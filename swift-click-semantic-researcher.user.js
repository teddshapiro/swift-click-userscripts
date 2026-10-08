// ==UserScript==
// @name         Swift Click Semantic Researcher
// @namespace    https://swiftclick.com/
// @version      0.2.1
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/swift-click-semantic-researcher.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/main/swift-click-semantic-researcher.user.js
// @description  Discover research lenses, find grounded evidence, highlight it in the page, and synthesize selected findings.
// @author       Swift Click / Tedd
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      semantic-researcher-ai-service.tedd-7f4.workers.dev
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    const APP_NAME = 'Swift Click Semantic Researcher';
    const APP_VERSION = '0.2.1';
    const AI_SERVICE_BASE = 'https://semantic-researcher-ai-service.tedd-7f4.workers.dev';
    const MAX_BLOCKS = 220;
    const MAX_DOCUMENT_CHARS = 50000;
    const MAX_BLOCK_CHARS = 2400;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const STORAGE = {
        AI_TOKEN: 'sc_semantic_researcher_access_token_v1',
        LAUNCHER_POSITION: 'sc_semantic_researcher_launcher_position_v1',
        EXPERIMENT_LOG: 'sc_semantic_researcher_experiment_log_v1',
        HOST_OVERRIDES: 'sc_semantic_researcher_host_overrides_v1'
    };

    const FIND_METHODS = Object.freeze({
        STANDARD: 'standard_v1',
        DECISIONS: 'decisions_hybrid_v1'
    });
    const MAX_EXPERIMENT_RUNS = 100;

    // Maintain an explicit list of private SwiftClick admin apps; no broad domain block.
    const PRIVATE_ADMIN_HOSTS = new Set([
        'swiftclick-project-dashboard.tedd-7f4.workers.dev'
    ]);

    const SENSITIVE_HOST_HINTS = [
        'bank', 'banking', 'creditunion', 'credit-union', 'brokerage',
        'mychart', 'patient', 'healthportal', 'health-portal',
        '1password', 'bitwarden', 'lastpass', 'dashlane',
        'paypal', 'venmo', 'coinbase',
        'login.', 'auth.', 'signin.', 'accounts.'
    ];

    let hostOverrides = loadValue(STORAGE.HOST_OVERRIDES, {});
    let uiStylesUnavailable = false;
    let rootHost = null;
    let shadow = null;
    let launcher = null;
    let panel = null;

    const state = {
        snapshot: null,
        discovery: null,
        findings: [],
        activeFindingIndex: -1,
        highlightsVisible: true,
        report: null,
        sensitiveConfirmationFingerprint: null,
        busy: false,
        findMethod: FIND_METHODS.STANDARD,
        activeExperimentRunId: null,
        activeFindMethod: null,
        comparison: null,
        experimentLog: []
    };

    init();

    function normalizeHost(hostname) {
        return String(hostname || '').toLowerCase().replace(/^www\./, '');
    }

    function hostMode(hostname) {
        const host = normalizeHost(hostname);
        if (hostOverrides[host] === true) return 'enabled';
        if (hostOverrides[host] === false) return 'disabled';
        return PRIVATE_ADMIN_HOSTS.has(host) ? 'disabled' : 'enabled';
    }

    function setHostEnabled(enabled) {
        const host = normalizeHost(location.hostname);
        hostOverrides[host] = Boolean(enabled);
        saveValue(STORAGE.HOST_OVERRIDES, hostOverrides);
        if (enabled) {
            uiStylesUnavailable = false;
            buildShell();
        } else {
            unmountShell();
        }
    }

    function resetHostOverride() {
        delete hostOverrides[normalizeHost(location.hostname)];
        saveValue(STORAGE.HOST_OVERRIDES, hostOverrides);
        unmountShell();
        if (hostMode(location.hostname) === 'enabled') buildShell();
    }

    function init() {
        state.experimentLog = loadExperimentLog();
        try {
            GM_registerMenuCommand('Semantic Researcher: set AI access key', setAiAccessKey);
            GM_registerMenuCommand('Semantic Researcher: clear AI access key', clearAiAccessKey);
            GM_registerMenuCommand('Semantic Researcher: clear page analysis', clearAnalysis);
            GM_registerMenuCommand('Enable on this site', () => setHostEnabled(true));
            GM_registerMenuCommand('Disable on this site', () => setHostEnabled(false));
            GM_registerMenuCommand('Reset this site to automatic mode', resetHostOverride);
        } catch (error) {
            console.warn(`[${APP_NAME}] Could not register script menu commands.`, error);
        }
        if (hostMode(location.hostname) === 'enabled') buildShell();
    }

    function unmountShell() {
        clearHighlights(); // Remove page modifications, not analysis or saved experiment data.
        rootHost?.remove();
        rootHost = shadow = launcher = panel = null;
    }

    function buildShell() {
        if (rootHost?.isConnected) return true;
        if (uiStylesUnavailable || hostMode(location.hostname) !== 'enabled') return false;
        if (!document.documentElement) return false;

        try {
            rootHost = document.createElement('div');
            rootHost.id = 'swiftclick-semantic-researcher-root';
            rootHost.setAttribute('data-swiftclick-semantic-researcher-ui', 'true');
            document.documentElement.appendChild(rootHost);

            shadow = rootHost.attachShadow({ mode: 'open' });
            addStyles();
            buildLauncher();
            buildPanel();
            if (!uiStylesApplied()) throw new Error('Required floating UI styles did not apply');
            refreshSnapshot();
            return true;
        } catch (error) {
            unmountShell();
            uiStylesUnavailable = true;
            console.warn(`[${APP_NAME}] UI unavailable on this page (possibly CSP).`, error);
            return false;
        }
    }

    function addStyles() {
        const cssText = `
            :host { all: initial; }
            * { box-sizing: border-box; }
            button, textarea { font: inherit; }
            .sr-launcher {
                position: fixed;
                right: 18px;
                top: 42%;
                z-index: 2147483646;
                width: 52px;
                height: 52px;
                padding: 0;
                border: 1px solid rgba(20, 28, 38, .25);
                border-radius: 50%;
                background: linear-gradient(145deg, #fff, #edf2f6);
                color: #16202a;
                box-shadow: 0 5px 20px rgba(0,0,0,.22);
                display: grid;
                place-items: center;
                cursor: grab;
                user-select: none;
                touch-action: none;
            }
            .sr-launcher:hover { transform: translateY(-1px); box-shadow: 0 7px 24px rgba(0,0,0,.28); }
            .sr-launcher.dragging { cursor: grabbing; }
            .sr-launcher svg { width: 29px; height: 29px; pointer-events: none; }
            .sr-launcher-badge {
                position: absolute;
                right: -2px;
                bottom: -2px;
                min-width: 18px;
                height: 18px;
                padding: 0 4px;
                border-radius: 9px;
                display: none;
                align-items: center;
                justify-content: center;
                background: #17212b;
                color: white;
                border: 2px solid white;
                font: 700 10px/1 system-ui, sans-serif;
            }
            .sr-panel {
                position: fixed;
                top: 18px;
                right: 18px;
                z-index: 2147483645;
                width: min(430px, calc(100vw - 28px));
                max-height: calc(100vh - 36px);
                overflow: auto;
                background: #f9fbfc;
                color: #17212b;
                border: 1px solid rgba(20, 28, 38, .2);
                border-radius: 16px;
                box-shadow: 0 18px 52px rgba(0,0,0,.28);
                font: 14px/1.42 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                display: none;
            }
            .sr-panel.open { display: block; }
            .sr-header {
                position: sticky;
                top: 0;
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                padding: 14px 16px;
                background: rgba(249,251,252,.97);
                border-bottom: 1px solid #dbe2e8;
                border-radius: 16px 16px 0 0;
            }
            .sr-title { margin: 0; font-size: 16px; font-weight: 750; }
            .sr-subtitle { color: #5b6875; font-size: 12px; margin-top: 2px; }
            .sr-close {
                width: 34px; height: 34px; border: 0; border-radius: 9px;
                background: transparent; color: #3c4854; cursor: pointer; font-size: 22px;
            }
            .sr-close:hover { background: #e9eef2; }
            .sr-body { padding: 14px; }
            .sr-section {
                background: white;
                border: 1px solid #dce3e8;
                border-radius: 12px;
                padding: 12px;
                margin-bottom: 12px;
            }
            .sr-section-title {
                margin: 0 0 7px;
                font-size: 13px;
                font-weight: 760;
                letter-spacing: .01em;
            }
            .sr-help { margin: 0 0 9px; color: #596876; font-size: 12px; }
            .sr-row { display: flex; gap: 7px; align-items: center; flex-wrap: wrap; }
            .sr-row + .sr-row { margin-top: 8px; }
            .sr-btn {
                appearance: none;
                border: 1px solid #bcc7d0;
                border-radius: 9px;
                padding: 7px 10px;
                background: #fff;
                color: #18222d;
                cursor: pointer;
                font-weight: 650;
            }
            .sr-btn:hover:not(:disabled) { background: #f0f4f7; border-color: #9facb7; }
            .sr-btn.primary { background: #18222d; color: white; border-color: #18222d; }
            .sr-btn.primary:hover:not(:disabled) { background: #2a3947; }
            .sr-btn:disabled { opacity: .48; cursor: default; }
            .sr-btn.small { padding: 5px 8px; font-size: 12px; }
            .sr-textarea {
                width: 100%;
                min-height: 76px;
                resize: vertical;
                border: 1px solid #bfcbd4;
                border-radius: 9px;
                padding: 9px;
                background: white;
                color: #17212b;
                line-height: 1.4;
            }
            .sr-textarea:focus { outline: 2px solid #7aa8cc; outline-offset: 1px; }
            .sr-status {
                white-space: pre-wrap;
                padding: 9px 10px;
                border-radius: 9px;
                background: #edf3f7;
                color: #42515f;
                font-size: 12px;
            }
            .sr-status.error { background: #fff0ef; color: #802820; }
            .sr-status.busy { background: #fff8df; color: #6d5200; }
            .sr-lenses { display: grid; gap: 7px; }
            .sr-lens {
                text-align: left;
                border: 1px solid #d1dae1;
                border-radius: 10px;
                background: #fbfcfd;
                padding: 9px;
                cursor: pointer;
            }
            .sr-lens:hover { border-color: #9eb1c0; background: #f4f8fa; }
            .sr-lens strong { display: block; margin-bottom: 3px; }
            .sr-lens span { display: block; color: #60707e; font-size: 12px; }
            .sr-summary {
                white-space: pre-wrap;
                margin: 0 0 9px;
                color: #3f4e5b;
                font-size: 12px;
            }
            .sr-finding {
                border: 1px solid #d8e0e6;
                border-radius: 10px;
                padding: 9px;
                margin-top: 8px;
                background: #fff;
            }
            .sr-finding.active { border-color: #d09b00; box-shadow: inset 3px 0 0 #e1aa00; }
            .sr-finding-head { display: flex; align-items: flex-start; gap: 7px; }
            .sr-finding-main { min-width: 0; flex: 1; }
            .sr-finding-category { font-weight: 740; }
            .sr-finding-meta { color: #6a7783; font-size: 11px; margin-top: 1px; }
            .sr-quote {
                margin: 7px 0 5px;
                padding-left: 8px;
                border-left: 3px solid #e4ba3c;
                color: #313d48;
                font-style: italic;
            }
            .sr-reason { color: #536270; font-size: 12px; }
            .sr-findings-empty { color: #6b7884; font-size: 12px; padding: 4px 0; }
            .sr-mode {
                display: inline-flex;
                gap: 3px;
                padding: 3px;
                border-radius: 10px;
                background: #e9eef2;
                margin: 2px 0 8px;
            }
            .sr-mode-btn {
                appearance: none;
                border: 0;
                border-radius: 8px;
                padding: 6px 9px;
                background: transparent;
                color: #4e5d69;
                cursor: pointer;
                font-weight: 700;
                font-size: 12px;
            }
            .sr-mode-btn.active {
                background: white;
                color: #17212b;
                box-shadow: 0 1px 4px rgba(0,0,0,.12);
            }
            .sr-experiment-summary {
                display: grid;
                gap: 7px;
                margin-top: 8px;
            }
            .sr-metric-card {
                border: 1px solid #d8e0e6;
                border-radius: 9px;
                padding: 8px 9px;
                background: #fbfcfd;
                font-size: 12px;
                color: #4c5a66;
            }
            .sr-metric-card strong { display: block; color: #202b35; margin-bottom: 2px; }
            .sr-comparison {
                margin-top: 9px;
                padding-top: 9px;
                border-top: 1px solid #e2e7eb;
                font-size: 12px;
                color: #4c5a66;
            }
            .sr-report {
                white-space: pre-wrap;
                max-height: 380px;
                overflow: auto;
                border: 1px solid #d8e0e6;
                border-radius: 9px;
                padding: 10px;
                background: #fbfcfd;
                color: #202b35;
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            }
            .sr-report-title { font-weight: 760; margin-bottom: 7px; }
            .sr-count { color: #596876; font-size: 12px; }
            .sr-divider { height: 1px; background: #e2e7eb; margin: 10px 0; }
            @media (max-width: 520px) {
                .sr-panel { top: 8px; right: 8px; width: calc(100vw - 16px); max-height: calc(100vh - 16px); }
                .sr-launcher { right: 10px; }
            }
        `;
        applyShadowStyles(cssText);
    }

    function applyShadowStyles(cssText) {
        try {
            if (typeof CSSStyleSheet === 'function' && 'adoptedStyleSheets' in shadow) {
                const sheet = new CSSStyleSheet();
                sheet.replaceSync(cssText);
                shadow.adoptedStyleSheets = [...shadow.adoptedStyleSheets, sheet];
                return;
            }
        } catch (error) {
            console.warn(`[${APP_NAME}] Constructed stylesheet unavailable; trying inline style.`, error);
        }
        const style = document.createElement('style');
        style.textContent = cssText;
        shadow.appendChild(style);
    }

    function uiStylesApplied() {
        return getComputedStyle(launcher).position === 'fixed'
            && getComputedStyle(panel).position === 'fixed';
    }

    function buildLauncher() {
        launcher = document.createElement('button');
        launcher.className = 'sr-launcher';
        launcher.type = 'button';
        launcher.setAttribute('aria-label', 'Open ' + APP_NAME);
        launcher.setAttribute('title', APP_NAME);

        const svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '0 0 32 32');
        svg.setAttribute('aria-hidden', 'true');

        const circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', '13');
        circle.setAttribute('cy', '13');
        circle.setAttribute('r', '8');
        circle.setAttribute('fill', 'none');
        circle.setAttribute('stroke', 'currentColor');
        circle.setAttribute('stroke-width', '3');

        const handle = document.createElementNS(SVG_NS, 'path');
        handle.setAttribute('d', 'M19 19 L28 28');
        handle.setAttribute('fill', 'none');
        handle.setAttribute('stroke', 'currentColor');
        handle.setAttribute('stroke-width', '3.2');
        handle.setAttribute('stroke-linecap', 'round');

        const glint = document.createElementNS(SVG_NS, 'path');
        glint.setAttribute('d', 'M8.5 10.5 C9.8 8.7 11.7 7.8 13.7 7.8');
        glint.setAttribute('fill', 'none');
        glint.setAttribute('stroke', 'currentColor');
        glint.setAttribute('stroke-width', '1.6');
        glint.setAttribute('stroke-linecap', 'round');
        glint.setAttribute('opacity', '.55');

        svg.append(circle, handle, glint);
        launcher.appendChild(svg);

        const badge = document.createElement('span');
        badge.className = 'sr-launcher-badge';
        badge.id = 'sr-launcher-badge';
        launcher.appendChild(badge);

        shadow.appendChild(launcher);
        restoreLauncherPosition();
        installLauncherDrag();
    }

    function restoreLauncherPosition() {
        const saved = loadValue(STORAGE.LAUNCHER_POSITION, null);
        if (!saved || !Number.isFinite(saved.left) || !Number.isFinite(saved.top)) return;
        requestAnimationFrame(() => {
            const size = launcher.getBoundingClientRect();
            const left = clamp(saved.left, 4, Math.max(4, window.innerWidth - size.width - 4));
            const top = clamp(saved.top, 4, Math.max(4, window.innerHeight - size.height - 4));
            launcher.style.left = left + 'px';
            launcher.style.top = top + 'px';
            launcher.style.right = 'auto';
        });
    }

    function installLauncherDrag() {
        let drag = null;

        launcher.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            const rect = launcher.getBoundingClientRect();
            drag = {
                pointerId: event.pointerId,
                offsetX: event.clientX - rect.left,
                offsetY: event.clientY - rect.top,
                startX: event.clientX,
                startY: event.clientY,
                moved: false
            };
            launcher.setPointerCapture?.(event.pointerId);
            launcher.classList.add('dragging');
        });

        launcher.addEventListener('pointermove', (event) => {
            if (!drag || drag.pointerId !== event.pointerId) return;
            if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 5) {
                drag.moved = true;
            }
            const rect = launcher.getBoundingClientRect();
            const left = clamp(event.clientX - drag.offsetX, 4, Math.max(4, window.innerWidth - rect.width - 4));
            const top = clamp(event.clientY - drag.offsetY, 4, Math.max(4, window.innerHeight - rect.height - 4));
            launcher.style.left = left + 'px';
            launcher.style.top = top + 'px';
            launcher.style.right = 'auto';
        });

        launcher.addEventListener('pointerup', (event) => {
            if (!drag || drag.pointerId !== event.pointerId) return;
            const wasMoved = drag.moved;
            drag = null;
            launcher.releasePointerCapture?.(event.pointerId);
            launcher.classList.remove('dragging');
            const rect = launcher.getBoundingClientRect();
            saveValue(STORAGE.LAUNCHER_POSITION, { left: rect.left, top: rect.top });
            if (!wasMoved) togglePanel();
        });

        launcher.addEventListener('pointercancel', () => {
            drag = null;
            launcher.classList.remove('dragging');
        });

        window.addEventListener('resize', () => {
            if (!launcher) return;
            const rect = launcher.getBoundingClientRect();
            const left = clamp(rect.left, 4, Math.max(4, window.innerWidth - rect.width - 4));
            const top = clamp(rect.top, 4, Math.max(4, window.innerHeight - rect.height - 4));
            launcher.style.left = left + 'px';
            launcher.style.top = top + 'px';
            launcher.style.right = 'auto';
        });
    }

    function buildPanel() {
        panel = el('section', 'sr-panel');
        panel.id = 'sr-panel';
        panel.setAttribute('aria-label', APP_NAME);

        const header = el('div', 'sr-header');
        const titleWrap = document.createElement('div');
        const title = el('h2', 'sr-title', 'Semantic Researcher');
        const subtitle = el('div', 'sr-subtitle', 'Discover → Investigate → Curate → Synthesize');
        titleWrap.append(title, subtitle);

        const close = el('button', 'sr-close', '×');
        close.type = 'button';
        close.setAttribute('aria-label', 'Close Semantic Researcher');
        close.addEventListener('click', () => panel.classList.remove('open'));

        header.append(titleWrap, close);
        panel.appendChild(header);

        const body = el('div', 'sr-body');

        const statusSection = section('Page & access');
        const pageCount = el('div', 'sr-count');
        pageCount.id = 'sr-page-count';
        statusSection.appendChild(pageCount);

        const statusButtons = el('div', 'sr-row');
        statusButtons.append(
            makeButton('Rescan page', refreshSnapshot, 'small'),
            makeButton('Set access key', setAiAccessKey, 'small', 'sr-access-key')
        );
        statusSection.appendChild(statusButtons);

        const status = el('div', 'sr-status');
        status.id = 'sr-status';
        statusSection.appendChild(status);
        body.appendChild(statusSection);

        const discoverSection = section('1 · Discover');
        discoverSection.appendChild(el(
            'p',
            'sr-help',
            'Ask AI for useful research lenses for this page, or skip discovery and write your own lens below.'
        ));
        discoverSection.appendChild(makeButton('Suggest research lenses', runDiscover, 'primary', 'sr-discover'));

        const discoverSummary = el('p', 'sr-summary');
        discoverSummary.id = 'sr-document-summary';
        discoverSection.appendChild(discoverSummary);

        const lenses = el('div', 'sr-lenses');
        lenses.id = 'sr-lenses';
        discoverSection.appendChild(lenses);
        body.appendChild(discoverSection);

        const investigateSection = section('2 · Investigate');
        investigateSection.appendChild(el(
            'p',
            'sr-help',
            'Describe the meaning you want to find. This instruction is applied to the page’s extracted text blocks.'
        ));

        const lensInput = document.createElement('textarea');
        lensInput.className = 'sr-textarea';
        lensInput.id = 'sr-lens-input';
        lensInput.placeholder = 'Example: Find unsupported claims or places where the author weakens the main argument.';
        lensInput.maxLength = 700;
        investigateSection.appendChild(lensInput);

        investigateSection.appendChild(el(
            'div',
            'sr-help',
            'Find method for this page session. Standard is the proven baseline; Decisions beta adds a fast triage pass before grounding.'
        ));

        const findMode = el('div', 'sr-mode');
        findMode.id = 'sr-find-mode';
        const standardMode = el('button', 'sr-mode-btn', 'Standard');
        standardMode.type = 'button';
        standardMode.id = 'sr-mode-standard';
        standardMode.addEventListener('click', () => setFindMethod(FIND_METHODS.STANDARD));
        const decisionsMode = el('button', 'sr-mode-btn', 'Decisions beta');
        decisionsMode.type = 'button';
        decisionsMode.id = 'sr-mode-decisions';
        decisionsMode.addEventListener('click', () => setFindMethod(FIND_METHODS.DECISIONS));
        findMode.append(standardMode, decisionsMode);
        investigateSection.appendChild(findMode);

        const investigateRow = el('div', 'sr-row');
        investigateRow.append(
            makeButton('Find evidence', runFind, 'primary', 'sr-find'),
            makeButton('Compare both', runCompareBoth, '', 'sr-compare-both')
        );
        investigateSection.appendChild(investigateRow);
        body.appendChild(investigateSection);

        const findingsSection = section('3 · Review findings');
        const findingsControls = el('div', 'sr-row');
        findingsControls.append(
            makeButton('Previous', () => moveFinding(-1), 'small', 'sr-prev'),
            makeButton('Next', () => moveFinding(1), 'small', 'sr-next'),
            makeButton('Hide highlights', toggleHighlights, 'small', 'sr-toggle-highlights'),
            makeButton('Clear', clearAnalysis, 'small')
        );
        findingsSection.appendChild(findingsControls);

        const findingCount = el('div', 'sr-count');
        findingCount.id = 'sr-finding-count';
        findingsSection.appendChild(findingCount);

        const findings = document.createElement('div');
        findings.id = 'sr-findings';
        findingsSection.appendChild(findings);
        body.appendChild(findingsSection);

        const experimentSection = section('Experiment');
        experimentSection.appendChild(el(
            'p',
            'sr-help',
            'Metrics are kept locally for comparison. The log stores no page text, URL, title, or research lens—only a hashed page fingerprint and run measurements.'
        ));
        const experimentSummary = el('div', 'sr-experiment-summary');
        experimentSummary.id = 'sr-experiment-summary';
        experimentSection.appendChild(experimentSummary);

        const comparison = el('div', 'sr-comparison');
        comparison.id = 'sr-comparison';
        experimentSection.appendChild(comparison);

        const experimentButtons = el('div', 'sr-row');
        experimentButtons.append(
            makeButton('Copy experiment log', copyExperimentLog, 'small', 'sr-copy-experiment'),
            makeButton('Clear experiment log', clearExperimentLog, 'small', 'sr-clear-experiment')
        );
        experimentSection.appendChild(experimentButtons);
        body.appendChild(experimentSection);

        const synthSection = section('4 · Synthesize');
        synthSection.appendChild(el(
            'p',
            'sr-help',
            'Only selected findings are sent to the synthesis pass. Add an optional instruction for the report.'
        ));

        const synthInput = document.createElement('textarea');
        synthInput.className = 'sr-textarea';
        synthInput.id = 'sr-synthesis-input';
        synthInput.placeholder = 'Optional: Explain how these findings affect the article’s overall conclusion.';
        synthInput.maxLength = 1500;
        synthSection.appendChild(synthInput);

        const synthButtons = el('div', 'sr-row');
        synthButtons.append(
            makeButton('Generate synthesis', runSynthesize, 'primary', 'sr-synthesize'),
            makeButton('Copy report', copyReport, '', 'sr-copy-report')
        );
        synthSection.appendChild(synthButtons);

        const reportTitle = el('div', 'sr-report-title');
        reportTitle.id = 'sr-report-title';
        synthSection.appendChild(reportTitle);

        const report = el('div', 'sr-report');
        report.id = 'sr-report';
        report.textContent = 'No synthesis yet.';
        synthSection.appendChild(report);

        body.appendChild(synthSection);
        panel.appendChild(body);
        shadow.appendChild(panel);

        renderAll();
    }

    function section(titleText) {
        const node = el('section', 'sr-section');
        node.appendChild(el('h3', 'sr-section-title', titleText));
        return node;
    }

    function el(tag, className = '', text = '') {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== '') node.textContent = text;
        return node;
    }

    function makeButton(label, handler, extraClass = '', id = '') {
        const button = el('button', ('sr-btn ' + extraClass).trim(), label);
        button.type = 'button';
        if (id) button.id = id;
        button.addEventListener('click', handler);
        return button;
    }

    function togglePanel() {
        if (!panel) return;
        panel.classList.toggle('open');
        if (panel.classList.contains('open')) {
            refreshSnapshot(false);
        }
    }

    function normalizeText(text) {
        return String(text || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function refreshSnapshot(showMessage = true) {
        clearHighlights();
        state.findings = [];
        state.activeFindingIndex = -1;
        state.activeExperimentRunId = null;
        state.activeFindMethod = null;
        state.comparison = null;
        state.report = null;
        state.discovery = null;
        state.sensitiveConfirmationFingerprint = null;

        const root =
            document.querySelector('article') ||
            document.querySelector('main') ||
            document.querySelector('[role="main"]') ||
            document.body;

        const selectors = 'h1,h2,h3,h4,p,li,blockquote,pre,td,th,figcaption';
        const candidates = Array.from(root?.querySelectorAll(selectors) || []);
        const blocks = [];
        const blockMap = new Map();
        const seenText = new Set();
        let totalChars = 0;

        for (const element of candidates) {
            if (blocks.length >= MAX_BLOCKS || totalChars >= MAX_DOCUMENT_CHARS) break;
            if (rootHost && (element === rootHost || rootHost.contains(element))) continue;
            if (element.closest('nav,footer,form,dialog,aside,[aria-hidden="true"],[hidden]')) continue;

            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (
                style.display === 'none' ||
                style.visibility === 'hidden' ||
                Number(style.opacity) === 0 ||
                !rect.width ||
                !rect.height
            ) {
                continue;
            }

            let text = normalizeText(element.textContent);
            if (text.length < 20) continue;
            if (text.length > MAX_BLOCK_CHARS) text = text.slice(0, MAX_BLOCK_CHARS).trim();
            if (!text || seenText.has(text)) continue;

            const remaining = MAX_DOCUMENT_CHARS - totalChars;
            if (remaining < 20) break;
            if (text.length > remaining) text = text.slice(0, remaining).trim();
            if (text.length < 20) break;

            const id = 'B' + String(blocks.length + 1).padStart(3, '0');
            const block = {
                id,
                tag: element.tagName.toLowerCase(),
                text,
                element
            };
            blocks.push(block);
            blockMap.set(id, block);
            seenText.add(text);
            totalChars += text.length;
        }

        const fingerprint = hashText(
            [document.title || '', location.href, ...blocks.map((block) => block.text)].join('\n')
        );

        state.snapshot = {
            page: {
                title: document.title || '',
                url: location.href,
                fingerprint
            },
            blocks,
            blockMap,
            totalChars
        };

        renderAll();
        if (showMessage) {
            setStatus(
                blocks.length
                    ? 'Page rescanned locally. No page text has been sent to AI.'
                    : 'I could not find enough readable text blocks on this page.'
            );
        }
    }

    function hashText(text) {
        let hash = 2166136261;
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return 'fnv1a-' + (hash >>> 0).toString(16).padStart(8, '0');
    }

    function serializableBlocks() {
        return (state.snapshot?.blocks || []).map(({ id, tag, text }) => ({ id, tag, text }));
    }

    function getStoredAiToken() {
        return String(loadValue(STORAGE.AI_TOKEN, '') || '').trim();
    }

    function setAiAccessKey() {
        const existing = getStoredAiToken();
        const token = window.prompt(
            'Enter your SwiftClick AI access key. It is stored only in Tampermonkey for this userscript.',
            existing
        );
        if (token === null) return;
        const clean = token.trim();
        if (!clean) {
            saveValue(STORAGE.AI_TOKEN, '');
            setStatus('AI access key cleared.');
        } else {
            saveValue(STORAGE.AI_TOKEN, clean);
            setStatus('AI access key saved.');
        }
        renderAll();
    }

    function clearAiAccessKey() {
        saveValue(STORAGE.AI_TOKEN, '');
        setStatus('AI access key cleared.');
        renderAll();
    }

    function makeRequestId(prefix) {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return prefix + '-' + window.crypto.randomUUID();
        }
        return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    function hostLooksSensitive(hostname) {
        const host = String(hostname || '').toLowerCase();
        return SENSITIVE_HOST_HINTS.some((hint) => host.includes(hint));
    }

    function confirmSensitiveTransmission() {
        if (!hostLooksSensitive(location.hostname)) return true;
        const fingerprint = state.snapshot?.page?.fingerprint || '';
        if (state.sensitiveConfirmationFingerprint === fingerprint) return true;

        const proceed = window.confirm(
            'This site looks potentially sensitive. Semantic Researcher will send the extracted readable page text to the SwiftClick AI service for this analysis. Continue?'
        );
        if (proceed) state.sensitiveConfirmationFingerprint = fingerprint;
        return proceed;
    }

    function ensureReadyForAi() {
        if (!state.snapshot?.blocks?.length) {
            refreshSnapshot(false);
        }
        if (!state.snapshot?.blocks?.length) {
            setStatus('There is not enough readable page text to analyze.', true);
            return null;
        }

        let token = getStoredAiToken();
        if (!token) {
            setAiAccessKey();
            token = getStoredAiToken();
        }
        if (!token) return null;
        if (!confirmSensitiveTransmission()) return null;
        return token;
    }

    function requestAi(path, token, data) {
        const payload = {
            request_id: makeRequestId('sr'),
            client_version: APP_VERSION,
            data
        };

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: AI_SERVICE_BASE + path,
                headers: {
                    Authorization: 'Bearer ' + token,
                    'Content-Type': 'application/json',
                    'X-Client-Version': APP_VERSION
                },
                data: JSON.stringify(payload),
                timeout: 180000,
                onload(response) {
                    let body = null;
                    try {
                        body = JSON.parse(response.responseText || '{}');
                    } catch {
                        body = null;
                    }

                    if (response.status >= 200 && response.status < 300 && body?.ok) {
                        resolve(body);
                        return;
                    }

                    const error = new Error(body?.error || 'ai_service_error');
                    error.status = response.status;
                    error.code = body?.error || 'ai_service_error';
                    error.retryAfterSeconds = body?.retry_after_seconds;
                    reject(error);
                },
                onerror() {
                    reject(new Error('Could not reach the SwiftClick Semantic Researcher service.'));
                },
                ontimeout() {
                    reject(new Error('The AI request timed out.'));
                }
            });
        });
    }

    async function runDiscover() {
        if (state.busy) return;
        const token = ensureReadyForAi();
        if (!token) return;

        setBusy(true, 'Reading the page and suggesting useful research lenses…');
        try {
            const response = await requestAi('/discover', token, {
                page: state.snapshot.page,
                blocks: serializableBlocks()
            });
            const result = response.result;
            if (!result || !Array.isArray(result.lenses)) throw serviceShapeError();

            state.discovery = {
                documentSummary: String(result.document_summary || ''),
                lenses: result.lenses
                    .filter((lens) => lens && typeof lens.request === 'string')
                    .slice(0, 8)
            };
            renderDiscovery();
            renderUsageStatus('Discovery complete.', response);
        } catch (error) {
            handleAiError(error);
        } finally {
            setBusy(false);
        }
    }

    async function runFind() {
        if (state.busy) return;
        const context = prepareFindContext();
        if (!context) return;

        resetFindResults();
        const method = state.findMethod;
        setBusy(
            true,
            method === FIND_METHODS.DECISIONS
                ? 'Running Decisions beta triage, then grounding the strongest candidates…'
                : 'Applying the research lens and checking source grounding…'
        );

        try {
            const timed = await timedFindRequest(method, context.token, context.lens);
            const grounded = normalizeGroundedFindings(timed.response);
            const run = recordExperimentRun(timed.response, method, timed.elapsedMs, grounded.length);
            activateFindingSet(grounded, run.id, method);
            state.comparison = null;
            renderComparison();

            const experiment = timed.response?.experiment;
            const candidateNote =
                method === FIND_METHODS.DECISIONS &&
                Number.isSafeInteger(experiment?.candidate_blocks) &&
                Number.isSafeInteger(experiment?.source_blocks)
                    ? ' · ' + experiment.candidate_blocks + '/' + experiment.source_blocks + ' blocks sent to grounding'
                    : '';
            const label = findMethodLabel(method);

            renderUsageStatus(
                grounded.length
                    ? label + ' found ' + grounded.length + ' grounded passage' + (grounded.length === 1 ? '' : 's') + candidateNote + '.'
                    : label + ' found no grounded findings' + candidateNote + '.',
                timed.response
            );
        } catch (error) {
            handleAiError(error);
        } finally {
            setBusy(false);
        }
    }

    async function runCompareBoth() {
        if (state.busy) return;
        const context = prepareFindContext();
        if (!context) return;

        resetFindResults();
        const comparisonId = makeRequestId('cmp');
        setBusy(true, 'Running Standard and Decisions beta against the same page snapshot and lens…');

        try {
            const settled = await Promise.allSettled([
                timedFindRequest(FIND_METHODS.STANDARD, context.token, context.lens),
                timedFindRequest(FIND_METHODS.DECISIONS, context.token, context.lens)
            ]);
            const methods = [FIND_METHODS.STANDARD, FIND_METHODS.DECISIONS];
            const successful = {};
            const errors = {};

            settled.forEach((item, index) => {
                const method = methods[index];
                if (item.status === 'fulfilled') {
                    const grounded = normalizeGroundedFindings(item.value.response);
                    const run = recordExperimentRun(
                        item.value.response,
                        method,
                        item.value.elapsedMs,
                        grounded.length,
                        comparisonId
                    );
                    successful[method] = { grounded, run, response: item.value.response };
                } else {
                    errors[method] = item.reason;
                }
            });

            if (!successful[FIND_METHODS.STANDARD] && !successful[FIND_METHODS.DECISIONS]) {
                throw errors[FIND_METHODS.STANDARD] || errors[FIND_METHODS.DECISIONS] || new Error('Both comparison runs failed.');
            }

            const standardIds = new Set((successful[FIND_METHODS.STANDARD]?.grounded || []).map((finding) => finding.blockId));
            const decisionsIds = new Set((successful[FIND_METHODS.DECISIONS]?.grounded || []).map((finding) => finding.blockId));
            const overlapIds = [...standardIds].filter((id) => decisionsIds.has(id));
            const onlyStandardIds = [...standardIds].filter((id) => !decisionsIds.has(id));
            const onlyDecisionsIds = [...decisionsIds].filter((id) => !standardIds.has(id));

            state.comparison = {
                id: comparisonId,
                standard: successful[FIND_METHODS.STANDARD] || null,
                decisions: successful[FIND_METHODS.DECISIONS] || null,
                errors,
                overlapIds,
                onlyStandardIds,
                onlyDecisionsIds,
                preference: null
            };
            annotateComparisonRuns(state.comparison);

            const initial = successful[FIND_METHODS.STANDARD] || successful[FIND_METHODS.DECISIONS];
            const initialMethod = successful[FIND_METHODS.STANDARD]
                ? FIND_METHODS.STANDARD
                : FIND_METHODS.DECISIONS;
            activateFindingSet(initial.grounded, initial.run.id, initialMethod);
            renderComparison();
            renderExperimentSummary();

            if (successful[FIND_METHODS.STANDARD] && successful[FIND_METHODS.DECISIONS]) {
                setStatus(
                    'Comparison complete · Standard ' +
                    successful[FIND_METHODS.STANDARD].grounded.length +
                    ' findings · Decisions beta ' +
                    successful[FIND_METHODS.DECISIONS].grounded.length +
                    ' · ' + overlapIds.length + ' shared block' + (overlapIds.length === 1 ? '' : 's') + '.'
                );
            } else {
                const failedMethod = successful[FIND_METHODS.STANDARD] ? 'Decisions beta' : 'Standard';
                setStatus('Comparison partially completed. ' + failedMethod + ' failed; the successful result is shown.', true);
            }
        } catch (error) {
            handleAiError(error);
        } finally {
            setBusy(false);
        }
    }

    function prepareFindContext() {
        const lensInput = shadow.getElementById('sr-lens-input');
        const lens = String(lensInput?.value || '').trim();
        if (lens.length < 3) {
            setStatus('Write or select a research lens before finding evidence.', true);
            lensInput?.focus();
            return null;
        }
        const token = ensureReadyForAi();
        return token ? { lens, token } : null;
    }

    function resetFindResults() {
        clearHighlights();
        state.findings = [];
        state.activeFindingIndex = -1;
        state.activeExperimentRunId = null;
        state.activeFindMethod = null;
        state.report = null;
        renderFindings();
        renderReport();
    }

    async function timedFindRequest(method, token, lens) {
        const path = method === FIND_METHODS.DECISIONS ? '/find-decisions' : '/find';
        const started = performance.now();
        const response = await requestAi(path, token, {
            page: state.snapshot.page,
            lens,
            blocks: serializableBlocks()
        });
        return {
            response,
            elapsedMs: Math.max(0, Math.round(performance.now() - started))
        };
    }

    function normalizeGroundedFindings(response) {
        const result = response?.result;
        if (!result || !Array.isArray(result.findings)) throw serviceShapeError();

        return result.findings.flatMap((finding) => {
            const block = state.snapshot.blockMap.get(finding?.block_id);
            if (!block || typeof finding?.quote !== 'string' || !block.text.includes(finding.quote)) {
                return [];
            }
            return [{
                blockId: finding.block_id,
                quote: finding.quote,
                category: String(finding.category || 'Finding'),
                reason: String(finding.reason || ''),
                assessmentType: String(finding.assessment_type || 'ai_assessment'),
                confidence: Number.isFinite(finding.confidence) ? finding.confidence : null,
                selected: true
            }];
        });
    }

    function activateFindingSet(findings, runId, method) {
        clearHighlights();
        state.findings = findings;
        state.activeFindingIndex = findings.length ? 0 : -1;
        state.activeExperimentRunId = runId || null;
        state.activeFindMethod = method || null;
        state.highlightsVisible = true;
        applyHighlights();
        if (findings.length) scrollToFinding(0, false);
        renderFindings();
        renderBusyControls();
    }

    async function runSynthesize() {
        if (state.busy) return;
        const lens = String(shadow.getElementById('sr-lens-input')?.value || '').trim();
        const selected = state.findings.filter((finding) => finding.selected);
        if (!lens) {
            setStatus('A research lens is required before synthesis.', true);
            return;
        }
        if (!selected.length) {
            setStatus('Select at least one finding before synthesis.', true);
            return;
        }

        const token = ensureReadyForAi();
        if (!token) return;

        updateExperimentSelection(state.activeExperimentRunId, selected.length);
        renderExperimentSummary();

        const findings = selected.map((finding) => {
            const block = state.snapshot.blockMap.get(finding.blockId);
            return {
                block_id: finding.blockId,
                quote: finding.quote,
                category: finding.category,
                reason: finding.reason,
                assessment_type: finding.assessmentType,
                source_text: block?.text || ''
            };
        });

        setBusy(true, 'Synthesizing the selected evidence…');
        try {
            const response = await requestAi('/synthesize', token, {
                page: state.snapshot.page,
                lens,
                document_summary: state.discovery?.documentSummary || '',
                findings,
                user_instruction: String(
                    shadow.getElementById('sr-synthesis-input')?.value || ''
                ).trim()
            });
            const result = response.result;
            if (!result || typeof result.report !== 'string') throw serviceShapeError();

            state.report = {
                title: String(result.title || 'Research synthesis'),
                report: result.report,
                citedBlockIds: Array.isArray(result.cited_block_ids)
                    ? result.cited_block_ids
                    : []
            };
            renderReport();
            renderUsageStatus('Synthesis complete.', response);
        } catch (error) {
            handleAiError(error);
        } finally {
            setBusy(false);
        }
    }

    function serviceShapeError() {
        const error = new Error('The AI service returned an unexpected response.');
        error.code = 'invalid_response';
        return error;
    }

    function renderUsageStatus(message, response) {
        const parts = [message];
        if (Number.isSafeInteger(response?.quota?.remaining)) {
            parts.push(response.quota.remaining + ' request' + (response.quota.remaining === 1 ? '' : 's') + ' remaining today for this step');
        }
        if (Number.isSafeInteger(response?.cost_microusd)) {
            parts.push('Approx. AI cost $' + (response.cost_microusd / 1000000).toFixed(5));
        }
        setStatus(parts.join(' · '));
    }

    function handleAiError(error) {
        console.error('[' + APP_NAME + '] AI error', error);
        const code = error?.code || '';

        if (code === 'invalid_credential' || code === 'credential_revoked' || code === 'credential_expired' || error?.status === 401) {
            setStatus('The SwiftClick AI access key was rejected. Use “Set access key” to replace it.', true);
            return;
        }
        if (code === 'credential_disabled' || code === 'not_entitled') {
            setStatus('This access key is not currently authorized for this Semantic Researcher capability.', true);
            return;
        }
        if (code === 'product_disabled' || code === 'capability_disabled' || code === 'global_ai_disabled') {
            setStatus('Semantic Researcher AI is currently disabled by SwiftClick.', true);
            return;
        }
        if (code === 'daily_quota_exceeded') {
            setStatus('Today’s allowance for this Semantic Researcher step has been reached.', true);
            return;
        }
        if (code === 'burst_limit_exceeded') {
            setStatus(
                'Too many requests were sent too quickly.' +
                (error?.retryAfterSeconds ? ' Try again in about ' + error.retryAfterSeconds + ' seconds.' : ''),
                true
            );
            return;
        }
        if (code === 'provider_invalid_grounding' || code === 'provider_duplicate_finding') {
            setStatus('AI returned findings that failed SwiftClick’s source-grounding checks, so they were rejected.', true);
            return;
        }
        if (code === 'document_too_large' || code === 'request_too_large') {
            setStatus('This page is larger than the current MVP analysis limit.', true);
            return;
        }

        setStatus('AI request failed: ' + (error?.message || code || 'unknown error'), true);
    }

    function setFindMethod(method) {
        if (![FIND_METHODS.STANDARD, FIND_METHODS.DECISIONS].includes(method)) return;
        state.findMethod = method;
        renderFindMethod();
        setStatus(
            method === FIND_METHODS.DECISIONS
                ? 'Decisions beta selected for this page session. It resets to Standard when the userscript reloads.'
                : 'Standard Find selected for this page session.'
        );
    }

    function findMethodLabel(method) {
        return method === FIND_METHODS.DECISIONS ? 'Decisions beta' : 'Standard';
    }

    function renderFindMethod() {
        if (!shadow) return;
        const standard = shadow.getElementById('sr-mode-standard');
        const decisions = shadow.getElementById('sr-mode-decisions');
        if (!standard || !decisions) return;

        const standardActive = state.findMethod === FIND_METHODS.STANDARD;
        standard.classList.toggle('active', standardActive);
        decisions.classList.toggle('active', !standardActive);
        standard.setAttribute('aria-pressed', String(standardActive));
        decisions.setAttribute('aria-pressed', String(!standardActive));
    }

    function loadExperimentLog() {
        const raw = loadValue(STORAGE.EXPERIMENT_LOG, []);
        if (!Array.isArray(raw)) return [];
        return raw
            .filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string')
            .slice(-MAX_EXPERIMENT_RUNS);
    }

    function saveExperimentLog() {
        saveValue(STORAGE.EXPERIMENT_LOG, state.experimentLog.slice(-MAX_EXPERIMENT_RUNS));
    }

    function integerOrNull(value) {
        return Number.isSafeInteger(value) && value >= 0 ? value : null;
    }

    function recordExperimentRun(response, method, clientElapsedMs, groundedFindings, comparisonId = null) {
        const experiment = response?.experiment || {};
        const usage = response?.usage || {};
        const decisionUsage = experiment?.decision_usage || {};
        const groundingUsage = experiment?.grounding_usage || {};

        const run = {
            id: String(response?.request_id || makeRequestId('run')),
            at: new Date().toISOString(),
            method,
            pageFingerprint: state.snapshot?.page?.fingerprint || '',
            sourceBlocks: integerOrNull(experiment?.source_blocks) ?? (state.snapshot?.blocks?.length || 0),
            candidateBlocks: integerOrNull(experiment?.candidate_blocks),
            findings: groundedFindings,
            selected: groundedFindings,
            clientElapsedMs: integerOrNull(clientElapsedMs),
            serviceLatencyMs: integerOrNull(response?.service_latency_ms),
            inputTokens: integerOrNull(usage?.input_tokens),
            outputTokens: integerOrNull(usage?.output_tokens),
            costMicrousd: integerOrNull(response?.cost_microusd),
            decisionLatencyMs: integerOrNull(experiment?.decision_latency_ms),
            groundingLatencyMs: integerOrNull(experiment?.grounding_latency_ms),
            decisionInputTokens: integerOrNull(decisionUsage?.input_tokens),
            decisionOutputTokens: integerOrNull(decisionUsage?.output_tokens),
            groundingInputTokens: integerOrNull(groundingUsage?.input_tokens),
            groundingOutputTokens: integerOrNull(groundingUsage?.output_tokens),
            decisionCostMicrousd: integerOrNull(experiment?.decision_cost_microusd),
            groundingCostMicrousd: integerOrNull(experiment?.grounding_cost_microusd),
            fallbackToFullDocument: Boolean(experiment?.fallback_to_full_document),
            comparisonId
        };

        state.experimentLog.push(run);
        if (state.experimentLog.length > MAX_EXPERIMENT_RUNS) {
            state.experimentLog.splice(0, state.experimentLog.length - MAX_EXPERIMENT_RUNS);
        }
        saveExperimentLog();
        renderExperimentSummary();
        return run;
    }

    function updateExperimentSelection(runId, selectedCount) {
        if (!runId || !Number.isSafeInteger(selectedCount) || selectedCount < 0) return;
        const run = state.experimentLog.find((entry) => entry.id === runId);
        if (!run) return;
        run.selected = selectedCount;
        saveExperimentLog();
    }

    function annotateComparisonRuns(comparison) {
        if (!comparison?.standard || !comparison?.decisions) return;
        const metrics = {
            overlap: comparison.overlapIds.length,
            onlyStandard: comparison.onlyStandardIds.length,
            onlyDecisions: comparison.onlyDecisionsIds.length
        };
        for (const runId of [comparison.standard.run.id, comparison.decisions.run.id]) {
            const run = state.experimentLog.find((entry) => entry.id === runId);
            if (run) run.comparison = { ...metrics };
        }
        saveExperimentLog();
    }

    function averageNumbers(values) {
        const numbers = values.filter((value) => typeof value === 'number' && Number.isFinite(value));
        if (!numbers.length) return null;
        return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
    }

    function renderExperimentSummary() {
        if (!shadow) return;
        const container = shadow.getElementById('sr-experiment-summary');
        if (!container) return;
        container.replaceChildren();

        for (const method of [FIND_METHODS.STANDARD, FIND_METHODS.DECISIONS]) {
            const runs = state.experimentLog.filter((run) => run.method === method);
            const card = el('div', 'sr-metric-card');
            card.appendChild(el('strong', '', findMethodLabel(method)));

            if (!runs.length) {
                card.appendChild(document.createTextNode('No logged runs yet.'));
                container.appendChild(card);
                continue;
            }

            const avgLatency = averageNumbers(runs.map((run) => run.serviceLatencyMs));
            const avgCost = averageNumbers(runs.map((run) => run.costMicrousd));
            const avgFindings = averageNumbers(runs.map((run) => run.findings));
            const avgSelected = averageNumbers(runs.map((run) => run.selected));
            const pieces = [
                runs.length + ' run' + (runs.length === 1 ? '' : 's'),
                avgLatency === null ? null : (avgLatency / 1000).toFixed(2) + 's avg server time',
                avgCost === null ? null : 'USD ' + (avgCost / 1000000).toFixed(5) + ' avg cost',
                avgFindings === null ? null : avgFindings.toFixed(1) + ' avg findings',
                avgSelected === null ? null : avgSelected.toFixed(1) + ' avg kept'
            ].filter(Boolean);

            if (method === FIND_METHODS.DECISIONS) {
                const avgCandidates = averageNumbers(runs.map((run) => run.candidateBlocks));
                const avgSource = averageNumbers(runs.map((run) => run.sourceBlocks));
                if (avgCandidates !== null && avgSource !== null) {
                    pieces.push(avgCandidates.toFixed(1) + '/' + avgSource.toFixed(1) + ' avg blocks grounded');
                }
            }

            card.appendChild(document.createTextNode(pieces.join(' · ')));
            container.appendChild(card);
        }
    }
    function renderComparison() {
        if (!shadow) return;
        const container = shadow.getElementById('sr-comparison');
        if (!container) return;
        container.replaceChildren();

        const comparison = state.comparison;
        if (!comparison) {
            container.textContent = 'Use “Compare both” for paired results from the same page snapshot and lens.';
            return;
        }

        const summaryParts = [];
        if (comparison.standard) summaryParts.push('Standard: ' + comparison.standard.grounded.length);
        if (comparison.decisions) summaryParts.push('Decisions beta: ' + comparison.decisions.grounded.length);
        if (comparison.standard && comparison.decisions) {
            summaryParts.push('Shared blocks: ' + comparison.overlapIds.length);
            summaryParts.push('Only Standard: ' + comparison.onlyStandardIds.length);
            summaryParts.push('Only Decisions: ' + comparison.onlyDecisionsIds.length);
        }
        container.appendChild(el('div', '', summaryParts.join(' · ')));

        if (comparison.standard && comparison.decisions) {
            const unique = [];
            if (comparison.onlyStandardIds.length) unique.push('Standard-only ' + comparison.onlyStandardIds.join(', '));
            if (comparison.onlyDecisionsIds.length) unique.push('Decisions-only ' + comparison.onlyDecisionsIds.join(', '));
            if (unique.length) container.appendChild(el('div', 'sr-finding-meta', unique.join(' · ')));
        }

        const showRow = el('div', 'sr-row');
        if (comparison.standard) {
            showRow.appendChild(makeButton('Show Standard', () => activateFindingSet(
                comparison.standard.grounded,
                comparison.standard.run.id,
                FIND_METHODS.STANDARD
            ), 'small'));
        }
        if (comparison.decisions) {
            showRow.appendChild(makeButton('Show Decisions beta', () => activateFindingSet(
                comparison.decisions.grounded,
                comparison.decisions.run.id,
                FIND_METHODS.DECISIONS
            ), 'small'));
        }
        container.appendChild(showRow);

        if (comparison.standard && comparison.decisions) {
            container.appendChild(el('div', 'sr-help',
                'After reviewing both sets, record which was more useful. Only the preference is stored with the metrics.'
            ));
            const preferenceRow = el('div', 'sr-row');
            for (const pair of [
                ['standard', 'Standard better'],
                ['decisions', 'Decisions better'],
                ['same', 'About the same'],
                ['neither', 'Neither']
            ]) {
                const value = pair[0];
                const label = pair[1];
                const button = makeButton(label, () => recordComparisonPreference(value), 'small');
                button.setAttribute('aria-pressed', String(comparison.preference === value));
                if (comparison.preference === value) button.textContent = '✓ ' + label;
                preferenceRow.appendChild(button);
            }
            container.appendChild(preferenceRow);
        }
    }

    function recordComparisonPreference(value) {
        if (!state.comparison || !['standard', 'decisions', 'same', 'neither'].includes(value)) return;
        state.comparison.preference = value;
        for (const runId of [state.comparison.standard?.run?.id, state.comparison.decisions?.run?.id]) {
            const run = state.experimentLog.find((entry) => entry.id === runId);
            if (run) run.comparison = { ...(run.comparison || {}), preference: value };
        }
        saveExperimentLog();
        renderComparison();
        setStatus('Comparison preference recorded.');
    }

    function copyExperimentLog() {
        GM_setClipboard(JSON.stringify({
            exported_at: new Date().toISOString(),
            app_version: APP_VERSION,
            note: 'Metrics only. No page text, URL, title, or research lens is stored.',
            runs: state.experimentLog
        }, null, 2), 'text');
        setStatus('Experiment log copied to the clipboard.');
    }

    function clearExperimentLog() {
        if (!state.experimentLog.length) return;
        if (!window.confirm('Clear the locally stored Semantic Researcher experiment metrics?')) return;
        state.experimentLog = [];
        saveExperimentLog();
        renderExperimentSummary();
        setStatus('Experiment metrics cleared.');
    }
    function renderAll() {
        renderSnapshot();
        renderDiscovery();
        renderFindMethod();
        renderFindings();
        renderExperimentSummary();
        renderComparison();
        renderReport();
        renderAccessButton();
        renderBusyControls();
        updateLauncherBadge();
    }

    function renderSnapshot() {
        const node = shadow?.getElementById('sr-page-count');
        if (!node) return;
        const count = state.snapshot?.blocks?.length || 0;
        const chars = state.snapshot?.totalChars || 0;
        node.textContent = count
            ? count + ' readable blocks · ' + chars.toLocaleString() + ' characters · local snapshot only'
            : 'No readable page snapshot yet.';
    }

    function renderDiscovery() {
        if (!shadow) return;
        const summary = shadow.getElementById('sr-document-summary');
        const container = shadow.getElementById('sr-lenses');
        if (!summary || !container) return;

        summary.textContent = state.discovery?.documentSummary || '';
        container.replaceChildren();

        for (const lens of state.discovery?.lenses || []) {
            const button = el('button', 'sr-lens');
            button.type = 'button';
            const title = document.createElement('strong');
            title.textContent = String(lens.title || 'Research lens');
            const why = document.createElement('span');
            why.textContent = String(lens.why || '');
            button.append(title, why);
            button.addEventListener('click', () => {
                const input = shadow.getElementById('sr-lens-input');
                input.value = String(lens.request || '');
                input.focus();
                setStatus('Research lens selected. Edit it if you like, then click “Find evidence.”');
            });
            container.appendChild(button);
        }
    }

    function renderFindings() {
        if (!shadow) return;
        const container = shadow.getElementById('sr-findings');
        const countNode = shadow.getElementById('sr-finding-count');
        if (!container || !countNode) return;

        const selectedCount = state.findings.filter((finding) => finding.selected).length;
        const methodPrefix = state.activeFindMethod ? findMethodLabel(state.activeFindMethod) + ' · ' : '';
        countNode.textContent = state.findings.length
            ? methodPrefix + state.findings.length + ' findings · ' + selectedCount + ' selected for synthesis'
            : 'No findings yet.';

        container.replaceChildren();

        if (!state.findings.length) {
            container.appendChild(el('div', 'sr-findings-empty', 'Run “Find evidence” to populate grounded findings.'));
            return;
        }

        state.findings.forEach((finding, index) => {
            const card = el('div', 'sr-finding' + (index === state.activeFindingIndex ? ' active' : ''));

            const head = el('div', 'sr-finding-head');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = finding.selected;
            checkbox.setAttribute('aria-label', 'Include finding ' + (index + 1) + ' in synthesis');
            checkbox.addEventListener('change', () => {
                finding.selected = checkbox.checked;
                updateExperimentSelection(
                    state.activeExperimentRunId,
                    state.findings.filter((item) => item.selected).length
                );
                renderFindings();
                renderExperimentSummary();
                renderBusyControls();
            });

            const main = el('div', 'sr-finding-main');
            main.appendChild(el('div', 'sr-finding-category', finding.category));
            const metaParts = [
                finding.blockId,
                assessmentLabel(finding.assessmentType)
            ];
            if (finding.confidence !== null) {
                metaParts.push(Math.round(finding.confidence * 100) + '% confidence');
            }
            main.appendChild(el('div', 'sr-finding-meta', metaParts.join(' · ')));

            head.append(checkbox, main);
            card.appendChild(head);
            card.appendChild(el('div', 'sr-quote', '“' + finding.quote + '”'));
            card.appendChild(el('div', 'sr-reason', finding.reason));

            const row = el('div', 'sr-row');
            row.appendChild(makeButton('Show in page', () => {
                state.activeFindingIndex = index;
                scrollToFinding(index, true);
                renderFindings();
            }, 'small'));
            card.appendChild(row);
            container.appendChild(card);
        });
    }

    function assessmentLabel(type) {
        if (type === 'direct_match') return 'Direct semantic match';
        if (type === 'likely_candidate') return 'Likely candidate';
        return 'AI assessment';
    }

    function renderReport() {
        if (!shadow) return;
        const title = shadow.getElementById('sr-report-title');
        const report = shadow.getElementById('sr-report');
        if (!title || !report) return;

        title.textContent = state.report?.title || '';
        report.textContent = state.report?.report || 'No synthesis yet.';
    }

    function renderAccessButton() {
        const button = shadow?.getElementById('sr-access-key');
        if (!button) return;
        button.textContent = getStoredAiToken() ? 'Change access key' : 'Set access key';
    }

    function renderBusyControls() {
        if (!shadow) return;
        const ids = ['sr-discover', 'sr-find', 'sr-compare-both', 'sr-synthesize'];
        for (const id of ids) {
            const button = shadow.getElementById(id);
            if (button) button.disabled = state.busy;
        }

        const standardMode = shadow.getElementById('sr-mode-standard');
        const decisionsMode = shadow.getElementById('sr-mode-decisions');
        if (standardMode) standardMode.disabled = state.busy;
        if (decisionsMode) decisionsMode.disabled = state.busy;

        const prev = shadow.getElementById('sr-prev');
        const next = shadow.getElementById('sr-next');
        const toggle = shadow.getElementById('sr-toggle-highlights');
        const copy = shadow.getElementById('sr-copy-report');
        if (prev) prev.disabled = !state.findings.length || state.busy;
        if (next) next.disabled = !state.findings.length || state.busy;
        if (toggle) {
            toggle.disabled = !state.findings.length || state.busy;
            toggle.textContent = state.highlightsVisible ? 'Hide highlights' : 'Show highlights';
        }
        if (copy) copy.disabled = !state.report?.report;
    }

    function updateLauncherBadge() {
        const badge = shadow?.getElementById('sr-launcher-badge');
        if (!badge) return;
        if (state.findings.length) {
            badge.textContent = String(state.findings.length);
            badge.style.display = 'flex';
        } else {
            badge.textContent = '';
            badge.style.display = 'none';
        }
    }

    function setStatus(message, error = false) {
        const status = shadow?.getElementById('sr-status');
        if (!status) return;
        status.textContent = message || '';
        status.classList.toggle('error', Boolean(error));
        status.classList.toggle('busy', state.busy && !error);
    }

    function setBusy(busy, message = '') {
        state.busy = busy;
        if (message) setStatus(message);
        else {
            const status = shadow?.getElementById('sr-status');
            status?.classList.toggle('busy', false);
        }
        renderBusyControls();
    }

    function originalStyleFor(element) {
        if (!element.__swiftclickSemanticResearcherOriginalStyle) {
            element.__swiftclickSemanticResearcherOriginalStyle = {
                backgroundColor: element.style.backgroundColor,
                boxShadow: element.style.boxShadow,
                borderRadius: element.style.borderRadius,
                transition: element.style.transition,
                outline: element.style.outline,
                outlineOffset: element.style.outlineOffset
            };
        }
        return element.__swiftclickSemanticResearcherOriginalStyle;
    }

    function applyHighlights() {
        clearHighlights(false);
        if (!rootHost?.isConnected || hostMode(location.hostname) !== 'enabled' || !state.highlightsVisible) return;

        const blockIds = new Set(state.findings.map((finding) => finding.blockId));
        for (const blockId of blockIds) {
            const block = state.snapshot?.blockMap?.get(blockId);
            const element = block?.element;
            if (!element?.isConnected) continue;
            originalStyleFor(element);
            element.style.backgroundColor = 'rgba(255, 214, 10, 0.17)';
            element.style.boxShadow = 'inset 4px 0 0 rgba(226, 171, 0, 0.95)';
            element.style.borderRadius = '3px';
            element.style.transition = 'background-color .18s ease, box-shadow .18s ease, outline .18s ease';
            element.setAttribute('data-swiftclick-semantic-finding', 'true');
        }
    }

    function clearHighlights(resetVisibility = false) {
        if (state.snapshot?.blocks) {
            for (const block of state.snapshot.blocks) {
                const element = block.element;
                const original = element?.__swiftclickSemanticResearcherOriginalStyle;
                if (!element?.isConnected || !original) continue;
                element.style.backgroundColor = original.backgroundColor;
                element.style.boxShadow = original.boxShadow;
                element.style.borderRadius = original.borderRadius;
                element.style.transition = original.transition;
                element.style.outline = original.outline;
                element.style.outlineOffset = original.outlineOffset;
                element.removeAttribute('data-swiftclick-semantic-finding');
            }
        }
        if (resetVisibility) state.highlightsVisible = true;
    }

    function toggleHighlights() {
        if (!state.findings.length) return;
        if (state.highlightsVisible) {
            clearHighlights();
            state.highlightsVisible = false;
        } else {
            state.highlightsVisible = true;
            applyHighlights();
        }
        renderBusyControls();
    }

    function moveFinding(delta) {
        if (!state.findings.length) return;
        const current = state.activeFindingIndex >= 0 ? state.activeFindingIndex : 0;
        const next = (current + delta + state.findings.length) % state.findings.length;
        state.activeFindingIndex = next;
        scrollToFinding(next, true);
        renderFindings();
    }

    function scrollToFinding(index, emphasize = true) {
        const finding = state.findings[index];
        const block = state.snapshot?.blockMap?.get(finding?.blockId);
        const element = block?.element;
        if (!element?.isConnected) return;

        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (!emphasize) return;

        const original = originalStyleFor(element);
        element.style.outline = '3px solid rgba(235, 143, 0, .95)';
        element.style.outlineOffset = '4px';
        window.setTimeout(() => {
            if (!element.isConnected) return;
            element.style.outline = original.outline;
            element.style.outlineOffset = original.outlineOffset;
        }, 1200);
    }

    function clearAnalysis() {
        clearHighlights(true);
        state.discovery = null;
        state.findings = [];
        state.activeFindingIndex = -1;
        state.activeExperimentRunId = null;
        state.activeFindMethod = null;
        state.comparison = null;
        state.report = null;
        state.sensitiveConfirmationFingerprint = null;

        if (shadow) {
            const lens = shadow.getElementById('sr-lens-input');
            const synth = shadow.getElementById('sr-synthesis-input');
            if (lens) lens.value = '';
            if (synth) synth.value = '';
        }

        renderAll();
        setStatus('Analysis cleared. The local page snapshot remains available.');
    }

    function copyReport() {
        const report = state.report?.report;
        if (!report) return;
        const text = state.report.title
            ? state.report.title + '\n\n' + report
            : report;
        GM_setClipboard(text, 'text');
        setStatus('Synthesis report copied to the clipboard.');
    }

    function loadValue(key, fallback) {
        try {
            return GM_getValue(key, fallback);
        } catch {
            return fallback;
        }
    }

    function saveValue(key, value) {
        try {
            GM_setValue(key, value);
        } catch (error) {
            console.error('[' + APP_NAME + '] Could not save Tampermonkey value', error);
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }
})();
