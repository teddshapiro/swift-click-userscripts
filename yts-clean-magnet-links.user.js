// ==UserScript==
// @name         YTS Clean Magnet Links
// @namespace    ted-starter
// @version      0.2
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/yts-clean-magnet-links.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/yts-clean-magnet-links.user.js
// @description  Reveal direct magnet links and reduce ad-driven click behavior
// @match        https://en.yts-official.top/movies/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const APP_VERSION = '0.2';

  function unhide(el) {
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('opacity', '1', 'important');
  }

  function cleanLink(a) {
    a.removeAttribute('onclick');
    a.removeAttribute('onmousedown');
    a.removeAttribute('target');
    a.rel = 'noopener noreferrer nofollow';
  }

  function buildPanel(magnetLinks) {
    if (document.getElementById('tm-clean-magnets')) return;

    const panel = document.createElement('div');
    panel.id = 'tm-clean-magnets';
    panel.style.cssText = [
      'position: relative',
      'z-index: 999999',
      'margin: 16px auto',
      'padding: 16px',
      'max-width: 1100px',
      'background: #111',
      'color: #fff',
      'border: 2px solid #75c74e',
      'border-radius: 10px',
      'font-family: Arial, sans-serif'
    ].join(';');

    const title = document.createElement('div');
    title.textContent = 'Clean Magnet Links';
    title.style.cssText = 'font-size: 20px; font-weight: bold; margin-bottom: 12px;';
    panel.appendChild(title);

    magnetLinks.forEach((href, i) => {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = `Open magnet link ${i + 1}`;
      a.style.cssText = [
        'display: inline-block',
        'margin: 6px 10px 6px 0',
        'padding: 10px 14px',
        'background: #75c74e',
        'color: #fff',
        'text-decoration: none',
        'border-radius: 6px',
        'font-weight: bold'
      ].join(';');
      cleanLink(a);
      panel.appendChild(a);
    });

    const version = document.createElement('div');
    version.textContent = 'v' + APP_VERSION;
    version.style.cssText = 'font-size: 11px; color: #9ca3af; margin-top: 10px;';
    panel.appendChild(version);

    const target = document.querySelector('#movie-content') || document.body;
    target.prepend(panel);
  }

  function run() {
    document.querySelectorAll('.torrent-modal-download, .modal-download, p[style*="display:none"]').forEach(unhide);

    const links = [...document.querySelectorAll('a[href^="magnet:"]')];
    links.forEach(cleanLink);

    const uniqueMagnets = [...new Set(links.map(a => a.href))];
    if (uniqueMagnets.length) {
      buildPanel(uniqueMagnets);
    }

    document.querySelectorAll('script[src*="flexmesonyx"], iframe[src*="flexmesonyx"]').forEach(el => el.remove());
  }

  run();
})();
