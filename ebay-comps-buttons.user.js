// ==UserScript==
// @name         eBay Comps Buttons
// @namespace    https://tampermonkey.net/
// @version      1.1
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/ebay-comps-buttons.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/ebay-comps-buttons.user.js
// @description  Adds a draggable comps panel to eBay item pages.
// @match        https://www.ebay.com/itm/*
// @match        https://www.ebay.com/itm/*/*
// @match        https://www.ebay.com/vi/*
// @grant        GM_openInTab
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const APP_VERSION = '1.1';

    /*
     * =========================
     * EASY SETTINGS TO EDIT
     * =========================
     *
     * If you are not a programmer, this is the main section to customize.
     */

    // Change the button text here.
    const BUTTON_TEXT = {
        sold: 'View Sold Comps',
        active: 'View Active Comps',
    };

    // Change these labels if you want the panel to show different search basis names.
    const SEARCH_MODE_LABELS = {
        upc: 'UPC',
        isbn: 'ISBN',
        title: 'Title',
    };

    // Change which words/phrases get removed from the title here.
    // Add or remove items in this list as needed.
    const REMOVABLE_PHRASES = [
        'RARE',
        'WOW',
        'LOOK',
        'L@@K',
        'FAST SHIPPING',
        'FREE SHIPPING',
        'NICE',
        'VINTAGE',
    ];

    // Change search behavior here.
    const SEARCH_SETTINGS = {
        openInBackground: false,
        preferUpcWhenAvailable: true,
        activeFilters: {
            // Example:
            // _nkw is added automatically from the selected search term.
        },
        soldFilters: {
            LH_Complete: '1',
            LH_Sold: '1',
        },
    };

    // Change the floating panel look and default position here.
    const PANEL_SETTINGS = {
        title: 'Comp Buttons',
        storageKey: 'tm-ebay-comps-panel-position',
        collapsedStorageKey: 'tm-ebay-comps-panel-collapsed',
        top: 90,
        right: 20,
        width: 220,
    };

    const MODE_PRIORITY = ['upc', 'isbn', 'title'];

    const WATCH_SETTINGS = {
        locationCheckIntervalMs: 800,
    };

    const PAGE_SELECTORS = [
        'h1.x-item-title__mainTitle',
        'h1[data-testid="x-item-title-label"]',
        'h1.x-item-title__mainTitle span',
        '.x-item-title__mainTitle',
        '#itemTitle',
    ];

    // If you want the script to check different item-specific details for UPC values,
    // add more labels here.
    const UPC_LABELS = [
        'UPC',
        'Universal Product Code',
    ];

    // If you want the script to check book-related details for ISBN values,
    // add more labels here.
    const ISBN_LABELS = [
        'ISBN',
        'ISBN-10',
        'ISBN-13',
    ];

    function isEbayItemPage() {
        return /\/(itm|vi)\//i.test(window.location.pathname);
    }

    function getTitleText() {
        for (const selector of PAGE_SELECTORS) {
            const element = document.querySelector(selector);
            if (!element) {
                continue;
            }

            const text = element.textContent.replace(/^Details about\s+/i, '').trim();
            if (text) {
                return text;
            }
        }

        return document.title
            .replace(/\s*\|\s*eBay.*$/i, '')
            .replace(/^Details about\s+/i, '')
            .trim();
    }

    function normalizeWhitespace(text) {
        return text.replace(/\s+/g, ' ').trim();
    }

    function looksLikeUpc(value) {
        return /^\d{8,14}$/.test(value);
    }

    function normalizeBookCode(value) {
        return value.replace(/[^0-9Xx]/g, '').toUpperCase();
    }

    function looksLikeIsbn(value) {
        return /^(?:\d{9}[\dX]|\d{13})$/.test(value);
    }

    function escapeRegExp(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function findCodeInElements(labels, validator, normalizer, selectorText) {
        const detailRows = document.querySelectorAll(selectorText);

        for (const row of detailRows) {
            const rowText = normalizeWhitespace(row.textContent || '');
            if (!rowText) {
                continue;
            }

            for (const label of labels) {
                const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:#-]?\\s*([A-Za-z0-9\\-\\s]+)`, 'i');
                const match = rowText.match(pattern);
                if (!match) {
                    continue;
                }

                const normalized = normalizer(match[1]);
                if (validator(normalized)) {
                    return normalized;
                }
            }
        }

        return '';
    }

    function findCodeInPageText(labels, validator, normalizer) {
        const pageText = normalizeWhitespace(document.body ? document.body.innerText : '');
        if (!pageText) {
            return '';
        }

        for (const label of labels) {
            const pattern = new RegExp(`${escapeRegExp(label)}\\s*[:#-]?\\s*([A-Za-z0-9\\-\\s]+)`, 'i');
            const match = pageText.match(pattern);
            if (!match) {
                continue;
            }

            const normalized = normalizer(match[1]);
            if (validator(normalized)) {
                return normalized;
            }
        }

        return '';
    }

    function findUpcFromItemSpecifics() {
        return findCodeInElements(
            UPC_LABELS,
            looksLikeUpc,
            function (value) {
                return value.replace(/\D/g, '');
            },
            'dl ux-labels-values, .ux-layout-section-evo__row, .itemAttr tr, .ux-labels-values'
        );
    }

    function findUpcFromPageText() {
        return findCodeInPageText(UPC_LABELS, looksLikeUpc, function (value) {
            return value.replace(/\D/g, '');
        });
    }

    function getUpcText() {
        return findUpcFromItemSpecifics() || findUpcFromPageText();
    }

    function findIsbnFromItemSpecifics() {
        return findCodeInElements(
            ISBN_LABELS,
            looksLikeIsbn,
            normalizeBookCode,
            'dl ux-labels-values, .ux-layout-section-evo__row, .itemAttr tr, .ux-labels-values'
        );
    }

    function findIsbnFromPageText() {
        return findCodeInPageText(ISBN_LABELS, looksLikeIsbn, normalizeBookCode);
    }

    function getIsbnText() {
        return findIsbnFromItemSpecifics() || findIsbnFromPageText();
    }

    function cleanTitle(title) {
        let cleaned = title;

        for (const phrase of REMOVABLE_PHRASES) {
            const pattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
            cleaned = cleaned.replace(pattern, ' ');
        }

        cleaned = cleaned
            .replace(/[|]+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .replace(/\s+([,.;:!?])/g, '$1')
            .trim();

        return cleaned || title;
    }

    function getSearchInfo(title) {
        const cleanedTitle = cleanTitle(title);
        const upc = getUpcText();
        const isbn = getIsbnText();
        const queries = {
            upc: upc,
            isbn: isbn,
            title: cleanedTitle,
        };

        let defaultMode = 'title';
        for (const mode of MODE_PRIORITY) {
            if (queries[mode]) {
                defaultMode = mode;
                break;
            }
        }

        return {
            query: queries[defaultMode],
            mode: defaultMode,
            defaultMode: defaultMode,
            queries: queries,
            titleFallbackQuery: cleanedTitle,
        };
    }

    function buildSearchUrl(query, includeSoldFilters) {
        const url = new URL('https://www.ebay.com/sch/i.html');
        const filters = includeSoldFilters
            ? { ...SEARCH_SETTINGS.activeFilters, ...SEARCH_SETTINGS.soldFilters }
            : { ...SEARCH_SETTINGS.activeFilters };

        url.searchParams.set('_nkw', query);

        for (const [key, value] of Object.entries(filters)) {
            url.searchParams.set(key, value);
        }

        return url.toString();
    }

    function openSearch(url) {
        if (typeof GM_openInTab === 'function') {
            GM_openInTab(url, { active: !SEARCH_SETTINGS.openInBackground, insert: true });
            return;
        }

        window.open(url, '_blank', 'noopener,noreferrer');
    }

    function savePanelPosition(left, top) {
        localStorage.setItem(PANEL_SETTINGS.storageKey, JSON.stringify({ left, top }));
    }

    function loadPanelPosition() {
        try {
            const saved = JSON.parse(localStorage.getItem(PANEL_SETTINGS.storageKey) || 'null');
            if (saved && typeof saved.left === 'number' && typeof saved.top === 'number') {
                return saved;
            }
        } catch (error) {
            // Ignore bad saved position data and fall back to defaults.
        }

        return null;
    }

    function clampPanelPosition(left, top, panel) {
        const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
        const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);

        return {
            left: Math.min(Math.max(0, left), maxLeft),
            top: Math.min(Math.max(0, top), maxTop),
        };
    }

    function applyPanelPosition(panel, left, top) {
        const safePosition = clampPanelPosition(left, top, panel);
        panel.style.left = `${safePosition.left}px`;
        panel.style.top = `${safePosition.top}px`;
        panel.style.right = 'auto';
    }

    function applyDefaultPanelPosition(panel) {
        panel.style.left = 'auto';
        panel.style.top = `${PANEL_SETTINGS.top}px`;
        panel.style.right = `${PANEL_SETTINGS.right}px`;
    }

    function savePanelCollapsed(isCollapsed) {
        localStorage.setItem(PANEL_SETTINGS.collapsedStorageKey, isCollapsed ? '1' : '0');
    }

    function loadPanelCollapsed() {
        return localStorage.getItem(PANEL_SETTINGS.collapsedStorageKey) === '1';
    }

    function setPanelCollapsed(panelBody, toggleButton, isCollapsed) {
        panelBody.style.display = isCollapsed ? 'none' : 'grid';
        toggleButton.textContent = isCollapsed ? '+' : '-';
        toggleButton.title = isCollapsed ? 'Expand panel' : 'Minimize panel';
        savePanelCollapsed(isCollapsed);
    }

    function makeHeaderButton(text, titleText) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.title = titleText;

        Object.assign(button.style, {
            minWidth: '24px',
            height: '24px',
            padding: '0 6px',
            background: 'rgba(255, 255, 255, 0.12)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '12px',
            lineHeight: '24px',
            cursor: 'pointer',
        });

        button.addEventListener('mouseenter', function () {
            button.style.background = 'rgba(255, 255, 255, 0.2)';
        });

        button.addEventListener('mouseleave', function () {
            button.style.background = 'rgba(255, 255, 255, 0.12)';
        });

        button.addEventListener('mousedown', function (event) {
            event.stopPropagation();
        });

        return button;
    }

    function createPanel(onRefresh) {
        const panel = document.createElement('div');
        const header = document.createElement('div');
        const title = document.createElement('div');
        const headerButtons = document.createElement('div');
        const statusLine = document.createElement('div');
        const modeRow = document.createElement('div');
        const termRow = document.createElement('div');
        const termText = document.createElement('div');
        const copyButton = document.createElement('button');
        const buttonRow = document.createElement('div');

        panel.id = 'tm-ebay-comps-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            top: `${PANEL_SETTINGS.top}px`,
            right: `${PANEL_SETTINGS.right}px`,
            width: `${PANEL_SETTINGS.width}px`,
            zIndex: '999999',
            background: 'rgba(25, 25, 25, 0.92)',
            color: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
            fontFamily: 'system-ui, sans-serif',
            overflow: 'hidden',
            backdropFilter: 'blur(4px)',
        });

        Object.assign(header.style, {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            background: 'rgba(255, 255, 255, 0.06)',
            cursor: 'move',
            userSelect: 'none',
            fontSize: '13px',
            fontWeight: '700',
            letterSpacing: '0.2px',
        });

        title.textContent = PANEL_SETTINGS.title;
        header.appendChild(title);

        Object.assign(headerButtons.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
        });

        Object.assign(statusLine.style, {
            padding: '10px 10px 0 10px',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.82)',
            whiteSpace: 'pre-line',
        });

        Object.assign(modeRow.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '6px',
            padding: '10px 10px 0 10px',
        });

        Object.assign(termRow.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 10px 0 10px',
        });

        Object.assign(termText.style, {
            flex: '1',
            minWidth: '0',
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.82)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
        });

        copyButton.type = 'button';
        copyButton.textContent = 'Copy';
        copyButton.title = 'Copy current search term';
        Object.assign(copyButton.style, {
            padding: '6px 10px',
            background: 'rgba(255, 255, 255, 0.12)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: 'pointer',
            flexShrink: '0',
        });

        copyButton.addEventListener('mouseenter', function () {
            copyButton.style.background = 'rgba(255, 255, 255, 0.2)';
        });

        copyButton.addEventListener('mouseleave', function () {
            copyButton.style.background = 'rgba(255, 255, 255, 0.12)';
        });

        termRow.appendChild(termText);
        termRow.appendChild(copyButton);

        Object.assign(buttonRow.style, {
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '8px',
            padding: '10px',
        });

        const resetButton = makeHeaderButton('R', 'Reset panel position');
        const refreshButton = makeHeaderButton('Ref', 'Refresh search mode');
        const minimizeButton = makeHeaderButton('-', 'Minimize panel');

        headerButtons.appendChild(resetButton);
        headerButtons.appendChild(refreshButton);
        headerButtons.appendChild(minimizeButton);
        header.appendChild(headerButtons);

        panel.appendChild(header);
        panel.appendChild(statusLine);
        panel.appendChild(modeRow);
        panel.appendChild(termRow);
        panel.appendChild(buttonRow);

        const versionLabel = document.createElement('div');
        versionLabel.textContent = 'v' + APP_VERSION;
        Object.assign(versionLabel.style, {
            padding: '0 10px 8px 10px',
            fontSize: '10px',
            color: 'rgba(255, 255, 255, 0.45)',
            lineHeight: '1',
            userSelect: 'none',
        });
        panel.appendChild(versionLabel);

        const savedPosition = loadPanelPosition();
        if (savedPosition) {
            document.body.appendChild(panel);
            applyPanelPosition(panel, savedPosition.left, savedPosition.top);
        } else {
            document.body.appendChild(panel);
        }

        let isCollapsed = loadPanelCollapsed();
        setPanelCollapsed(buttonRow, minimizeButton, isCollapsed);
        statusLine.style.display = isCollapsed ? 'none' : 'block';
        modeRow.style.display = isCollapsed ? 'none' : 'grid';
        termRow.style.display = isCollapsed ? 'none' : 'flex';

        minimizeButton.addEventListener('click', function (event) {
            event.stopPropagation();
            isCollapsed = !isCollapsed;
            setPanelCollapsed(buttonRow, minimizeButton, isCollapsed);
            statusLine.style.display = isCollapsed ? 'none' : 'block';
            modeRow.style.display = isCollapsed ? 'none' : 'grid';
            termRow.style.display = isCollapsed ? 'none' : 'flex';
        });

        resetButton.addEventListener('click', function (event) {
            event.stopPropagation();
            applyDefaultPanelPosition(panel);
            localStorage.removeItem(PANEL_SETTINGS.storageKey);
        });

        refreshButton.addEventListener('click', function (event) {
            event.stopPropagation();
            onRefresh();
        });

        makePanelDraggable(panel, header);

        return {
            panel,
            buttonRow,
            statusLine,
            modeRow,
            termText,
            copyButton,
        };
    }

    function makePanelDraggable(panel, handle) {
        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        handle.addEventListener('mousedown', function (event) {
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;
            panel.style.right = 'auto';
            event.preventDefault();
        });

        document.addEventListener('mousemove', function (event) {
            if (!isDragging) {
                return;
            }

            const left = event.clientX - offsetX;
            const top = event.clientY - offsetY;
            applyPanelPosition(panel, left, top);
        });

        document.addEventListener('mouseup', function () {
            if (!isDragging) {
                return;
            }

            isDragging = false;
            const rect = panel.getBoundingClientRect();
            savePanelPosition(rect.left, rect.top);
        });

        window.addEventListener('resize', function () {
            const rect = panel.getBoundingClientRect();
            applyPanelPosition(panel, rect.left, rect.top);
            const updatedRect = panel.getBoundingClientRect();
            savePanelPosition(updatedRect.left, updatedRect.top);
        });
    }

    function makeButton(label, onClick, container) {
        const button = document.createElement('button');
        button.textContent = label;
        button.type = 'button';

        Object.assign(button.style, {
            width: '100%',
            padding: '10px 12px',
            background: '#3665f3',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
        });

        button.addEventListener('mouseenter', function () {
            button.style.background = '#274bba';
        });

        button.addEventListener('mouseleave', function () {
            button.style.background = '#3665f3';
        });

        button.addEventListener('click', onClick);
        container.appendChild(button);
    }

    function makeModeButton(label, isAvailable, isSelected, onClick, container) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = !isAvailable;

        Object.assign(button.style, {
            width: '100%',
            padding: '8px 6px',
            background: isSelected ? '#3665f3' : 'rgba(255, 255, 255, 0.08)',
            color: isAvailable ? '#ffffff' : 'rgba(255, 255, 255, 0.35)',
            border: isSelected ? '1px solid #5d82f6' : '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: '700',
            cursor: isAvailable ? 'pointer' : 'default',
            opacity: isAvailable ? '1' : '0.65',
        });

        if (isAvailable) {
            button.addEventListener('mouseenter', function () {
                if (!isSelected) {
                    button.style.background = 'rgba(255, 255, 255, 0.14)';
                }
            });

            button.addEventListener('mouseleave', function () {
                if (!isSelected) {
                    button.style.background = 'rgba(255, 255, 255, 0.08)';
                }
            });

            button.addEventListener('click', onClick);
        }

        container.appendChild(button);
    }

    function renderPanelContents(panelBits, searchInfo) {
        const modeState = {
            selectedMode: searchInfo.defaultMode,
        };

        function getActiveMode() {
            return modeState.selectedMode;
        }

        function getActiveQuery() {
            return searchInfo.queries[getActiveMode()] || searchInfo.queries[searchInfo.defaultMode];
        }

        function redrawModeButtons() {
            panelBits.modeRow.replaceChildren();

            for (const mode of MODE_PRIORITY) {
                const isAvailable = Boolean(searchInfo.queries[mode]);
                const isSelected = getActiveMode() === mode;
                const label = SEARCH_MODE_LABELS[mode] || mode;

                makeModeButton(label, isAvailable, isSelected, function () {
                    modeState.selectedMode = mode;
                    updateStatusLine();
                    updateTermLine();
                    redrawModeButtons();
                }, panelBits.modeRow);
            }
        }

        function updateStatusLine() {
            const activeMode = getActiveMode();
            const modeLabel = SEARCH_MODE_LABELS[activeMode] || activeMode;
            const defaultLabel = SEARCH_MODE_LABELS[searchInfo.defaultMode] || searchInfo.defaultMode;
            const usingOverride = activeMode !== searchInfo.defaultMode;

            panelBits.statusLine.textContent = usingOverride
                ? `Search basis: ${modeLabel} (manual)\nDefault: ${defaultLabel}`
                : `Search basis: ${modeLabel}`;
        }

        function updateTermLine() {
            const activeQuery = getActiveQuery();
            panelBits.termText.textContent = `Search term: ${activeQuery}`;
            panelBits.termText.title = activeQuery;
        }

        async function copyCurrentSearchTerm() {
            const textToCopy = getActiveQuery();

            try {
                await navigator.clipboard.writeText(textToCopy);
                panelBits.copyButton.textContent = 'Copied';
            } catch (error) {
                const tempArea = document.createElement('textarea');
                tempArea.value = textToCopy;
                tempArea.setAttribute('readonly', '');
                tempArea.style.position = 'fixed';
                tempArea.style.left = '-9999px';
                document.body.appendChild(tempArea);
                tempArea.select();
                document.execCommand('copy');
                document.body.removeChild(tempArea);
                panelBits.copyButton.textContent = 'Copied';
            }

            setTimeout(function () {
                panelBits.copyButton.textContent = 'Copy';
            }, 1200);
        }

        panelBits.buttonRow.replaceChildren();
        updateStatusLine();
        updateTermLine();
        redrawModeButtons();
        panelBits.copyButton.onclick = copyCurrentSearchTerm;

        makeButton(BUTTON_TEXT.sold, function () {
            openSearch(buildSearchUrl(getActiveQuery(), true));
        }, panelBits.buttonRow);

        makeButton(BUTTON_TEXT.active, function () {
            openSearch(buildSearchUrl(getActiveQuery(), false));
        }, panelBits.buttonRow);
    }

    function watchForListingChanges(refreshPanelContents) {
        let lastHref = window.location.href;
        let refreshTimeout = null;

        function scheduleRefresh() {
            if (refreshTimeout) {
                clearTimeout(refreshTimeout);
            }

            refreshTimeout = setTimeout(function () {
                refreshPanelContents();
            }, 350);
        }

        setInterval(function () {
            if (window.location.href === lastHref) {
                return;
            }

            lastHref = window.location.href;

            if (isEbayItemPage()) {
                scheduleRefresh();
            }
        }, WATCH_SETTINGS.locationCheckIntervalMs);
    }

    function init() {
        if (!isEbayItemPage()) {
            return;
        }

        let panelBits = null;
        const existingPanel = document.getElementById('tm-ebay-comps-panel');
        if (existingPanel) {
            return;
        }

        function refreshPanelContents() {
            const title = getTitleText();
            if (!title) {
                return;
            }

            const searchInfo = getSearchInfo(title);
            renderPanelContents(panelBits, searchInfo);
        }

        panelBits = createPanel(refreshPanelContents);
        refreshPanelContents();
        watchForListingChanges(refreshPanelContents);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
