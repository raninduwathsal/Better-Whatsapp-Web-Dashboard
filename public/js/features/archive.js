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
