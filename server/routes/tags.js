const express = require('express');
const router = express.Router();
const { getDb, isDbReady, persistDb, rowsFromExec, extractPhoneFromChatId, normalizePhone, getArchivedTagId } = require('../database/init');
const { getClient, isReady: isWAReady } = require('../whatsapp/client');

// GET /api/tags
router.get('/', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  try {
    const sqliteDb = getDb();
    const rows = rowsFromExec(sqliteDb.exec('SELECT id, name, color, is_system, created_at FROM tags ORDER BY id'));
    res.json(rows);
  } catch (err) {
    console.error('GET /api/tags error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /api/tags
router.post('/', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const { name, color } = req.body || {};
  if (!name || !color) return res.status(400).json({ error: 'name and color required' });
  
  try {
    const sqliteDb = getDb();
    const stmt = sqliteDb.prepare && sqliteDb.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
    if (stmt && stmt.run) stmt.run([name, color]); 
    else sqliteDb.run(`INSERT INTO tags (name, color) VALUES ("${name.replace(/"/g, '\\"')}", "${color}")`);
    stmt && stmt.free && stmt.free();
    
    persistDb();
    req.app.get('io').emit('tags_updated');
    
    const rows = rowsFromExec(sqliteDb.exec('SELECT id, name, color, created_at FROM tags ORDER BY id'));
    res.status(201).json(rows[rows.length - 1]);
  } catch (err) {
    console.error('POST /api/tags error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// PUT /api/tags/:id
router.put('/:id', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const id = Number(req.params.id);
  const { name, color } = req.body || {};
  if (!id || !name || !color) return res.status(400).json({ error: 'id,name,color required' });
  
  try {
    const sqliteDb = getDb();
    const tag = rowsFromExec(sqliteDb.exec(`SELECT id, is_system FROM tags WHERE id = ${id}`))[0];
    if (!tag) return res.status(404).json({ error: 'not found' });
    if (tag.is_system) return res.status(403).json({ error: 'Cannot edit system tag' });
    
    sqliteDb.run('UPDATE tags SET name = ?, color = ? WHERE id = ?', [name, color, id]);
    persistDb();
    req.app.get('io').emit('tags_updated');
    
    const row = rowsFromExec(sqliteDb.exec(`SELECT id, name, color, created_at FROM tags WHERE id = ${id}`))[0];
    res.json(row);
  } catch (err) {
    console.error('PUT /api/tags error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// DELETE /api/tags/:id
router.delete('/:id', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id required' });
  
  try {
    const sqliteDb = getDb();
    const tag = rowsFromExec(sqliteDb.exec(`SELECT id, is_system FROM tags WHERE id = ${id}`))[0];
    if (!tag) return res.status(404).json({ error: 'not found' });
    if (tag.is_system) return res.status(403).json({ error: 'Cannot delete system tag' });
    
    sqliteDb.run('DELETE FROM tag_assignments WHERE tag_id = ?', [id]);
    sqliteDb.run('DELETE FROM tags WHERE id = ?', [id]);
    persistDb();
    req.app.get('io').emit('tags_updated');
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tags error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET /api/tags/:id/count
router.get('/:id/count', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id required' });
  
  try {
    const sqliteDb = getDb();
    const result = rowsFromExec(sqliteDb.exec(`SELECT COUNT(*) as count FROM tag_assignments WHERE tag_id = ${id}`));
    const count = result && result[0] ? result[0].count : 0;
    res.json({ tagId: id, count });
  } catch (err) {
    console.error('GET /api/tags/:id/count error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /api/tags/assign
router.post('/assign', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const { tagId, chatId } = req.body || {};
  if (!tagId || !chatId) return res.status(400).json({ error: 'tagId and chatId required' });
  
  try {
    const sqliteDb = getDb();
    const existing = rowsFromExec(sqliteDb.exec(`SELECT id FROM tag_assignments WHERE tag_id = ${tagId} AND chat_id = "${String(chatId).replace(/"/g, '\\"')}"`));
    if (existing && existing.length > 0) {
      res.json({ ok: true, existing: true });
      return;
    }
    
    const phoneNumber = extractPhoneFromChatId(chatId);
    sqliteDb.run('INSERT INTO tag_assignments (tag_id, chat_id, phone_number) VALUES (?, ?, ?)', [tagId, chatId, phoneNumber]);
    persistDb();
    req.app.get('io').emit('tags_updated');
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/tags/assign error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /api/tags/unassign
router.post('/unassign', async (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const { tagId, chatId } = req.body || {};
  if (!tagId || !chatId) return res.status(400).json({ error: 'tagId and chatId required' });
  
  try {
    const sqliteDb = getDb();
    const archivedTagId = getArchivedTagId();
    
    if (archivedTagId && Number(tagId) === Number(archivedTagId) && isWAReady()) {
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
        
        if (chatObj && chatObj.archived) {
          await chatObj.unarchive();
        }
      } catch (err) {
        console.error('Failed to unarchive chat when removing Archived tag', err);
      }
    }
    
    sqliteDb.run('DELETE FROM tag_assignments WHERE tag_id = ? AND chat_id = ?', [tagId, chatId]);
    persistDb();
    req.app.get('io').emit('tags_updated');
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/tags/unassign error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET /api/tags/export
router.get('/export', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  try {
    const sqliteDb = getDb();
    const tags = rowsFromExec(sqliteDb.exec('SELECT id, name, color, is_system FROM tags ORDER BY id'));
    const assigns = rowsFromExec(sqliteDb.exec('SELECT tag_id, chat_id, phone_number FROM tag_assignments'));
    res.json({ tags, assignments: assigns });
  } catch (err) {
    console.error('GET /api/tags/export error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /api/tags/import
router.post('/import', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const body = req.body || {};
  const tags = Array.isArray(body.tags) ? body.tags : [];
  const assigns = Array.isArray(body.assignments) ? body.assignments : [];
  const replace = !!body.replace;
  
  if (!tags.length) return res.status(400).json({ error: 'tags required' });
  
  try {
    const sqliteDb = getDb();
    const idMap = {};
    const nameMap = {};
    
    if (replace) {
      sqliteDb.run('DELETE FROM tag_assignments');
      sqliteDb.run('DELETE FROM tags');
    }
    
    const insert = sqliteDb.prepare && sqliteDb.prepare('INSERT INTO tags (name, color) VALUES (?, ?)');
    for (const t of tags) {
      const name = (t && (t.name || t.text)) ? String(t.name || t.text) : '';
      const color = (t && t.color) ? String(t.color) : '#AAAAAA';
      if (!name) continue;
      
      if (insert && insert.run) insert.run([name, color]); 
      else sqliteDb.run('INSERT INTO tags (name, color) VALUES ("' + name.replace(/"/g, '\\"') + '","' + color + '")');
      
      const last = rowsFromExec(sqliteDb.exec('SELECT last_insert_rowid() AS id'))[0];
      const newId = last && last.id ? last.id : null;
      const oldId = t && (t.id || t.tag_id || t.tagId || null);
      
      if (oldId != null && newId != null) idMap[String(oldId)] = newId;
      if (newId != null) nameMap[String(name)] = newId;
    }
    insert && insert.free && insert.free();
    
    let assignmentsImported = 0;
    let assignmentsSkipped = 0;
    let assignmentsFailed = 0;
    
    if (assigns && assigns.length) {
      for (const a of assigns) {
        const incomingTid = a.tag_id != null ? a.tag_id : (a.tagId != null ? a.tagId : null);
        const incomingTagName = a.tag_name || a.tag || null;
        const incomingChat = a.chat_id || a.chatId || a.chat || null;
        const incomingPhone = a.phone_number || a.phoneNumber || a.phone || null;
        
        let mappedTid = null;
        if (incomingTid != null && idMap.hasOwnProperty(String(incomingTid))) mappedTid = idMap[String(incomingTid)];
        else if (incomingTagName && nameMap.hasOwnProperty(String(incomingTagName))) mappedTid = nameMap[String(incomingTagName)];
        else if (incomingTid != null) mappedTid = incomingTid;
        
        if (!mappedTid) {
          assignmentsFailed++;
          continue;
        }
        
        let chatId = null;
        let phoneNumber = null;
        
        if (incomingChat) {
          chatId = String(incomingChat);
          if (chatId.indexOf('@') === -1) {
            const normalized = chatId.replace(/[^0-9+]/g, '');
            if (normalized.length > 0) chatId = normalized + '@c.us';
          }
          phoneNumber = extractPhoneFromChatId(chatId);
        } else if (incomingPhone) {
          phoneNumber = normalizePhone(incomingPhone);
          const existing = rowsFromExec(sqliteDb.exec(`SELECT chat_id FROM tag_assignments WHERE phone_number = "${phoneNumber}" LIMIT 1`));
          if (existing && existing.length > 0) {
            chatId = existing[0].chat_id;
          } else {
            chatId = phoneNumber + '@c.us';
          }
        }
        
        if (!chatId) {
          assignmentsFailed++;
          continue;
        }
        
        const existingAssign = rowsFromExec(sqliteDb.exec(`SELECT id FROM tag_assignments WHERE tag_id = ${mappedTid} AND chat_id = "${String(chatId).replace(/"/g, '\\"')}"`));
        if (existingAssign && existingAssign.length > 0) {
          assignmentsSkipped++;
          continue;
        }
        
        sqliteDb.run('INSERT INTO tag_assignments (tag_id, chat_id, phone_number) VALUES (?, ?, ?)', [mappedTid, chatId, phoneNumber]);
        assignmentsImported++;
      }
    }
    
    persistDb();
    req.app.get('io').emit('tags_updated');
    res.json({
      ok: true,
      imported: tags.length,
      assignments: {
        total: assigns.length,
        imported: assignmentsImported,
        skipped: assignmentsSkipped,
        failed: assignmentsFailed
      }
    });
  } catch (err) {
    console.error('POST /api/tags/import error', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
