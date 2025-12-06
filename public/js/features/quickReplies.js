/**
 * Quick Replies Feature Module
 * Handles all quick reply functionality
 */

const QUICK_REPLIES_API = '/api/quick-replies';

// Load quick replies from server
async function loadQuickRepliesFromServer() {
  try {
    const res = await fetch(QUICK_REPLIES_API);
    if (!res.ok) throw new Error('failed');
    AppState.quickReplies = await res.json();
  } catch (err) {
    console.error('Failed to load quick replies', err);
    AppState.quickReplies = [];
  }
  renderQuickReplies();
}

// Create quick reply on server
async function createQuickReplyOnServer(text) {
  const res = await fetch(QUICK_REPLIES_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('create failed');
  return await res.json();
}

// Update quick reply on server
async function updateQuickReplyOnServer(id, text) {
  const res = await fetch(`${QUICK_REPLIES_API}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (!res.ok) throw new Error('update failed');
  return await res.json();
}

// Delete quick reply on server
async function deleteQuickReplyOnServer(id) {
  const res = await fetch(`${QUICK_REPLIES_API}/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('delete failed');
  return await res.json();
}

// Render quick replies
function renderQuickReplies() {
  let container = document.getElementById('quick-replies-container');
  if (!container) {
    const messagesEl = document.getElementById('messages');
    if (!messagesEl) return;
    container = document.createElement('div');
    container.id = 'quick-replies-container';
    container.style.padding = '8px 12px';
    container.style.borderBottom = '1px solid #eee';
    messagesEl.parentNode.insertBefore(container, messagesEl);
  }

  container.innerHTML = '';

  if (!AppState.quickReplies || AppState.quickReplies.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#999';
    empty.style.fontSize = '12px';
    empty.textContent = 'No quick replies configured';
    container.appendChild(empty);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.style.display = 'flex';
  wrapper.style.flexWrap = 'wrap';
  wrapper.style.gap = '6px';

  const displayCount = AppState.showAllQuickReplies ? AppState.quickReplies.length : Math.min(3, AppState.quickReplies.length);

  for (let i = 0; i < displayCount; i++) {
    const qr = AppState.quickReplies[i];
    const btn = document.createElement('button');
    btn.className = 'qr-btn';
    btn.textContent = qr.text.length > 15 ? qr.text.substring(0, 15) + '...' : qr.text;
    btn.title = qr.text;
    btn.style.fontSize = '11px';
    btn.style.padding = '4px 8px';
    btn.addEventListener('click', () => {
      AppState.presetInput.value = qr.text;
    });
    wrapper.appendChild(btn);
  }

  if (AppState.quickReplies.length > 3) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'qr-btn';
    toggleBtn.textContent = AppState.showAllQuickReplies ? '▲ Less' : '▼ More';
    toggleBtn.style.fontSize = '11px';
    toggleBtn.style.padding = '4px 8px';
    toggleBtn.addEventListener('click', () => {
      AppState.showAllQuickReplies = !AppState.showAllQuickReplies;
      renderQuickReplies();
    });
    wrapper.appendChild(toggleBtn);
  }

  container.appendChild(wrapper);
}

// Open quick reply editor modal
function openQuickReplyEditor(initialText, onSave) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  const panel = document.createElement('div');
  panel.className = 'panel';
  const header = document.createElement('div');
  header.className = 'header';
  const hTitle = document.createElement('div');
  hTitle.textContent = 'Quick Reply';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Cancel';
  header.appendChild(hTitle);
  header.appendChild(closeBtn);

  const body = document.createElement('div');
  body.className = 'body';
  const ta = document.createElement('textarea');
  ta.style.width = '100%';
  ta.style.height = '160px';
  ta.value = initialText || '';
  body.appendChild(ta);

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
  saveBtn.addEventListener('click', () => close(ta.value));
}

// Render quick replies settings panel
function renderQuickRepliesSettings() {
  let panel = document.getElementById('sidebar-quick-replies');
  if (!panel) {
    const sidebar = document.getElementById('settings-sidebar');
    if (sidebar) {
      panel = document.createElement('div');
      panel.id = 'sidebar-quick-replies';
      panel.style.padding = '8px';
      panel.style.borderBottom = '1px solid #eee';
      sidebar.appendChild(panel);
    } else {
      panel = document.getElementById('quick-replies-settings-panel');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'quick-replies-settings-panel';
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

  if (!AppState.quickRepliesSettingsOpen) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  panel.innerHTML = '';
  panel.style.padding = '12px';

  const title = document.createElement('div');
  title.style.fontWeight = 'bold';
  title.textContent = 'Quick Replies';
  title.style.marginBottom = '12px';
  panel.appendChild(title);

  const createBtn = document.createElement('button');
  createBtn.textContent = '+ Add Quick Reply';
  createBtn.className = 'qr-btn';
  createBtn.style.marginBottom = '12px';
  createBtn.addEventListener('click', () => {
    openQuickReplyEditor('', async (text) => {
      if (!text) return;
      await createQuickReplyOnServer(text);
      await loadQuickRepliesFromServer();
      renderQuickReplies();
      renderQuickRepliesSettings();
    });
  });
  panel.appendChild(createBtn);

  if (!AppState.quickReplies || AppState.quickReplies.length === 0) {
    const empty = document.createElement('div');
    empty.style.marginTop = '8px';
    empty.style.color = '#999';
    empty.textContent = 'No quick replies yet';
    panel.appendChild(empty);
    return;
  }

  AppState.quickReplies.forEach((qr, idx) => {
    const row = document.createElement('div');
    row.style.padding = '12px';
    row.style.background = idx % 2 === 0 ? '#fff' : '#f9f9f9';
    row.style.borderBottom = '1px solid #e0e0e0';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const text = document.createElement('div');
    text.style.flex = '1';
    text.textContent = qr.text.length > 50 ? qr.text.substring(0, 50) + '...' : qr.text;
    text.title = qr.text;
    row.appendChild(text);

    const editBtn = document.createElement('button');
    editBtn.className = 'qr-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      openQuickReplyEditor(qr.text, async (text) => {
        if (!text) return;
        await updateQuickReplyOnServer(qr.id, text);
        await loadQuickRepliesFromServer();
        renderQuickReplies();
        renderQuickRepliesSettings();
      });
    });
    row.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'qr-btn';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      if (confirm('Delete this quick reply?')) {
        await deleteQuickReplyOnServer(qr.id);
        await loadQuickRepliesFromServer();
        renderQuickReplies();
        renderQuickRepliesSettings();
      }
    });
    row.appendChild(delBtn);

    panel.appendChild(row);
  });
}
