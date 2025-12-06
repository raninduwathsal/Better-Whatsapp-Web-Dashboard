const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

let SQL;
let sqliteDb = null;
const SQLITE_FILE = path.join(__dirname, '../../data.sqlite');
let dbReady = false;

function persistDb() {
  try {
    const data = sqliteDb.export();
    fs.writeFileSync(SQLITE_FILE, Buffer.from(data));
  } catch (err) {
    console.error('Failed to persist sqlite DB', err);
  }
}

function rowsFromExec(execResult) {
  if (!execResult || execResult.length === 0) return [];
  const r = execResult[0];
  const cols = r.columns;
  return r.values.map(vals => {
    const obj = {};
    for (let i = 0; i < cols.length; i++) obj[cols[i]] = vals[i];
    return obj;
  });
}

// Helper: extract normalized phone number from WhatsApp chat_id
function extractPhoneFromChatId(chatId) {
  if (!chatId) return null;
  const str = String(chatId);
  if (str.includes('@g.us') || str.includes('@broadcast') || str.includes('@newsletter')) return null;
  const parts = str.split('@');
  if (parts.length === 0) return null;
  const phone = parts[0];
  if (phone.includes('-')) return null;
  return normalizePhone(phone);
}

// Helper: normalize phone number to unified format
function normalizePhone(phone) {
  if (!phone) return null;
  const str = String(phone).trim();
  const hasPlus = str.startsWith('+');
  const digits = str.replace(/[^0-9]/g, '');
  if (!digits) return null;
  return hasPlus ? '+' + digits : digits;
}

// Ensure the permanent "Archived" system tag exists
function ensureArchivedTag() {
  try {
    const existing = rowsFromExec(sqliteDb.exec("SELECT id FROM tags WHERE name = 'Archived' AND is_system = 1 LIMIT 1"));
    if (!existing || existing.length === 0) {
      console.log('Creating permanent "Archived" system tag...');
      sqliteDb.run("INSERT INTO tags (name, color, is_system) VALUES ('Archived', '#808080', 1)");
      console.log('"Archived" tag created');
    }
  } catch (err) {
    console.error('Failed to ensure Archived tag', err);
  }
}

// Get the ID of the Archived system tag
function getArchivedTagId() {
  try {
    const result = rowsFromExec(sqliteDb.exec("SELECT id FROM tags WHERE name = 'Archived' AND is_system = 1 LIMIT 1"));
    return (result && result.length > 0) ? result[0].id : null;
  } catch (err) {
    console.error('Failed to get Archived tag ID', err);
    return null;
  }
}

async function initSqlite() {
  try {
    SQL = await initSqlJs();
  } catch (err) {
    console.error('initSqlJs failed', err);
    throw err;
  }
  
  if (fs.existsSync(SQLITE_FILE)) {
    const buf = fs.readFileSync(SQLITE_FILE);
    sqliteDb = new SQL.Database(new Uint8Array(buf));
  } else {
    sqliteDb = new SQL.Database();
  }
  
  // Create tables
  sqliteDb.run("CREATE TABLE IF NOT EXISTS quick_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);");
  sqliteDb.run("CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, color TEXT NOT NULL, is_system INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);");
  sqliteDb.run("CREATE TABLE IF NOT EXISTS tag_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, tag_id INTEGER NOT NULL, chat_id TEXT NOT NULL, phone_number TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);");
  sqliteDb.run("CREATE TABLE IF NOT EXISTS notes (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id TEXT NOT NULL, phone_number TEXT, text TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME);");
  
  // Migration: add phone_number column to tag_assignments if needed
  try {
    sqliteDb.exec("SELECT phone_number FROM tag_assignments LIMIT 1");
  } catch (err) {
    if (err.message && err.message.includes('no such column')) {
      console.log('Migrating tag_assignments table: adding phone_number column...');
      sqliteDb.run("ALTER TABLE tag_assignments ADD COLUMN phone_number TEXT");
      const existingAssigns = rowsFromExec(sqliteDb.exec("SELECT id, chat_id FROM tag_assignments"));
      for (const a of existingAssigns) {
        const phone = extractPhoneFromChatId(a.chat_id);
        if (phone) {
          sqliteDb.run(`UPDATE tag_assignments SET phone_number = "${phone}" WHERE id = ${a.id}`);
        }
      }
      console.log(`Migration complete: backfilled ${existingAssigns.length} assignments with phone numbers`);
    }
  }
  
  // Migration: add is_system column to tags if needed
  try {
    sqliteDb.exec("SELECT is_system FROM tags LIMIT 1");
  } catch (err) {
    if (err.message && err.message.includes('no such column')) {
      console.log('Migrating tags table: adding is_system column...');
      sqliteDb.run("ALTER TABLE tags ADD COLUMN is_system INTEGER DEFAULT 0");
    }
  }
  
  ensureArchivedTag();
  persistDb();
  dbReady = true;
}

module.exports = {
  initSqlite,
  getDb: () => sqliteDb,
  isDbReady: () => dbReady,
  persistDb,
  rowsFromExec,
  extractPhoneFromChatId,
  normalizePhone,
  getArchivedTagId,
  ensureArchivedTag
};
