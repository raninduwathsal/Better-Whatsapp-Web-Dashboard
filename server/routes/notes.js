const express = require('express');
const router = express.Router();
const { getDb, isDbReady, persistDb, rowsFromExec, extractPhoneFromChatId, normalizePhone } = require('../database/init');

// GET /api/notes?chatId=...
router.get('/', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const chatId = req.query.chatId;
  if (!chatId) return res.status(400).json({ error: 'chatId required' });
  
  try {
    const sqliteDb = getDb();
    const rows = rowsFromExec(sqliteDb.exec(`SELECT id, chat_id as chatId, phone_number as phoneNumber, text, created_at as createdAt, updated_at as updatedAt FROM notes WHERE chat_id = "${String(chatId).replace(/"/g, '\\"')}" ORDER BY id DESC`));
    res.json(rows);
  } catch (err) {
    console.error('GET /api/notes error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /api/notes
router.post('/', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const { chatId, text } = req.body || {};
  if (!chatId || !text || String(text).trim() === '') return res.status(400).json({ error: 'chatId and text required' });
  
  try {
    const sqliteDb = getDb();
    const phoneNumber = extractPhoneFromChatId(chatId);
    const stmt = sqliteDb.prepare && sqliteDb.prepare('INSERT INTO notes (chat_id, phone_number, text) VALUES (?, ?, ?)');
    
    if (stmt && stmt.run) stmt.run([chatId, phoneNumber, text]); 
    else sqliteDb.run('INSERT INTO notes (chat_id, phone_number, text) VALUES ("' + String(chatId).replace(/"/g, '\\"') + '", "' + (phoneNumber || '') + '", "' + String(text).replace(/"/g, '\\"') + '")');
    
    stmt && stmt.free && stmt.free();
    
    const last = rowsFromExec(sqliteDb.exec('SELECT last_insert_rowid() AS id'))[0];
    const row = rowsFromExec(sqliteDb.exec(`SELECT id, chat_id as chatId, phone_number as phoneNumber, text, created_at as createdAt, updated_at as updatedAt FROM notes WHERE id = ${last.id}`))[0];
    
    persistDb();
    req.app.get('io').emit('notes_updated', { chatId });
    res.status(201).json(row || {});
  } catch (err) {
    console.error('POST /api/notes error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// PUT /api/notes/:id
router.put('/:id', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const id = Number(req.params.id);
  const { text } = req.body || {};
  if (!id || !text || String(text).trim() === '') return res.status(400).json({ error: 'id and text required' });
  
  try {
    const sqliteDb = getDb();
    sqliteDb.run('UPDATE notes SET text = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [text, id]);
    const row = rowsFromExec(sqliteDb.exec(`SELECT id, chat_id as chatId, phone_number as phoneNumber, text, created_at as createdAt, updated_at as updatedAt FROM notes WHERE id = ${id}`))[0];
    
    if (!row) return res.status(404).json({ error: 'not found' });
    
    persistDb();
    req.app.get('io').emit('notes_updated', { chatId: row.chatId });
    res.json(row);
  } catch (err) {
    console.error('PUT /api/notes error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id required' });
  
  try {
    const sqliteDb = getDb();
    const row = rowsFromExec(sqliteDb.exec(`SELECT id, chat_id as chatId FROM notes WHERE id = ${id}`))[0];
    if (!row) return res.status(404).json({ error: 'not found' });
    
    sqliteDb.run('DELETE FROM notes WHERE id = ?', [id]);
    persistDb();
    req.app.get('io').emit('notes_updated', { chatId: row.chatId });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/notes error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET /api/notes/counts
router.get('/counts', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  try {
    const sqliteDb = getDb();
    const rows = rowsFromExec(sqliteDb.exec('SELECT chat_id as chatId, COUNT(*) as count FROM notes GROUP BY chat_id'));
    res.json(rows);
  } catch (err) {
    console.error('GET /api/notes/counts error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET /api/notes/export
router.get('/export', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  try {
    const sqliteDb = getDb();
    const chatId = req.query.chatId;
    let rows;
    
    if (chatId) {
      rows = rowsFromExec(sqliteDb.exec(`SELECT id, chat_id as chatId, phone_number as phoneNumber, text, created_at as createdAt, updated_at as updatedAt FROM notes WHERE chat_id = "${String(chatId).replace(/"/g, '\\"')}" ORDER BY id`));
    } else {
      rows = rowsFromExec(sqliteDb.exec('SELECT id, chat_id as chatId, phone_number as phoneNumber, text, created_at as createdAt, updated_at as updatedAt FROM notes ORDER BY id'));
    }
    
    res.json(rows);
  } catch (err) {
    console.error('GET /api/notes/export error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /api/notes/import
router.post('/import', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const body = req.body || {};
  const notes = Array.isArray(body.notes) ? body.notes : [];
  const replace = !!body.replace;
  
  if (!notes.length) return res.status(400).json({ error: 'notes required' });
  
  try {
    const sqliteDb = getDb();
    
    if (replace) {
      sqliteDb.run('DELETE FROM notes');
    }
    
    const insertStmt = sqliteDb.prepare && sqliteDb.prepare('INSERT INTO notes (chat_id, phone_number, text, created_at) VALUES (?, ?, ?, ?)');
    let imported = 0;
    let failed = 0;
    let skipped = 0;
    
    for (const it of notes) {
      const incomingChat = it.chatId || it.chat_id || it.chat || null;
      const incomingPhoneRaw = it.phoneNumber || it.phone_number || it.phone || null;
      const text = it.text || '';
      const createdAt = it.createdAt || it.created_at || null;
      
      if (!text) {
        failed++;
        continue;
      }
      
      let phoneNumber = null;
      if (incomingPhoneRaw) phoneNumber = normalizePhone(incomingPhoneRaw);
      
      let chatId = null;
      if (incomingChat) {
        chatId = String(incomingChat);
      } else if (phoneNumber) {
        const t1 = rowsFromExec(sqliteDb.exec(`SELECT chat_id FROM tag_assignments WHERE phone_number = "${phoneNumber}" LIMIT 1`));
        if (t1 && t1.length > 0 && t1[0].chat_id) chatId = t1[0].chat_id;
        
        if (!chatId) {
          const t2 = rowsFromExec(sqliteDb.exec(`SELECT chat_id FROM notes WHERE phone_number = "${phoneNumber}" LIMIT 1`));
          if (t2 && t2.length > 0 && t2[0].chat_id) chatId = t2[0].chat_id;
        }
        
        if (!chatId) chatId = (phoneNumber.indexOf('@') === -1) ? (phoneNumber + '@c.us') : phoneNumber;
      } else {
        failed++;
        continue;
      }
      
      try {
        const escChat = String(chatId).replace(/"/g, '\\"');
        const escText = String(text).replace(/"/g, '\\"');
        const exists = rowsFromExec(sqliteDb.exec(`SELECT id FROM notes WHERE chat_id = "${escChat}" AND text = "${escText}" LIMIT 1`));
        
        if (exists && exists.length > 0) {
          skipped++;
          continue;
        }
        
        if (insertStmt && insertStmt.run) {
          insertStmt.run([chatId, phoneNumber, text, createdAt]);
        } else {
          const escPhone = String(phoneNumber || '').replace(/"/g, '\\"');
          sqliteDb.run(`INSERT INTO notes (chat_id, phone_number, text, created_at) VALUES ("${escChat}", "${escPhone}", "${escText}", ${createdAt ? '"' + String(createdAt).replace(/"/g, '\\"') + '"' : 'CURRENT_TIMESTAMP'})`);
        }
        imported++;
      } catch (err) {
        failed++;
      }
    }
    
    if (insertStmt && insertStmt.free) insertStmt.free();
    persistDb();
    req.app.get('io').emit('notes_updated', {});
    res.json({ ok: true, imported, skipped, failed, total: notes.length });
  } catch (err) {
    console.error('POST /api/notes/import error', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
