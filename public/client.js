const socket = io();

const qrImg = document.getElementById('qr');
const statusEl = document.getElementById('status');
const messagesEl = document.getElementById('messages');
const presetInput = document.getElementById('preset');
const sendBtn = document.getElementById('sendBtn');
const refreshBtn = document.getElementById('refresh');

// state
let chats = []; // array of chat objects from server
let selectedChatId = null;
const pinned = new Set();

socket.on('connect', () => {
  statusEl.textContent = 'Connected to server';
  socket.emit('requestMessages');
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
    if (c.chatId === selectedChatId) el.classList.add('selected');
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
      // use server-provided fromMe flag when available
      const isMine = !!m.fromMe;
      const row = document.createElement('div');
      const bubble = document.createElement('div');
      bubble.className = 'bubble ' + (isMine ? 'right' : 'left');
      // message text
      const textNode = document.createElement('div');
      textNode.textContent = m.body;
      bubble.appendChild(textNode);
      // timestamp
      const ts = document.createElement('span'); ts.className='timestamp'; ts.textContent = new Date(m.timestamp*1000).toLocaleTimeString();
      bubble.appendChild(ts);
      row.appendChild(bubble);
      hist.appendChild(row);
    }

    el.appendChild(header);
    el.appendChild(pinBtn);
    el.appendChild(hist);

    el.addEventListener('click', ()=>{
      selectedChatId = c.chatId;
      document.querySelectorAll('.msg').forEach(x=>x.classList.toggle('selected', x.dataset.chatId===selectedChatId));
    });

      // double-click to open full chat view
      el.addEventListener('dblclick', ()=>{
        openFullChat(c.chatId, c.name || c.chatId);
      });

    messagesEl.appendChild(el);
  }
}

function getSelectedChatId(){
  return selectedChatId;
}

function sendPreset(){
  const chatId = getSelectedChatId();
  const text = presetInput.value && presetInput.value.trim();
  if (!chatId) { statusEl.textContent = 'No chat selected'; return; }
  if (!text) { statusEl.textContent = 'No preset text'; return; }
  socket.emit('sendPreset', { chatId, text });
}

sendBtn.addEventListener('click', sendPreset);
refreshBtn.addEventListener('click', ()=> socket.emit('requestMessages'));

// keyboard handling: press 'r' to send preset
window.addEventListener('keydown', (e)=>{
  if (e.key === 'r' || e.key === 'R'){
    e.preventDefault();
    sendPreset();
  }
});

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
    const textNode = document.createElement('div'); textNode.textContent = m.body;
    const ts = document.createElement('div'); ts.className='timestamp'; ts.textContent = new Date(m.timestamp*1000).toLocaleString();
    bubble.appendChild(textNode); bubble.appendChild(ts);
    row.appendChild(bubble);
    container.appendChild(row);
  }
}
