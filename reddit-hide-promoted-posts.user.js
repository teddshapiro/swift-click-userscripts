// ==UserScript==
// @name         Reddit Hide Promoted Posts
// @namespace    ted-reddit-cleanup
// @version      0.8
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/reddit-hide-promoted-posts.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/reddit-hide-promoted-posts.user.js
// @description  Hide Reddit promoted posts plus in-feed Reddit app/game posts, and show a hidden count at the top
// @match        https://www.reddit.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const APP_VERSION = '0.8';

  const HIDDEN_ATTR = 'data-tm-promoted-hidden';
  const HIDDEN_REASON_ATTR = 'data-tm-feed-hidden-reason';
  const PLACEHOLDER_ATTR = 'data-tm-promoted-placeholder';
  const DIVIDER_HIDDEN_ATTR = 'data-tm-feed-divider-hidden';
  const BANNER_ID = 'tm-promoted-counter';

  const REASON_PROMOTED = 'promoted';
  const REASON_APP = 'app';

  function makePlaceholder(label) {
    const el = document.createElement('div');
    el.setAttribute(PLACEHOLDER_ATTR, '1');
    el.textContent = label;
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
    const hidden = Array.from(
      document.querySelectorAll('[' + HIDDEN_ATTR + '="1"]')
    );

    const promotedCount = hidden.filter(post =>
      post.getAttribute(HIDDEN_REASON_ATTR) === REASON_PROMOTED
    ).length;

    const appCount = hidden.filter(post =>
      post.getAttribute(HIDDEN_REASON_ATTR) === REASON_APP
    ).length;

    const total = hidden.length;
    const parts = [];

    if (promotedCount > 0) {
      parts.push(
        promotedCount === 1
          ? '1 promoted post'
          : promotedCount + ' promoted posts'
      );
    }

    if (appCount > 0) {
      parts.push(
        appCount === 1
          ? '1 Reddit app/game post'
          : appCount + ' Reddit app/game posts'
      );
    }

    const banner = ensureBanner();

    if (total === 0) {
      banner.textContent = '0 feed items hidden · v' + APP_VERSION;
      return;
    }

    banner.textContent =
      parts.join(' + ') +
      ' hidden · ' +
      total +
      ' total · v' +
      APP_VERSION;
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

  function looksLikeRedditAppPost(post) {
    if (!(post instanceof HTMLElement)) return false;

    if (post.hasAttribute('app-slug')) return true;
    if (post.matches('shreddit-post[app-slug]')) return true;
    if (post.querySelector('devvit-post')) return true;
    if (post.querySelector('devvit-post-consume-tracker')) return true;

    return false;
  }

  function isPostDetailPage() {
    return /\/comments\//u.test(window.location.pathname);
  }

  function hideAdjacentDivider(post) {
    const article = post.closest('article');
    if (!article) return;

    const next = article.nextElementSibling;
    if (!(next instanceof HTMLElement)) return;
    if (next.tagName !== 'HR') return;
    if (next.getAttribute(DIVIDER_HIDDEN_ATTR) === '1') return;

    next.style.display = 'none';
    next.setAttribute(DIVIDER_HIDDEN_ATTR, '1');
  }

  function hidePost(post, reason) {
    if (!isLikelyFeedPost(post)) return;
    if (post.getAttribute(HIDDEN_ATTR) === '1') return;
    if (!post.parentNode) return;

    if (reason === REASON_PROMOTED) {
      const placeholder = makePlaceholder('Promoted post hidden');
      post.parentNode.insertBefore(placeholder, post);
    }

    post.style.display = 'none';
    post.setAttribute(HIDDEN_ATTR, '1');
    post.setAttribute(HIDDEN_REASON_ATTR, reason);

    if (reason === REASON_APP) {
      const article = post.closest('article');
      if (article && article !== post) {
        article.style.display = 'none';
      }
      hideAdjacentDivider(post);
    }

    updateBanner();
  }

  function scanRedditAppPosts() {
    if (isPostDetailPage()) return;

    const directCandidates = document.querySelectorAll(
      'shreddit-post[app-slug], ' +
      'devvit-post, ' +
      'devvit-post-consume-tracker'
    );

    for (const node of directCandidates) {
      const post = findPostContainer(node) || (isLikelyFeedPost(node) ? node : null);
      if (post && looksLikeRedditAppPost(post)) {
        hidePost(post, REASON_APP);
      }
    }

    document.querySelectorAll('shreddit-post[app-slug]').forEach(post => {
      if (looksLikeRedditAppPost(post)) {
        hidePost(post, REASON_APP);
      }
    });
  }

  function scanPromotedPosts() {
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
        hidePost(post, REASON_PROMOTED);
      }
    }

    document.querySelectorAll('shreddit-post, article, [id^="t3_"]').forEach(post => {
      if (looksPromoted(post)) {
        hidePost(post, REASON_PROMOTED);
      }
    });
  }

  function scan() {
    scanRedditAppPosts();
    scanPromotedPosts();
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
