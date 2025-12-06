const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { getArchivedTagId, getDb, persistDb, rowsFromExec, extractPhoneFromChatId } = require('../database/init');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true }
});

let waReady = false;

function isReady() {
  return waReady;
}

function getClient() {
  return client;
}

// Assign the Archived tag to a chat if not already assigned
function assignArchivedTagIfNeeded(archivedTagId, chatId, io) {
  try {
    const sqliteDb = getDb();
    const existing = rowsFromExec(sqliteDb.exec(`SELECT id FROM tag_assignments WHERE tag_id = ${archivedTagId} AND chat_id = "${String(chatId).replace(/"/g, '\\"')}"`));
    if (existing && existing.length > 0) {
      return;
    }
    
    const phoneNumber = extractPhoneFromChatId(chatId);
    sqliteDb.run('INSERT INTO tag_assignments (tag_id, chat_id, phone_number) VALUES (?, ?, ?)', [archivedTagId, chatId, phoneNumber]);
    persistDb();
    if (io) io.emit('tags_updated');
  } catch (err) {
    console.error('Failed to assign Archived tag', err);
  }
}

async function fetchChats(io) {
  if (!waReady) return [];
  const chats = await client.getChats();
  const results = [];
  const cutoff = Date.now() / 1000 - (24 * 60 * 60);
  
  const archivedTagId = getArchivedTagId();
  
  for (const chat of chats) {
    try {
      const unread = chat.unreadCount || 0;
      const msgs = await chat.fetchMessages({ limit: 3 });
      const history = [];
      
      for (const m of msgs) {
        const item = {
          id: m.id._serialized,
          from: m.author || m.from,
          body: m.body,
          timestamp: m.timestamp,
          fromMe: !!m.fromMe,
          hasMedia: !!m.hasMedia,
          mimetype: m.mimetype || null,
          filename: m.filename || null,
          isSticker: !!m.isSticker
        };
        
        if (item.hasMedia && item.isSticker) {
          try {
            const media = await m.downloadMedia();
            if (media && media.data) {
              item.media = {
                data: `data:${media.mimetype};base64,${media.data}`,
                mimetype: media.mimetype,
                filename: m.filename || null
              };
            }
          } catch (err) {
            console.error('downloadMedia (sticker) failed for message', m.id && m.id._serialized, err && err.message);
          }
        }
        history.push(item);
      }
      
      history.sort((a, b) => a.timestamp - b.timestamp);
      const lastTs = history.length ? history[history.length - 1].timestamp : 0;
      
      if (unread <= 0 && lastTs < cutoff) continue;
      
      const displayName = chat.name || null;
      results.push({
        chatId: chat.id._serialized,
        name: displayName,
        unreadCount: unread,
        history,
        lastTimestamp: lastTs
      });
      
      // Auto-assign Archived tag if chat is archived
      if (archivedTagId && chat.archived) {
        assignArchivedTagIfNeeded(archivedTagId, chat.id._serialized, io);
      }
    } catch (err) {
      // continue on errors
    }
  }
  
  results.sort((a, b) => {
    if ((b.unreadCount > 0) - (a.unreadCount > 0) !== 0) return (b.unreadCount > 0) - (a.unreadCount > 0);
    return b.lastTimestamp - a.lastTimestamp;
  });
  
  return results;
}

function initClient(io) {
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
    try {
      const list = await fetchChats(io);
      io.emit('chats', list);
    } catch (err) {
      console.error('Error loading chats', err);
    }
  });

  client.on('message', async msg => {
    if (!msg.body) return;
    try {
      const list = await fetchChats(io);
      io.emit('chats', list);
    } catch (err) {
      console.error('Error fetching unread on new message', err);
    }
  });

  // Initialize with retry
  async function initWithRetry(retries = 3, delayMs = 5000) {
    try {
      await client.initialize();
    } catch (err) {
      console.error('Client initialize failed:', err.message || err);
      if (retries > 0) {
        console.log(`Retrying initialize in ${delayMs}ms... (${retries} retries left)`);
        setTimeout(() => initWithRetry(retries - 1, delayMs), delayMs);
      } else {
        console.error('Failed to initialize WhatsApp client after retries.');
      }
    }
  }

  initWithRetry();
}

module.exports = {
  initClient,
  getClient,
  isReady,
  fetchChats,
  assignArchivedTagIfNeeded
};
