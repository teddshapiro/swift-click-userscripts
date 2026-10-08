'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const DASHBOARD = 'swiftclick-project-dashboard.tedd-7f4.workers.dev';
const CASES = [
    { filename: 'swift-click-gpt-swiss-army-knife.user.js', kind: 'swiss', prefix: 'scgpt_' },
    { filename: 'swift-click-semantic-researcher.user.js', kind: 'semantic', prefix: 'sc_semantic_researcher_' }
];

function boot(spec, hostname, options = {}) {
    const original = fs.readFileSync(path.join(ROOT, spec.filename), 'utf8');
    let source = original;
    const swissStartup = '    registerMenuCommands();\n    mount();\n    installSelfHealingMountWatcher();';
    const semanticStartup = '    init();';
    if (spec.kind === 'swiss') {
        assert.ok(source.includes(swissStartup), 'Swiss bootstrap anchor changed');
        source = source.replace(swissStartup,
            "    buildLauncher = function () { launcher = {}; };\n" +
            "    buildPanel = function () { panel = {}; };\n" +
            "    buildToast = function () {};\n" +
            "    openPanel = function () {};\n" +
            "    globalThis.__testApi = { hostMode, setHostEnabled, mount, getStyles: () => uiStylesUnavailable };\n" +
            swissStartup);
    } else {
        assert.ok(source.includes(semanticStartup), 'Semantic bootstrap anchor changed');
        source = source.replace(semanticStartup,
            "    buildLauncher = function () { launcher = {}; };\n" +
            "    buildPanel = function () { panel = {}; };\n" +
            "    refreshSnapshot = function () {};\n" +
            "    globalThis.__testApi = { hostMode, setHostEnabled, resetHostOverride, buildShell, getStyles: () => uiStylesUnavailable };\n" +
            semanticStartup);
    }

    const store = new Map(Object.entries(options.stored || {}));
    const menus = new Map();
    const warnings = [];
    const roots = [];
    const stylesheetTexts = [];
    const shadowNodes = [];
    let lastShadow = null;
    const fakeShadow = () => {
        lastShadow = {
            adoptedStyleSheets: [],
            appendChild(node) { shadowNodes.push(node); return node; }
        };
        return lastShadow;
    };
    const document = {
        title: 'Test page',
        documentElement: {
            appendChild(node) {
                node.isConnected = true;
                roots.push(node);
                return node;
            }
        },
        createElement(tag) {
            return {
                tagName: tag.toUpperCase(),
                isConnected: false,
                style: {},
                setAttribute() {},
                appendChild() {},
                attachShadow: fakeShadow,
                remove() { this.isConnected = false; }
            };
        },
        addEventListener() {}
    };
    const location = {
        hostname, href: 'https://' + hostname + '/',
        reload() {}
    };
    const ctx = {
        document, location,
        window: { addEventListener() {}, innerWidth: 1440, innerHeight: 900 },
        console: { warn: (...args) => warnings.push(args), error() {}, log() {} },
        GM_getValue(key, fallback) { return store.has(key) ? store.get(key) : fallback; },
        GM_setValue(key, value) { store.set(key, value); },
        GM_registerMenuCommand(label, fn) { menus.set(label, fn); },
        MutationObserver: class { observe() {} },
        queueMicrotask() {},
        getComputedStyle() { return { position: options.styled === false ? 'static' : 'fixed' }; },
        CSSStyleSheet: options.constructed === false ? undefined : class {
            replaceSync(css) { stylesheetTexts.push(css); }
        }
    };
    vm.runInNewContext(source, ctx, { filename: spec.filename, timeout: 1000 });
    return { api: ctx.__testApi, menus, store, warnings, roots, stylesheetTexts, shadowNodes, getShadow: () => lastShadow, source: original };
}

