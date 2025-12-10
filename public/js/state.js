// Global application state
const AppState = {
  chats: [],
  pinned: new Set(),
  selectedChats: new Set(),
  notesCounts: {},
  tags: [],
  tagAssignments: {},
  selectedTagFilters: new Set(),
  tagsSettingsOpen: false,
  tagsImportHandlerAttached: false,
  notesSettingsOpen: false,
  sidebarVisible: false,
  quickReplies: [],
  showAllQuickReplies: false,
  quickRepliesSettingsOpen: false,
  currentContextMenu: null,
  pendingSends: 0
};

// Export state
window.AppState = AppState;
