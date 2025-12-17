/**
 * Main Application Initialization
 * Coordinates all modules and sets up the application
 */

// Get DOM elements
AppState.qrImg = document.getElementById('qr');
AppState.statusEl = document.getElementById('status');
AppState.messagesEl = document.getElementById('messages');
AppState.presetInput = document.getElementById('preset');
AppState.sendBtn = document.getElementById('sendBtn');
AppState.refreshBtn = document.getElementById('refresh');

// Initialize all features on page load
function initializeApp() {
  // Initialize keyboard shortcuts
  initKeyboardShortcuts();

  // Create settings sidebar
  createSettingsSidebar();

  // Create header search UI
  createHeaderSearch();

  // Load initial data from server
  loadTagsFromServer();
  loadNotesCountsFromServer();
  loadQuickRepliesFromServer();

  // Preset input send functionality
  if (AppState.sendBtn) {
    AppState.sendBtn.addEventListener('click', sendPreset);
  }

  if (AppState.refreshBtn) {
    AppState.refreshBtn.addEventListener('click', () => {
      socket.emit('requestMessages');
    });
  }

  // Mark All Read button functionality
  const markAllReadBtn = document.getElementById('markAllReadBtn');
  if (markAllReadBtn) {
    markAllReadBtn.addEventListener('click', markAllUnreadAsRead);
  }

  // Allow pressing Enter in the preset input to send the preset
  if (AppState.presetInput) {
    AppState.presetInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendPreset();
      }
    });
  }
}
AppState.pendingSends = 0;
/**
 * Toggles a GitHub-style loading indicator at the top of the screen.
 * @param {boolean} isLoading - true to start the loader, false to stop.
 */
function toggleAppLoader(isLoading) {
    const loader = document.getElementById('app-loader');
    if (!loader) return;

    if (isLoading) {
        loader.classList.remove('done');
        // Start from 0 width to reset
        loader.style.width = '0%';
        // Use a timeout to ensure the CSS reset is applied before starting the animation
        setTimeout(() => {
            loader.classList.add('loading');
        }, 10);
    } else {
        loader.classList.remove('loading');
        loader.classList.add('done');
        // Instantly transition to 100% and then fade out via CSS `done` class
        loader.style.width = '100%';
        // Remove 'done' after transition completes to reset for next use
        setTimeout(() => {
            loader.classList.remove('done');
            loader.style.width = '0%';
        }, 500); // 500ms should be enough for the 'done' transition
    }
}

function sendPreset() {
  const ids = Array.from(AppState.selectedChats);
  const text = AppState.presetInput.value && AppState.presetInput.value.trim();
  if (!ids.length) {
    AppState.statusEl.textContent = 'No chat selected';
    return;
  }
  if (!text) {
    AppState.statusEl.textContent = 'No preset text';
    return;
  }

  // 1. START LOADER
  toggleAppLoader(true);
  
  // 2. Initialize pending sends counter (New line)
  AppState.pendingSends = ids.length; 
  
  // 3. Update status immediately and clear input for speed perception
  AppState.statusEl.textContent = `Sending reply to ${ids.length} chat(s)...`;
  AppState.presetInput.value = '';
  
  // 4. Send the preset message(s)
  for (const id of ids) {
    socket.emit('sendPreset', { chatId: id, text });
  }
}

