const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true }
});

let waReady = false;

client.on('qr', async (qr) => {
  try {
    const dataUrl = await qrcode.toDataURL(qr);
    io.emit('qr', dataUrl);
  } catch (e) {
    console.error('QR generation error', e);
  }
});

client.on('ready', async () => {
  console.log('WhatsApp client ready');
  waReady = true;
  io.emit('ready');
  // Emit initial chats with history
  try {
    const list = await fetchChats();
    io.emit('chats', list);
  } catch (err) {
    console.error('Error loading chats', err);
  }
});

client.on('message', async msg => {
  if (!msg.body) return;
  try {
    // whenever a new message arrives, emit updated chats list
    const list = await fetchChats();
    io.emit('chats', list);
  } catch (err) {
    console.error('Error fetching unread on new message', err);
  }
});


io.on('connection', socket => {
  console.log('UI connected');

  socket.on('requestMessages', async () => {
    // Only allow fetching messages when WhatsApp client is ready
    if (!waReady) {
      socket.emit('not_ready');
      socket.emit('messages', []);
      return;
    }

    try {
      const chats = await client.getChats();
      const messages = [];
      for (const chat of chats) {
        try {
          const msgs = await chat.fetchMessages({ limit: 5 });
          for (const m of msgs) {
            if (!m.body) continue;
            messages.push({
              id: m.id._serialized,
              chatId: m.from || chat.id._serialized,
              from: m.author || m.from || chat.name || chat.id.user,
              body: m.body,
              timestamp: m.timestamp
            });
          }
        } catch (err) {}
      }
      messages.sort((a,b)=>b.timestamp - a.timestamp);
      socket.emit('messages', messages.slice(0,200));
    } catch (err) {
      console.error('requestMessages failed', err);
      socket.emit('messages', []);
    }
  });

  socket.on('sendPreset', async ({ chatId, text }) => {
    if (!chatId || !text) return;
    try {
      await client.sendMessage(chatId, text);
      // mark chat as seen/read if possible (remove unread highlight)
      try { await client.sendSeen(chatId); } catch (e) {}

      // emit updated chats so UI can update (we don't hide chats after reply)
      try {
        const list = await fetchChats();
        io.emit('chats', list);
      } catch (e) {}
      socket.emit('sent', { chatId, text });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('getFullChat', async (chatId) => {
    if (!waReady) { socket.emit('full_chat', { chatId, messages: [] }); return; }
    try {
      // try to get the chat and fetch a larger history
      let chatObj = null;
      try { chatObj = await client.getChatById(chatId); } catch(e) { /* fallback */ }
      if (!chatObj) {
        const all = await client.getChats();
        chatObj = all.find(c=>c.id && c.id._serialized === chatId);
      }
      if (!chatObj) { socket.emit('full_chat', { chatId, messages: [] }); return; }
      const msgs = await chatObj.fetchMessages({ limit: 200 });
      const messages = [];
      for (const m of msgs) {
        const item = { id: m.id._serialized, from: m.author || m.from, body: m.body, timestamp: m.timestamp, fromMe: !!m.fromMe };
        if (m.hasMedia) {
          try {
            const media = await m.downloadMedia();
            if (media && media.data) {
              item.media = { data: `data:${media.mimetype};base64,${media.data}`, mimetype: media.mimetype, filename: m.filename || null };
            }
          } catch (err) {
            console.error('downloadMedia failed for message', m.id && m.id._serialized, err && err.message);
          }
        }
        messages.push(item);
      }
      // sort oldest -> newest
      messages.sort((a,b)=>a.timestamp - b.timestamp);
      socket.emit('full_chat', { chatId, messages });
    } catch (err) {
      console.error('getFullChat failed', err);
      socket.emit('full_chat', { chatId, messages: [] });
    }
  });
});
async function fetchChats(){
  if (!waReady) return [];
  const chats = await client.getChats();
  const results = [];
  const cutoff = Date.now()/1000 - (24*60*60); // last 24 hours
  for (const chat of chats){
    try {
      const unread = chat.unreadCount || 0;

      // get last 3 messages and sort oldest -> newest for display
      const msgs = await chat.fetchMessages({ limit: 3 });
      const history = [];
      for (const m of msgs) {
        const item = { id: m.id._serialized, from: m.author || m.from, body: m.body, timestamp: m.timestamp, fromMe: !!m.fromMe, hasMedia: !!m.hasMedia, mimetype: m.mimetype || null, filename: m.filename || null, isSticker: !!m.isSticker };
        // For small stickers include the media in the summary so UI can render it in the compact card
        if (item.hasMedia && item.isSticker) {
          try {
            const media = await m.downloadMedia();
            if (media && media.data) {
              item.media = { data: `data:${media.mimetype};base64,${media.data}`, mimetype: media.mimetype, filename: m.filename || null };
            }
          } catch (err) {
            console.error('downloadMedia (sticker) failed for message', m.id && m.id._serialized, err && err.message);
          }
        }
        history.push(item);
      }
      history.sort((a,b)=> a.timestamp - b.timestamp);

      const lastTs = history.length ? history[history.length-1].timestamp : 0;
      // only include if unread or recent activity (last 24h)
      if (unread <= 0 && lastTs < cutoff) continue;

      // keep only chat name (if any) — do not derive or expose phone numbers/ids
      const displayName = chat.name || null;
      results.push({ chatId: chat.id._serialized, name: displayName, unreadCount: unread, history, lastTimestamp: lastTs });
    } catch (err) {
      // continue on errors
    }
  }
  // sort: pinned handling is client-side; here sort by unread first then recent
  results.sort((a,b)=>{
    if ((b.unreadCount>0) - (a.unreadCount>0) !== 0) return (b.unreadCount>0) - (a.unreadCount>0);
    return b.lastTimestamp - a.lastTimestamp;
  });
  return results;
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Server listening on port', PORT));

// --- SQLite quick replies persistence using sql.js (WASM) ---
const initSqlJs = require('sql.js');
let SQL; // sql.js namespace
let sqliteDb = null;
const SQLITE_FILE = path.join(__dirname, 'data.sqlite');
let dbReady = false;

function persistDb(){
  try {
    const data = sqliteDb.export(); // Uint8Array
    fs.writeFileSync(SQLITE_FILE, Buffer.from(data));
  } catch (err) {
    console.error('Failed to persist sqlite DB', err);
  }
}

function rowsFromExec(execResult){
  if (!execResult || execResult.length === 0) return [];
  const r = execResult[0];
  const cols = r.columns;
  return r.values.map(vals=>{
    const obj = {};
    for (let i=0;i<cols.length;i++) obj[cols[i]] = vals[i];
    return obj;
  });
}

async function initSqlite(){
  try {
    SQL = await initSqlJs();
  } catch (err) {
    console.error('initSqlJs failed', err);
    throw err;
  }
  if (fs.existsSync(SQLITE_FILE)){
    const buf = fs.readFileSync(SQLITE_FILE);
    sqliteDb = new SQL.Database(new Uint8Array(buf));
  } else {
    sqliteDb = new SQL.Database();
  }
  // ensure table exists
  sqliteDb.run("CREATE TABLE IF NOT EXISTS quick_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);");
  // persist initial state
  persistDb();
  dbReady = true;
}

app.get('/api/quick-replies', (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'db not ready' });
  try {
    const rows = rowsFromExec(sqliteDb.exec('SELECT id, text, created_at FROM quick_replies ORDER BY id'));
    res.json(rows);
  } catch (err) {
    console.error('GET /api/quick-replies error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Export quick replies (same as GET but separate route)
app.get('/api/quick-replies/export', (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'db not ready' });
  try {
    const rows = rowsFromExec(sqliteDb.exec('SELECT id, text, created_at FROM quick_replies ORDER BY id'));
    res.json(rows);
  } catch (err) {
    console.error('GET /api/quick-replies/export error', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.post('/api/quick-replies', (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'db not ready' });
  const { text } = req.body || {};
  if (!text || String(text).trim() === '') return res.status(400).json({ error: 'text required' });
  try {
    const stmt = sqliteDb.prepare('INSERT INTO quick_replies (text) VALUES (?)');
    stmt.run([text]);
    stmt.free && stmt.free();
    const last = rowsFromExec(sqliteDb.exec('SELECT last_insert_rowid() AS id'))[0];
    const row = rowsFromExec(sqliteDb.exec(`SELECT id, text, created_at FROM quick_replies WHERE id = ${last.id}`))[0];
    persistDb();
    io.emit('quick_replies_updated');
    res.status(201).json(row || {});
  } catch (err) {
    console.error('POST /api/quick-replies error', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.put('/api/quick-replies/:id', (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'db not ready' });
  const id = Number(req.params.id);
  const { text } = req.body || {};
  if (!id || !text || String(text).trim() === '') return res.status(400).json({ error: 'id and text required' });
  try {
    sqliteDb.run('UPDATE quick_replies SET text = ? WHERE id = ?', [text, id]);
    const row = rowsFromExec(sqliteDb.exec(`SELECT id, text, created_at FROM quick_replies WHERE id = ${id}`))[0];
    if (!row) return res.status(404).json({ error: 'not found' });
    persistDb();
    io.emit('quick_replies_updated');
    res.json(row);
  } catch (err) {
    console.error('PUT /api/quick-replies error', err);
    res.status(500).json({ error: 'internal' });
  }
});

app.delete('/api/quick-replies/:id', (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'db not ready' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    const existing = rowsFromExec(sqliteDb.exec(`SELECT id FROM quick_replies WHERE id = ${id}`))[0];
    if (!existing) return res.status(404).json({ error: 'not found' });
    sqliteDb.run('DELETE FROM quick_replies WHERE id = ?', [id]);
    persistDb();
    io.emit('quick_replies_updated');
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/quick-replies error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// Import quick replies
// Body: { items: [{ text: '...' }], replace: boolean }
app.post('/api/quick-replies/import', (req, res) => {
  if (!dbReady) return res.status(503).json({ error: 'db not ready' });
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const replace = !!body.replace;
  if (!items.length) return res.status(400).json({ error: 'items required' });
  try {
    if (replace) {
      sqliteDb.run('DELETE FROM quick_replies');
    }
    const insertStmt = sqliteDb.prepare && sqliteDb.prepare('INSERT INTO quick_replies (text) VALUES (?)');
    // If prepare isn't available (older sql.js), use run directly
    for (const it of items) {
      const text = (it && it.text) ? String(it.text) : '';
      if (!text) continue;
      if (insertStmt && insertStmt.run) insertStmt.run([text]); else sqliteDb.run('INSERT INTO quick_replies (text) VALUES ("' + text.replace(/"/g, '\\"') + '")');
    }
    if (insertStmt && insertStmt.free) insertStmt.free();
    persistDb();
    io.emit('quick_replies_updated');
    const rows = rowsFromExec(sqliteDb.exec('SELECT id, text, created_at FROM quick_replies ORDER BY id'));
    res.json({ ok: true, count: rows.length, rows });
  } catch (err) {
    console.error('POST /api/quick-replies/import error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// initialize sql.js DB
initSqlite().catch(err=>{ console.error('Failed to initialize sql.js DB', err); });

// initialize client with simple retry to help transient network issues
async function initClient(retries = 3, delayMs = 5000) {
  try {
    await client.initialize();
  } catch (err) {
    console.error('Client initialize failed:', err.message || err);
    if (retries > 0) {
      console.log(`Retrying initialize in ${delayMs}ms... (${retries} retries left)`);
      setTimeout(() => initClient(retries - 1, delayMs), delayMs);
    } else {
      console.error('Failed to initialize WhatsApp client after retries.');
    }
  }
}

initClient();

process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
