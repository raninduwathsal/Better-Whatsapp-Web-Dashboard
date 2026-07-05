/**
 * Been Away For Sometime Feature
 * Sends randomized preset messages to all unread chats with long delays.
 */

const EMOJIS = ['😊', '💖', '❤️', '✨', '😅', '😁', '🙌', '🤗', '👍', '✌️', '😎', '😉'];

function initBeenAwayMode() {
  const btn = document.getElementById('awayModeBtn');
  if (btn) {
    btn.addEventListener('click', openBeenAwayModal);
  }
}

function openBeenAwayModal() {
  const existing = document.getElementById('been-away-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'been-away-modal';
  modal.className = 'modal';

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.style.maxWidth = '600px';
  panel.style.height = 'auto';
  panel.style.maxHeight = '90vh';

  // Load saved settings
  let presets = [];
  try {
    const saved = localStorage.getItem('beenAwayPresets');
    if (saved) presets = JSON.parse(saved);
  } catch(e) {}
  while(presets.length < 10) presets.push('');

  let emojiEnabled = localStorage.getItem('beenAwayEmojis') !== 'false';
  let batchSize = parseInt(localStorage.getItem('beenAwayBatchSize')) || 10;

  // Header
  const header = document.createElement('div');
  header.className = 'header';
  const h3 = document.createElement('h3');
  h3.textContent = '🏖️ Been Away For Sometime Mode';
  h3.style.margin = '0';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.fontSize = '18px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.color = 'var(--text-secondary)';
  closeBtn.addEventListener('click', () => modal.remove());
  header.appendChild(h3);
  header.appendChild(closeBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'body';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';
  body.style.gap = '12px';
  body.style.overflowY = 'auto';

  const info = document.createElement('p');
  info.textContent = 'This mode will reply to all unread chats. It picks a random message from the list below, waits 10 seconds between messages, and takes a 10-minute break every N messages.';
  info.style.fontSize = '13px';
  info.style.color = 'var(--text-secondary)';
  info.style.margin = '0 0 8px 0';
  body.appendChild(info);

  // Inputs for presets
  const inputsContainer = document.createElement('div');
  inputsContainer.style.display = 'flex';
  inputsContainer.style.flexDirection = 'column';
  inputsContainer.style.gap = '8px';

  const textareas = [];
  for (let i = 0; i < 10; i++) {
    const ta = document.createElement('textarea');
    ta.placeholder = `Preset Message ${i + 1}`;
    ta.value = presets[i];
    ta.style.width = '100%';
    ta.style.boxSizing = 'border-box';
    ta.style.minHeight = '40px';
    ta.style.padding = '8px';
    ta.style.borderRadius = '4px';
    ta.style.resize = 'vertical';
    textareas.push(ta);
    inputsContainer.appendChild(ta);
  }
  body.appendChild(inputsContainer);

  // Settings
  const settingsRow = document.createElement('div');
  settingsRow.style.display = 'flex';
  settingsRow.style.alignItems = 'center';
  settingsRow.style.gap = '16px';
  settingsRow.style.marginTop = '8px';

  const emojiLabel = document.createElement('label');
  emojiLabel.style.display = 'flex';
  emojiLabel.style.alignItems = 'center';
  emojiLabel.style.gap = '6px';
  emojiLabel.style.fontSize = '13px';
  const emojiCheck = document.createElement('input');
  emojiCheck.type = 'checkbox';
  emojiCheck.checked = emojiEnabled;
  emojiLabel.appendChild(emojiCheck);
  emojiLabel.appendChild(document.createTextNode('Append random emoji'));
  
  const batchLabel = document.createElement('label');
  batchLabel.style.display = 'flex';
  batchLabel.style.alignItems = 'center';
  batchLabel.style.gap = '6px';
  batchLabel.style.fontSize = '13px';
  const batchInput = document.createElement('input');
  batchInput.type = 'number';
  batchInput.min = '1';
  batchInput.value = batchSize;
  batchInput.style.width = '60px';
  batchInput.style.padding = '4px';
  batchLabel.appendChild(document.createTextNode('Take 10 min break every (messages):'));
  batchLabel.appendChild(batchInput);

  settingsRow.appendChild(emojiLabel);
  settingsRow.appendChild(batchLabel);
  body.appendChild(settingsRow);

  // Footer/Start button
  const footer = document.createElement('div');
  footer.style.marginTop = '16px';
  footer.style.display = 'flex';
  footer.style.justifyContent = 'flex-end';
  
  const startBtn = document.createElement('button');
  startBtn.className = 'qr-btn primary';
  startBtn.textContent = 'Start Processing';
  startBtn.addEventListener('click', async () => {
    // Save settings
    const newPresets = textareas.map(t => t.value.trim());
    localStorage.setItem('beenAwayPresets', JSON.stringify(newPresets));
    localStorage.setItem('beenAwayEmojis', emojiCheck.checked);
    localStorage.setItem('beenAwayBatchSize', batchInput.value);
    
    modal.remove();
    await startBeenAwayProcessing(newPresets, emojiCheck.checked, parseInt(batchInput.value) || 10);
  });
  
  footer.appendChild(startBtn);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  modal.appendChild(panel);
  document.body.appendChild(modal);
}

async function startBeenAwayProcessing(presets, addEmoji, batchSize) {
  const validPresets = presets.filter(p => p.length > 0);
  if (validPresets.length === 0) {
    alert('Please enter at least one preset message.');
    return;
  }

  const unreadChats = Array.from(AppState.chats || []).filter(c => c.unreadCount > 0);
  if (unreadChats.length === 0) {
    alert('No unread chats found.');
    return;
  }

  if (!confirm(`Are you sure you want to reply to ${unreadChats.length} unread chats?`)) {
    return;
  }

  const originalStatus = AppState.statusEl.textContent;
  let count = 0;

  for (let i = 0; i < unreadChats.length; i++) {
    const chat = unreadChats[i];
    
    // Pick random message
    let text = validPresets[Math.floor(Math.random() * validPresets.length)];
    
    // Append random emoji if enabled
    if (addEmoji) {
      const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
      text += ' ' + emoji;
    }

    AppState.statusEl.textContent = `[Away Mode] Sending ${i + 1}/${unreadChats.length}...`;
    
    // Send message
    socket.emit('sendPreset', { chatId: chat.chatId, text });
    count++;

    // Delay handling
    if (i < unreadChats.length - 1) {
      if (count % batchSize === 0) {
        AppState.statusEl.textContent = `[Away Mode] Taking 10 min break... (${i + 1}/${unreadChats.length} done)`;
        // 10 minute break
        await new Promise(res => setTimeout(res, 600000));
      } else {
        AppState.statusEl.textContent = `[Away Mode] Waiting 10s... (${i + 1}/${unreadChats.length} done)`;
        // 10 second delay
        await new Promise(res => setTimeout(res, 10000));
      }
    }
  }

  AppState.statusEl.textContent = `[Away Mode] Completed! Sent to ${unreadChats.length} chats.`;
  setTimeout(() => {
    if (AppState.statusEl.textContent.startsWith('[Away Mode]')) {
      AppState.statusEl.textContent = originalStatus;
    }
  }, 5000);
}

// Auto-initialize when the script loads
document.addEventListener('DOMContentLoaded', () => {
  initBeenAwayMode();
});
// Also try immediate initialization in case DOM is already loaded
initBeenAwayMode();
