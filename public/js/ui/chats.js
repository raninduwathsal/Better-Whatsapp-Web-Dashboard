/**
 * Chats UI Module
 * Handles rendering of chat list and messages
 */

function renderChats() {
  const messagesEl = document.getElementById('messages');
  if (!messagesEl) return;

  messagesEl.innerHTML = '';
  const now = Date.now();
  const sorted = Array.from(AppState.chats);
  sorted.sort((a, b) => {
    // pinned top
    const pa = AppState.pinned.has(a.chatId) ? 1 : 0;
    const pb = AppState.pinned.has(b.chatId) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    // unread next
    if ((b.unreadCount > 0) - (a.unreadCount > 0) !== 0) return (b.unreadCount > 0) - (a.unreadCount > 0);
    return b.lastTimestamp - a.lastTimestamp;
  });

  for (const c of sorted) {
    // filter by selectedTagFilters (if any)
    if (AppState.selectedTagFilters.size > 0) {
      const assigned = AppState.tagAssignments[c.chatId] || [];
      const match = assigned.some(tid => AppState.selectedTagFilters.has(String(tid)) || AppState.selectedTagFilters.has(Number(tid)));
      if (!match) continue;
    }

    const el = document.createElement('div');
    el.className = 'msg';
    el.dataset.chatId = c.chatId;
    if (AppState.selectedChats.has(c.chatId)) el.classList.add('selected');
    if (c.unreadCount > 0) el.classList.add('unread');

    // Add colored left border for assigned tags
    const assignedIds = AppState.tagAssignments[c.chatId] || [];
    if (assignedIds.length > 0) {
      const tagColors = assignedIds.map(tid => {
        const t = AppState.tags.find(x => Number(x.id) === Number(tid));
        return t ? (t.color || '#999') : '#999';
      });
      if (tagColors.length === 1) {
        el.style.borderLeft = `4px solid ${tagColors[0]}`;
      } else if (tagColors.length > 1) {
        const gradientStops = tagColors.map((color, idx) => {
          const start = (idx / tagColors.length) * 100;
          const end = ((idx + 1) / tagColors.length) * 100;
          return `${color} ${start}%, ${color} ${end}%`;
        }).join(', ');
        el.style.borderLeft = `4px solid transparent`;
        el.style.backgroundImage = `linear-gradient(to bottom, ${gradientStops})`;
        el.style.backgroundPosition = 'left';
        el.style.backgroundSize = '4px 100%';
        el.style.backgroundRepeat = 'no-repeat';
      }
    }

    // header: phone/name + unread count
    const header = document.createElement('div');
    header.className = 'meta';
    const left = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = c.name || '';
    left.appendChild(title);

    // show notes badge if any
    const noteCount = AppState.notesCounts[c.chatId] || 0;
    if (noteCount > 0) {
      const noteBadge = document.createElement('span');
      noteBadge.textContent = ` 📝${noteCount}`;
      noteBadge.style.marginLeft = '8px';
      noteBadge.style.fontSize = '12px';
      noteBadge.title = `${noteCount} note${noteCount !== 1 ? 's' : ''}`;
      noteBadge.addEventListener('mouseenter', () => showNotesPreviewBubble(noteBadge, c.chatId));
      noteBadge.addEventListener('mouseleave', () => hideNotesPreviewBubble(noteBadge));
      left.appendChild(noteBadge);
    }

    // tag badges container
    const badgeWrap = document.createElement('span');
    badgeWrap.className = 'tag-badges';
    badgeWrap.style.marginLeft = '8px';
    for (const tid of assignedIds) {
      const t = AppState.tags.find(x => Number(x.id) === Number(tid));
      if (!t) continue;
      const dot = document.createElement('span');
      dot.className = 'tag-dot';
      dot.title = t.name;
      dot.style.display = 'inline-block';
      dot.style.width = '12px';
      dot.style.height = '12px';
      dot.style.borderRadius = '6px';
      dot.style.background = t.color || '#999';
      dot.style.marginRight = '6px';
      badgeWrap.appendChild(dot);
    }
    left.appendChild(badgeWrap);

    const info = document.createElement('span');
    info.style.marginLeft = '8px';
    info.textContent = c.unreadCount > 0 ? `${c.unreadCount} unread` : '';
    left.appendChild(info);
    header.appendChild(left);

    const pinBtn = document.createElement('button');
    pinBtn.className = 'pinBtn';
    pinBtn.textContent = AppState.pinned.has(c.chatId) ? 'Unpin' : 'Pin';
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (AppState.pinned.has(c.chatId)) AppState.pinned.delete(c.chatId);
      else AppState.pinned.add(c.chatId);
      renderChats();
    });
    header.appendChild(pinBtn);

    // history (last 3 messages) as bubbles
    const hist = document.createElement('div');
    hist.className = 'history';
    for (const m of c.history) {
      const isMine = !!m.fromMe;
      const row = document.createElement('div');
      const bubble = document.createElement('div');
      bubble.className = 'bubble ' + (isMine ? 'right' : 'left');

      if (m.hasMedia) {
        const mt = (m.mimetype || '').toLowerCase();
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
        const fullText = String(m.body || '');
        const truncated = fullText.length > 40 ? fullText.slice(0, 40) + '...' : fullText;
        const textNode = document.createElement('div');
        textNode.textContent = truncated;
        if (fullText.length > 40) bubble.title = fullText;
        bubble.appendChild(textNode);
      }

      const ts = document.createElement('span');
      ts.className = 'timestamp';
      ts.textContent = new Date(m.timestamp * 1000).toLocaleTimeString();
      bubble.appendChild(ts);
      row.appendChild(bubble);
      hist.appendChild(row);
    }

    el.appendChild(header);
    el.appendChild(hist);

    // click to open full chat / select chat
    el.addEventListener('click', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (AppState.selectedChats.has(c.chatId)) AppState.selectedChats.delete(c.chatId);
        else AppState.selectedChats.add(c.chatId);
      } else {
        AppState.selectedChats.clear();
        AppState.selectedChats.add(c.chatId);
      }
      renderChats();
    });

    // right-click context menu
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openTagContextMenu(e.clientX, e.clientY, c.chatId);
    });

    messagesEl.appendChild(el);
  }
}
