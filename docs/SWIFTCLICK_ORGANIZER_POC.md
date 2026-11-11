# SwiftClick Organizer — Technical Proof of Concept

Status: experimental / development branch only  
Tracking: [Issue #5](https://github.com/teddshapiro/swift-click-userscripts/issues/5)  
Script: root-level `swiftclick-organizer.user.js` (0.1.0-alpha.2)  
Branch: `feat/swiftclick-organizer-poc-20261111`

## Intent

Provide a category-first **front door** to ChatGPT, not a permanent replacement sidebar. On an initial visit to the ChatGPT home route, the organizer opens. After choosing a native project or chat link it gets out of the way. On direct/deep links to a chat or project, it does **not** auto-open. A small launcher, inserted in a suitable sidebar when available (otherwise floating near lower-left), reopens it.

This is *not* yet an account-wide conversation database or final visual design.

## What currently works in the PoC

- Standalone Tampermonkey script limited to ChatGPT domains.
- Category-first opening screen; Family → Henry / Bradley / Other family matters; My Health; SwiftClick Business; Generative AI; Hobbies & Interests → Cinema Decoder; Uncategorized.
- Clickable virtual categories, nested category navigation and global title search.
- Read-only observation of projects/chats **currently linked in the native page navigation** and of the current page URL; no message-body extraction.
- Per-item category picker. Category assignments persist via Tampermonkey values, keyed to the link identifier.
- **Add project** manual shortcut form: enter a project name, paste its existing ChatGPT project URL, choose a virtual category. Saved manual project shortcuts reappear after refresh even when ChatGPT has not loaded them into its sidebar.
- Saved project shortcuts can be removed from SwiftClick without affecting ChatGPT.
- Native ChatGPT links remain intact; regular click closes the organizer, modified/middle clicks preserve their browser behavior.
- Close button, Escape, click-outside dismissal, Tampermonkey menu command, and ordinary launcher.
- Shadow DOM, constructed stylesheets with fallback, explicit DOM element creation; broken-CSS detection closes the overlay.

## Deliberate limitations

1. **Not a complete account inventory.** The script sees loaded links only. A collapsed or virtualized ChatGPT sidebar can yield an incomplete or empty list; ChatGPT can change its DOM at any time. The on-screen count says "observed", never "total".
2. Automatically discovered chats/projects are session-only and **not** persisted across reloads. Category assignments persist. **Explicitly saved project shortcuts** (name and URL) are persisted across reloads in Tampermonkey storage. Account/workspace isolation is not implemented: avoid using multiple ChatGPT accounts in the same browser profile until scoping is added. Do not manually save restricted or shared project links you do not want stored locally.
3. The PoC does not infer that a chat belongs to a project, so project assignment **does not automatically assign its conversations** yet. The hierarchy is virtual.
4. Category names and ordering are seeded, **not yet editable**. This is a technical PoC, not the finished MVP.
5. Project/chat title extraction relies on page navigation links and can miss items or show imperfect titles; no hidden ChatGPT endpoints or scraping of messages.
6. Does not move, delete or rename ChatGPT content, alter project instructions, call external APIs, or use AI.
7. Browser UI has not been validated against a logged-in 2026 ChatGPT account; DOM, CSS, and accessibility require manual testing before a release.

## Manual Firefox + Tampermonkey test procedure

1. Visit [the branch's raw script](https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/feat/swiftclick-organizer-poc-20261111/swiftclick-organizer.user.js). Install it in Tampermonkey, or create a new userscript and paste the full source. **Do not replace an existing production userscript.**
2. Confirm Tampermonkey displays **SwiftClick Organizer (Technical PoC)** version `0.1.0-alpha.2`. The development script deliberately has **no** production `@updateURL` or `@downloadURL`; reinstall from this branch for new PoC revisions.
3. Open `https://chatgpt.com/` in a **fresh tab**. Verify the front door appears automatically, is styled, and shows the expected category cards.
4. Click Family → Henry → back to Family → back to Categories. Click Hobbies & Interests → Cinema Decoder. Verify navigation and visible counts.
5. Expand native ChatGPT Projects/Recents sidebar sections, use the launcher or Tampermonkey menu command to reopen, and look in **Uncategorized**. Confirm loaded links appear. If a link is absent, record whether it was visible in the sidebar at that moment.
6. Place one observed project or chat in Family → Henry using its select menu. Close and reopen; verify it appears under Family → Henry. Refresh the page, re-expand its native sidebar entry and verify the assignment is preserved.
7. From the organizer home, click **+ Add project**. Open an existing ChatGPT project in another tab, copy its full browser URL, enter its name, paste the URL, and select **SwiftClick Business** (or another category). Save; close/reopen/refresh to confirm the project shortcut stays visible in the selected category even when its native sidebar entry is hidden. A conversation URL must be rejected as an invalid project URL.
8. Click a discovered chat/project. Verify ordinary ChatGPT navigation occurs and the organizer disappears. Refresh a deep chat URL: it must **not** auto-open. Click the launcher to open manually.
9. Test Ctrl-click/middle-click a destination, Escape, outside-click, narrow windows, and both light/dark ChatGPT settings. Verify the original ChatGPT UI stays functional.
10. Confirm the browser's Network panel shows **no SwiftClick or third-party HTTP requests** made by this script; verify the PoC does not access conversation message bodies.
11. Check the browser console for `[SwiftClick Organizer]` warnings. Report a screenshot of a missing launcher, unstyled overlay, or missing visible link along with the route and browser version.

### Return evidence before release

- Firefox/Tampermonkey versions and whether the script was installed from the branch.
- Screenshot of the home modal and launcher placement.
- Count of discovered projects/chats versus the links visibly loaded.
- Pass/fail for auto-open, native click + dismiss, persistence, direct-link bypass, Esc, and light/dark styles.
- Any console errors.

## Automated checks

Run locally from repository root:

```bash
node --check swiftclick-organizer.user.js
node --test tests/swiftclick-organizer.test.cjs
```

CI workflow for the development branch/PR is `.github/workflows/swiftclick-organizer-poc.yml`. Tests cover route guards, link parsing, category descendants, and static privacy/HTML-injection regression checks. They **cannot** replace logged-in Firefox/Tampermonkey acceptance.

## Post-PoC MVP decisions

- Identify a privacy-safe stable account/workspace scope before retaining a persistent link inventory.
- Decide whether to import a user-supplied ChatGPT export to seed a complete historic index.
- Investigate why some native project links are not observed even when sidebar project names are visible; do not claim all projects are auto-discovered.
- Add editable/reorderable categories, then optional favorites and recent items.
- Detect and validate real project→chat relationships instead of guessing from sidebar proximity.
- Consider dashboard-wide CSP testing and more robust launch placement/accessibility.
- Only after approval: promote a stable filename on main, add canonical raw-main update/download metadata, and bump to a release version.
