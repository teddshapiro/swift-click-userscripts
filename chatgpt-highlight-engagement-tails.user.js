// ==UserScript==
// @name         ChatGPT: Highlight engagement tails (safer + looser)
// @namespace    tedd.local
// @version      1.2
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/chatgpt-highlight-engagement-tails.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/chatgpt-highlight-engagement-tails.user.js
// @description  Highlights likely engagement-tail text in assistant messages (preview only). Looser matching for statements like "If you want, I can...".
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const STYLE_ID = 'tm-tail-preview-style-v2';

  // Match common "engagement tail" openers.
  // We *do not* require a question mark anymore.
  const TAIL_START_RE = /\b(?:if you want|if you'd like|if you would like|want me to|would you like(?: me)? to|do you want me to|should i|can i|i can|i could|i'm happy to|i am happy to|let me know if|tell me if)\b/i;

  // Only consider a tail if it begins fairly late in the paragraph OR the paragraph is short and the tail begins near the end.
  // (Prevents highlighting legitimate uses early in long content too often.)
  const MAX_P_LEN = 900;      // ignore giant paragraphs
  const LATE_THRESHOLD = 320; // tail should be within last N chars
  const SHORT_P = 420;        // but allow whole short paragraphs too

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
.tm-tail-preview,
.tm-tail-preview-paragraph {
  color: #9ca3af !important;
  opacity: 0.6;
}

.tm-tail-preview *,
.tm-tail-preview-paragraph * {
  color: inherit !important;
}
    `;
    document.documentElement.appendChild(style);
  }

  function shouldConsiderTail(text, startIdx) {
    const len = text.length;
    if (len > MAX_P_LEN) return false;

    const tailLen = len - startIdx;

    // Tail starts late -> likely an appended "what next?" prompt
    if (tailLen <= LATE_THRESHOLD) return true;

    // Short paragraph that is basically just a tail prompt
    if (len <= SHORT_P && startIdx <= 40) return true;

    return false;
  }

  function highlightParagraph(p) {
    if (!p || p.nodeType !== 1) return;
    if (p.closest('pre, code')) return;
    if (p.dataset.tmTailPreviewDone === '1') return;

    const fullText = (p.textContent || '').trim();
    if (!fullText) {
      p.dataset.tmTailPreviewDone = '1';
      return;
    }

    const match = fullText.match(TAIL_START_RE);
    if (!match || match.index == null) {
      p.dataset.tmTailPreviewDone = '1';
      return;
    }

    const startIdx = match.index;
    if (!shouldConsiderTail(fullText, startIdx)) {
      p.dataset.tmTailPreviewDone = '1';
      return;
    }

    // Try to wrap tail precisely (this rebuilds as plain text, so it may drop inline formatting in that paragraph).
    // If you want a format-preserving Range-based wrapper, we can do that next.
    const head = fullText.slice(0, startIdx);
    const tail = fullText.slice(startIdx);

    // If tail is essentially the whole paragraph, use a paragraph-level highlight (keeps it readable + obvious).
    if (startIdx < 8) {
      p.classList.add('tm-tail-preview-paragraph');
      p.dataset.tmTailPreviewDone = '1';
      return;
    }

    p.replaceChildren(
      document.createTextNode(head),
      (() => {
        const span = document.createElement('span');
        span.className = 'tm-tail-preview';
        span.textContent = tail;
        return span;
      })()
    );

    p.dataset.tmTailPreviewDone = '1';
  }

  function scan() {
    // This selector matches your current DOM (your screenshot shows <p> tags under assistant turns)
    const paras = document.querySelectorAll('[data-message-author-role="assistant"] p');
    paras.forEach(highlightParagraph);
  }

  injectStyle();
  scan();

  // Debounced observer that disconnects while scanning to prevent feedback loops
  let timer = null;
  const obs = new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      try {
        obs.disconnect();
        scan();
      } finally {
        obs.observe(document.body, { childList: true, subtree: true });
      }
    }, 250);
  });

  obs.observe(document.body, { childList: true, subtree: true });
})();
