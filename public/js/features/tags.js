/**
 * Tags Feature Module
 * Handles all tag-related functionality
 */

const TAGS_API = '/api/tags';

// Load tags from server
async function loadTagsFromServer() {
  try {
    const res = await fetch('/api/tags/export');
    if (!res.ok) throw new Error('failed to load tags');
    const data = await res.json();
    AppState.tags = Array.isArray(data.tags) ? data.tags : (data || []);
    
    // build assignments map
    AppState.tagAssignments = {};
    const assigns = Array.isArray(data.assignments) ? data.assignments : (data.assignments || []);
    for (const a of assigns) {
      if (!a.chat_id && !a.chatId) continue;
      const cid = a.chat_id || a.chatId;
      const tid = a.tag_id || a.tagId;
      if (!AppState.tagAssignments[cid]) AppState.tagAssignments[cid] = [];
      AppState.tagAssignments[cid].push(tid);
    }
  } catch (err) {
    console.error('Failed to load tags', err);
    AppState.tags = [];
    AppState.tagAssignments = {};
  }
  renderTagFilterChips();
  renderChats();
}

// Create tag on server
async function createTagOnServer(name, color) {
  const res = await fetch(TAGS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color })
  });
  if (!res.ok) throw new Error('create tag failed');
  return await res.json();
}

// Update tag on server
async function updateTagOnServer(id, name, color) {
  const res = await fetch(`${TAGS_API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color })
  });
  if (!res.ok) throw new Error('update tag failed');
  return await res.json();
}

// Delete tag on server
async function deleteTagOnServer(id) {
  const res = await fetch(`${TAGS_API}/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('delete tag failed');
  return await res.json();
}

// Assign tag to chat
async function assignTagOnServer(tagId, chatId) {
  const res = await fetch('/api/tags/assign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagId, chatId })
  });
  if (!res.ok) throw new Error('assign failed');
  return await res.json();
}

// Unassign tag from chat
async function unassignTagOnServer(tagId, chatId) {
  const res = await fetch('/api/tags/unassign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tagId, chatId })
  });
  if (!res.ok) throw new Error('unassign failed');
  return await res.json();
}

// Open tag editor modal
function openTagEditor(initialName, initialColor, onSave) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const panel = document.createElement('div');
  panel.className = 'panel';
  const header = document.createElement('div');
  header.className = 'header';
  const hTitle = document.createElement('div');
  hTitle.textContent = initialName ? 'Edit Tag' : 'New Tag';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Cancel';
  header.appendChild(hTitle);
  header.appendChild(closeBtn);
  const body = document.createElement('div');
  body.className = 'body';
  const nameInput = document.createElement('input');
  nameInput.placeholder = 'Tag name';
  nameInput.value = initialName || '';
  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = initialColor || '#ffcc00';
  body.appendChild(nameInput);
  body.appendChild(document.createElement('br'));
  body.appendChild(colorInput);
  const composer = document.createElement('div');
  composer.className = 'composer';
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.className = 'qr-btn primary';
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  composer.appendChild(cancelBtn);
  composer.appendChild(saveBtn);
  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(composer);
  modal.appendChild(panel);
  document.body.appendChild(modal);
  
  function close(v) {
    document.body.removeChild(modal);
    onSave(v);
  }
  closeBtn.addEventListener('click', () => close(null));
  cancelBtn.addEventListener('click', () => close(null));
  saveBtn.addEventListener('click', () => close({ name: nameInput.value.trim(), color: colorInput.value }));
}