for (const spec of CASES) {
    test(spec.kind + ': dashboard is off by default but can be explicitly enabled and disabled', () => {
        const f = boot(spec, DASHBOARD);
        assert.equal(f.api.hostMode(DASHBOARD), 'disabled');
        assert.equal(f.roots.length, 0);
        assert.ok(f.menus.has('Enable on this site'));
        assert.ok(f.menus.has('Disable on this site'));
        f.menus.get('Enable on this site')();
        assert.equal(f.api.hostMode(DASHBOARD), 'enabled');
        assert.equal(f.roots.length, 1);
        assert.equal(f.roots[0].isConnected, true);
        f.menus.get('Disable on this site')();
        assert.equal(f.api.hostMode(DASHBOARD), 'disabled');
        assert.equal(f.roots[0].isConnected, false);
        assert.equal([...f.store.keys()].filter(k => k.includes('host_overrides')).length, 1);
    });

    test(spec.kind + ': other SwiftClick Worker hosts remain enabled', () => {
        const f = boot(spec, 'semantic-researcher-ai-service.tedd-7f4.workers.dev');
        assert.equal(f.api.hostMode('semantic-researcher-ai-service.tedd-7f4.workers.dev'), 'enabled');
        assert.equal(f.roots.length, 1);
    });

    test(spec.kind + ': stored false overrides normal auto-enable', () => {
        const key = spec.kind === 'swiss' ? 'scgpt_host_overrides_v1' : 'sc_semantic_researcher_host_overrides_v1';
        const hostname = 'example.org';
        const f = boot(spec, hostname, { stored: { [key]: { [hostname]: false } } });
        assert.equal(f.api.hostMode(hostname), 'disabled');
        assert.equal(f.roots.length, 0);
    });

    test(spec.kind + ': constructed stylesheet is attached to the shadow root', () => {
        const f = boot(spec, 'example.org');
        assert.equal(f.stylesheetTexts.length, 1);
        assert.ok(f.stylesheetTexts[0].includes(spec.kind === 'swiss' ? '.sc-panel' : '.sr-panel'));
        assert.equal(f.getShadow().adoptedStyleSheets.length, 1);
        assert.equal(f.shadowNodes.length, 0);
    });

    test(spec.kind + ': inline style fallback retains UI if it is allowed', () => {
        const f = boot(spec, 'example.org', { constructed: false });
        assert.equal(f.stylesheetTexts.length, 0);
        assert.equal(f.shadowNodes.length, 1);
        assert.equal(f.shadowNodes[0].tagName, 'STYLE');
        assert.equal(f.roots[0].isConnected, true);
    });

    test(spec.kind + ': blocked styling removes the UI and prevents repeated injection', () => {
        const f = boot(spec, 'example.org', { constructed: false, styled: false });
        assert.equal(f.roots.length, 1);
        assert.equal(f.roots[0].isConnected, false);
        assert.equal(f.api.getStyles(), true);
        const retry = spec.kind === 'swiss' ? f.api.mount() : f.api.buildShell();
        assert.equal(retry, false);
        assert.equal(f.roots.length, 1);
        assert.ok(f.warnings.some(args => String(args[0]).includes('UI unavailable')));
    });

    test(spec.kind + ': existing auto-update source and safe DOM construction stay intact', () => {
        const f = boot(spec, DASHBOARD);
        assert.match(f.source, new RegExp('@updateURL\\s+https://raw\\.githubusercontent\\.com/teddshapiro/swift-click-userscripts/main/' + spec.filename.replace(/\./g, '\\.')));
        assert.doesNotMatch(f.source, /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(/);
        assert.match(f.source, /PRIVATE_ADMIN_HOSTS\.has\(/);
    });
}

test('Swiss sensitive-site mode and manual Open remain available', () => {
    const f = boot(CASES[0], 'secure-banking.example.com');
    assert.equal(f.api.hostMode('secure-banking.example.com'), 'sensitive');
    assert.equal(f.roots.length, 0);
    // Opening in privacy mode mounts on demand, without overriding stored preference.
    // This is exercised through the real command with UI stubs, not a duplicated policy.
    f.menus.get('Open Swift Click GPT Swiss Army Knife')();
    assert.equal(f.roots.length, 1);
});

test('Semantic reset restores dashboard default without erasing experiment metrics', () => {
    const key = 'sc_semantic_researcher_experiment_log_v1';
    const runs = [{ id: 'fixture-run', method: 'standard_v1' }];
    const f = boot(CASES[1], DASHBOARD, { stored: { [key]: runs } });
    f.menus.get('Enable on this site')();
    f.menus.get('Reset this site to automatic mode')();
    assert.equal(f.api.hostMode(DASHBOARD), 'disabled');
    assert.equal(f.roots[0].isConnected, false);
    assert.equal(f.store.get(key), runs);
});
