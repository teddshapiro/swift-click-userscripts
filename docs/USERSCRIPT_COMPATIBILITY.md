# SwiftClick Tampermonkey compatibility standard

Status: development branch only. Do not publish to main without browser review.

## October 7, 2026 incident

Both Swiss Army Knife and Semantic Researcher created Shadow DOM panels using a style element whose CSS might be rejected by a strict page Content Security Policy (CSP). That leaves controls unpositioned and unstyled. The code-level cause is confirmed; the deployed private dashboard response headers could not be independently inspected.

Private dashboard: https://swiftclick-project-dashboard.tedd-7f4.workers.dev/

Never weaken a site's CSP or modify the dashboard just to support userscript overlays.

## Per-website preference model

Both general-purpose scripts ship with the exact dashboard hostname excluded by default through PRIVATE_ADMIN_HOSTS. It is deliberately an application-level soft exclusion rather than a Tampermonkey @exclude rule: the script can still provide menu commands to enable it intentionally.

Priority: explicit saved true enables > explicit saved false disables > private-admin default disables > normal script behavior. An override is keyed by the normalized hostname; it persists through reloads. The Swiss Army Knife additionally preserves its existing sensitive-site privacy mode.

In Tampermonkey's per-script menu use Enable on this site, Disable on this site, or Reset this site to automatic mode (Swiss Army Knife retains the older wording, Reset this site to automatic privacy mode). Both scripts make their own choices; they are not combined into a shared global switch.

Swiss Army Knife continues using existing host override key scgpt_host_overrides_v1. Semantic Researcher introduces sc_semantic_researcher_host_overrides_v1. Do not change the existing AI tokens, metrics, preferences, positions or other saved keys.

Maintain a deliberate allowlist-style registry of *private admin exclusions* by exact hostname in both scripts. When another known private SwiftClick administrative site should be excluded, add its exact host and a regression case. Do not blacklist all of *.workers.dev, *.tedd-7f4.workers.dev or *.swiftclick.com: they include unrelated applications.

## CSP-safe component construction

1. Build userscript UI with document.createElement, document.createElementNS, attributes, textContent, and appendChild. Avoid innerHTML, outerHTML, insertAdjacentHTML, and HTML string parsing, particularly on sites using Trusted Types.
2. Use Shadow DOM for isolation. Try CSSStyleSheet.replaceSync and shadow.adoptedStyleSheets before falling back to a style element in the Shadow Root. Plain GM_addStyle normally targets document head and cannot style shadow-scoped nodes.
3. Check computed layout of the critical launcher/panel elements after building. If their expected fixed positioning is absent, remove the entire root immediately, log a diagnostic, and stop remount attempts until there is an explicit retry. Do not leave broken controls on the page.
4. Never attempt to weaken CSP or bypass access controls. Constructed stylesheets are standard CSSOM, not a guarantee of browser compatibility. Individual inline style changes used by drag positioning/highlights must be tested separately.
5. A MutationObserver can repair removed UI on normal sites, but must not cause infinite retries when styles are blocked.
6. No runtime development-branch dependencies: keep the styling/bootstrap helpers self-contained. Extract a versioned shared library only when multiple products justify the maintenance cost.

## Versions and release behavior

Swiss Army Knife moves from 1.0.1 to 1.0.2; Semantic Researcher moves from 0.2.0 to 0.2.1 on the development branch. Existing updateURL and downloadURL metadata continue pointing at canonical main; users do not receive development changes through normal automatic updates. Promotion to main requires explicit approval.

## Automated regressions

Run from repository root:

    node --check swift-click-gpt-swiss-army-knife.user.js
    node --check swift-click-semantic-researcher.user.js
    node --test tests/userscript-compatibility.test.cjs

The Node tests cover dashboard default exclusion; explicit enable, disable and persisted settings; normal sibling hosts; Swiss sensitive-mode behavior; constructed stylesheets; traditional inline fallback; cleanup and retry suppression if CSS is blocked; update URLs; DOM safety; and Semantic Researcher experiment-log preservation. A development-branch GitHub Actions workflow runs the same commands when available.

Tests simulate DOM/CSP behavior and do not prove the dashboard response headers or actual Firefox/Chromium behavior.

## Before releasing

- Load dashboard with both scripts and no overrides. Both should remain absent without changing dashboard display/functionality.
- Enable each explicitly through Tampermonkey on the dashboard. Either it displays correctly, or it cleans up completely and logs a warning; no unstyled controls remain.
- Disable and refresh, then reset to automatic and refresh. Verify preference persistence and dashboard default exclusion.
- On ordinary websites, exercise capture and prompt building in Swiss; discover/find/highlight/synthesize and logs in Semantic; verify saved tokens, settings and launcher positions.
- On a sensitive host, check Swiss's manual privacy-mode Open behavior still works.
- Test a known strict-CSP fixture in Firefox and Chromium, including CSS fallback and failure cleanup.
- Only then review/promote to main. The dashboard itself must not be changed.
