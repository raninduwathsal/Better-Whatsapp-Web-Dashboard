/**
 * Notes Feature Module
 * Handles all note-related functionality
 */

const NOTES_API = '/api/notes';

// Load notes counts from server
async function loadNotesCountsFromServer() {
  try {
    const res = await fetch('/api/notes/counts');
    if (!res.ok) throw new Error('failed');
    const rows = await res.json();
    AppState.notesCounts = {};
    for (const r of rows) AppState.notesCounts[r.chatId] = Number(r.count) || 0;
  } catch (err) {
    console.error('Failed to load note counts', err);
    AppState.notesCounts = {};
  }
  renderChats();
}

// Load notes for a specific chat
async function loadNotesForChat(chatId) {
  try {
    const res = await fetch(`${NOTES_API}?chatId=${encodeURIComponent(chatId)}`);
    if (!res.ok) throw new Error('failed');
    return await res.json();
  } catch (err) {
    console.error('Failed to load notes for chat', err);
    return [];
  }
}

// Create note on server
async function createNoteOnServer(chatId, text) {
  const res = await fetch(NOTES_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, text })
  });
  if (!res.ok) throw new Error('create failed');
  return await res.json();
}

// Update note on server
async function updateNoteOnServer(id, text) {
  const res = await fetch(`${NOTES_API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('update failed');
  return await res.json();
}

// Delete note on server
async function deleteNoteOnServer(id) {
  const res = await fetch(`${NOTES_API}/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('delete failed');
  return await res.json();
}

// Open notes modal
function openNotesModal(chatId, title) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const panel = document.createElement('div');
  panel.className = 'panel';
  const header = document.createElement('div');
  header.className = 'header';
  const hTitle = document.createElement('div');
  hTitle.textContent = `Notes for ${title}`;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  header.appendChild(hTitle);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'body';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.gap = '8px';

  const composer = document.createElement('div');
  composer.className = 'composer';
  const ta = document.createElement('textarea');
  ta.placeholder = 'Add a note...';
  ta.style.width = '100%';
  ta.style.height = '80px';
  ta.style.padding = '8px';
  ta.style.border = '1px solid #ddd';
  ta.style.borderRadius = '4px';
  ta.style.fontFamily = 'inherit';
  const addBtn = document.createElement('button');
  addBtn.textContent = 'Add Note';
  addBtn.className = 'qr-btn primary';
  composer.appendChild(ta);
  composer.appendChild(addBtn);

  const notesList = document.createElement('div');
  notesList.style.flex = '1';
  notesList.style.overflowY = 'auto';
  notesList.style.marginTop = '8px';

  panel.appendChild(header);
  panel.appendChild(composer);
  panel.appendChild(body);
  body.appendChild(notesList);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  addBtn.addEventListener('click', async () => {
    const text = ta.value && ta.value.trim();
    if (!text) return;
    try {
      await createNoteOnServer(chatId, text);
      ta.value = '';
      await loadNotesCountsFromServer();
      const notes = await loadNotesForChat(chatId);
      renderNotesList(notesList, chatId, notes);
    } catch (err) {
      console.error(err);
      alert('Failed to create note');
    }
  });

  // Load and display existing notes
  loadNotesForChat(chatId).then(notes => {
    renderNotesList(notesList, chatId, notes);
  });
}

// Render notes list
function renderNotesList(container, chatId, notes) {
  container.innerHTML = '';
  if (!notes || notes.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#999';
    empty.style.textAlign = 'center';
    empty.style.padding = '20px';
    empty.textContent = 'No notes yet';
    container.appendChild(empty);
    return;
  }

  for (const note of notes) {
    const noteEl = document.createElement('div');
    noteEl.style.padding = '8px';
    noteEl.style.background = '#f9f9f9';
    noteEl.style.border = '1px solid #e0e0e0';
    noteEl.style.borderRadius = '4px';
    noteEl.style.marginBottom = '8px';

    const text = document.createElement('div');
    text.style.marginBottom = '4px';
    text.textContent = note.text;
    noteEl.appendChild(text);

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '8px';
    controls.style.fontSize = '12px';

    const timestamp = document.createElement('span');
    timestamp.style.color = '#999';
    timestamp.textContent = new Date(note.created_at).toLocaleString();
    controls.appendChild(timestamp);

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.style.background = 'none';
    editBtn.style.border = 'none';
    editBtn.style.color = '#007AFF';
    editBtn.style.cursor = 'pointer';
    editBtn.style.padding = '0';
    editBtn.style.fontSize = '12px';
    editBtn.addEventListener('click', () => {
      const newText = prompt('Edit note:', note.text);
      if (newText && newText.trim()) {
        updateNoteOnServer(note.id, newText.trim()).then(() => {
          loadNotesForChat(chatId).then(notes => {
            renderNotesList(container, chatId, notes);
          });
        });
      }
    });
    controls.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    delBtn.style.background = 'none';
    delBtn.style.border = 'none';
    delBtn.style.color = '#FF3B30';
    delBtn.style.cursor = 'pointer';
    delBtn.style.padding = '0';
    delBtn.style.fontSize = '12px';
    delBtn.addEventListener('click', async () => {
      if (confirm('Delete this note?')) {
        await deleteNoteOnServer(note.id);
        await loadNotesCountsFromServer();
        const notes = await loadNotesForChat(chatId);
        renderNotesList(container, chatId, notes);
      }
    });
    controls.appendChild(delBtn);

    noteEl.appendChild(controls);
    container.appendChild(noteEl);
  }
}

