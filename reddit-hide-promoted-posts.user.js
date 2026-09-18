// ==UserScript==
// @name         Reddit Hide Promoted Posts
// @namespace    ted-reddit-cleanup
// @version      0.7
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/reddit-hide-promoted-posts.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/reddit-hide-promoted-posts.user.js
// @description  Hide Reddit promoted posts, leave a small placeholder, and show a hidden count at the top
// @match        https://www.reddit.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const APP_VERSION = '0.7';

  const HIDDEN_ATTR = 'data-tm-promoted-hidden';
  const PLACEHOLDER_ATTR = 'data-tm-promoted-placeholder';
  const BANNER_ID = 'tm-promoted-counter';

  function makePlaceholder() {
    const el = document.createElement('div');
    el.setAttribute(PLACEHOLDER_ATTR, '1');
    el.textContent = 'Promoted post hidden';
    el.style.cssText = [
      'margin: 8px 0 16px 0',
      'padding: 10px 14px',
      'border: 1px solid rgba(128,128,128,0.35)',
      'border-radius: 14px',
      'background: rgba(128,128,128,0.08)',
      'color: rgb(120,120,120)',
      'font-size: 13px',
      'line-height: 1.4'
    ].join(';');
    return el;
  }

  function ensureBanner() {
    let banner = document.getElementById(BANNER_ID);
    if (banner) return banner;

    banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.style.cssText = [
      'margin: 12px auto',
      'padding: 10px 14px',
      'max-width: 760px',
      'border: 1px solid rgba(128,128,128,0.35)',
      'border-radius: 14px',
      'background: rgba(128,128,128,0.08)',
      'color: rgb(90,90,90)',
      'font-size: 13px',
      'line-height: 1.4',
      'text-align: center'
    ].join(';');

    const target =
      document.querySelector('main') ||
      document.querySelector('[slot="page-content"]') ||
      document.body;

    target.prepend(banner);
    return banner;
  }

  function updateBanner() {
    const count = document.querySelectorAll('[' + HIDDEN_ATTR + '="1"]').length;
    const banner = ensureBanner();
    banner.textContent = count === 1
      ? '1 promoted post hidden · v' + APP_VERSION
      : count + ' promoted posts hidden · v' + APP_VERSION;
  }

  function isLikelyFeedPost(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.matches('shreddit-post')) return true;
    if (el.matches('article')) return true;
    if (el.id && el.id.startsWith('t3_')) return true;
    return false;
  }

  function findPostContainer(node) {
    if (!(node instanceof HTMLElement)) return null;
    return node.closest('shreddit-post, article, [id^="t3_"]');
  }

  function looksPromoted(post) {
    if (!(post instanceof HTMLElement)) return false;

    if (post.hasAttribute('promoted')) return true;
    if (post.querySelector('[data-ad-click-location]')) return true;
    if (post.querySelector('[data-testid="promoted-credit-bar-avatar"]')) return true;
    if (post.querySelector('.promoted-label')) return true;
    if (post.querySelector('image-observer[is-promoted]')) return true;
    if (post.querySelector('shreddit-post-overflow-menu[is-ad]')) return true;

    return false;
  }

  function hidePost(post) {
    if (!isLikelyFeedPost(post)) return;
    if (post.getAttribute(HIDDEN_ATTR) === '1') return;
    if (!post.parentNode) return;

    const placeholder = makePlaceholder();
    post.parentNode.insertBefore(placeholder, post);
    post.style.display = 'none';
    post.setAttribute(HIDDEN_ATTR, '1');
    updateBanner();
  }

  function scan() {
    const directCandidates = document.querySelectorAll(
      'shreddit-post[promoted], ' +
      'article[promoted], ' +
      '[id^="t3_"][promoted], ' +
      '.promoted-label, ' +
      '[data-ad-click-location], ' +
      '[data-testid="promoted-credit-bar-avatar"], ' +
      'image-observer[is-promoted], ' +
      'shreddit-post-overflow-menu[is-ad]'
    );

    for (const node of directCandidates) {
      const post = findPostContainer(node) || (isLikelyFeedPost(node) ? node : null);
      if (post && looksPromoted(post)) {
        hidePost(post);
      }
    }

    document.querySelectorAll('shreddit-post, article, [id^="t3_"]').forEach(post => {
      if (looksPromoted(post)) {
        hidePost(post);
      }
    });

    updateBanner();
  }

  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan();
    });
  }

  const observer = new MutationObserver(scheduleScan);

  scan();
  observer.observe(document.body, { childList: true, subtree: true });
})();
