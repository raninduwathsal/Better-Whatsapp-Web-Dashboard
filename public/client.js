const socket = io();

const qrImg = document.getElementById('qr');
const statusEl = document.getElementById('status');
const messagesEl = document.getElementById('messages');
const presetInput = document.getElementById('preset');
const sendBtn = document.getElementById('sendBtn');
const refreshBtn = document.getElementById('refresh');

// state
let chats = []; // array of chat objects from server
const pinned = new Set();
// selection supports multi-select (ctrl/cmd click)
const selectedChats = new Set();

// quick replies (server-backed)
let quickReplies = []; // {id, text, created_at}
let showAllQuickReplies = false;
let quickRepliesSettingsOpen = false;
const QUICK_REPLIES_API = '/api/quick-replies';

async function loadQuickRepliesFromServer(){
  try {
    const res = await fetch(QUICK_REPLIES_API);
    if (!res.ok) throw new Error('failed');
    quickReplies = await res.json();
  } catch (err) {
    console.error('Failed to load quick replies', err);
    quickReplies = [];
  }
  renderQuickReplies();
}

async function createQuickReplyOnServer(text){
  const res = await fetch(QUICK_REPLIES_API, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error('create failed');
  return await res.json();
}

async function updateQuickReplyOnServer(id, text){
  const res = await fetch(`${QUICK_REPLIES_API}/${id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error('update failed');
  return await res.json();
}

async function deleteQuickReplyOnServer(id){
  const res = await fetch(`${QUICK_REPLIES_API}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('delete failed');
  return await res.json();
}

// subscribe to server-side updates
socket.on('quick_replies_updated', ()=> loadQuickRepliesFromServer());
// initial load
loadQuickRepliesFromServer();


socket.on('connect', () => {
  statusEl.textContent = 'Connected to server';
  socket.emit('requestMessages');
});

socket.on('connect_error', (err)=>{
  console.error('Socket connect_error', err);
  statusEl.textContent = 'Socket error';
});

socket.on('error', (err)=>{
  console.error('Socket error', err);
});

socket.on('qr', dataUrl => {
  qrImg.src = dataUrl;
  statusEl.textContent = 'Scan QR to link WhatsApp';
});

socket.on('ready', () => {
  statusEl.textContent = 'WhatsApp Ready';
  document.getElementById('qrWrap').style.display = 'none';
});

socket.on('chats', list => {
  // update local chats list
  chats = list || [];
  renderChats();
});

socket.on('not_ready', ()=>{
  statusEl.textContent = 'WhatsApp initializing...';
});

socket.on('sent', ({chatId, text}) => {
  // show friendly name if available
  const c = chats.find(x=>x.chatId === chatId);
  const display = c ? (c.name || c.chatId) : chatId;
  statusEl.textContent = `Sent to ${display}`;
  // after sending, refresh chats from server so unread state updates
  socket.emit('requestMessages');
});

socket.on('error', e => {
  statusEl.textContent = `Error: ${e.message || e}`;
});

function renderChats(){
  messagesEl.innerHTML = '';
  // render pinned first
  messagesEl.innerHTML = '';
  const now = Date.now();
  const sorted = Array.from(chats);
  sorted.sort((a,b)=>{
    // pinned top
    const pa = pinned.has(a.chatId) ? 1 : 0;
    const pb = pinned.has(b.chatId) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    // unread next
    if ((b.unreadCount>0) - (a.unreadCount>0) !== 0) return (b.unreadCount>0) - (a.unreadCount>0);
    return b.lastTimestamp - a.lastTimestamp;
  });

  for (const c of sorted){
    const el = document.createElement('div');
    el.className = 'msg';
    el.dataset.chatId = c.chatId;
    if (selectedChats.has(c.chatId)) el.classList.add('selected');
    if (c.unreadCount > 0) el.classList.add('unread');

    // header: phone/name + unread count
    const header = document.createElement('div'); header.className='meta';
    const left = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = c.name || '';
    left.appendChild(title);
    const info = document.createElement('span');
    info.style.marginLeft = '8px';
    info.textContent = c.unreadCount>0 ? `${c.unreadCount} unread` : '';
    left.appendChild(info);
    header.appendChild(left);

    const pinBtn = document.createElement('button');
    pinBtn.className = 'pinBtn';
    pinBtn.textContent = pinned.has(c.chatId) ? 'Unpin' : 'Pin';
    pinBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      if (pinned.has(c.chatId)) pinned.delete(c.chatId); else pinned.add(c.chatId);
      renderChats();
    });

    // history (last 3 messages) as bubbles
    const hist = document.createElement('div'); hist.className='history';
    for (const m of c.history){
      const isMine = !!m.fromMe;
      const row = document.createElement('div');
      const bubble = document.createElement('div');
      bubble.className = 'bubble ' + (isMine ? 'right' : 'left');

      if (m.hasMedia) {
        const mt = (m.mimetype || '').toLowerCase();
        // stickers: render small inline sticker image if media data is available
        if (m.isSticker && m.media && m.media.data) {
          const img = document.createElement('img');
          img.src = m.media.data;
          img.style.width = '72px';
          img.style.height = '72px';
          img.style.objectFit = 'contain';
          img.style.borderRadius = '8px';
          img.alt = m.filename || 'sticker';
          bubble.appendChild(img);
        } else {
          // show compact placeholder for media
          let label = '📄 File';
          if (mt.startsWith('image/')) label = '🖼️ Image';
          else if (mt === 'application/pdf') label = '📄 PDF';
          else if (mt.startsWith('video/')) label = '📹 Video';
          const textNode = document.createElement('div');
          textNode.textContent = `${label}${m.filename ? ' — ' + m.filename : ''}`;
          bubble.appendChild(textNode);
          if (m.filename) bubble.title = m.filename;
        }
      } else {
        // message text (truncate to 40 chars in the card)
        const fullText = String(m.body || '');
        const truncated = fullText.length > 40 ? fullText.slice(0,40) + '...' : fullText;
        const textNode = document.createElement('div');
        textNode.textContent = truncated;
        if (fullText.length > 40) bubble.title = fullText;
        bubble.appendChild(textNode);
      }

      // timestamp
      const ts = document.createElement('span'); ts.className='timestamp'; ts.textContent = new Date(m.timestamp*1000).toLocaleTimeString();
      bubble.appendChild(ts);
      row.appendChild(bubble);
      hist.appendChild(row);
    }

    el.appendChild(header);
    el.appendChild(pinBtn);
    el.appendChild(hist);

    el.addEventListener('click', (e)=>{
      const id = c.chatId;
      if (e.ctrlKey || e.metaKey) {
        // toggle
        if (selectedChats.has(id)) selectedChats.delete(id); else selectedChats.add(id);
      } else {
        // single select
        selectedChats.clear();
        selectedChats.add(id);
      }
      // update visuals
      document.querySelectorAll('.msg').forEach(x=> x.classList.toggle('selected', selectedChats.has(x.dataset.chatId)));
    });

      // double-click to open full chat view
      el.addEventListener('dblclick', ()=>{
        openFullChat(c.chatId, c.name || c.chatId);
      });

    messagesEl.appendChild(el);
  }

  renderQuickReplies();
}