function createSettingsSidebar() {
  const header = document.querySelector('header');
  if (!header) return;

  // Check if sidebar already exists
  if (document.getElementById('settings-sidebar')) return;

  const sidebar = document.createElement('div');
  sidebar.id = 'settings-sidebar';
  sidebar.style.position = 'fixed';
  sidebar.style.left = '-308px';
  sidebar.style.top = '60px';
  sidebar.style.width = '300px';
  sidebar.style.height = 'calc(100vh - 60px)';
  sidebar.style.background = 'var(--bg-card)';
  sidebar.style.borderRight = '1px solid var(--border-medium)';
  sidebar.style.overflowY = 'auto';
  sidebar.style.zIndex = '1000';
  sidebar.style.transition = 'left 0.3s ease';
  sidebar.style.boxShadow = '2px 0 10px rgba(0,0,0,0.1)';
  sidebar.style.display = 'flex';
  sidebar.style.flexDirection = 'column';

  document.body.appendChild(sidebar);

  // Create settings header in sidebar
  const sidebarHeader = document.createElement('div');
  sidebarHeader.style.padding = '12px';
  sidebarHeader.style.borderBottom = '1px solid var(--border-medium)';
  sidebarHeader.style.fontWeight = 'bold';
  sidebarHeader.textContent = 'Settings';
  sidebar.appendChild(sidebarHeader);

  // Create toggles container (fixed at top)
  const togglesContainer = document.createElement('div');
  togglesContainer.style.display = 'flex';
  togglesContainer.style.flexDirection = 'column';
  togglesContainer.style.borderBottom = '1px solid var(--border-medium)';
  togglesContainer.style.flexShrink = '0';

  // Tags settings toggle
  const tagsToggle = document.createElement('div');
  tagsToggle.style.padding = '8px 12px';
  tagsToggle.style.borderBottom = '1px solid var(--border-light)';
  tagsToggle.style.cursor = 'pointer';
  tagsToggle.style.display = 'flex';
  tagsToggle.style.justifyContent = 'space-between';
  tagsToggle.style.alignItems = 'center';
  const tagsLabel = document.createElement('span');
  tagsLabel.textContent = 'Tags';
  const tagsChevron = document.createElement('span');
  tagsChevron.textContent = '▼';
  tagsChevron.style.fontSize = '10px';
  tagsToggle.appendChild(tagsLabel);
  tagsToggle.appendChild(tagsChevron);
  tagsToggle.addEventListener('click', () => {
    AppState.tagsSettingsOpen = !AppState.tagsSettingsOpen;
    tagsChevron.textContent = AppState.tagsSettingsOpen ? '▲' : '▼';
    renderTagsSettings();
  });
  togglesContainer.appendChild(tagsToggle);

  // Notes settings toggle
  const notesToggle = document.createElement('div');
  notesToggle.style.padding = '8px 12px';
  notesToggle.style.borderBottom = '1px solid var(--border-light)';
  notesToggle.style.cursor = 'pointer';
  notesToggle.style.display = 'flex';
  notesToggle.style.justifyContent = 'space-between';
  notesToggle.style.alignItems = 'center';
  const notesLabel = document.createElement('span');
  notesLabel.textContent = 'Notes';
  const notesChevron = document.createElement('span');
  notesChevron.textContent = '▼';
  notesChevron.style.fontSize = '10px';
  notesToggle.appendChild(notesLabel);
  notesToggle.appendChild(notesChevron);
  notesToggle.addEventListener('click', () => {
    AppState.notesSettingsOpen = !AppState.notesSettingsOpen;
    notesChevron.textContent = AppState.notesSettingsOpen ? '▲' : '▼';
    renderNotesSettings();
  });
  togglesContainer.appendChild(notesToggle);

  // Quick Replies settings toggle
  const quickRepliesToggle = document.createElement('div');
  quickRepliesToggle.style.padding = '8px 12px';
  quickRepliesToggle.style.borderBottom = '1px solid var(--border-light)';
  quickRepliesToggle.style.cursor = 'pointer';
  quickRepliesToggle.style.display = 'flex';
  quickRepliesToggle.style.justifyContent = 'space-between';
  quickRepliesToggle.style.alignItems = 'center';
  const quickRepliesLabel = document.createElement('span');
  quickRepliesLabel.textContent = 'Quick Replies';
  const quickRepliesChevron = document.createElement('span');
  quickRepliesChevron.textContent = '▼';
  quickRepliesChevron.style.fontSize = '10px';
  quickRepliesToggle.appendChild(quickRepliesLabel);
  quickRepliesToggle.appendChild(quickRepliesChevron);
  quickRepliesToggle.addEventListener('click', () => {
    AppState.quickRepliesSettingsOpen = !AppState.quickRepliesSettingsOpen;
    quickRepliesChevron.textContent = AppState.quickRepliesSettingsOpen ? '▲' : '▼';
    renderQuickRepliesSettings();
  });
  togglesContainer.appendChild(quickRepliesToggle);

  // Keyboard Shortcuts button
  const shortcutsBtn = document.createElement('div');
  shortcutsBtn.style.padding = '8px 12px';
  shortcutsBtn.style.borderBottom = '1px solid var(--border-light)';
  shortcutsBtn.style.cursor = 'pointer';
  shortcutsBtn.style.display = 'flex';
  shortcutsBtn.style.justifyContent = 'space-between';
  shortcutsBtn.style.alignItems = 'center';
  shortcutsBtn.style.background = 'var(--bg-status)';
  shortcutsBtn.textContent = '⌨️ Keyboard Shortcuts';
  shortcutsBtn.style.fontWeight = '500';
  shortcutsBtn.style.color = 'var(--color-accent)';
  shortcutsBtn.addEventListener('mouseenter', () => {
    shortcutsBtn.style.backgroundColor = 'var(--bg-card-hover)';
  });
  shortcutsBtn.addEventListener('mouseleave', () => {
    shortcutsBtn.style.backgroundColor = 'var(--bg-status)';
  });
  shortcutsBtn.addEventListener('click', () => {
    showShortcutsGuide();
  });
  togglesContainer.appendChild(shortcutsBtn);

  // Logout button
  const logoutBtn = document.createElement('div');
  logoutBtn.style.padding = '8px 12px';
  logoutBtn.style.borderBottom = '1px solid var(--border-light)';
  logoutBtn.style.cursor = 'pointer';
  logoutBtn.style.display = 'flex';
  logoutBtn.style.justifyContent = 'space-between';
  logoutBtn.style.alignItems = 'center';
  logoutBtn.style.background = 'var(--bg-card)';
  logoutBtn.textContent = '🚪 Logout from WhatsApp';
  logoutBtn.style.fontWeight = '500';
  logoutBtn.style.color = '#e74c3c';
  logoutBtn.addEventListener('mouseenter', () => {
    logoutBtn.style.backgroundColor = 'var(--bg-card-hover)';
  });
  logoutBtn.addEventListener('mouseleave', () => {
    logoutBtn.style.backgroundColor = 'var(--bg-card)';
  });
  logoutBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to logout from WhatsApp? You will need to scan the QR code again.')) {
      try {
        const response = await fetch('/api/logout', { method: 'POST' });
        if (response.ok) {
          alert('Logged out successfully. The page will reload.');
          window.location.reload();
        } else {
          alert('Failed to logout. Please try again.');
        }
      } catch (err) {
        console.error('Logout error:', err);
        alert('Error during logout: ' + err.message);
      }
    }
  });
  togglesContainer.appendChild(logoutBtn);

  sidebar.appendChild(togglesContainer);

  // Create content container (scrollable)
  const contentContainer = document.createElement('div');
  contentContainer.id = 'settings-content';
  contentContainer.style.flex = '1';
  contentContainer.style.overflowY = 'auto';
  contentContainer.style.padding = '8px 0';
  sidebar.appendChild(contentContainer);

  // Setup hamburger menu button
  const existingHamburger = document.getElementById('hamburger-menu');
  if (existingHamburger) {
    existingHamburger.style.display = 'block';
    existingHamburger.innerHTML = '☰';
    existingHamburger.style.background = 'none';
    existingHamburger.style.border = 'none';
    existingHamburger.style.fontSize = '24px';
    existingHamburger.style.cursor = 'pointer';
    existingHamburger.style.padding = '8px 12px';
    existingHamburger.style.marginRight = '12px';
    existingHamburger.style.color = 'var(--text-secondary)';
    existingHamburger.addEventListener('click', () => toggleSidebar());
  }

  // Setup quick reply add button
  const quickReplyAddBtn = document.getElementById('quick-reply-add-btn');
  if (quickReplyAddBtn) {
    quickReplyAddBtn.addEventListener('click', () => {
      openQuickReplyEditor('', async (text) => {
        if (!text) return;
        await createQuickReplyOnServer(text);
        await loadQuickRepliesFromServer();
        renderQuickReplies();
        renderQuickRepliesSettings();
      });
    });
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('settings-sidebar');
  const messages = document.getElementById('messages');
  if (!sidebar) return;

  AppState.sidebarVisible = !AppState.sidebarVisible;
  if (AppState.sidebarVisible) {
    sidebar.style.left = '0';
    if (messages) messages.style.marginLeft = '308px';
  } else {
    sidebar.style.left = '-308px';
    if (messages) messages.style.marginLeft = '0';
  }
}

