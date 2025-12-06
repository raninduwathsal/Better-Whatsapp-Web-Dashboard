const { getClient, isReady, fetchChats, assignArchivedTagIfNeeded } = require('../whatsapp/client');
const { getDb, persistDb, rowsFromExec, getArchivedTagId } = require('../database/init');

function initSocketHandlers(io) {
  io.on('connection', socket => {
    console.log('UI connected');

    socket.on('requestMessages', async () => {
      if (!isReady()) {
        socket.emit('not_ready');
        socket.emit('messages', []);
        return;
      }

      try {
        const client = getClient();
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
        
        messages.sort((a, b) => b.timestamp - a.timestamp);
        socket.emit('messages', messages.slice(0, 200));
      } catch (err) {
        console.error('requestMessages failed', err);
        socket.emit('messages', []);
      }
    });

    socket.on('sendPreset', async ({ chatId, text }) => {
      if (!chatId || !text) return;
      try {
        const client = getClient();
        await client.sendMessage(chatId, text);
        try {
          await client.sendSeen(chatId);
        } catch (e) {}

        try {
          const list = await fetchChats(io);
          io.emit('chats', list);
        } catch (e) {}
        
        socket.emit('sent', { chatId, text });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    socket.on('getFullChat', async (chatId) => {
      if (!isReady()) {
        socket.emit('full_chat', { chatId, messages: [] });
        return;
      }
      
      try {
        const client = getClient();
        let chatObj = null;
        
        try {
          chatObj = await client.getChatById(chatId);
        } catch (e) {}
        
        if (!chatObj) {
          const all = await client.getChats();
          chatObj = all.find(c => c.id && c.id._serialized === chatId);
        }
        
        if (!chatObj) {
          socket.emit('full_chat', { chatId, messages: [] });
          return;
        }
        
        const msgs = await chatObj.fetchMessages({ limit: 200 });
        const messages = [];
        
        for (const m of msgs) {
          const item = {
            id: m.id._serialized,
            from: m.author || m.from,
            body: m.body,
            timestamp: m.timestamp,
            fromMe: !!m.fromMe
          };
          
          if (m.hasMedia) {
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
              console.error('downloadMedia failed for message', m.id && m.id._serialized, err && err.message);
            }
          }
          messages.push(item);
        }
        
        messages.sort((a, b) => a.timestamp - b.timestamp);
        socket.emit('full_chat', { chatId, messages });
      } catch (err) {
        console.error('getFullChat failed', err);
        socket.emit('full_chat', { chatId, messages: [] });
      }
    });

    socket.on('archiveChat', async ({ chatId }) => {
      if (!isReady()) {
        socket.emit('archive_error', { chatId, error: 'WhatsApp not ready' });
        return;
      }
      if (!chatId) {
        socket.emit('archive_error', { chatId, error: 'chatId required' });
        return;
      }
      
      try {
        const client = getClient();
        let chatObj = null;
        
        try {
          chatObj = await client.getChatById(chatId);
        } catch (e) {}
        
        if (!chatObj) {
          const all = await client.getChats();
          chatObj = all.find(c => c.id && c.id._serialized === chatId);
        }
        
        if (!chatObj) {
          socket.emit('archive_error', { chatId, error: 'Chat not found' });
          return;
        }
        
        await chatObj.archive();
        
        const archivedTagId = getArchivedTagId();
        if (archivedTagId) {
          assignArchivedTagIfNeeded(archivedTagId, chatId, io);
        }
        
        socket.emit('archive_success', { chatId });
        
        try {
          const list = await fetchChats(io);
          io.emit('chats', list);
        } catch (e) {
          console.error('Failed to fetch chats after archiving', e);
        }
      } catch (err) {
        console.error('archiveChat failed', err);
        socket.emit('archive_error', { chatId, error: err.message || 'Failed to archive' });
      }
    });

    socket.on('unarchiveChat', async ({ chatId }) => {
      if (!isReady()) {
        socket.emit('unarchive_error', { chatId, error: 'WhatsApp not ready' });
        return;
      }
      if (!chatId) {
        socket.emit('unarchive_error', { chatId, error: 'chatId required' });
        return;
      }
      
      try {
        const client = getClient();
        let chatObj = null;
        
        try {
          chatObj = await client.getChatById(chatId);
        } catch (e) {}
        
        if (!chatObj) {
          const all = await client.getChats();
          chatObj = all.find(c => c.id && c.id._serialized === chatId);
        }
        
        if (!chatObj) {
          socket.emit('unarchive_error', { chatId, error: 'Chat not found' });
          return;
        }
        
        await chatObj.unarchive();
        
        const archivedTagId = getArchivedTagId();
        if (archivedTagId) {
          try {
            const sqliteDb = getDb();
            sqliteDb.run('DELETE FROM tag_assignments WHERE tag_id = ? AND chat_id = ?', [archivedTagId, chatId]);
            persistDb();
            io.emit('tags_updated');
          } catch (err) {
            console.error('Failed to remove Archived tag', err);
          }
        }
        
        socket.emit('unarchive_success', { chatId });
        
        try {
          const list = await fetchChats(io);
          io.emit('chats', list);
        } catch (e) {
          console.error('Failed to fetch chats after unarchiving', e);
        }
      } catch (err) {
        console.error('unarchiveChat failed', err);
        socket.emit('unarchive_error', { chatId, error: err.message || 'Failed to unarchive' });
      }
    });
  });
}

module.exports = { initSocketHandlers };
