const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const qrcode = require('qrcode');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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
      const messages = msgs.map(m=>({ id: m.id._serialized, from: m.author || m.from, body: m.body, timestamp: m.timestamp, fromMe: !!m.fromMe }));
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
      const history = msgs
        .map(m=>({ id: m.id._serialized, from: m.author || m.from, body: m.body, timestamp: m.timestamp, fromMe: !!m.fromMe }))
        .sort((a,b)=> a.timestamp - b.timestamp);

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
