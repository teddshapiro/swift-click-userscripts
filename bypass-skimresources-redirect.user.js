// ==UserScript==
// @name         Bypass Skimresources Redirect
// @namespace    tedd.local
// @version      1.1
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/bypass-skimresources-redirect.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/bypass-skimresources-redirect.user.js
// @description  Automatically redirect skimresources links to the real destination
// @match        https://go.skimresources.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const params = new URLSearchParams(window.location.search);
    const target = params.get("url");

    if (target) {
        const decoded = decodeURIComponent(target);
        window.location.replace(decoded);
    }
})();
