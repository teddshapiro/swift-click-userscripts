// ==UserScript==
// @name         TiVoCommunity: Force external links to new tab + fix right-click
// @namespace    tedd.local
// @version      5.1
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/tivocommunity-external-links.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/tivocommunity-external-links.user.js
// @description  Left-click opens external links in a new tab (bypassing skim hijack). Right-click menu works and "Open in new tab" uses the clean URL.
// @match        https://www.tivocommunity.com/*
// @match        https://tivocommunity.com/*
// @match        https://cnn.com/*
// @run-at       document-start
// @grant        GM_openInTab
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

  document.addEventListener('click', onClick, true);
  document.addEventListener('contextmenu', onContextMenu, true);
})();
