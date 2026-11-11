// ==UserScript==
// @name         SwiftClick Organizer (Technical PoC)
// @namespace    https://swiftclicktools.com/
// @version      0.1.0-alpha.1
// @description  Local category-first front door for loaded ChatGPT projects and chats. Experimental: incomplete inventory.
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
  const CATEGORY_TREE = [
    { id: 'family', label: 'Family', icon: '👪', parent: null },
    { id: 'henry', label: 'Henry', icon: '📁', parent: 'family' },
    { id: 'bradley', label: 'Bradley', icon: '📁', parent: 'family' },
    { id: 'family-other', label: 'Other family matters', icon: '📁', parent: 'family' },
    { id: 'health', label: 'My Health', icon: '♡', parent: null },
    { id: 'business', label: 'SwiftClick Business', icon: '◈', parent: null },
    { id: 'ai', label: 'Generative AI', icon: '✧', parent: null },
    { id: 'hobbies', label: 'Hobbies & Interests', icon: '✿', parent: null },
    { id: 'cinema', label: 'Cinema Decoder', icon: '🎬', parent: 'hobbies' },
    { id: 'uncategorized', label: 'Uncategorized', icon: '▤', parent: null }
  ];

  // Pure utilities are tested without a browser. The script never reads chat message bodies.
  function isHomeRoute(pathname) {
    return pathname === '/' || pathname === '';
  }

  function validCategory(id) {
    return CATEGORY_TREE.some((c) => c.id === id);
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
      return { type, key, title: title || (type === 'chat' ? 'Untitled chat' : 'Unnamed project'), href: link };
    } catch (_) {
      return null;
    }
  }

  function isDescendant(categoryId, possibleAncestor) {
    let node = CATEGORY_TREE.find((x) => x.id === categoryId);
    while (node) {
      if (node.id === possibleAncestor) return true;
      node = CATEGORY_TREE.find((x) => x.id === node.parent);
    }
    return false;
  }

  // Node regression tests opt in to helpers, bypassing browser initialization.
  if (typeof globalThis !== 'undefined' && globalThis.__SC_ORGANIZER_TEST_HOOKS__) {
    Object.assign(globalThis.__SC_ORGANIZER_TEST_HOOKS__, {
      isHomeRoute, parseItemLink, isDescendant, validCategory
    });
    return;
  }

  if (!document.documentElement || !document.body) return;
  if (document.getElementById(APP_ID + '-overlay')) return;

  const seen = new Map(); // Session-only inventory: no cross-account stored chat titles/links.
  let currentCategory = null;
  let query = '';
  let open = false;
  let lastRoute = location.pathname;
  let refreshTimer = 0;

  function readAssignments() {
    try {
      const value = GM_getValue(STORAGE_KEY, {});
      if (!value || typeof value !== 'object' || typeof value.assignments !== 'object') return {};
      const clean = {};
      for (const [key, categoryId] of Object.entries(value.assignments || {})) {
        if (/^(chat|project):[a-zA-Z0-9-]{1,160}$/.test(key) && validCategory(categoryId)) {
          clean[key] = categoryId;
        }
      }
      return clean;
    } catch (error) {
      console.warn('[SwiftClick Organizer] Could not read local labels:', error);
      return {};
    }
  }
  let assignments = readAssignments();

  function saveAssignments() {
    try {
      GM_setValue(STORAGE_KEY, { version: 1, assignments });
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
    ':host([data-placement="floating"]){position:fixed;left:14px;bottom:18px;z-index:2147483600;}',
    ':host([data-placement="sidebar"]){position:relative;margin:5px 6px;z-index:2;}',
    'button{display:flex;align-items:center;gap:8px;cursor:pointer;padding:9px 12px;border:1px solid #778397;border-radius:12px;background:#17212f;color:#fff;font:600 12px/1.4 system-ui;box-shadow:0 4px 16px #0003;}',
    ':host([data-placement="sidebar"]) button{width:100%;box-shadow:none;}',
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
    '.item-title{min-width:0;flex:1;color:#ecf4ff;font-size:14px;text-decoration:none;overflow-wrap:anywhere;}',
    '.item-title:hover{text-decoration:underline;}',
    '.pill{color:#b0c0d4;font-size:11px;text-transform:uppercase;letter-spacing:.5px;}',
    'select{max-width:210px;min-width:130px;background:#223449;border:1px solid #52657c;border-radius:8px;padding:7px;color:#f3f8ff;font-size:12px;}',
    '.foot{padding:12px 20px;border-top:1px solid #304052;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;}',
    '.hint{color:#b1c2d8;font-size:12px;line-height:1.55;}',
    '.empty{padding:24px 14px;border:1px dashed #526579;border-radius:12px;color:#b6c5d9;text-align:center;font-size:13px;}',
    '@media(max-width:620px){.main{padding:14px}.head{padding:12px}.item{flex-wrap:wrap}select{max-width:none;width:100%}.cards{grid-template-columns:1fr 1fr}.card{padding:12px;min-height:90px}}'
  ].join('\n');

  const launcherHost = el('div');
  launcherHost.id = APP_ID + '-launcher';
  launcherHost.dataset.placement = 'floating';
  const launcherRoot = launcherHost.attachShadow({ mode: 'open' });
  stylesheet(launcherRoot, LAUNCHER_CSS);
  const launcherButton = button('▦  SwiftClick Organizer', '', () => show());
  launcherButton.setAttribute('aria-label', 'Open SwiftClick Organizer');
  launcherRoot.appendChild(launcherButton);
  document.documentElement.appendChild(launcherHost);

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

  function labelFor(id) {
    return (CATEGORY_TREE.find((c) => c.id === id) || CATEGORY_TREE[CATEGORY_TREE.length - 1]).label;
  }

  function categoryFor(item) {
    const c = assignments[item.key];
    return validCategory(c) ? c : 'uncategorized';
  }

  function visibleItems(categoryId) {
    return [...seen.values()].filter((item) => {
      const assigned = categoryFor(item);
      return categoryId === null || isDescendant(assigned, categoryId);
    });
  }

  function indexAnchor(anchor) {
    const title = anchor.getAttribute('aria-label') || anchor.textContent || '';
    const item = parseItemLink(anchor.getAttribute('href'), title, location.origin);
    if (!item) return false;
    const existing = seen.get(item.key);
    if (existing && existing.title.length > item.title.length && item.title.startsWith('Unnamed')) return false;
    if (existing && existing.title === item.title && existing.href === item.href) return false;
    seen.set(item.key, item);
    return true;
  }

  function collectLoadedLinks() {
    let changed = false;
    const containers = document.querySelectorAll('nav, aside, [data-testid*="sidebar"], [data-sidebar]');
    for (const container of containers) {
      if (launcherHost.contains(container) || overlayHost.contains(container)) continue;
      for (const anchor of container.querySelectorAll('a[href]')) {
        if (indexAnchor(anchor)) changed = true;
      }
    }
    // The current route is useful even if the native sidebar is collapsed.
    const pageTitle = (document.title || '').replace(/\s*[-|]\s*ChatGPT\s*$/i, '');
    const activeItem = parseItemLink(location.href, pageTitle, location.origin);
    if (activeItem) {
      const prior = seen.get(activeItem.key);
      if (!prior || prior.title !== activeItem.title) {
        seen.set(activeItem.key, activeItem);
        changed = true;
      }
    }
    if (changed && open) render();
  }

  function findSidebar() {
    const candidates = document.querySelectorAll('[data-testid*="sidebar"], [data-sidebar], nav, aside');
    for (const candidate of candidates) {
      if (candidate === launcherHost || candidate.contains(launcherHost)) continue;
      if (candidate.querySelector('a[href*="/c/"],a[href*="/g/g-p-"]')) return candidate;
    }
    return null;
  }

  function positionLauncher() {
    const sidebar = findSidebar();
    if (sidebar && !sidebar.contains(launcherHost)) {
      sidebar.insertBefore(launcherHost, sidebar.firstChild);
      launcherHost.dataset.placement = 'sidebar';
    } else if (!sidebar && launcherHost.parentNode !== document.documentElement) {
      document.documentElement.appendChild(launcherHost);
      launcherHost.dataset.placement = 'floating';
    }
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
    card.appendChild(el('span', 'card-meta', count + ' observed item' + (count === 1 ? '' : 's')));
    return card;
  }

  function makeItemRow(item) {
    const row = el('div', 'item');
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
    for (const c of CATEGORY_TREE) {
      const opt = el('option', '', c.parent ? '   ' + c.label : c.label);
      opt.value = c.id;
      selector.appendChild(opt);
    }
    selector.value = categoryFor(item);
    selector.addEventListener('change', () => {
      if (selector.value === 'uncategorized') delete assignments[item.key];
      else assignments[item.key] = selector.value;
      saveAssignments();
      render();
    });
    row.appendChild(selector);
    return row;
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

    const search = el('input', 'search');
    search.type = 'search';
    search.placeholder = 'Search observed projects and chats...';
    search.setAttribute('aria-label', 'Search observed projects and chats');
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
    const directChildren = CATEGORY_TREE.filter((c) => c.parent === currentCategory);
    if (!hasSearch && directChildren.length) {
      const cards = el('div', 'cards');
      directChildren.forEach((category) => cards.appendChild(makeCategoryCard(category)));
      content.appendChild(cards);
    }

    const filtered = visibleItems(hasSearch ? null : currentCategory).filter((item) => {
      const q = query.toLocaleLowerCase().trim();
      return !q || (item.title + ' ' + item.type + ' ' + labelFor(categoryFor(item))).toLocaleLowerCase().includes(q);
    }).sort((a, b) => a.type.localeCompare(b.type) || a.title.localeCompare(b.title));
    if (!hasSearch && currentCategory === null) {
      // The default front door is categories, not a wall of chat links.
      content.appendChild(el('p', 'hint', 'Choose a category or search above. Uncategorized is the inbox for links not yet assigned.'));
    } else {
      content.appendChild(el('p', 'hint', filtered.length + ' matching loaded project/chat links'));
      const list = el('div', 'items');
      filtered.slice(0, 250).forEach((item) => list.appendChild(makeItemRow(item)));
      if (!filtered.length) list.appendChild(el('div', 'empty', 'No matching items observed yet. Expand your ChatGPT sidebar or visit the item, then reopen this view.'));
      content.appendChild(list);
    }
    panel.appendChild(content);

    const footer = el('div', 'foot');
    footer.appendChild(el('span', 'hint', seen.size + ' links observed in this browser session. This is NOT a complete ChatGPT inventory.'));
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

  function show() {
    collectLoadedLinks();
    open = true;
    currentCategory = null;
    query = '';
    render();
    overlayHost.hidden = false;
    window.requestAnimationFrame(() => {
      // Some restrictive CSP configurations block inline <style>. Do not leave broken UI.
      if (window.getComputedStyle(backdrop).position !== 'fixed') {
        hide();
        window.alert('SwiftClick Organizer styling was blocked by this page. The overlay was removed to avoid a broken interface.');
        return;
      }
      const search = panel.querySelector('input.search');
      if (search) search.focus();
    });
  }

  function hide() {
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
      positionLauncher();
      collectLoadedLinks();
    }, 400);
  }

  const observer = new MutationObserver((records) => {
    if (records.every((r) => launcherHost.contains(r.target) || overlayHost.contains(r.target))) return;
    scheduleRefresh();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.setInterval(() => {
    if (lastRoute !== location.pathname) {
      lastRoute = location.pathname;
      if (open) hide();
      scheduleRefresh();
    }
  }, 1000);

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Open SwiftClick Organizer', show);
  }

  positionLauncher();
  collectLoadedLinks();

  // Only initial ChatGPT home entry auto-opens; direct links must remain unobstructed.
  if (isHomeRoute(location.pathname)) {
    window.setTimeout(() => {
      if (isHomeRoute(location.pathname) && !open) show();
    }, 750);
  }
})();
