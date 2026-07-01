/* ===========================================================
   Nova — app logic
   No build step, no dependencies. Everything lives in
   localStorage until you wire up a real API in
   requestAssistantReply() below.
   =========================================================== */
(() => {
  'use strict';

  /* ---------- storage helpers ---------- */
  const STORE_KEY = 'nova.conversations';
  const SETTINGS_KEY = 'nova.settings';
  const THEME_KEY = 'nova.theme';

  const loadConversations = () => {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch { return []; }
  };
  const saveConversations = (list) => localStorage.setItem(STORE_KEY, JSON.stringify(list));

  const loadSettings = () => {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
    catch { return {}; }
  };
  const saveSettings = (s) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));

  /* ---------- state ---------- */
  let conversations = loadConversations();
  let settings = loadSettings();
  let activeId = conversations[0]?.id || null;
  let isThinking = false;

  /* ---------- dom refs ---------- */
  const $ = (sel) => document.querySelector(sel);
  const appEl = $('#app');
  const sidebar = $('#sidebar');
  const conversationList = $('#conversationList');
  const searchInput = $('#searchInput');
  const newChatBtn = $('#newChatBtn');
  const collapseSidebarBtn = $('#collapseSidebar');
  const mobileMenuBtn = $('#mobileMenuBtn');
  const mobileOverlay = $('#mobileOverlay');

  const emptyState = $('#emptyState');
  const thread = $('#thread');
  const suggestionGrid = $('#suggestionGrid');

  const composerForm = $('#composerForm');
  const messageInput = $('#messageInput');
  const sendBtn = $('#sendBtn');
  const composerKeyPill = $('#composerKeyPill');

  const modelPickerBtn = $('#modelPickerBtn');
  const modelDropdown = $('#modelDropdown');
  const currentModelName = $('#currentModelName');

  const themeToggle = $('#themeToggle');
  const settingsBtn = $('#settingsBtn');
  const settingsBtnTop = $('#settingsBtnTop');
  const settingsBackdrop = $('#settingsBackdrop');
  const closeSettings = $('#closeSettings');
  const saveSettingsBtn = $('#saveSettingsBtn');
  const apiKeyInput = $('#apiKeyInput');
  const endpointInput = $('#endpointInput');
  const toggleKeyVisibility = $('#toggleKeyVisibility');
  const soundToggle = $('#soundToggle');
  const clearDataBtn = $('#clearDataBtn');
  const apiStatusLabel = $('#apiStatusLabel');

  const toast = $('#toast');

  /* ===========================================================
     Theme
     =========================================================== */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $('.icon-sun').hidden = theme === 'dark';
    $('.icon-moon').hidden = theme !== 'dark';
    localStorage.setItem(THEME_KEY, theme);
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(localStorage.getItem(THEME_KEY) || (prefersDark ? 'dark' : 'light'));

  themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  /* ===========================================================
     Conversation helpers
     =========================================================== */
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  function getActiveConversation() {
    return conversations.find((c) => c.id === activeId) || null;
  }

  function createConversation() {
    const convo = {
      id: uid(),
      title: 'New chat',
      model: currentModelName.textContent.trim(),
      createdAt: Date.now(),
      messages: [],
    };
    conversations.unshift(convo);
    activeId = convo.id;
    saveConversations(conversations);
    renderSidebar();
    renderThread();
    closeMobileSidebar();
    messageInput.focus();
  }

  function deleteConversation(id, evt) {
    evt?.stopPropagation();
    conversations = conversations.filter((c) => c.id !== id);
    saveConversations(conversations);
    if (activeId === id) activeId = conversations[0]?.id || null;
    renderSidebar();
    renderThread();
  }

  function selectConversation(id) {
    activeId = id;
    renderSidebar();
    renderThread();
    closeMobileSidebar();
  }

  function deriveTitle(text) {
    const clean = text.trim().replace(/\s+/g, ' ');
    return clean.length > 42 ? clean.slice(0, 42) + '…' : clean || 'New chat';
  }

  /* ===========================================================
     Sidebar rendering
     =========================================================== */
  function groupByRecency(list) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfWeek = startOfToday - 6 * 86400000;

    const groups = { Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] };
    list.forEach((c) => {
      const t = c.createdAt;
      if (t >= startOfToday) groups.Today.push(c);
      else if (t >= startOfYesterday) groups.Yesterday.push(c);
      else if (t >= startOfWeek) groups['Previous 7 days'].push(c);
      else groups.Older.push(c);
    });
    return groups;
  }

  function renderSidebar() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = query
      ? conversations.filter((c) => c.title.toLowerCase().includes(query))
      : conversations;

    conversationList.innerHTML = '';

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-conv-list';
      empty.textContent = query ? 'No matches found' : 'No conversations yet';
      conversationList.appendChild(empty);
      return;
    }

    const groups = groupByRecency(filtered);
    Object.entries(groups).forEach(([label, items]) => {
      if (!items.length) return;
      const groupLabel = document.createElement('div');
      groupLabel.className = 'conv-group-label';
      groupLabel.textContent = label;
      conversationList.appendChild(groupLabel);

      items.forEach((c) => {
        const item = document.createElement('div');
        item.className = 'conv-item' + (c.id === activeId ? ' active' : '');
        item.setAttribute('role', 'button');
        item.tabIndex = 0;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'conv-title';
        titleSpan.textContent = c.title;

        const delBtn = document.createElement('button');
        delBtn.className = 'conv-delete';
        delBtn.setAttribute('aria-label', 'Delete conversation');
        delBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0-1 13a1 1 0 01-1 1H8a1 1 0 01-1-1L6 7"/></svg>';
        delBtn.addEventListener('click', (e) => deleteConversation(c.id, e));

        item.appendChild(titleSpan);
        item.appendChild(delBtn);
        item.addEventListener('click', () => selectConversation(c.id));
        item.addEventListener('keydown', (e) => { if (e.key === 'Enter') selectConversation(c.id); });

        conversationList.appendChild(item);
      });
    });
  }

  /* ===========================================================
     Minimal markdown renderer (no deps)
     =========================================================== */
  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function renderMarkdown(raw) {
    let text = escapeHtml(raw);

    // fenced code blocks
    text = text.replace(/```([a-z]*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`);

    // inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // bold / italic
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

    // unordered lists
    text = text.replace(/(^|\n)((?:[-*] .+\n?)+)/g, (m, lead, block) => {
      const items = block.trim().split('\n').map((l) => `<li>${l.replace(/^[-*]\s+/, '')}</li>`).join('');
      return `${lead}<ul>${items}</ul>`;
    });

    // paragraphs (split on blank lines, skip lines already wrapped in block tags)
    const blocks = text.split(/\n{2,}/).map((block) => {
      if (/^<(ul|pre|h\d)/.test(block.trim())) return block;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    });

    return blocks.join('');
  }

  /* ===========================================================
     Thread rendering
     =========================================================== */
  function renderThread() {
    const convo = getActiveConversation();

    if (!convo || convo.messages.length === 0) {
      emptyState.hidden = false;
      thread.hidden = true;
      thread.innerHTML = '';
      return;
    }

    emptyState.hidden = true;
    thread.hidden = false;
    thread.innerHTML = '';

    const inner = document.createElement('div');
    inner.className = 'thread-inner';

    convo.messages.forEach((msg) => {
      inner.appendChild(buildMessageEl(msg));
    });

    thread.appendChild(inner);
    thread.scrollTop = thread.scrollHeight;
  }

  function buildMessageEl(msg) {
    const el = document.createElement('div');
    el.className = `message ${msg.role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = msg.role === 'user' ? 'Y' : '✦';

    const body = document.createElement('div');
    body.className = 'message-body';

    const roleLabel = document.createElement('div');
    roleLabel.className = 'message-role';
    roleLabel.textContent = msg.role === 'user' ? 'You' : 'Nova';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = renderMarkdown(msg.content);

    body.appendChild(roleLabel);
    body.appendChild(content);

    if (msg.role === 'assistant' && !msg.pending) {
      const actions = document.createElement('div');
      actions.className = 'message-actions';

      const copyBtn = document.createElement('button');
      copyBtn.innerHTML = '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 012-2h10"/></svg> Copy';
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content).then(() => showToast('Copied to clipboard'));
      });

      actions.appendChild(copyBtn);
      body.appendChild(actions);
    }

    el.appendChild(avatar);
    el.appendChild(body);
    return el;
  }

  /* ===========================================================
     Sending messages
     =========================================================== */
  function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
    sendBtn.disabled = messageInput.value.trim().length === 0 || isThinking;
  }
  messageInput.addEventListener('input', autoResize);
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      composerForm.requestSubmit();
    }
  });

  composerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text || isThinking) return;
    sendMessage(text);
  });

  suggestionGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.suggestion-card');
    if (!card) return;
    sendMessage(card.dataset.prompt);
  });

  function sendMessage(text) {
    let convo = getActiveConversation();
    if (!convo) {
      convo = {
        id: uid(),
        title: 'New chat',
        model: currentModelName.textContent.trim(),
        createdAt: Date.now(),
        messages: [],
      };
      conversations.unshift(convo);
      activeId = convo.id;
    }

    if (convo.messages.length === 0) {
      convo.title = deriveTitle(text);
    }

    convo.messages.push({ role: 'user', content: text, ts: Date.now() });
    saveConversations(conversations);

    messageInput.value = '';
    autoResize();
    renderSidebar();
    renderThread();
    playSendSound();

    showThinking(convo);
  }

  function showThinking(convo) {
    isThinking = true;
    sendBtn.disabled = true;

    const placeholder = { role: 'assistant', content: '', ts: Date.now(), pending: true };
    convo.messages.push(placeholder);
    renderThread();

    // replace last rendered message's content with a thinking indicator
    const lastMsg = thread.querySelector('.message.assistant:last-child .message-content');
    if (lastMsg) lastMsg.innerHTML = '<div class="thinking"><span></span><span></span><span></span></div>';

    requestAssistantReply(convo)
      .then((replyText) => {
        placeholder.content = replyText;
        delete placeholder.pending;
        saveConversations(conversations);
        isThinking = false;
        renderThread();
        autoResize();
      })
      .catch((err) => {
        placeholder.content = `Something went wrong reaching the model: ${err.message || err}`;
        delete placeholder.pending;
        saveConversations(conversations);
        isThinking = false;
        renderThread();
        autoResize();
      });
  }

  /* ===========================================================
     >>> WIRE YOUR API HERE <<<
     This is the single function to replace once you have a key.
     It currently returns a friendly placeholder so the rest of
     the UI is fully testable without any backend.

     Example real implementation (through your own proxy, since
     calling provider APIs directly from a static page will hit
     CORS restrictions and exposes your key to anyone reading
     the page's network traffic):

       async function requestAssistantReply(convo) {
         const res = await fetch(settings.endpoint, {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json',
             'Authorization': `Bearer ${settings.apiKey}`,
           },
           body: JSON.stringify({
             model: convo.model,
             messages: convo.messages
               .filter(m => !m.pending)
               .map(m => ({ role: m.role, content: m.content })),
           }),
         });
         if (!res.ok) throw new Error(`API error ${res.status}`);
         const data = await res.json();
         return data.reply; // shape depends on your backend
       }
     =========================================================== */
  function requestAssistantReply(convo) {
    return new Promise((resolve) => {
      const delay = 650 + Math.random() * 700;
      setTimeout(() => {
        if (!settings.apiKey) {
          resolve(
            "I'm just a placeholder for now — no API key is connected yet.\n\n" +
            "Open **Settings** (the gear icon) and add your key plus an endpoint to bring real replies to life. " +
            "Everything else — conversations, search, themes, markdown rendering — is already working."
          );
          return;
        }
        resolve(
          "An API key is saved, but this page isn't calling a real model yet — `requestAssistantReply()` " +
          "in `script.js` still returns this placeholder. Wire it up to your endpoint when you're ready."
        );
      }, delay);
    });
  }

  /* ===========================================================
     Model picker
     =========================================================== */
  function toggleModelDropdown(force) {
    const willOpen = force ?? modelDropdown.hidden;
    modelDropdown.hidden = !willOpen;
    modelPickerBtn.setAttribute('aria-expanded', String(willOpen));
  }
  modelPickerBtn.addEventListener('click', () => toggleModelDropdown());
  modelDropdown.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    currentModelName.textContent = li.dataset.model;
    [...modelDropdown.children].forEach((c) => c.classList.toggle('selected', c === li));
    const convo = getActiveConversation();
    if (convo) { convo.model = li.dataset.model; saveConversations(conversations); }
    toggleModelDropdown(false);
  });
  document.addEventListener('click', (e) => {
    if (!modelDropdown.hidden && !e.target.closest('.model-picker')) toggleModelDropdown(false);
  });

  /* ===========================================================
     Sidebar collapse / mobile
     =========================================================== */
  collapseSidebarBtn.addEventListener('click', () => {
    appEl.classList.toggle('sidebar-collapsed');
  });
  mobileMenuBtn.addEventListener('click', () => appEl.classList.add('sidebar-open'));
  mobileOverlay.addEventListener('click', closeMobileSidebar);
  function closeMobileSidebar() { appEl.classList.remove('sidebar-open'); }

  newChatBtn.addEventListener('click', createConversation);
  searchInput.addEventListener('input', renderSidebar);

  /* ===========================================================
     Settings modal
     =========================================================== */
  function openSettings() {
    apiKeyInput.value = settings.apiKey || '';
    endpointInput.value = settings.endpoint || '';
    soundToggle.checked = !!settings.sound;
    settingsBackdrop.hidden = false;
  }
  function hideSettings() { settingsBackdrop.hidden = true; }

  settingsBtn.addEventListener('click', openSettings);
  settingsBtnTop.addEventListener('click', openSettings);
  closeSettings.addEventListener('click', hideSettings);
  settingsBackdrop.addEventListener('click', (e) => { if (e.target === settingsBackdrop) hideSettings(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { hideSettings(); toggleModelDropdown(false); }
  });

  toggleKeyVisibility.addEventListener('click', () => {
    const isPw = apiKeyInput.type === 'password';
    apiKeyInput.type = isPw ? 'text' : 'password';
    toggleKeyVisibility.textContent = isPw ? 'Hide' : 'Show';
  });

  saveSettingsBtn.addEventListener('click', () => {
    settings.apiKey = apiKeyInput.value.trim();
    settings.endpoint = endpointInput.value.trim();
    settings.sound = soundToggle.checked;
    saveSettings(settings);
    updateApiStatus();
    hideSettings();
    showToast('Settings saved');
  });

  clearDataBtn.addEventListener('click', () => {
    if (!confirm('Delete every conversation stored in this browser? This cannot be undone.')) return;
    conversations = [];
    saveConversations(conversations);
    activeId = null;
    renderSidebar();
    renderThread();
    hideSettings();
    showToast('All conversations cleared');
  });

  function updateApiStatus() {
    const hasKey = !!settings.apiKey;
    apiStatusLabel.textContent = hasKey ? 'API key connected' : 'No API key set';
    composerKeyPill.textContent = hasKey ? 'Key connected' : 'No key yet';
    composerKeyPill.className = 'composer-key-pill ' + (hasKey ? 'set' : 'unset');
  }

  /* ===========================================================
     Sound
     =========================================================== */
  let audioCtx;
  function playSendSound() {
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 720;
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.18);
    } catch { /* audio not available, ignore */ }
  }

  /* ===========================================================
     Toast
     =========================================================== */
  let toastTimer;
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  }

  /* ===========================================================
     Init
     =========================================================== */
  updateApiStatus();
  renderSidebar();
  renderThread();
  autoResize();
})();
