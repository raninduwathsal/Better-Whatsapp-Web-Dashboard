/**
 * Socket.io Event Handlers
 * Manages all real-time communication between client and server
 */

const socket = io();

// Connect handlers
socket.on('connect', () => {
  AppState.statusEl.textContent = 'Connected to server';
  socket.emit('requestMessages');
});

socket.on('connect_error', (err) => {
  console.error('Socket connect_error', err);
  AppState.statusEl.textContent = 'Socket error';
});

socket.on('error', (err) => {
  console.error('Socket error', err);
});

// QR & Status handlers
socket.on('qr', dataUrl => {
  AppState.qrImg.src = dataUrl;
  AppState.statusEl.textContent = 'Scan QR to link WhatsApp';
});

socket.on('ready', () => {
  AppState.statusEl.textContent = 'WhatsApp Ready';
  document.getElementById('qrWrap').style.display = 'none';
});

socket.on('not_ready', () => {
  AppState.statusEl.textContent = 'WhatsApp initializing...';
});

// Chat handlers
socket.on('chats', list => {
  AppState.chats = list || [];
  renderChats();
});

socket.on('sent', ({ chatId, text }) => {
  // Decrement pending sends counter
  AppState.pendingSends = Math.max(0, AppState.pendingSends - 1);

  const c = AppState.chats.find(x => x.chatId === chatId);
  const display = c ? (c.name || c.chatId) : chatId;
  
  // If there are still messages pending, just update the status
  if (AppState.pendingSends > 0) {
    AppState.statusEl.textContent = `Sent to ${display}. Remaining: ${AppState.pendingSends}`;
  } else {
    // 1. STOP LOADER on the last message
    // toggleAppLoader is available since it's defined in app.js which is loaded before this file
    toggleAppLoader(false); 
    
    // 2. Final success status
    AppState.statusEl.textContent = `All messages sent successfully!`;
    
    // 3. Complete the UX bonus: Deselect chats and refresh UI
    AppState.selectedChats.clear();
    renderChats(); 
    
    // Request full messages after a short delay to allow UI to settle
    setTimeout(() => socket.emit('requestMessages'), 500);
  }
});

// Archive handlers
socket.on('archive_success', ({ chatId }) => {
  const c = AppState.chats.find(x => x.chatId === chatId);
  const display = c ? (c.name || c.chatId) : chatId;
  AppState.statusEl.textContent = `Archived ${display}`;
  loadTagsFromServer();
});

socket.on('archive_error', ({ chatId, error }) => {
  const c = AppState.chats.find(x => x.chatId === chatId);
  const display = c ? (c.name || c.chatId) : chatId;
  AppState.statusEl.textContent = `Failed to archive ${display}: ${error}`;
});

socket.on('unarchive_success', ({ chatId }) => {
  const c = AppState.chats.find(x => x.chatId === chatId);
  const display = c ? (c.name || c.chatId) : chatId;
  AppState.statusEl.textContent = `Unarchived ${display}`;
  loadTagsFromServer();
});

socket.on('unarchive_error', ({ chatId, error }) => {
  const c = AppState.chats.find(x => x.chatId === chatId);
  const display = c ? (c.name || c.chatId) : chatId;
  AppState.statusEl.textContent = `Failed to unarchive ${display}: ${error}`;
});

// Tag updates from server
socket.on('tags_updated', () => {
  loadTagsFromServer();
  renderTagFilterChips();
});

// Notes updates from server
socket.on('notes_updated', () => {
  loadNotesCountsFromServer();
});

// Quick replies updates from server
socket.on('quick_replies_updated', () => {
  loadQuickRepliesFromServer();
  renderQuickReplies();
});

// Export socket for use in other modules
window.socket = socket;
