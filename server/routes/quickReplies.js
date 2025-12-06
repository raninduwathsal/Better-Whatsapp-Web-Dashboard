const express = require('express');
const router = express.Router();
const { getDb, isDbReady, persistDb, rowsFromExec } = require('../database/init');

// GET /api/quick-replies
router.get('/', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  try {
    const sqliteDb = getDb();
    const rows = rowsFromExec(sqliteDb.exec('SELECT id, text, created_at FROM quick_replies ORDER BY id'));
    res.json(rows);
  } catch (err) {
    console.error('GET /api/quick-replies error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /api/quick-replies
router.post('/', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const { text } = req.body || {};
  if (!text || String(text).trim() === '') return res.status(400).json({ error: 'text required' });
  
  try {
    const sqliteDb = getDb();
    const stmt = sqliteDb.prepare('INSERT INTO quick_replies (text) VALUES (?)');
    stmt.run([text]);
    stmt.free && stmt.free();
    
    const last = rowsFromExec(sqliteDb.exec('SELECT last_insert_rowid() AS id'))[0];
    const row = rowsFromExec(sqliteDb.exec(`SELECT id, text, created_at FROM quick_replies WHERE id = ${last.id}`))[0];
    
    persistDb();
    req.app.get('io').emit('quick_replies_updated');
    res.status(201).json(row || {});
  } catch (err) {
    console.error('POST /api/quick-replies error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// PUT /api/quick-replies/:id
router.put('/:id', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const id = Number(req.params.id);
  const { text } = req.body || {};
  if (!id || !text || String(text).trim() === '') return res.status(400).json({ error: 'id and text required' });
  
  try {
    const sqliteDb = getDb();
    sqliteDb.run('UPDATE quick_replies SET text = ? WHERE id = ?', [text, id]);
    const row = rowsFromExec(sqliteDb.exec(`SELECT id, text, created_at FROM quick_replies WHERE id = ${id}`))[0];
    
    if (!row) return res.status(404).json({ error: 'not found' });
    
    persistDb();
    req.app.get('io').emit('quick_replies_updated');
    res.json(row);
  } catch (err) {
    console.error('PUT /api/quick-replies error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// DELETE /api/quick-replies/:id
router.delete('/:id', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'id required' });
  
  try {
    const sqliteDb = getDb();
    const existing = rowsFromExec(sqliteDb.exec(`SELECT id FROM quick_replies WHERE id = ${id}`))[0];
    if (!existing) return res.status(404).json({ error: 'not found' });
    
    sqliteDb.run('DELETE FROM quick_replies WHERE id = ?', [id]);
    persistDb();
    req.app.get('io').emit('quick_replies_updated');
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/quick-replies error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// GET /api/quick-replies/export
router.get('/export', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  try {
    const sqliteDb = getDb();
    const rows = rowsFromExec(sqliteDb.exec('SELECT id, text, created_at FROM quick_replies ORDER BY id'));
    res.json(rows);
  } catch (err) {
    console.error('GET /api/quick-replies/export error', err);
    res.status(500).json({ error: 'internal' });
  }
});

// POST /api/quick-replies/import
router.post('/import', (req, res) => {
  if (!isDbReady()) return res.status(503).json({ error: 'db not ready' });
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : [];
  const replace = !!body.replace;
  
  if (!items.length) return res.status(400).json({ error: 'items required' });
  
  try {
    const sqliteDb = getDb();
    
    if (replace) {
      sqliteDb.run('DELETE FROM quick_replies');
    }
    
    const insertStmt = sqliteDb.prepare && sqliteDb.prepare('INSERT INTO quick_replies (text) VALUES (?)');
    
    for (const it of items) {
      const text = (it && it.text) ? String(it.text) : '';
      if (!text) continue;
      
      if (insertStmt && insertStmt.run) {
        insertStmt.run([text]);
      } else {
        sqliteDb.run('INSERT INTO quick_replies (text) VALUES ("' + text.replace(/"/g, '\\"') + '")');
      }
    }
    
    if (insertStmt && insertStmt.free) insertStmt.free();
    persistDb();
    req.app.get('io').emit('quick_replies_updated');
    
    const rows = rowsFromExec(sqliteDb.exec('SELECT id, text, created_at FROM quick_replies ORDER BY id'));
    res.json({ ok: true, count: rows.length, rows });
  } catch (err) {
    console.error('POST /api/quick-replies/import error', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
