// ==UserScript==
// @name         SwiftClick Organizer (Technical PoC)
// @namespace    https://swiftclicktools.com/
// @version      0.1.0-alpha.8
// @description  Manual-only local organizer for ChatGPT projects and chats. Nothing auto-indexed.
// @author       Swift Click / Tedd
// @match        https://chatgpt.com/*
// @match        https://www.chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  const APP_ID = 'swiftclick-organizer-poc';
  const STORAGE_KEY = APP_ID + '.assignments.v1';
  const MANUAL_PROJECTS_KEY = APP_ID + '.manualProjects.v1';
  const SAVED_CHATS_KEY = APP_ID + '.savedChats.v1';
  const ORDER_KEY = APP_ID + '.categoryOrder.v1';
  const PENDING_INTAKE_KEY = APP_ID + '.pendingProjectNavigation.v1';
  // Flat virtual categories only; do not introduce nested categories in this MVP.
  const CATEGORIES = [
    { id: 'family', label: 'Family', icon: '👪' },
    { id: 'health', label: 'My Health', icon: '♡' },
    { id: 'business', label: 'SwiftClick Business', icon: '◈' },
    { id: 'ai', label: 'Generative AI', icon: '✧' },
    { id: 'hobbies', label: 'Hobbies & Interests', icon: '✿' },
    { id: 'uncategorized', label: 'Uncategorized', icon: '▤' }
  ];

  function cleanIntakeName(value) {
    const title = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!title || /^(?:unnamed project|untitled chat|chatgpt|project home|project|chat)$/i.test(title)) {
      return '';
    }
    return title.replace(/^ChatGPT\s*[-–|]\s*/i, '').replace(/\s*[-–|]\s*Project$/i, '').trim();
  }

  // Prefer the title on the clicked sidebar project row over the title of the
  // project currently open elsewhere on the page.
  function chooseProjectName(trigger, targetKey, savedName, destinationTitle) {
    if (trigger && Date.now() - trigger.at <= 12000 &&
        (!trigger.key || trigger.key === targetKey)) {
      const fromRow = cleanIntakeName(trigger.title);
      if (fromRow) return fromRow;
    }
    return cleanIntakeName(savedName) || cleanIntakeName(destinationTitle);
  }

  // One-time compatibility mapping for assignments saved by alpha.1–5.
  // Convert virtual subcategories into their parent WITHOUT losing linked chats.
  const LEGACY_CATEGORIES = Object.freeze({
    henry: 'family',
    bradley: 'family',
    'family-other': 'family',
    cinema: 'hobbies'
  });

  // Pure utilities are tested without a browser. The script never reads chat message bodies.
  // A user-organized chat needs its title and URL saved, not just a category
  // ID, otherwise it disappears when ChatGPT lazily unloads its sidebar link.
  function sanitizeSavedChat(raw, origin) {
    if (!raw || typeof raw !== 'object') return null;
    const title = String(raw.title || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!title) return null;
    const item = parseItemLink(raw.href, title, origin);
    return item && item.type === 'chat' ? { ...item, manual: true } : null;
  }

  function isHomeRoute(pathname) {
    return pathname === '/' || pathname === '';
  }

  function validCategory(id) {
    return CATEGORIES.some((c) => c.id === id);
  }

  function normalizeCategoryId(id) {
    const mapped = Object.prototype.hasOwnProperty.call(LEGACY_CATEGORIES, id)
      ? LEGACY_CATEGORIES[id] : id;
    return validCategory(mapped) ? mapped : 'uncategorized';
  }

  function itemInCategory(assignedId, selectedId) {
    return selectedId === null || normalizeCategoryId(assignedId) === selectedId;
  }

  function migrateAssignments(rawAssignments) {
    const clean = {};
    let migrated = false;
    if (!rawAssignments || typeof rawAssignments !== 'object' || Array.isArray(rawAssignments)) {
      return { assignments: clean, migrated: false };
    }
    for (const [key, oldId] of Object.entries(rawAssignments)) {
      if (!/^(chat|project):[a-zA-Z0-9-]{1,160}$/.test(key)) continue;
      const id = normalizeCategoryId(oldId);
      if (id !== oldId) migrated = true;
      // Uncategorized is the default and requires no explicit stored label.
      if (id !== 'uncategorized') clean[key] = id;
    }
    return { assignments: clean, migrated };
  }

  function parseItemLink(href, rawTitle, origin) {
    try {
      const url = new URL(href, origin);
      const allowed = ['chatgpt.com', 'www.chatgpt.com', 'chat.openai.com'];
      if (!allowed.includes(url.hostname) || !/^https:$/.test(url.protocol)) return null;
      const path = url.pathname.replace(/\/+$/, '') || '/';
      const chatMatch = path.match(/(?:^|\/)c\/([a-zA-Z0-9-]+)(?:\/|$)/);
      const projectMatch = path.match(/^\/g\/(g-p-[a-zA-Z0-9-]+)(?:\/project)?$/);
      let type, key, link;
      if (chatMatch) {
        type = 'chat';
        key = 'chat:' + chatMatch[1];
        link = url.origin + path;
      } else if (projectMatch) {
        type = 'project';
        key = 'project:' + projectMatch[1];
        link = url.origin + '/g/' + projectMatch[1] + '/project';
      } else {
        return null;
      }
      const title = String(rawTitle || '').replace(/\s+/g, ' ').trim().slice(0, 140);
      // ChatGPT sometimes exposes a document title rather than a short
      // project name (e.g. "ChatGPT - Cinema Decoder - Project").
      const displayTitle = type === 'project'
        ? title.replace(/^ChatGPT\s*[-–|]\s*/i, '').replace(/\s*[-–|]\s*Project$/i, '').trim()
        : title;
      return { type, key, title: displayTitle || (type === 'chat' ? 'Untitled chat' : 'Unnamed project'), href: link };
    } catch (_) {
      return null;
    }
  }

  function sanitizeManualProject(raw, origin) {
    if (!raw || typeof raw !== 'object') return null;
    const name = String(raw.title || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!name) return null;
    const parsed = parseItemLink(raw.href, name, origin);
    return parsed && parsed.type === 'project' ? { ...parsed, manual: true } : null;
  }



  // Order is independent for each flat category. Keep known IDs even when a
  // lazily-loaded ChatGPT sidebar does not currently expose every item.
  function sanitizeCategoryOrders(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw.categories : null;
    const cleaned = {};
    for (const category of CATEGORIES) {
      const entries = source && source[category.id];
      if (!Array.isArray(entries)) continue;
      const unique = new Set();
      for (const key of entries.slice(0, 1000)) {
        if (typeof key === 'string' && /^(chat|project):[a-zA-Z0-9-]{1,160}$/.test(key)) {
          unique.add(key);
        }
      }
      if (unique.size) cleaned[category.id] = [...unique];
    }
    return cleaned;
  }

  function reorderKeys(keys, movingKey, targetKey, after = false) {
    const result = [...keys];
    if (movingKey === targetKey || !result.includes(movingKey) || !result.includes(targetKey)) return result;
    result.splice(result.indexOf(movingKey), 1);
    const targetIndex = result.indexOf(targetKey);
    result.splice(targetIndex + (after ? 1 : 0), 0, movingKey);
    return result;
  }

  // Preserve not-currently-visible IDs in their previous positions when the
  // user reorders the visible portion of the category.
  function mergeVisibleOrder(storedKeys, reorderedVisibleKeys) {
    const visibleSet = new Set(reorderedVisibleKeys);
    let next = 0;
    const result = [];
    for (const key of storedKeys) {
      if (visibleSet.has(key)) result.push(reorderedVisibleKeys[next++]);
      else result.push(key);
    }
    result.push(...reorderedVisibleKeys.slice(next));
    return [...new Set(result)];
  }

  function orderItems(items, categoryId, categoryOrders) {
    const saved = categoryOrders[categoryId] || [];
    const indices = new Map(saved.map((key, index) => [key, index]));
    return [...items].sort((a, b) => {
      const aIndex = indices.has(a.key) ? indices.get(a.key) : Infinity;
      const bIndex = indices.has(b.key) ? indices.get(b.key) : Infinity;
      return aIndex - bIndex || a.type.localeCompare(b.type) || a.title.localeCompare(b.title);
    });
  }

  // Node regression tests opt in to helpers, bypassing browser initialization.
  if (typeof globalThis !== 'undefined' && globalThis.__SC_ORGANIZER_TEST_HOOKS__) {
    Object.assign(globalThis.__SC_ORGANIZER_TEST_HOOKS__, {
      isHomeRoute, parseItemLink, sanitizeManualProject, validCategory,
      normalizeCategoryId, itemInCategory, migrateAssignments, sanitizeSavedChat,
      cleanIntakeName, chooseProjectName, sanitizeCategoryOrders, reorderKeys, mergeVisibleOrder, orderItems,
      categories: CATEGORIES.map((c) => c.id)
    });
    return;
  }

  if (!document.documentElement || !document.body) return;
  if (document.getElementById(APP_ID + '-overlay')) return;

  const seen = new Map(); // Session-only inventory: no cross-account stored chat titles/links.
  let currentCategory = null;
  let query = '';
  let addingProject = false;
  let addingChat = false;
  let intakeProject = null;
  let intakeChat = null;
  let pendingNativeProject = null;
  let recentProjectTrigger = null;
  let open = false;
  let lastRoute = location.pathname;
  let refreshTimer = 0;
  let dragging = null; // Only local browser UI state; never drag ChatGPT links.

  function readCategoryOrders() {
    try {
      return sanitizeCategoryOrders(GM_getValue(ORDER_KEY, { version: 1, categories: {} }));
    } catch (error) {
      console.warn('[SwiftClick Organizer] Could not read local item order:', error);
      return {};
    }
  }
  let categoryOrders = readCategoryOrders();

  function persistCategoryOrders() {
    try {
      GM_setValue(ORDER_KEY, { version: 1, categories: categoryOrders });
    } catch (error) {
      console.warn('[SwiftClick Organizer] Could not save local item order:', error);
    }
  }

  function forgetItemOrder(key) {
    let modified = false;
    for (const [categoryId, keys] of Object.entries(categoryOrders)) {
      if (keys.includes(key)) {
        const remaining = keys.filter((entry) => entry !== key);
        if (remaining.length) categoryOrders[categoryId] = remaining;
        else delete categoryOrders[categoryId];
        modified = true;
      }
    }
    if (modified) persistCategoryOrders();
  }

  function moveCategoryItem(movingKey, targetKey, after) {
    const categoryId = currentCategory;
    if (!categoryId || query.trim() || movingKey === targetKey) return false;
    const currentItems = orderItems(visibleItems(categoryId), categoryId, categoryOrders);
    const keys = currentItems.map((item) => item.key);
    if (!keys.includes(movingKey) || !keys.includes(targetKey)) return false;
    const reordered = reorderKeys(keys, movingKey, targetKey, after);
    if (reordered.every((key, index) => key === keys[index])) return false;
    categoryOrders[categoryId] = mergeVisibleOrder(categoryOrders[categoryId] || [], reordered).slice(0, 1000);
    persistCategoryOrders();
    render();
    const handle = [...panel.querySelectorAll('.drag-handle')]
      .find((node) => node.dataset.itemKey === movingKey);
    if (handle) handle.focus();
    return true;
  }

  function resetCategoryOrder() {
    if (currentCategory && categoryOrders[currentCategory]) {
      delete categoryOrders[currentCategory];
      persistCategoryOrders();
      render();
    }
  }

  function readAssignments() {
    try {
      const value = GM_getValue(STORAGE_KEY, {});
      if (!value || typeof value !== 'object' || typeof value.assignments !== 'object') return {};
      const { assignments: clean, migrated } = migrateAssignments(value.assignments);
      if (migrated) {
        // Preserve project/chat links and category decisions; only flatten
        // category IDs. This is idempotent and uses the existing storage key.
        try {
          GM_setValue(STORAGE_KEY, { version: 2, assignments: clean });
        } catch (error) {
          // A storage write failure must never blank the user's loaded labels.
          console.warn('[SwiftClick Organizer] Could not persist category migration:', error);
        }
      }
      return clean;
    } catch (error) {
      console.warn('[SwiftClick Organizer] Could not read local labels:', error);
      return {};
    }
  }
  let assignments = readAssignments();

  function readManualProjects() {
    try {
      const raw = GM_getValue(MANUAL_PROJECTS_KEY, []);
      if (!Array.isArray(raw)) return [];
      const saved = new Map();
      for (const data of raw.slice(0, 200)) {
        const item = sanitizeManualProject(data, location.origin);
        if (item) saved.set(item.key, item);
      }
      return [...saved.values()];
    } catch (error) {
      console.warn('[SwiftClick Organizer] Could not load saved project shortcuts:', error);
      return [];
    }
  }
  let manualProjects = readManualProjects();
  for (const project of manualProjects) seen.set(project.key, project);

  function readSavedChats() {
    try {
      const raw = GM_getValue(SAVED_CHATS_KEY, []);
      if (!Array.isArray(raw)) return [];
      const saved = new Map();
      for (const data of raw.slice(0, 500)) {
        const chat = sanitizeSavedChat(data, location.origin);
        if (chat) saved.set(chat.key, chat);
      }
      return [...saved.values()];
    } catch (error) {
      console.warn('[SwiftClick Organizer] Could not load saved chat shortcuts:', error);
      return [];
    }
  }
  let savedChats = readSavedChats();
  for (const chat of savedChats) seen.set(chat.key, chat);

  function saveSavedChats() {
    try {
      GM_setValue(SAVED_CHATS_KEY, savedChats.map(({ href, title }) => ({ href, title })));
    } catch (error) {
      console.warn('[SwiftClick Organizer] Could not save chat shortcuts:', error);
    }
  }

  function saveChatShortcut(chat) {
    const parsed = sanitizeSavedChat(chat, location.origin);
    if (!parsed) return false;
    const prior = savedChats.find((c) => c.key === parsed.key);
    if (!prior && savedChats.length >= 500) return false;
    if (prior) parsed.title = prior.title;
    savedChats = savedChats.filter((c) => c.key !== parsed.key).concat(parsed);
    seen.set(parsed.key, parsed);
    saveSavedChats();
    return true;
  }

  function saveManualProjects() {
    try {
      GM_setValue(MANUAL_PROJECTS_KEY, manualProjects.map(({ href, title }) => ({ href, title })));
    } catch (error) {
      console.warn('[SwiftClick Organizer] Could not save project shortcuts:', error);
    }
  }

  // One type of project, regardless of whether its link was discovered or added by hand.
  // Keep the existing storage key for backwards compatibility with alpha.2–4.
  function saveProjectShortcut(project) {
    const parsed = sanitizeManualProject(project, location.origin);
    if (!parsed) return false;
    const prior = manualProjects.find((p) => p.key === parsed.key);
    if (!prior && manualProjects.length >= 200) return false;
    if (prior && !project.manual) parsed.title = prior.title; // preserve manually supplied names
    manualProjects = manualProjects.filter((p) => p.key !== parsed.key).concat(parsed);
    seen.set(parsed.key, parsed);
    saveManualProjects();
    return true;
  }

  function saveAssignments() {
    try {
      GM_setValue(STORAGE_KEY, { version: 2, assignments });
    } catch (error) {
      console.warn('[SwiftClick Organizer] Could not save local labels:', error);
    }
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function button(label, className, callback) {
    const b = el('button', className, label);
    b.type = 'button';
    b.addEventListener('click', callback);
    return b;
  }

  function stylesheet(root, css) {
    try {
      if ('adoptedStyleSheets' in root && typeof CSSStyleSheet === 'function') {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = [sheet];
        return;
      }
    } catch (error) {
      console.warn('[SwiftClick Organizer] Constructable stylesheet unavailable:', error);
    }
    const style = el('style');
    style.textContent = css;
    root.appendChild(style);
  }

  const LAUNCHER_CSS = [
    ':host{display:block;font-family:system-ui,-apple-system,sans-serif;}',
    ':host{position:fixed;right:10px;top:50%;transform:translateY(-50%);z-index:2147483600;pointer-events:none;}',
    'button{pointer-events:auto;display:flex;align-items:center;gap:8px;cursor:pointer;padding:9px 12px;border:1px solid #778397;border-radius:12px;background:#17212f;color:#fff;font:600 12px/1.4 system-ui;box-shadow:0 4px 16px #0003;}',
    'button:focus-visible{outline:3px solid #7dbbff;outline-offset:2px;}',
    'button:hover{background:#26374b;}'
  ].join('\n');

  const OVERLAY_CSS = [
    ':host{display:block;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#e8edf7;}',
    ':host([hidden]){display:none!important;}',
    '*{box-sizing:border-box;}',
    '.backdrop{position:fixed;inset:0;background:#050c16c9;z-index:2147483601;display:flex;align-items:center;justify-content:center;padding:16px;}',
    '.panel{width:min(1080px,100%);height:min(760px,calc(100vh - 32px));min-height:300px;display:flex;flex-direction:column;border-radius:18px;background:#111b29;box-shadow:0 20px 90px #0009;border:1px solid #35475d;overflow:hidden;}',
    '.head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 20px;border-bottom:1px solid #304052;}',
    '.brand{font-size:17px;font-weight:750;letter-spacing:-.3px;}',
    '.muted{color:#a7b7cc;font-size:12px;}',
    '.main{padding:20px;flex:1;overflow:auto;}',
    '.topline{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px;}',
    'input.search{width:100%;padding:12px 14px;border-radius:10px;background:#202e40;color:#fff;border:1px solid #536478;font:inherit;font-size:14px;}',
    'input:focus-visible,select:focus-visible,button:focus-visible{outline:2px solid #72b6ff;outline-offset:2px;}',
    '.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;}',
    '.card{background:#1b2a3b;border:1px solid #3d5067;color:#f0f5ff;text-align:left;border-radius:13px;padding:20px;cursor:pointer;min-height:102px;}',
    '.card:hover,.card:focus-visible{background:#29435c;border-color:#8bc2ff;}',
    '.card-title{display:block;font-weight:700;font-size:15px;margin:8px 0 4px;}',
    '.card-meta{color:#afc1d8;font-size:12px;}',
    '.toolbar{display:flex;align-items:center;justify-content:space-between;gap:9px;flex-wrap:wrap;margin-bottom:16px;}',
    '.title{font-size:20px;font-weight:750;margin:0 0 4px;}',
    '.action{background:#25384d;border:1px solid #526680;color:#eaf4ff;border-radius:8px;padding:8px 12px;cursor:pointer;font:inherit;font-size:12px;}',
    '.action:hover{background:#35516c;}',
    '.items{display:grid;gap:8px;margin-top:14px;}',
    '.item{display:flex;align-items:center;gap:12px;background:#182739;border:1px solid #364a60;border-radius:10px;padding:11px;}',
    '.drag-handle{background:transparent;color:#bdcfe2;border:1px solid transparent;border-radius:7px;min-width:30px;min-height:36px;padding:4px 6px;cursor:grab;font:700 19px/1 system-ui;touch-action:none;user-select:none;}',
    '.drag-handle:hover,.drag-handle:focus-visible{background:#2d4560;border-color:#6686a4;}',
    '.drag-handle:active{cursor:grabbing;}',
    '.item.drop-before{border-top:3px solid #8ac8ff;padding-top:9px;}',
    '.item.drop-after{border-bottom:3px solid #8ac8ff;padding-bottom:9px;}',
    '.item.is-dragging{opacity:.45;}',
    '.item-title{min-width:0;flex:1;color:#ecf4ff;font-size:14px;text-decoration:none;overflow-wrap:anywhere;}',
    '.item-title:hover{text-decoration:underline;}',
    '.add-form{border:1px solid #59728e;background:#1b2b40;padding:14px;border-radius:11px;display:grid;gap:10px;margin:10px 0 16px;}',
    '.field-label{display:grid;gap:5px;color:#ccd8ea;font-size:12px;font-weight:600;}',
    '.entry-field{width:100%;padding:10px 12px;background:#111f30;color:#fff;border:1px solid #58708d;border-radius:8px;font:inherit;font-size:14px;}',
    '.form-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}',
    '.error{font-size:12px;color:#ffb6b6;}',
    '.pill{color:#b0c0d4;font-size:11px;text-transform:uppercase;letter-spacing:.5px;}',
    'select{max-width:280px;min-width:160px;background:#223449;border:1px solid #52657c;border-radius:8px;padding:7px;color:#f3f8ff;font-size:12px;}',
    '.foot{padding:12px 20px;border-top:1px solid #304052;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;}',
    '.hint{color:#b1c2d8;font-size:12px;line-height:1.55;}',
    '.empty{padding:24px 14px;border:1px dashed #526579;border-radius:12px;color:#b6c5d9;text-align:center;font-size:13px;}',
    '@media(max-width:620px){.main{padding:14px}.head{padding:12px}.item{flex-wrap:wrap}select{max-width:none;width:100%}.cards{grid-template-columns:1fr 1fr}.card{padding:12px;min-height:90px}}'
  ].join('\n');

  const launcherHost = el('div');
  launcherHost.id = APP_ID + '-launcher';
  const launcherRoot = launcherHost.attachShadow({ mode: 'open' });
  stylesheet(launcherRoot, LAUNCHER_CSS);
  const launcherButton = button('▦  SwiftClick Organizer', '', () => show());
  launcherButton.setAttribute('aria-label', 'Open SwiftClick Organizer');
  launcherRoot.appendChild(launcherButton);
  // Never inject into ChatGPT-owned navigation: its DOM layout/hover actions are fragile.
  document.body.appendChild(launcherHost);

  const overlayHost = el('div');
  overlayHost.id = APP_ID + '-overlay';
  overlayHost.hidden = true;
  const overlayRoot = overlayHost.attachShadow({ mode: 'open' });
  stylesheet(overlayRoot, OVERLAY_CSS);
  const backdrop = el('div', 'backdrop');
  const panel = el('section', 'panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'SwiftClick Organizer');
  backdrop.appendChild(panel);
  overlayRoot.appendChild(backdrop);
  document.documentElement.appendChild(overlayHost);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) hide();
  });

  // The native project menu is React-owned: observe it but never insert children.
  // A small companion action is rendered in our OWN Shadow DOM beside the menu.
  const menuActionHost = el('div');
  menuActionHost.id = APP_ID + '-project-action';
  menuActionHost.hidden = true;
  const menuActionRoot = menuActionHost.attachShadow({ mode: 'open' });
  stylesheet(menuActionRoot, [
    ':host{position:fixed;z-index:2147483550;display:block;pointer-events:none;}',
    ':host([hidden]){display:none!important;}',
    'button{pointer-events:auto;cursor:pointer;background:#16283b;color:#f5f9ff;border:1px solid #7893ae;',
    'box-shadow:0 5px 22px #0005;border-radius:10px;padding:10px 12px;font:600 12px/1.4 system-ui;',
    'white-space:nowrap;max-width:calc(100vw - 16px);}',
    'button:hover{background:#284561;}',
    'button:focus-visible{outline:3px solid #69b6ff;outline-offset:2px;}'
  ].join('\n'));
  const menuActionButton = button('＋ Add to SwiftClick Organizer', '', () => startNativeProjectIntake());
  menuActionButton.setAttribute('aria-label', 'Add this ChatGPT project to SwiftClick Organizer');
  menuActionButton.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    // Prevent the native outside-pointer handler from closing its menu first.
    event.preventDefault();
    event.stopPropagation();
    startNativeProjectIntake();
  });
  menuActionRoot.appendChild(menuActionButton);
  document.body.appendChild(menuActionHost);
  let activeNativeProjectHome = null;

  // Capture the native project row immediately when its three-dot button is
  // clicked, before React portals the menu elsewhere in document.body.
  // This is a one-off user-initiated lookup, NOT background discovery.
  function captureProjectTrigger(target) {
    const buttonNode = target && target.closest && target.closest('button, [role="button"]');
    if (!buttonNode || launcherHost.contains(buttonNode) ||
        overlayHost.contains(buttonNode) || menuActionHost.contains(buttonNode)) return null;
    let node = buttonNode;
    for (let depth = 0; node && depth < 7; depth++, node = node.parentElement) {
      if (!node.querySelectorAll) continue;
      const matches = [];
      for (const anchor of node.querySelectorAll('a[href]')) {
        const project = parseItemLink(anchor.getAttribute('href'), '', location.origin);
        if (project && project.type === 'project') matches.push({ anchor, project });
      }
      // A project row has one native project link. Higher containers with
      // multiple unrelated project links are intentionally rejected.
      if (matches.length !== 1) continue;
      const match = matches[0];
      const title = cleanIntakeName(
        match.anchor.textContent || match.anchor.getAttribute('title') ||
        match.anchor.getAttribute('aria-label')
      );
      if (!title) continue;
      return { at: Date.now(), title, key: match.project.key, href: match.project.href };
    }
    return null;
  }

  document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || open) return;
    const captured = captureProjectTrigger(event.target);
    if (captured) recentProjectTrigger = captured;
  }, true);



  function findNativeProjectMenu() {
    // Only project menus with the explicit native "Project home" action qualify.
    // Never infer the project from the CURRENT page: a different project may
    // be selected in the sidebar when this menu is opened.
    for (const menu of document.querySelectorAll('[role="menu"]')) {
      if (!menu.isConnected || !menu.getClientRects().length) continue;
      const entries = menu.querySelectorAll('[role="menuitem"], a[href], button');
      for (const entry of entries) {
        if (entry.textContent.replace(/\s+/g, ' ').trim().toLowerCase() === 'project home') {
          return { menu, home: entry };
        }
      }
    }
    return null;
  }

  function positionProjectMenuAction() {
    if (open || pendingNativeProject) {
      menuActionHost.hidden = true;
      activeNativeProjectHome = null;
      return;
    }
    const found = findNativeProjectMenu();
    if (!found) {
      menuActionHost.hidden = true;
      activeNativeProjectHome = null;
      return;
    }
    activeNativeProjectHome = found.home;
    const rect = found.menu.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      menuActionHost.hidden = true;
      return;
    }
    // Adjacent to the menu, never overlapping its native actions.
    const actionWidth = 236;
    const actionHeight = 43;
    // Favor an adjacent side panel; placement above a bottom-edge menu can
    // cover the underlying project row and its three-dot/New Chat controls.
    let x, y;
    if (rect.right + actionWidth + 12 <= window.innerWidth) {
      x = rect.right + 8;
      y = Math.max(8, Math.min(window.innerHeight - actionHeight - 8, rect.top));
    } else if (rect.left - actionWidth - 12 >= 0) {
      x = rect.left - actionWidth - 8;
      y = Math.max(8, Math.min(window.innerHeight - actionHeight - 8, rect.top));
    } else {
      x = Math.max(8, Math.min(window.innerWidth - actionWidth - 8, rect.left));
      y = rect.bottom + actionHeight + 12 <= window.innerHeight
        ? rect.bottom + 5
        : Math.max(8, rect.top - actionHeight - 5);
    }
    menuActionHost.style.left = x + 'px';
    menuActionHost.style.top = y + 'px';
    menuActionHost.hidden = false;
  }

  function stashPendingIntake() {
    if (!pendingNativeProject) return;
    try {
      // Short-lived tab-only navigation intent; not a persistent conversation index.
      window.sessionStorage.setItem(PENDING_INTAKE_KEY, JSON.stringify(pendingNativeProject));
    } catch (error) {
      console.warn('[SwiftClick Organizer] Cannot retain intake across a full page load:', error);
    }
  }

  function clearPendingIntake() {
    try { window.sessionStorage.removeItem(PENDING_INTAKE_KEY); } catch (_) { /* optional */ }
  }

  function resumePendingIntake() {
    let pending;
    try {
      const raw = window.sessionStorage.getItem(PENDING_INTAKE_KEY);
      if (raw) pending = JSON.parse(raw);
    } catch (_) { clearPendingIntake(); return false; }
    if (!pending || typeof pending.from !== 'string' || !Number.isFinite(pending.at)) {
      clearPendingIntake();
      return false;
    }
    if (Date.now() - pending.at > 7000) {
      clearPendingIntake();
      return false;
    }
    if (location.href === pending.from) return false;
    const project = parseItemLink(location.href, '', location.origin);
    if (!project || project.type !== 'project') return false;
    const trigger = pending.trigger || null;
    const title = chooseProjectName(trigger, project.key,
      manualProjects.find((p) => p.key === project.key)?.title, projectNameOnPage());
    openProjectIntake({ ...project, title });
    return true;
  }

  function projectNameOnPage() {
    const main = document.querySelector('main');
    const title = main && main.querySelector('h1, [data-testid="project-title"]');
    const value = title ? String(title.textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (value && value.length < 141) return value;
    const fallback = (document.title || '').replace(/\s*[-|]\s*ChatGPT\s*$/i, '').trim();
    return fallback && fallback.toLowerCase() !== 'chatgpt' ? fallback.slice(0, 140) : 'Unnamed project';
  }

  function openProjectIntake(project) {
    if (!project || project.type !== 'project') return;
    pendingNativeProject = null;
    clearPendingIntake();
    menuActionHost.hidden = true;
    // An intake intentionally causes native project navigation. A normal
    // route watcher must not immediately dismiss the just-opened intake.
    lastRoute = location.pathname;
    show();
    intakeProject = project;
    addingProject = true;
    render();
  }

  function resolveNativeProjectIntake() {
    if (!pendingNativeProject) return;
    if (Date.now() - pendingNativeProject.at > 7000) {
      pendingNativeProject = null;
      clearPendingIntake();
      console.warn('[SwiftClick Organizer] Project home did not yield a verifiable project URL.');
      window.alert('SwiftClick could not identify that project automatically. You can still open Project home and use + Add project with its URL.');
      return;
    }
    if (location.href === pendingNativeProject.from) return;
    const project = parseItemLink(location.href, '', location.origin);
    if (project && project.type === 'project') {
      const trigger = pendingNativeProject.trigger || null;
      const name = chooseProjectName(trigger, project.key,
        manualProjects.find((p) => p.key === project.key)?.title, projectNameOnPage());
      openProjectIntake({ ...project, title: name });
    }
  }

  function startNativeProjectIntake() {
    if (open || pendingNativeProject) return;
    const home = activeNativeProjectHome;
    const stillOpen = findNativeProjectMenu();
    if (!home || !home.isConnected || !stillOpen || stillOpen.home !== home) {
      menuActionHost.hidden = true;
      return;
    }
    // Where the native menu contains an actual project link, use its
    // verified href directly. Otherwise invoke the site's own Project home
    // action, then wait to observe a NEW project route; never guess an ID.
    const nativeLink = home.matches('a[href]') ? home : home.querySelector('a[href]');
    const parsed = nativeLink && parseItemLink(nativeLink.getAttribute('href'), '', location.origin);
    if (parsed && parsed.type === 'project') {
      const title = chooseProjectName(recentProjectTrigger, parsed.key,
        manualProjects.find((p) => p.key === parsed.key)?.title, '');
      openProjectIntake({ ...parsed, title });
      return;
    }

    pendingNativeProject = { from: location.href, at: Date.now(),
      trigger: recentProjectTrigger && Date.now() - recentProjectTrigger.at <= 12000
        ? recentProjectTrigger : null };
    stashPendingIntake();
    menuActionHost.hidden = true;
    home.click();
    window.setTimeout(resolveNativeProjectIntake, 100);
    window.setTimeout(resolveNativeProjectIntake, 500);
    window.setTimeout(resolveNativeProjectIntake, 1400);
  }

  function labelFor(id) {
    return (CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1]).label;
  }

  function categoryFor(item) {
    return normalizeCategoryId(assignments[item.key]);
  }

  function visibleItems(categoryId) {
    return [...seen.values()].filter((item) => itemInCategory(categoryFor(item), categoryId));
  }

  function makeCategoryCard(category) {
    const count = visibleItems(category.id).length;
    const card = button('', 'card', () => {
      currentCategory = category.id;
      query = '';
      render();
    });
    card.appendChild(el('span', '', category.icon));
    card.appendChild(el('span', 'card-title', category.label));
    card.appendChild(el('span', 'card-meta', count + ' item' + (count === 1 ? '' : 's')));
    return card;
  }

  function clearDragHighlights() {
    for (const row of panel.querySelectorAll('.item')) {
      row.classList.remove('drop-before', 'drop-after', 'is-dragging');
    }
  }

  function keyboardReorder(item, direction) {
    if (!currentCategory || query.trim()) return;
    const items = orderItems(visibleItems(currentCategory), currentCategory, categoryOrders);
    const at = items.findIndex((entry) => entry.key === item.key);
    const target = items[at + direction];
    if (at < 0 || !target) return;
    moveCategoryItem(item.key, target.key, direction > 0);
  }

  function makeItemRow(item, canReorder = false) {
    const row = el('div', 'item');
    if (canReorder) {
      // Only the dedicated handle is draggable, never the native chat link.
      const handle = button('⠿', 'drag-handle', () => {});
      handle.title = 'Drag to reorder; or press Arrow Up / Arrow Down';
      handle.setAttribute('aria-label', 'Reorder ' + item.title + '. Drag or use Arrow Up and Arrow Down.');
      handle.dataset.itemKey = item.key;
      handle.draggable = true;
      handle.addEventListener('keydown', (event) => {
        if (event.altKey || event.ctrlKey || event.metaKey ||
            (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
        event.preventDefault();
        keyboardReorder(item, event.key === 'ArrowUp' ? -1 : 1);
      });
      handle.addEventListener('dragstart', (event) => {
        if (!event.dataTransfer || !currentCategory || query.trim()) {
          event.preventDefault();
          return;
        }
        dragging = { key: item.key, category: currentCategory };
        event.dataTransfer.effectAllowed = 'move';
        // Firefox requires nonempty drag data; never expose a URL or chat title.
        event.dataTransfer.setData('text/plain', 'SwiftClick Organizer');
        row.classList.add('is-dragging');
      });
      handle.addEventListener('dragend', () => {
        dragging = null;
        clearDragHighlights();
      });
      row.addEventListener('dragover', (event) => {
        if (!dragging || dragging.category !== currentCategory ||
            dragging.key === item.key || !event.dataTransfer) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        row.classList.toggle('drop-before', event.clientY < row.getBoundingClientRect().top +
          row.getBoundingClientRect().height / 2);
        row.classList.toggle('drop-after', !row.classList.contains('drop-before'));
      });
      row.addEventListener('dragleave', (event) => {
        if (!event.relatedTarget || !row.contains(event.relatedTarget)) {
          row.classList.remove('drop-before', 'drop-after');
        }
      });
      row.addEventListener('drop', (event) => {
        if (!dragging || dragging.category !== currentCategory) return;
        event.preventDefault();
        const key = dragging.key;
        const after = event.clientY >= row.getBoundingClientRect().top +
          row.getBoundingClientRect().height / 2;
        dragging = null;
        clearDragHighlights();
        moveCategoryItem(key, item.key, after);
      });
      row.appendChild(handle);
    }
    row.appendChild(el('span', 'pill', item.type === 'project' ? 'Project' : 'Chat'));
    const link = el('a', 'item-title', item.title);
    link.href = item.href;
    link.addEventListener('click', (event) => {
      // Keep native link features, including middle-click and modifier clicks.
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      hide();
    });
    row.appendChild(link);
    const selector = el('select');
    selector.setAttribute('aria-label', 'Place ' + item.title + ' in category');
    for (const c of CATEGORIES) {
      const opt = el('option', '', c.label);
      opt.value = c.id;
      selector.appendChild(opt);
    }
    selector.value = categoryFor(item);
    selector.addEventListener('change', () => {
      // Organizing an observed project also saves its link for future visits.
      // Previously this wrote only a category ID, so the project vanished
      // from SwiftClick after a reload if ChatGPT did not load its sidebar link.
      if ((item.type === 'project' && !saveProjectShortcut(item)) ||
          (item.type === 'chat' && !saveChatShortcut(item))) {
        window.alert('SwiftClick could not save that shortcut. The category was not changed.');
        return;
      }
      if (selector.value !== categoryFor(item)) forgetItemOrder(item.key);
      if (selector.value === 'uncategorized') delete assignments[item.key];
      else assignments[item.key] = selector.value;
      saveAssignments();
      render();
    });
    row.appendChild(selector);
    if (item.manual) {
      const remove = button('Remove shortcut', 'action', () => {
        if (!window.confirm('Remove this locally saved shortcut from SwiftClick Organizer? The original ChatGPT ' + item.type + ' will not change.')) return;
        if (item.type === 'project') {
          manualProjects = manualProjects.filter((p) => p.key !== item.key);
          saveManualProjects();
        } else {
          savedChats = savedChats.filter((c) => c.key !== item.key);
          saveSavedChats();
        }
        seen.delete(item.key);
        delete assignments[item.key];
        forgetItemOrder(item.key);
        saveAssignments();
        render();
      });
      remove.setAttribute('aria-label', 'Remove saved ' + item.type + ' shortcut ' + item.title);
      row.appendChild(remove);
    }
    return row;
  }

  function currentChatForManualIntake() {
    // Only inspect the current chat when the user explicitly clicks Add chat.
    const item = parseItemLink(location.href, '', location.origin);
    if (!item || item.type !== 'chat') return null;
    let title = cleanIntakeName(document.title);
    // Document titles can be generic; one explicit, ID-matched lookup of the
    // current native link is allowed as part of this manual Add action.
    if (!title) {
      for (const link of document.querySelectorAll('nav a[href], aside a[href]')) {
        const linked = parseItemLink(link.getAttribute('href'), '', location.origin);
        if (linked && linked.key === item.key) {
          title = cleanIntakeName(link.textContent || link.getAttribute('aria-label'));
          if (title) break;
        }
      }
    }
    return { ...item, title };
  }

  function makeAddChatForm() {
    const form = el('form', 'add-form');
    form.appendChild(el('div', 'brand', 'Add a ChatGPT conversation'));
    form.appendChild(el('p', 'hint',
      'If you are viewing a chat, its URL and available title are filled in. Otherwise paste a ChatGPT conversation URL and give it a name.'));
    const nameLabel = el('label', 'field-label', 'Chat title');
    const name = el('input', 'entry-field');
    name.type = 'text';
    name.maxLength = 140;
    name.required = true;
    name.placeholder = 'Name this conversation';
    if (intakeChat) name.value = cleanIntakeName(intakeChat.title);
    nameLabel.appendChild(name);
    form.appendChild(nameLabel);

    const urlLabel = el('label', 'field-label', 'ChatGPT conversation URL');
    const url = el('input', 'entry-field');
    url.type = 'url';
    url.required = true;
    url.placeholder = 'https://chatgpt.com/c/…';
    if (intakeChat) url.value = intakeChat.href;
    urlLabel.appendChild(url);
    form.appendChild(urlLabel);

    const categoryLabel = el('label', 'field-label', 'Show conversation in');
    const selector = el('select');
    for (const category of CATEGORIES) {
      const option = el('option', '', category.label);
      option.value = category.id;
      selector.appendChild(option);
    }
    const existing = intakeChat ? assignments[intakeChat.key] : null;
    selector.value = existing && validCategory(existing)
      ? existing : validCategory(currentCategory) ? currentCategory : 'uncategorized';
    categoryLabel.appendChild(selector);
    form.appendChild(categoryLabel);

    const message = el('div', 'error');
    message.setAttribute('role', 'alert');
    form.appendChild(message);
    const actions = el('div', 'form-actions');
    const save = el('button', 'action', 'Save chat shortcut');
    save.type = 'submit';
    actions.appendChild(save);
    actions.appendChild(button('Cancel', 'action', () => {
      addingChat = false;
      intakeChat = null;
      render();
    }));
    form.appendChild(actions);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const item = sanitizeSavedChat({ title: name.value, href: url.value }, location.origin);
      if (!item) {
        message.textContent = 'Please enter a title and a valid ChatGPT conversation link (not a project URL).';
        return;
      }
      if (!saveChatShortcut(item)) {
        message.textContent = 'Could not save the chat shortcut (or the 500-chat limit was reached).';
        return;
      }
      if (selector.value === 'uncategorized') delete assignments[item.key];
      else assignments[item.key] = selector.value;
      saveAssignments();
      addingChat = false;
      intakeChat = null;
      query = '';
      currentCategory = selector.value;
      render();
    });
    return form;
  }

  function makeAddProjectForm() {
    const form = el('form', 'add-form');
    form.appendChild(el('div', 'brand', intakeProject ? 'Organize this ChatGPT project' : 'Add an existing ChatGPT project'));
    form.appendChild(el('p', 'hint', intakeProject ? 'Confirm the detected project and choose where its shortcut should appear.' : 'Open the project in ChatGPT, copy its address from the browser, and paste it here. This creates only a SwiftClick shortcut.'));
    const nameLabel = el('label', 'field-label', 'Project name');
    const name = el('input', 'entry-field');
    name.type = 'text';
    name.placeholder = 'e.g. Coding — Tampermonkey Scripts';
    name.maxLength = 140;
    name.required = true;
    if (intakeProject) name.value = cleanIntakeName(intakeProject.title);
    nameLabel.appendChild(name);
    form.appendChild(nameLabel);
    const urlLabel = el('label', 'field-label', 'ChatGPT project URL');
    const url = el('input', 'entry-field');
    url.type = 'url';
    url.placeholder = 'https://chatgpt.com/g/g-p-…/project';
    url.required = true;
    if (intakeProject) url.value = intakeProject.href;
    urlLabel.appendChild(url);
    form.appendChild(urlLabel);
    const categoryLabel = el('label', 'field-label', 'Show project in');
    const selector = el('select');
    for (const category of CATEGORIES) {
      const option = el('option', '', category.label);
      option.value = category.id;
      selector.appendChild(option);
    }
    selector.value = intakeProject && validCategory(assignments[intakeProject.key])
      ? assignments[intakeProject.key]
      : validCategory(currentCategory) ? currentCategory : 'uncategorized';
    categoryLabel.appendChild(selector);
    form.appendChild(categoryLabel);
    const message = el('div', 'error');
    message.setAttribute('role', 'alert');
    form.appendChild(message);
    const actions = el('div', 'form-actions');
    const save = el('button', 'action', 'Save project shortcut');
    save.type = 'submit';
    actions.appendChild(save);
    actions.appendChild(button('Cancel', 'action', () => {
      addingProject = false;
      intakeProject = null;
      render();
    }));
    form.appendChild(actions);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const parsed = sanitizeManualProject({ title: name.value, href: url.value }, location.origin);
      if (!parsed) {
        message.textContent = 'Please paste a ChatGPT PROJECT URL (not a conversation link). Open the project first and copy the address from your browser.';
        return;
      }
      if (!saveProjectShortcut(parsed)) {
        message.textContent = 'Could not save the project shortcut (or the 200-project limit was reached).';
        return;
      }
      if (selector.value === 'uncategorized') delete assignments[parsed.key];
      else assignments[parsed.key] = selector.value;
      saveManualProjects();
      saveAssignments();
      addingProject = false;
      intakeProject = null;
      query = '';
      currentCategory = selector.value;
      render();
    });
    return form;
  }

  function render() {
    panel.replaceChildren();
    const header = el('div', 'head');
    const brand = el('div');
    brand.appendChild(el('div', 'brand', '▦  SwiftClick Organizer'));
    brand.appendChild(el('div', 'muted', 'A personal front door to ChatGPT · Technical PoC'));
    header.appendChild(brand);
    header.appendChild(button('✕ Close', 'action', hide));
    panel.appendChild(header);

    const content = el('div', 'main');
    if (currentCategory !== null) {
      const toolbar = el('div', 'toolbar');
      toolbar.appendChild(button('← Categories', 'action', () => {
        currentCategory = null;
        query = '';
        render();
      }));
      toolbar.appendChild(el('span', 'muted', labelFor(currentCategory)));
      content.appendChild(toolbar);
    } else {
      content.appendChild(el('h2', 'title', 'Where would you like to go?'));
    }

    const addBar = el('div', 'toolbar');
    const addActions = el('div', 'form-actions');
    addActions.appendChild(button(addingProject ? '− Cancel project' : '+ Add project', 'action', () => {
      addingProject = !addingProject;
      addingChat = false;
      intakeChat = null;
      intakeProject = null;
      render();
    }));
    addActions.appendChild(button(addingChat ? '− Cancel chat' : '+ Add chat', 'action', () => {
      addingChat = !addingChat;
      addingProject = false;
      intakeProject = null;
      intakeChat = addingChat ? currentChatForManualIntake() : null;
      render();
    }));
    addBar.appendChild(addActions);
    addBar.appendChild(el('span', 'hint', 'Only items you explicitly add are listed'));
    content.appendChild(addBar);
    if (addingProject) content.appendChild(makeAddProjectForm());
    if (addingChat) content.appendChild(makeAddChatForm());

    const search = el('input', 'search');
    search.type = 'search';
    search.placeholder = 'Search saved projects and chats...';
    search.setAttribute('aria-label', 'Search saved projects and chats');
    search.value = query;
    search.addEventListener('input', () => {
      query = search.value;
      const cursor = search.selectionStart;
      render();
      const replacement = panel.querySelector('input.search');
      if (replacement) {
        replacement.focus();
        try { replacement.setSelectionRange(cursor, cursor); } catch (_) { /* Search input browser support */ }
      }
    });
    content.appendChild(search);

    const hasSearch = query.trim().length > 0;
    // Category cards appear ONLY on the front door, never within a category.
    if (!hasSearch && currentCategory === null) {
      const cards = el('div', 'cards');
      CATEGORIES.forEach((category) => cards.appendChild(makeCategoryCard(category)));
      content.appendChild(cards);
    }

    const filtered = visibleItems(hasSearch ? null : currentCategory).filter((item) => {
      const q = query.toLocaleLowerCase().trim();
      return !q || (item.title + ' ' + item.type + ' ' + labelFor(categoryFor(item))).toLocaleLowerCase().includes(q);
    });
    const ordered = orderItems(filtered, hasSearch ? 'uncategorized' : currentCategory, categoryOrders);
    if (!hasSearch && currentCategory === null) {
      // The default front door is categories, not a wall of chat links.
      content.appendChild(el('p', 'hint', 'Choose a category or search your saved items. Add projects and chats explicitly; nothing is collected automatically.'));
    } else {
      content.appendChild(el('p', 'hint', hasSearch
        ? filtered.length + ' search result' + (filtered.length === 1 ? '' : 's')
        : filtered.length + ' project' + (filtered.length === 1 ? ' or chat' : 's or chats') + ' in ' + labelFor(currentCategory)));
      const canReorder = !hasSearch && currentCategory !== null && ordered.length <= 250;
      if (canReorder && ordered.length > 1) {
        const instructions = el('div', 'toolbar');
        instructions.appendChild(el('span', 'hint', 'Drag ⠿ to reorder items, or use ↑ / ↓ on a handle. Order is saved for this category.'));
        if (categoryOrders[currentCategory]?.length) {
          instructions.appendChild(button('Reset order', 'action', resetCategoryOrder));
        }
        content.appendChild(instructions);
      }
      const list = el('div', 'items');
      ordered.slice(0, 250).forEach((item) => list.appendChild(makeItemRow(item, canReorder)));
      if (!filtered.length) list.appendChild(el('div', 'empty',
        hasSearch ? 'No matches among currently indexed projects and chats.'
          : 'Nothing saved here yet. Use Add project or Add chat to choose what belongs in this category.'));
      content.appendChild(list);
    }
    panel.appendChild(content);

    const footer = el('div', 'foot');
    footer.appendChild(el('span', 'hint', manualProjects.length + ' projects and ' +
      savedChats.length + ' chats saved locally. Items appear only when you add them.'));
    const reset = button('Clear local category labels', 'action', () => {
      if (window.confirm('Clear all locally saved SwiftClick Organizer category assignments? This will not change ChatGPT.')) {
        assignments = {};
        saveAssignments();
        render();
      }
    });
    footer.appendChild(reset);
    panel.appendChild(footer);
  }

  function show(automatic = false) {
    open = true;
    currentCategory = null;
    addingProject = false;
    addingChat = false;
    intakeProject = null;
    intakeChat = null;
    query = '';
    render();
    overlayHost.hidden = false;
    window.requestAnimationFrame(() => {
      // Some restrictive CSP configurations block inline <style>. Do not leave broken UI.
      if (window.getComputedStyle(backdrop).position !== 'fixed') {
        hide();
        if (!automatic) window.alert('SwiftClick Organizer styling was blocked by this page. The overlay was removed to avoid a broken interface.');
        else console.warn('[SwiftClick Organizer] Auto-open skipped: site styles blocked.');
        return;
      }
      const search = panel.querySelector('input.search');
      if (search) search.focus();
    });
  }

  function hide() {
    dragging = null;
    open = false;
    overlayHost.hidden = true;
    launcherButton.focus();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      hide();
    }
  }, true);

  function scheduleRefresh() {
    if (refreshTimer) window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => {
      refreshTimer = 0;
      positionProjectMenuAction();
      resolveNativeProjectIntake();
    }, 150);
  }

  const observer = new MutationObserver((records) => {
    if (records.every((r) => launcherHost.contains(r.target) || overlayHost.contains(r.target) || menuActionHost.contains(r.target))) return;
    scheduleRefresh();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setInterval(() => {
    if (lastRoute !== location.pathname) {
      lastRoute = location.pathname;
      if (pendingNativeProject) {
        // First consume the project-home route; it opens a new intake dialog.
        resolveNativeProjectIntake();
      } else if (open) {
        hide(); // Ordinary non-intake navigation still closes the organizer.
      }
      scheduleRefresh();
    }
    resolveNativeProjectIntake();
    positionProjectMenuAction();
  }, 1000);

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Open SwiftClick Organizer', show);
  }

  positionProjectMenuAction();
  resumePendingIntake(); // Full page navigation should not lose an intake.

  // Only initial ChatGPT home entry auto-opens; direct links must remain unobstructed.
  if (isHomeRoute(location.pathname)) {
    window.setTimeout(() => {
      if (isHomeRoute(location.pathname) && !open) show(true);
    }, 750);
  }
})();
