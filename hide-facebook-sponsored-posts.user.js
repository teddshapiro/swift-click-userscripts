// ==UserScript==
// @name         Hide Facebook Sponsored Posts
// @namespace    http://tampermonkey.net/
// @version      1.2
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/hide-facebook-sponsored-posts.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/hide-facebook-sponsored-posts.user.js
// @description  Hides sponsored posts on Facebook feed
// @match        https://www.facebook.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    function hideAds() {
        // Facebook typically labels ads with the text "Sponsored" or "Suggested for you"
        const elements = document.querySelectorAll('div[role="article"]');

        elements.forEach(element => {
            // Adjust the innerText or query selector depending on your localized Facebook language
            if (element.innerText.includes('Sponsored') || element.innerText.includes('Suggested for you')) {
                element.style.display = 'none';
            }
        });
    }

    // Run the script initially and on scroll to catch dynamically loaded ads
    hideAds();
    window.addEventListener('scroll', hideAds);
})();
