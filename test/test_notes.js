// Notes API test script
// Run with: node test/test_notes.js

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

let passed = true;

function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

async function get(path){ const res = await fetch(`${BASE_URL}${path}`); return res; }
async function getJson(path){ const r = await get(path); if (!r.ok) throw new Error(`GET ${path} failed: ${r.status}`); return await r.json(); }
async function postJson(path, body){ const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); return res; }
async function putJson(path, body){ const res = await fetch(`${BASE_URL}${path}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) }); return res; }
async function del(path){ const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE' }); return res; }

(async ()=>{
  console.log('Notes API test starting against', BASE_URL);
  try {
    // 0. Cleanup existing notes (export then delete)
    console.log('Cleaning existing notes...');
    const all = await getJson('/api/notes/export');
    if (Array.isArray(all)){
      for (const n of all){
        try { await del(`/api/notes/${n.id}`); } catch(e) {}
      }
    }
    await sleep(500);

    // 1. Create a note
    const chatId = '1112223330@c.us';
    console.log('Creating note for', chatId);
    let r = await postJson('/api/notes', { chatId, text: 'Test note 1' });
    if (!r.ok) { console.error('Create failed', await r.text()); passed = false; }
    const created = r.ok ? await r.json() : null;
    console.log('Created:', created);
    if (!created || !created.id) { console.error('Create did not return id'); passed = false; }
    await sleep(500);

    // 2. Get notes for chat
    console.log('Fetching notes for chat');
    r = await get(`/api/notes?chatId=${encodeURIComponent(chatId)}`);
    if (!r.ok) { console.error('GET notes failed', r.status); passed = false; }
    const notes = await r.json();
    if (!(Array.isArray(notes) && notes.length >= 1)) { console.error('Expected at least 1 note', notes); passed = false; }

    const nid = notes[0] && notes[0].id;

    // 3. Update note
    console.log('Updating note', nid);
    r = await putJson(`/api/notes/${nid}`, { text: 'Updated test note' });
    if (!r.ok) { console.error('Update failed', await r.text()); passed = false; }
    const updated = await r.json();
    if (updated.text !== 'Updated test note') { console.error('Update not persisted', updated); passed = false; }
    await sleep(300);

    // 4. Count endpoint
    console.log('Checking counts endpoint');
    r = await get('/api/notes/counts');
    if (!r.ok) { console.error('Counts endpoint failed', r.status); passed = false; }
    const counts = await r.json();
    const foundCount = counts.find(x=>x.chatId === chatId);
    if (!foundCount || Number(foundCount.count) < 1) { console.error('Counts missing for chat', counts); passed = false; }

    // 5. Export all notes
    console.log('Exporting all notes');
    r = await get('/api/notes/export');
    if (!r.ok) { console.error('Export failed', r.status); passed = false; }
    const exported = await r.json();
    if (!Array.isArray(exported) || exported.length < 1) { console.error('Export returned unexpected', exported); passed = false; }

    // 6. Test import append
    console.log('Testing import append with two notes');
    const importItems = [ { chatId, text: 'Imported note A' }, { chatId, text: 'Imported note B' } ];
    r = await postJson('/api/notes/import', { notes: importItems, replace: false });
    if (!r.ok) { console.error('Import failed', await r.text()); passed = false; }
    const importRes = await r.json();
    console.log('Import response:', importRes);
    if (!importRes || importRes.imported < 2) { console.error('Import did not import expected items', importRes); passed = false; }
    await sleep(500);

    // 7. Test deduplication: import same items again, expect skipped >=2
    console.log('Testing deduplication by re-importing same items');
    r = await postJson('/api/notes/import', { notes: importItems, replace: false });
    if (!r.ok) { console.error('Second import failed', await r.text()); passed = false; }
    const importRes2 = await r.json();
    console.log('Second import response:', importRes2);
    if (typeof importRes2.skipped === 'undefined' || importRes2.skipped < 2) { console.error('Deduplication did not skip expected items', importRes2); passed = false; }

    // 8. Phone fallback: import note with phoneNumber only
    console.log('Testing phone fallback import');
    const phoneNote = [{ phoneNumber: '+15550000001', text: 'Phone fallback note' }];
    r = await postJson('/api/notes/import', { notes: phoneNote, replace: false });
    if (!r.ok) { console.error('Phone import failed', await r.text()); passed = false; }
    const phoneRes = await r.json();
    console.log('Phone import response:', phoneRes);
    if (!phoneRes || phoneRes.imported < 1) { console.error('Phone fallback did not import', phoneRes); passed = false; }

    // 9. Cleanup: delete all notes created
    console.log('Cleaning up created notes');
    const allNow = await getJson('/api/notes/export');
    for (const n of allNow) {
      try { await del(`/api/notes/${n.id}`); } catch (e) {}
    }

  } catch (err){
    console.error('Test error', err);
    passed = false;
  }

  if (passed) { console.log('\nTEST PASS'); process.exit(0); } else { console.error('\nTEST FAIL'); process.exit(1); }
})();
