// ==UserScript==
// @name         TiVoCommunity: Force external links to new tab + fix right-click
// @namespace    tedd.local
// @version      5.5
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/tivocommunity-external-links.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/tivocommunity-external-links.user.js
// @description  Left-click opens external links in a new tab (bypassing skim hijack). Right-click menu works and "Open in new tab" uses the clean URL. Hover over thread titles to open temporary reading tabs with Close & Return.
// @match        https://www.tivocommunity.com/*
// @match        https://tivocommunity.com/*
// @match        https://cnn.com/*
// @run-at       document-start
// @grant        GM_openInTab
// @grant        GM_getTab
// @grant        GM_saveTab
// @grant        window.close
// ==/UserScript==

(function () {
  'use strict';

  const SITE_HOST = location.host;

  function isExternalHttpUrl(url) {
    try {
      const u = new URL(url, location.href);
      return (u.protocol === 'http:' || u.protocol === 'https:') && u.host !== SITE_HOST;
    } catch {
      return false;
    }
  }

  function cleanSkimUrl(url) {
    try {
      const u = new URL(url, location.href);
      if (u.hostname !== 'go.skimresources.com') return null;
      const target = u.searchParams.get('url');
      return target ? decodeURIComponent(target) : null;
    } catch {
      return null;
    }
  }

  function getCleanDestination(a) {
    // Prefer the real href attribute, not the resolved property, because sites play games.
    const raw = a.getAttribute('href') || '';
    const resolved = a.href || raw;

    // If it's a skim link, extract the destination.
    const fromRaw = cleanSkimUrl(raw);
    if (fromRaw) return new URL(fromRaw, location.href).toString();

    const fromResolved = cleanSkimUrl(resolved);
    if (fromResolved) return new URL(fromResolved, location.href).toString();

    // Otherwise, just normalize the external URL.
    try {
      return new URL(raw || resolved, location.href).toString();
    } catch {
      return null;
    }
  }

  // 1) Left-click: open ALL external http(s) links in a new tab.
  function onClick(ev) {
    if (ev.button !== 0) return; // only left click

    const a = ev.target?.closest?.('a[href]');
    if (!a) return;

    const href = a.getAttribute('href') || a.href;
    if (!href) return;

    if (
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:')
    ) return;

    if (!isExternalHttpUrl(href) && !cleanSkimUrl(href)) return;

    const cleanUrl = getCleanDestination(a);
    if (!cleanUrl) return;

    // Stop site hijacker and open ourselves.
    ev.preventDefault();
    ev.stopImmediatePropagation();

    if (typeof GM_openInTab === 'function') {
      GM_openInTab(cleanUrl, { active: true, insert: true, setParent: true });
    } else {
      window.open(cleanUrl, '_blank');
    }
  }

  // 2) Right-click: rewrite href in-place so the browser context menu uses the clean URL.
  function onContextMenu(ev) {
    const a = ev.target?.closest?.('a[href]');
    if (!a) return;

    const href = a.getAttribute('href') || a.href;
    if (!href) return;

    // Only bother for skim or external links
    if (!isExternalHttpUrl(href) && !cleanSkimUrl(href)) return;

    const cleanUrl = getCleanDestination(a);
    if (!cleanUrl) return;

    // Rewrite without blocking the menu.
    // This makes "Open Link in New Tab/Window" use the clean destination.
    a.setAttribute('href', cleanUrl);
  }


  // 3) Thread titles: reveal a separate new-tab button on hover or focus.
  function installThreadTabButtons() {
    if (!/^(www\.)?tivocommunity\.com$/i.test(location.hostname)) return;

    const selector = '.structItem-title a[href], .articlePreview-title a[href], .contentRow-title a[href]';
    const processed = new WeakSet();
    const style = document.createElement('style');
    style.textContent = `
      .sc-thread-tab-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
        width: 25px;
        height: 24px;
        margin: 0 0 0 4px;
        padding: 3px;
        border: 1px solid transparent;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        opacity: 0;
        pointer-events: none;
        box-sizing: border-box;
      }
      a:hover + .sc-thread-tab-button,
      a:focus + .sc-thread-tab-button,
      .sc-thread-tab-button:hover,
      .sc-thread-tab-button:focus {
        opacity: 1;
        pointer-events: auto;
      }
      .sc-thread-tab-button:hover,
      .sc-thread-tab-button:focus-visible {
        border-color: currentColor;
        background: rgba(128,128,128,.12);
      }
      @media (hover: none) {
        .sc-thread-tab-button { opacity: 1; pointer-events: auto; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);

    function isThreadTitle(a) {
      if (a.classList.contains('labelLink')) return false;
      try {
        const u = new URL(a.href, location.href);
        return u.origin === location.origin &&
          /(?:^|\/)threads\/[^/]+(?:\/|$)/i.test(u.pathname);
      } catch { return false; }
    }

    function addButton(a) {
      if (processed.has(a) || !isThreadTitle(a)) return;
      if (a.nextElementSibling?.classList.contains('sc-thread-tab-button')) {
        processed.add(a);
        return;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sc-thread-tab-button';
      button.title = 'Open thread in new tab';
      button.setAttribute('aria-label', 'Open thread in new tab: ' + a.textContent.trim());
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      for (const [key, value] of Object.entries({
        width: '15', height: '15', viewBox: '0 0 24 24',
        fill: 'none', stroke: 'currentColor', 'stroke-width': '2',
        'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        'aria-hidden': 'true'
      })) svg.setAttribute(key, value);
      for (const d of [
        'M13 5h6v6', 'M19 5l-9 9',
        'M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5'
      ]) {
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', d);
        svg.appendChild(path);
      }
      button.appendChild(svg);
      // Keep the hover target continuous across the small space beside the title.
      button.style.marginLeft = '0';
      button.style.width = '29px';
      button.style.paddingLeft = '7px';
      button.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (!isThreadTitle(a)) return;
        if (typeof GM_openInTab === 'function') {
          GM_openInTab(temporaryThreadUrl(a.href), { active: true, insert: true, setParent: true });
        } else {
          window.open(temporaryThreadUrl(a.href), '_blank', 'noopener');
        }
      });
      a.after(button);
      processed.add(a);
    }

    function scan(root) {
      if (root.nodeType === 1 && root.matches(selector)) addButton(root);
      root.querySelectorAll?.(selector).forEach(addButton);
    }

    scan(document);
    // Also cover thread lists loaded or replaced by the forum after page load.
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1 && !node.classList.contains('sc-thread-tab-button')) scan(node);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }


  // 4) Initialize temporary tabs before following unread-post redirects.
  const READING_KEY = 'swiftclickTemporaryReadingTab';
  const READING_HASH = '#sc-reading-target=';

  function temporaryThreadUrl(href) {
    const entry = new URL(location.href);
    entry.hash = READING_HASH + encodeURIComponent(new URL(href, location.href).href);
    return entry.href;
  }

  function installCloseAndReturn() {
    if (window.top !== window.self ||
        !/^(www\.)?tivocommunity\.com$/i.test(location.hostname)) return;

    function showButton() {
      function mount() {
        if (document.getElementById('sc-close-reading-tab')) return;
        const button = document.createElement('button');
        button.id = 'sc-close-reading-tab';
        button.type = 'button';
        button.title = 'Close this temporary tab and return to the previous tab';
        button.setAttribute('aria-label', 'Close and return');
        button.textContent = '×  Close & Return';
        Object.assign(button.style, {
          display: 'inline-flex', alignItems: 'center', flexShrink: '0',
          background: '#79501e', color: '#fff', border: '1px solid #fff',
          borderRadius: '6px', padding: '7px 12px',
          font: '600 14px system-ui, sans-serif', cursor: 'pointer',
          whiteSpace: 'nowrap', marginLeft: '12px', verticalAlign: 'middle'
        });
        button.addEventListener('click', event => {
          if (!event.isTrusted) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          window.close();
        });
        function place() {
          // Position against the rendered logo, not its possibly zero-width/absolute wrapper.
          const candidates = [...document.querySelectorAll(
            '.p-nav-smallLogo img, .p-header-logo img, .p-nav-smallLogo svg, .p-header-logo svg, .p-nav-smallLogo, .p-header-logo'
          )];
          const rects = candidates.map(el => el.getBoundingClientRect()).filter(r =>
            r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < 160 && r.right > 0);
          const logo = rects.sort((a,b) => b.right - a.right)[0];
          const left = Math.max(180, logo ? logo.right + 14 : 180);
          const top = logo ? Math.max(8, (logo.top + logo.bottom - button.offsetHeight) / 2) : 16;
          Object.assign(button.style, {
            position:'fixed', left: Math.min(left, Math.max(8, window.innerWidth - button.offsetWidth - 12)) + 'px',
            right:'auto', top:top + 'px', marginLeft:'0', zIndex:'2147483647'
          });
        }
        document.body.appendChild(button);
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, {passive:true});
      }
      if (document.body && document.readyState !== 'loading') mount();
      else document.addEventListener('DOMContentLoaded', mount, {once:true});
    }

    if (location.hash.startsWith(READING_HASH)) {
      let target;
      try {
        target = new URL(decodeURIComponent(location.hash.slice(READING_HASH.length)));
        if (target.origin !== location.origin || !/(?:^|\/)threads\/[^/]+/i.test(target.pathname)) return;
      } catch { return; }
      let proceeded = false;
      function proceed() {
        if (proceeded) return;
        proceeded = true;
        location.replace(target.href);
      }
      try { sessionStorage.setItem(READING_KEY, '1'); } catch {}
      // The bootstrap page records the tab before the forum can redirect the thread URL.
      setTimeout(proceed, 1500);
      try {
        GM_getTab(tab => {
          tab = tab || {};
          tab[READING_KEY] = true;
          GM_saveTab(tab, proceed);
        });
      } catch { proceed(); }
      return;
    }

    let fallback = false;
    try { fallback = sessionStorage.getItem(READING_KEY) === '1'; } catch {}
    if (fallback) showButton();
    try {
      GM_getTab(tab => {
        if (tab && tab[READING_KEY] === true) showButton();
      });
    } catch {}
  }

  installCloseAndReturn();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installThreadTabButtons, { once: true });
  } else {
    installThreadTabButtons();
  }

  document.addEventListener('click', onClick, true);
  document.addEventListener('contextmenu', onContextMenu, true);
})();