function renderQuickReplies(){
  let container = document.getElementById('quick-replies-container');
  // defensive: create container if missing
  if (!container) {
    const header = document.querySelector('header');
    container = document.createElement('div');
    container.id = 'quick-replies-container';
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.gap = '8px';
    if (header) header.insertBefore(container, header.children[1] || null);
  }
  container.innerHTML = '';
  // Add button to create new quick reply
  const addBtn = document.createElement('button');
  addBtn.className = 'qr-btn';
  addBtn.textContent = '+';
  addBtn.title = 'Create quick reply';
  addBtn.addEventListener('click', ()=>{
    // Open a modal editor so we can accept multiline quick replies
    openQuickReplyEditor('', (v)=>{
      if (v != null && v.trim() !== ''){
        createQuickReplyOnServer(v).then(()=> loadQuickRepliesFromServer()).catch(err=>{ console.error(err); statusEl.textContent='Failed to create quick reply'; });
      }
    });
  });
  container.appendChild(addBtn);

  // Settings toggle (collapsible panel)
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'qr-btn';
  settingsBtn.textContent = '⚙';
  settingsBtn.title = 'Quick replies settings';
  settingsBtn.addEventListener('click', (e)=>{
    e.stopPropagation();
    quickRepliesSettingsOpen = !quickRepliesSettingsOpen;
    renderQuickReplies();
    renderQuickRepliesSettings();
  });
  container.appendChild(settingsBtn);

  // Show quick reply buttons, collapse if many
  const maxVisible = showAllQuickReplies ? quickReplies.length : 6;
  for (let i=0;i<Math.min(quickReplies.length, maxVisible);i++){
    const qr = quickReplies[i];
    const b = document.createElement('button');
    b.className = 'qr-btn';
    const txt = (qr && qr.text) ? qr.text : '';
    const label = txt.length > 24 ? txt.slice(0,24) + '...' : txt;
    b.textContent = label;
    b.title = txt;
    b.addEventListener('click', ()=>{
      // send qr text to all selected chats
      const ids = getSelectedChatIds();
      if (!ids.length) { statusEl.textContent = 'No chats selected'; return; }
      for (const id of ids) socket.emit('sendPreset', { chatId: id, text: txt });
      statusEl.textContent = `Sent quick reply to ${ids.length} chat(s)`;
    });
    container.appendChild(b);
  }

  if (quickReplies.length > 6){
    const more = document.createElement('button'); more.className='qr-btn';
    more.textContent = showAllQuickReplies ? 'Show less' : `+${quickReplies.length-6} more`;
    more.addEventListener('click', ()=>{ showAllQuickReplies = !showAllQuickReplies; renderQuickReplies(); });
    container.appendChild(more);
  }

  // render settings panel state if open
  renderQuickRepliesSettings();
}