// Create a search button in the header that expands to an input and shows results
function createHeaderSearch() {
  const header = document.querySelector('header');
  if (!header) return;

  // Avoid duplicate
  if (document.getElementById('search-toggle')) return;

  const wrapper = document.createElement('div');
  wrapper.id = 'header-search-wrapper';
  wrapper.style.position = 'relative';
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.gap = '8px';
  wrapper.style.marginLeft = '8px';

  const btn = document.createElement('button');
  btn.id = 'search-toggle';
  btn.className = 'qr-btn';
  btn.title = 'Search Chats';
  btn.setAttribute('aria-label', 'Search Chats');
  btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
  btn.style.padding = '6px 8px';

  const input = document.createElement('input');
  input.id = 'header-search-input';
  input.type = 'search';
  input.placeholder = 'Search chats...';
  input.style.transition = 'width 0.18s ease, opacity 0.18s ease';
  input.style.width = '0px';
  input.style.opacity = '0';
  input.style.padding = '6px 8px';
  input.style.borderRadius = '8px';
  input.style.border = '1px solid var(--border-input)';
  input.style.background = 'var(--bg-input)';
  input.style.color = 'var(--text-primary)';

  const results = document.createElement('div');
  results.id = 'header-search-results';
  results.style.position = 'absolute';
  results.style.top = '40px';
  results.style.right = '0';
  results.style.minWidth = '260px';
  results.style.maxWidth = '420px';
  results.style.background = 'var(--bg-card)';
  results.style.border = '1px solid var(--border-medium)';
  results.style.borderRadius = '8px';
  results.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
  results.style.zIndex = '1200';
  results.style.display = 'none';
  results.style.overflow = 'auto';
  results.style.maxHeight = '320px';

  wrapper.appendChild(btn);
  wrapper.appendChild(input);
  // small hint help text for keyboard navigation
  const hint = document.createElement('div');
  hint.id = 'header-search-hint';
  hint.textContent = 'Use ↑/↓ to navigate • Enter to select • Esc to close';
  hint.style.fontSize = '12px';
  hint.style.color = 'var(--text-secondary)';
  hint.style.marginLeft = '8px';
  hint.style.opacity = '0';
  hint.style.transition = 'opacity 0.18s ease';
  wrapper.appendChild(hint);

  wrapper.appendChild(results);

  // Prefer inserting the search wrapper into the right-side header controls so it stays right-aligned.
  const headerControls = document.getElementById('header-controls-right');
  const status = document.getElementById('status');
  if (headerControls) {
    headerControls.insertBefore(wrapper, headerControls.firstChild);
  } else if (status && status.parentElement === header) {
    header.insertBefore(wrapper, status);
  } else {
    header.appendChild(wrapper);
  }

  let open = false;
  let selectedIndex = -1;

  function openInput() {
    input.style.width = '260px';
    input.style.opacity = '1';
    input.focus();
    hint.style.opacity = '1';
    // center header controls when search is open
    try {
      const headerControls = document.getElementById('header-controls-right');
      if (headerControls) {
        headerControls.style.marginLeft = '0';
        headerControls.style.marginRight = '0';
        headerControls.style.margin = '0 auto';
        headerControls.style.transform = 'translateY(0)';
      }
    } catch (err) {}
    open = true;
  }

  function closeInput() {
    input.value = '';
    input.style.width = '0px';
    input.style.opacity = '0';
    results.style.display = 'none';
    hint.style.opacity = '0';
    // restore header controls to right-aligned
    try {
      const headerControls = document.getElementById('header-controls-right');
      if (headerControls) {
        headerControls.style.marginLeft = 'auto';
        headerControls.style.marginRight = '';
        headerControls.style.margin = '';
        headerControls.style.transform = '';
      }
    } catch (err) {}
    open = false;
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!open) openInput(); else closeInput();
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) closeInput();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Clear any highlighted result and close
      selectedIndex = -1;
      closeInput();
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const rows = results.querySelectorAll('[data-chat-id]');
      if (rows.length === 0) return;
      if (selectedIndex < rows.length - 1) selectedIndex++; else selectedIndex = 0;
      updateResultHighlight();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = results.querySelectorAll('[data-chat-id]');
      if (rows.length === 0) return;
      if (selectedIndex > 0) selectedIndex--; else selectedIndex = rows.length - 1;
      updateResultHighlight();
      return;
    }

    if (e.key === 'Enter') {
      const rows = results.querySelectorAll('[data-chat-id]');
      if (selectedIndex >= 0 && selectedIndex < rows.length) {
        const id = rows[selectedIndex].getAttribute('data-chat-id');
        handleSearchResultClick(id);
        e.preventDefault();
        return;
      }
      const first = results.querySelector('[data-chat-id]');
      if (first) {
        const id = first.getAttribute('data-chat-id');
        handleSearchResultClick(id);
        e.preventDefault();
      }
    }
  });

  input.addEventListener('input', (e) => {
    const q = String(e.target.value || '').trim();
    if (!q) {
      results.style.display = 'none';
      return;
    }
    const matches = performSearch(q);
    renderSearchResults(matches, results);
  });

  // Search through AppState.chats (name + recent message bodies)
  function performSearch(query) {
    const q = query.toLowerCase();
    const out = [];
    const seen = new Set();
    const chats = AppState.chats || [];
    for (const c of chats) {
      let matched = false;
      if ((c.name || '').toLowerCase().includes(q) || (c.chatId || '').toLowerCase().includes(q)) matched = true;
      if (!matched) {
        for (const m of (c.history || [])) {
          if ((m.body || '').toLowerCase().includes(q)) { matched = true; break; }
        }
      }
      if (matched && !seen.has(c.chatId)) { seen.add(c.chatId); out.push(c); }
    }
    return out;
  }

  // Utility: escape HTML to avoid XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeRegex(s) {
    return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  function highlightMatches(text, query) {
    if (!text) return '';
    if (!query) return escapeHtml(text);
    const escText = escapeHtml(text);
    const escQuery = escapeHtml(query);
    try {
      const re = new RegExp(escapeRegex(escQuery), 'gi');
      return escText.replace(re, (m) => `<span class="search-match" style="background:var(--color-accent);color:#fff;padding:2px 4px;border-radius:3px;">${escapeHtml(m)}</span>`);
    } catch (err) {
      return escText;
    }
  }

  function renderSearchResults(list, container) {
    container.innerHTML = '';
    if (!list || !list.length) {
      const nothing = document.createElement('div');
      nothing.style.padding = '10px';
      nothing.style.color = 'var(--text-secondary)';
      nothing.textContent = 'No results';
      container.appendChild(nothing);
      container.style.display = 'block';
      return;
    }

    let idx = 0;
    selectedIndex = -1; // reset selection when new results come in
    for (const c of list) {
      const row = document.createElement('div');
      row.dataset.index = idx;
      idx++;
      row.style.padding = '8px 10px';
      row.style.borderBottom = '1px solid var(--border-light)';
      row.style.cursor = 'pointer';
      row.style.display = 'flex';
      row.style.flexDirection = 'column';
      row.dataset.chatId = c.chatId;

      const title = document.createElement('div');
      title.style.fontWeight = '600';
      title.style.fontSize = '14px';
      // highlight matches in title
      const q = (input.value || '').trim();
      title.innerHTML = highlightMatches(c.name || c.chatId || '', q);

      const snippet = document.createElement('div');
      snippet.style.fontSize = '12px';
      snippet.style.color = 'var(--text-secondary)';
      // find snippet from history
      let sn = '';
      if (c.history && c.history.length) {
        const found = c.history.find(m => (m.body || '').toLowerCase().includes((input.value || '').toLowerCase()));
        if (found) sn = found.body && (found.body.length > 80 ? found.body.slice(0, 80) + '...' : found.body);
      }
      snippet.innerHTML = highlightMatches(sn, (input.value || '').trim());

      row.appendChild(title);
      row.appendChild(snippet);

      row.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = row.dataset.chatId;
        handleSearchResultClick(id);
      });

      row.addEventListener('mouseenter', () => {
        const i = Number(row.dataset.index);
        selectedIndex = isNaN(i) ? -1 : i;
        updateResultHighlight();
      });

      container.appendChild(row);
    }

    container.style.display = 'block';
    // show hint when there are results
    try {
      if (hint) hint.style.opacity = (list && list.length) ? '1' : '0';
    } catch (err) {}
  }

  function updateResultHighlight() {
    const rows = results.querySelectorAll('[data-chat-id]');
    rows.forEach((r, i) => {
      if (i === selectedIndex) {
        // High-contrast highlight using theme-aware variables
        r.style.background = 'var(--color-accent-selected)';
        r.style.outline = '3px solid var(--color-accent)';
        r.style.boxShadow = '0 6px 18px rgba(0,0,0,0.12)';
        r.style.color = 'var(--text-primary)';
        r.style.fontWeight = '600';
        r.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        r.style.background = '';
        r.style.outline = '';
        r.style.boxShadow = '';
        r.style.color = '';
        r.style.fontWeight = '';
      }
    });
  }

  // When a search result is clicked, add it to selection (preserve existing selection), focus it and scroll into view
  function handleSearchResultClick(chatId) {
    if (!chatId) return;
    // If there is already a selection, add to it; otherwise just add
    if (!AppState.selectedChats) AppState.selectedChats = new Set();
    AppState.selectedChats.add(chatId);
    renderChats();

    // scroll to element
    const el = document.querySelector(`#messages [data-chat-id="${chatId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // brief highlight
      el.style.transition = 'box-shadow 0.25s ease, transform 0.25s ease';
      const prev = el.style.boxShadow;
      el.style.boxShadow = '0 8px 28px rgba(0,0,0,0.25)';
      setTimeout(() => { el.style.boxShadow = prev || 'var(--shadow-card)'; }, 800);
    }

    // keep search open for additional selection
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', initializeApp);
