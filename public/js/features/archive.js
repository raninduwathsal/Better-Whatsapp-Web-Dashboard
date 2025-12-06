/**
 * Archive Feature Module
 * Handles chat archive/unarchive functionality
 */

// Archive a chat in WhatsApp and assign the Archived tag
function archiveChat(chatId) {
  socket.emit('archiveChat', { chatId });
}

// Unarchive a chat in WhatsApp and remove the Archived tag
function unarchiveChat(chatId) {
  socket.emit('unarchiveChat', { chatId });
}

// Mark one or more chats as read
function markChatsAsRead(chatIds = null) {
  // If no chatIds provided, use selected chats or focused chat
  const ids = chatIds || Array.from(AppState.selectedChats) || (keyboardFocusedChatId ? [keyboardFocusedChatId] : []);
  if (ids.length === 0) return;
  socket.emit('markAsRead', { chatIds: ids });
}