// Render tag filter chips
function renderTagFilterChips() {
  let container = document.getElementById('tag-filter-chips');
  if (!container) {
    container = document.createElement('div');
    container.id = 'tag-filter-chips';
    container.style.display = 'flex';
    container.style.gap = '6px';
    container.style.flexWrap = 'wrap';
    container.style.marginBottom = '12px';
    container.style.padding = '0 12px';
    const messagesEl = document.getElementById('messages');
    if (messagesEl && messagesEl.parentNode) {
      messagesEl.parentNode.insertBefore(container, messagesEl);
    }
  }
  container.innerHTML = '';
  
  // Add "All" chip
  const allChip = document.createElement('button');
  allChip.textContent = 'All';
  allChip.style.padding = '4px 12px';
  allChip.style.background = AppState.selectedTagFilters.size === 0 ? '#25D366' : '#e0e0e0';
  allChip.style.color = AppState.selectedTagFilters.size === 0 ? '#fff' : '#000';
  allChip.style.border = 'none';
  allChip.style.borderRadius = '12px';
  allChip.style.cursor = 'pointer';
  allChip.style.fontSize = '12px';
  allChip.addEventListener('click', () => {
    AppState.selectedTagFilters.clear();
    renderTagFilterChips();
    renderChats();
  });
  container.appendChild(allChip);
  
  // Add tag chips (include ALL tags, even Archived)
  for (const t of AppState.tags) {
    const chip = document.createElement('button');
    chip.textContent = t.name;
    chip.style.padding = '4px 12px';
    chip.style.background = AppState.selectedTagFilters.has(String(t.id)) ? t.color : '#e0e0e0';
    chip.style.color = AppState.selectedTagFilters.has(String(t.id)) ? '#fff' : '#000';
    chip.style.border = 'none';
    chip.style.borderRadius = '12px';
    chip.style.cursor = 'pointer';
    chip.style.fontSize = '12px';
    chip.addEventListener('click', () => {
      const tagId = String(t.id);
      if (AppState.selectedTagFilters.has(tagId)) {
        AppState.selectedTagFilters.delete(tagId);
      } else {
        AppState.selectedTagFilters.add(tagId);
      }
      renderTagFilterChips();
      renderChats();
    });
    container.appendChild(chip);
  }
}