// Show notes preview bubble
function showNotesPreviewBubble(anchorEl, chatId) {
  hideNotesPreviewBubble(anchorEl);
  
  loadNotesForChat(chatId).then(notes => {
    if (!notes || notes.length === 0) return;

    const bubble = document.createElement('div');
    bubble.style.position = 'fixed';
    bubble.style.background = '#fff';
    bubble.style.border = '1px solid #ddd';
    bubble.style.borderRadius = '6px';
    bubble.style.padding = '8px';
    bubble.style.maxWidth = '200px';
    bubble.style.maxHeight = '200px';
    bubble.style.overflowY = 'auto';
    bubble.style.zIndex = '10000';
    bubble.style.fontSize = '12px';
    bubble.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';

    const rect = anchorEl.getBoundingClientRect();
    bubble.style.left = (rect.right + 8) + 'px';
    bubble.style.top = (rect.top) + 'px';

    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '6px';
    title.textContent = `${notes.length} note${notes.length !== 1 ? 's' : ''}`;
    bubble.appendChild(title);

    for (const note of notes) {
      const line = document.createElement('div');
      line.style.marginBottom = '6px';
      line.style.paddingBottom = '6px';
      line.style.borderBottom = '1px solid #eee';
      line.textContent = note.text.substring(0, 50) + (note.text.length > 50 ? '...' : '');
      bubble.appendChild(line);
    }

    document.body.appendChild(bubble);
    anchorEl._noteBubble = bubble;
  });
}

// Hide notes preview bubble
function hideNotesPreviewBubble(anchorEl) {
  if (anchorEl && anchorEl._noteBubble) {
    try {
      anchorEl._noteBubble.remove();
    } catch (e) {}
    anchorEl._noteBubble = null;
  }
}

// Render notes settings panel
function renderNotesSettings() {
  let panel = document.getElementById('sidebar-notes');
  if (!panel) {
    const sidebar = document.getElementById('settings-sidebar');
    if (sidebar) {
      panel = document.createElement('div');
      panel.id = 'sidebar-notes';
      panel.style.padding = '8px';
      panel.style.borderBottom = '1px solid #eee';
      sidebar.appendChild(panel);
    } else {
      panel = document.getElementById('notes-settings-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'notes-settings-panel';
        panel.style.border = '1px solid #ddd';
        panel.style.padding = '8px';
        panel.style.marginTop = '8px';
        panel.style.background = '#fff';
        const header = document.querySelector('header');
        if (header) header.parentNode.insertBefore(panel, header.nextSibling);
        else document.body.appendChild(panel);
      }
    }
  }

  if (!AppState.notesSettingsOpen) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  panel.innerHTML = '';
  panel.style.padding = '12px';

  const title = document.createElement('div');
  title.style.fontWeight = 'bold';
  title.textContent = 'Notes Settings';
  title.style.marginBottom = '12px';
  panel.appendChild(title);

  const btnRow = document.createElement('div');
  btnRow.style.display = 'flex';
  btnRow.style.gap = '8px';
  btnRow.style.marginBottom = '12px';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'qr-btn';
  exportBtn.textContent = 'Export All Notes';

  const importBtn = document.createElement('button');
  importBtn.className = 'qr-btn';
  importBtn.textContent = 'Import Notes (Append)';

  btnRow.appendChild(exportBtn);
  btnRow.appendChild(importBtn);
  panel.appendChild(btnRow);

  const info = document.createElement('div');
  info.style.marginTop = '8px';
  info.style.color = '#666';
  info.style.fontSize = '12px';
  info.textContent = 'Export creates a JSON backup of all notes. Import will append notes to matching chats using chatId or phone number fallback.';
  panel.appendChild(info);

  // hidden input for import
  let importInput = document.getElementById('notes-import-all-input');
  if (!importInput) {
    importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.id = 'notes-import-all-input';
    importInput.accept = '.json,application/json';
    importInput.style.display = 'none';
    document.body.appendChild(importInput);
  }

  exportBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/notes/export');
      if (!res.ok) {
        AppState.statusEl.textContent = 'Export failed';
        return;
      }
      const rows = await res.json();
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notes-all-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      AppState.statusEl.textContent = 'Exported all notes';
    } catch (err) {
      console.error(err);
      AppState.statusEl.textContent = 'Export failed';
    }
  });

  importBtn.addEventListener('click', () => {
    importInput.value = '';
    importInput.click();
  });

  importInput.addEventListener('change', async (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const parsed = JSON.parse(txt);
      const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.notes) ? parsed.notes : []);
      if (!items.length) {
        AppState.statusEl.textContent = 'No notes to import';
        return;
      }
      const res = await fetch('/api/notes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: items, replace: false })
      });
      if (!res.ok) {
        AppState.statusEl.textContent = 'Import failed';
        return;
      }
      const js = await res.json();
      AppState.statusEl.textContent = `Import: ${js.imported || 0} imported, ${js.failed || 0} failed`;
      await loadNotesCountsFromServer();
      renderNotesSettings();
    } catch (err) {
      console.error(err);
      AppState.statusEl.textContent = 'Import failed';
    }
  });
}
