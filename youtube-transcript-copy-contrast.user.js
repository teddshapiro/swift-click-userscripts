// ==UserScript==
// @name         YouTube: Fix transcript copy button contrast (aria-label targeted)
// @namespace    tedd.local
// @version      3.1
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/youtube-transcript-copy-contrast.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/youtube-transcript-copy-contrast.user.js
// @description  Styles the transcript-copy button injected by an extension (aria-label "Copy video transcript to clipboard").
// @match        https://www.youtube.com/watch*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

 const CSS = `
  /* Target your extension's button */
  button[aria-label="Copy video transcript to clipboard"],
  button[id^="copy-"][aria-label*="transcript"] {
    background-color: #000000 !important;
    color: #ffffff !important;
    border: 1px solid rgba(255,255,255,0.35) !important;
    border-radius: 999px !important;
    padding: 8px 12px !important;
    font-weight: 700 !important;
    line-height: 1.2 !important;
    box-shadow: 0 1px 2px rgba(0,0,0,0.6) !important;
  }

  button[aria-label="Copy video transcript to clipboard"]:hover,
  button[id^="copy-"][aria-label*="transcript"]:hover {
    background-color: #111111 !important;
  }

  button[aria-label="Copy video transcript to clipboard"]:focus,
  button[id^="copy-"][aria-label*="transcript"]:focus {
    outline: 2px solid rgba(255,255,255,0.8) !important;
    outline-offset: 2px !important;
  }
`;


  function injectStyle() {
    if (document.getElementById('tm-transcript-btn-style')) return;
    const style = document.createElement('style');
    style.id = 'tm-transcript-btn-style';
    style.textContent = CSS;
    document.documentElement.appendChild(style);
  }

  injectStyle();

  // YouTube dynamically swaps page content; re-inject if needed.
  const obs = new MutationObserver(() => injectStyle());
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