// Render tags settings panel
function renderTagsSettings() {
  let panel = document.getElementById('sidebar-tags');
  if (!panel) {
    const sidebar = document.getElementById('settings-sidebar');
    if (sidebar) {
      panel = document.createElement('div');
      panel.id = 'sidebar-tags';
      panel.style.padding = '8px';
      panel.style.borderBottom = '1px solid #eee';
      sidebar.appendChild(panel);
    } else {
      panel = document.getElementById('tags-settings-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'tags-settings-panel';
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

  if (!AppState.tagsSettingsOpen) {
    panel.style.display = 'none';
    return;
  }
  panel.style.display = 'block';
  panel.innerHTML = '';
  panel.style.padding = '12px';

  const titleRow = document.createElement('div');
  titleRow.style.display = 'flex';
  titleRow.style.alignItems = 'center';
  titleRow.style.justifyContent = 'space-between';
  const title = document.createElement('div');
  title.style.fontWeight = 'bold';
  title.textContent = 'Tags Settings';
  const toolbar = document.createElement('div');
  toolbar.style.display = 'flex';
  toolbar.style.gap = '8px';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'qr-btn';
  exportBtn.textContent = 'Export';
  exportBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/tags/export');
      if (!res.ok) {
        AppState.statusEl.textContent = 'Export failed';
        return;
      }
      const js = await res.json();
      const blob = new Blob([JSON.stringify(js, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tags-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      AppState.statusEl.textContent = 'Exported tags';
    } catch (err) {
      console.error(err);
      AppState.statusEl.textContent = 'Export failed';
    }
  });

  const importBtn = document.createElement('button');
  importBtn.className = 'qr-btn';
  importBtn.textContent = 'Import';
  let importInput = document.getElementById('tags-import-input');
  if (!importInput) {
    importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.id = 'tags-import-input';
    importInput.accept = '.json,application/json';
    importInput.style.display = 'none';
    document.body.appendChild(importInput);
  }
  importBtn.addEventListener('click', () => {
    importInput.value = '';
    importInput.click();
  });

  if (!AppState.tagsImportHandlerAttached) {
    AppState.tagsImportHandlerAttached = true;
    importInput.addEventListener('change', async (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      try {
        const txt = await f.text();
        const parsed = JSON.parse(txt);
        const replace = confirm('Replace existing tags? OK = replace, Cancel = append');
        const res = await fetch('/api/tags/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tags: parsed.tags || parsed,
            assignments: parsed.assignments || [],
            replace
          })
        });
        if (!res.ok) {
          AppState.statusEl.textContent = 'Import failed';
          return;
        }
        const result = await res.json();
        await loadTagsFromServer();
        renderTagFilterChips();
        renderTagsSettings();
        AppState.statusEl.textContent = 'Imported tags';
        if (result && result.assignments) {
          const a = result.assignments;
          alert(`Tags Import Report:\n\nTags imported: ${result.imported || 0}\n\nAssignments:\n• Total: ${a.total || 0}\n• Imported: ${a.imported || 0}\n• Skipped (duplicates): ${a.skipped || 0}\n• Failed: ${a.failed || 0}`);
        }
      } catch (err) {
        console.error(err);
        AppState.statusEl.textContent = 'Import failed';
      }
    });
  }

  toolbar.appendChild(exportBtn);
  toolbar.appendChild(importBtn);
  titleRow.appendChild(title);
  titleRow.appendChild(toolbar);
  panel.appendChild(titleRow);

  const createRow = document.createElement('div');
  createRow.style.marginTop = '8px';
  createRow.style.marginBottom = '12px';
  const createBtn = document.createElement('button');
  createBtn.textContent = 'Create Tag';
  createBtn.className = 'qr-btn';
  createBtn.addEventListener('click', () => {
    openTagEditor('', '#ffcc00', async (v) => {
      if (!v) return;
      await createTagOnServer(v.name, v.color);
      await loadTagsFromServer();
      renderTagFilterChips();
      renderTagsSettings();
    });
  });
  createRow.appendChild(createBtn);
  panel.appendChild(createRow);

  if (!AppState.tags || AppState.tags.length === 0) {
    const empty = document.createElement('div');
    empty.style.marginTop = '8px';
    empty.style.color = '#999';
    empty.textContent = 'No tags defined.';
    panel.appendChild(empty);
    return;
  }

  AppState.tags.forEach((t, idx) => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';
    row.style.padding = '12px';
    row.style.background = idx % 2 === 0 ? '#fff' : '#f9f9f9';
    row.style.borderBottom = '1px solid #e0e0e0';

    const label = document.createElement('div');
    label.style.flex = '1';
    label.textContent = t.name;
    if (t.is_system) {
      const badge = document.createElement('span');
      badge.textContent = 'System';
      badge.style.fontSize = '10px';
      badge.style.background = '#e0e0e0';
      badge.style.color = '#666';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '4px';
      badge.style.marginLeft = '8px';
      label.appendChild(badge);
    }

    const color = document.createElement('div');
    color.style.width = '24px';
    color.style.height = '16px';
    color.style.background = t.color;
    color.style.border = '1px solid #ccc';

    const edit = document.createElement('button');
    edit.className = 'qr-btn';
    edit.textContent = 'Edit';
    if (t.is_system) {
      edit.disabled = true;
      edit.style.opacity = '0.5';
      edit.style.cursor = 'not-allowed';
      edit.title = 'Cannot edit system tag';
    } else {
      edit.addEventListener('click', () => {
        openTagEditor(t.name, t.color, async (v) => {
          if (!v) return;
          await updateTagOnServer(t.id, v.name, v.color);
          await loadTagsFromServer();
          renderTagFilterChips();
          renderTagsSettings();
        });
      });
    }

    const del = document.createElement('button');
    del.className = 'qr-btn';
    del.textContent = 'Delete';
    if (t.is_system) {
      del.disabled = true;
      del.style.opacity = '0.5';
      del.style.cursor = 'not-allowed';
      del.title = 'Cannot delete system tag';
    } else {
      del.addEventListener('click', async () => {
        try {
          const countRes = await fetch(`/api/tags/${t.id}/count`);
          if (!countRes.ok) throw new Error('Failed to get count');
          const countData = await countRes.json();
          const chatCount = countData.count || 0;
          const msg = chatCount > 0
            ? `Delete tag "${t.name}"?\n\nThis tag is assigned to ${chatCount} chat${chatCount !== 1 ? 's' : ''}. Deleting it will remove the tag from these chats.`
            : `Delete tag "${t.name}"?`;
          if (!confirm(msg)) return;
          await deleteTagOnServer(t.id);
          await loadTagsFromServer();
          renderTagFilterChips();
          renderTagsSettings();
        } catch (err) {
          console.error(err);
          alert('Failed to delete tag');
        }
      });
    }

    row.appendChild(label);
    row.appendChild(color);
    row.appendChild(edit);
    row.appendChild(del);
    panel.appendChild(row);
  });
}