function renderQuickRepliesSettings(){
  let panel = document.getElementById('qr-settings-panel');
  if (!panel){
    panel = document.createElement('div'); panel.id = 'qr-settings-panel';
    panel.style.border = '1px solid #ddd';
    panel.style.padding = '8px';
    panel.style.marginTop = '8px';
    panel.style.background = '#fff';
    const header = document.querySelector('header');
    if (header) header.parentNode.insertBefore(panel, header.nextSibling);
    else document.body.appendChild(panel);
  }
  // hide when closed
  if (!quickRepliesSettingsOpen){ panel.style.display = 'none'; return; }
  panel.style.display = 'block';
  panel.innerHTML = '';
  const titleRow = document.createElement('div'); titleRow.style.display='flex'; titleRow.style.alignItems='center'; titleRow.style.justifyContent='space-between';
  const title = document.createElement('div'); title.style.fontWeight='bold'; title.textContent = 'Quick Replies Settings';
  const toolbar = document.createElement('div'); toolbar.style.display='flex'; toolbar.style.gap='8px';
  // export button
  const exportBtn = document.createElement('button'); exportBtn.className='qr-btn'; exportBtn.textContent='Export';
  exportBtn.addEventListener('click', async ()=>{
    try {
      const res = await fetch('/api/quick-replies/export');
      if (!res.ok) { statusEl.textContent = 'Export failed'; return; }
      const rows = await res.json();
      const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `quick-replies-${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      statusEl.textContent = 'Exported quick replies';
    } catch (err){ console.error(err); statusEl.textContent='Export failed'; }
  });
  // import button
  const importBtn = document.createElement('button'); importBtn.className='qr-btn'; importBtn.textContent='Import';
  // hidden file input
  let importInput = document.getElementById('qr-import-input');
  if (!importInput) {
    importInput = document.createElement('input'); importInput.type='file'; importInput.id='qr-import-input'; importInput.accept='.json,application/json'; importInput.style.display='none'; document.body.appendChild(importInput);
  }
  importBtn.addEventListener('click', ()=>{
    importInput.value = '';
    importInput.click();
  });
  importInput.addEventListener('change', async (ev)=>{
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    try {
      const txt = await f.text();
      const parsed = JSON.parse(txt);
      const items = Array.isArray(parsed) ? parsed.map(x=> ({ text: x.text || x })) : (parsed.items || []);
      if (!items.length) { statusEl.textContent = 'No items to import'; return; }
      const replace = confirm('Replace existing quick replies? Click OK to replace, Cancel to append.');
      const res = await fetch('/api/quick-replies/import', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items, replace }) });
      if (!res.ok) { statusEl.textContent = 'Import failed'; return; }
      await loadQuickRepliesFromServer();
      renderQuickRepliesSettings();
      statusEl.textContent = 'Imported quick replies';
    } catch (err) { console.error(err); statusEl.textContent='Import failed'; }
  });

  toolbar.appendChild(exportBtn); toolbar.appendChild(importBtn);
  titleRow.appendChild(title); titleRow.appendChild(toolbar);
  panel.appendChild(titleRow);
  if (!quickReplies || quickReplies.length === 0){ const empty = document.createElement('div'); empty.style.marginTop='8px'; empty.textContent = 'No quick replies defined.'; panel.appendChild(empty); return; }

  // list items
  quickReplies.forEach((qr, idx)=>{
    const row = document.createElement('div'); row.style.display='flex'; row.style.alignItems='center'; row.style.gap='8px'; row.style.marginTop='6px';
    const label = document.createElement('div'); label.style.flex='1'; label.style.whiteSpace='pre-wrap'; label.textContent = qr.text || '';
    const edit = document.createElement('button'); edit.className='qr-btn'; edit.textContent='Edit';
    edit.addEventListener('click', ()=>{
      openQuickReplyEditor(qr.text, (v)=>{
        if (v != null && v.trim() !== ''){
          updateQuickReplyOnServer(qr.id, v).then(()=>{ loadQuickRepliesFromServer(); renderQuickRepliesSettings(); }).catch(err=>{ console.error(err); statusEl.textContent='Failed to update'; });
        }
      });
    });
    const del = document.createElement('button'); del.className='qr-btn'; del.textContent='Delete';
    del.addEventListener('click', ()=>{
      if (!confirm('Delete this quick reply?')) return;
      deleteQuickReplyOnServer(qr.id).then(()=>{ loadQuickRepliesFromServer(); renderQuickRepliesSettings(); }).catch(err=>{ console.error(err); statusEl.textContent='Failed to delete'; });
    });
    row.appendChild(label); row.appendChild(edit); row.appendChild(del);
    panel.appendChild(row);
  });
}

// Ensure quick replies UI is present immediately
renderQuickReplies();

// Quick reply editor modal (multiline)
function openQuickReplyEditor(initialText, onSave){
  const modal = document.createElement('div'); modal.className='modal';
  const panel = document.createElement('div'); panel.className='panel';
  const header = document.createElement('div'); header.className='header';
  const hTitle = document.createElement('div'); hTitle.textContent = 'Quick Reply';
  const closeBtn = document.createElement('button'); closeBtn.textContent='Cancel';
  header.appendChild(hTitle); header.appendChild(closeBtn);
  const body = document.createElement('div'); body.className='body';
  const ta = document.createElement('textarea'); ta.style.width='100%'; ta.style.height='160px'; ta.value = initialText || '';
  body.appendChild(ta);
  const composer = document.createElement('div'); composer.className='composer';
  const saveBtn = document.createElement('button'); saveBtn.textContent='Save'; saveBtn.className='qr-btn primary';
  const cancelBtn = document.createElement('button'); cancelBtn.textContent='Cancel';
  composer.appendChild(cancelBtn); composer.appendChild(saveBtn);
  panel.appendChild(header); panel.appendChild(body); panel.appendChild(composer);
  modal.appendChild(panel); document.body.appendChild(modal);

  function close(v){ document.body.removeChild(modal); onSave(v); }
  closeBtn.addEventListener('click', ()=> close(null));
  cancelBtn.addEventListener('click', ()=> close(null));
  saveBtn.addEventListener('click', ()=> close(ta.value));
}

function getSelectedChatIds(){
  return Array.from(selectedChats);
}

function sendPreset(){
  const ids = getSelectedChatIds();
  const text = presetInput.value && presetInput.value.trim();
  if (!ids.length) { statusEl.textContent = 'No chat selected'; return; }
  if (!text) { statusEl.textContent = 'No preset text'; return; }
  for (const id of ids) socket.emit('sendPreset', { chatId: id, text });
}

sendBtn.addEventListener('click', sendPreset);
refreshBtn.addEventListener('click', ()=> socket.emit('requestMessages'));

// keyboard shortcut removed: sending is done via the Send button only

// no periodic suppressed cleanup needed in this version

// --- full chat modal handling ---
function openFullChat(chatId, title){
  // create modal
  const modal = document.createElement('div'); modal.className='modal';
  const panel = document.createElement('div'); panel.className='panel';
  const header = document.createElement('div'); header.className='header';
  const hTitle = document.createElement('div'); hTitle.textContent = title;
  const closeBtn = document.createElement('button'); closeBtn.textContent='Close';
  header.appendChild(hTitle); header.appendChild(closeBtn);

  const body = document.createElement('div'); body.className='body';
  const composer = document.createElement('div'); composer.className='composer';
  const input = document.createElement('input'); input.placeholder='Message...';
  const send = document.createElement('button'); send.textContent='Send';
  composer.appendChild(input); composer.appendChild(send);

  panel.appendChild(header); panel.appendChild(body); panel.appendChild(composer);
  modal.appendChild(panel);
  document.body.appendChild(modal);

  closeBtn.addEventListener('click', ()=>{ document.body.removeChild(modal); });

  // request full chat from server
  socket.emit('getFullChat', chatId);
  // show loading
  body.innerHTML = '<em>Loading...</em>';

  // handle send from composer
  send.addEventListener('click', ()=>{
    const txt = input.value && input.value.trim();
    if (!txt) return;
    socket.emit('sendPreset', { chatId, text: txt });
    input.value = '';
  });

  // receive full chat
  const handler = (payload) => {
    if (!payload || payload.chatId !== chatId) return;
    const msgs = payload.messages || [];
    renderFullChatBody(body, msgs);
    // scroll to bottom
    body.scrollTop = body.scrollHeight;
  };
  socket.on('full_chat', handler);

  // cleanup listener when modal closed
  modal.addEventListener('remove', ()=> socket.off('full_chat', handler));
}

function renderFullChatBody(container, messages){
  container.innerHTML = '';
  for (const m of messages){
    const row = document.createElement('div');
    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (m.fromMe ? 'right' : 'left');

    if (m.media && m.media.data) {
      const mt = (m.media.mimetype || '').toLowerCase();
      if (mt.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = m.media.data;
        img.style.maxWidth = '100%';
        img.style.borderRadius = '8px';
        bubble.appendChild(img);
        if (m.media.filename) {
          const fn = document.createElement('div'); fn.style.fontSize='12px'; fn.style.color='#666'; fn.textContent = m.media.filename; bubble.appendChild(fn);
        }
      } else if (mt === 'application/pdf') {
        // embed small PDF preview
        const iframe = document.createElement('iframe');
        iframe.src = m.media.data;
        iframe.style.width = '100%';
        iframe.style.height = '300px';
        iframe.style.border = 'none';
        bubble.appendChild(iframe);
        if (m.media.filename) {
          const a = document.createElement('a'); a.href = m.media.data; a.download = m.media.filename; a.textContent = 'Download PDF'; a.style.display='block'; a.style.marginTop='6px'; bubble.appendChild(a);
        }
      } else {
        const a = document.createElement('a'); a.href = m.media.data; a.download = m.media.filename || 'file'; a.textContent = m.media.filename || 'Download file';
        bubble.appendChild(a);
      }
      // if there's a caption/body show it below
      if (m.body) {
        const cap = document.createElement('div'); cap.style.marginTop='6px'; cap.textContent = m.body; bubble.appendChild(cap);
      }
    } else {
      const textNode = document.createElement('div'); textNode.textContent = m.body;
      bubble.appendChild(textNode);
    }

    const ts = document.createElement('div'); ts.className='timestamp'; ts.textContent = new Date(m.timestamp*1000).toLocaleString();
    bubble.appendChild(ts);
    row.appendChild(bubble);
    container.appendChild(row);
  }
}
