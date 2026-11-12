# SwiftClick Organizer — Technical Proof of Concept

Status: experimental / development branch only  
Tracking: [Issue #5](https://github.com/teddshapiro/swift-click-userscripts/issues/5)  
Script: root-level `swiftclick-organizer.user.js` (0.1.0-alpha.7)  
Branch: `feat/swiftclick-organizer-poc-20261111`

## Intent

Provide a category-first **front door** to ChatGPT, not a permanent replacement sidebar. On an initial visit to the ChatGPT home route, the organizer opens. After choosing a native project or chat link it gets out of the way. On direct/deep links to a chat or project, it does **not** auto-open. A compact launcher, positioned near the right edge of the viewport and mounted as a direct child of the document body, reopens it. The script never inserts its launcher into the native ChatGPT sidebar.

This is *not* yet an account-wide conversation database or final visual design.

## What currently works in the PoC

- Standalone Tampermonkey script limited to ChatGPT domains.
- Flat category-first opening screen: Family; My Health; SwiftClick Business; Generative AI; Hobbies & Interests; Uncategorized. Each category contains **only ChatGPT projects and conversations**, with no subcategories.
- Clickable flat virtual categories and global title search. The Cinema Decoder **project** is a normal item inside Hobbies & Interests—not another SwiftClick category.
- Read-only observation of projects/chats **currently linked in the native page navigation** and of the current page URL; no message-body extraction.
- Per-item category picker. Category assignments persist via Tampermonkey values, keyed to the link identifier.
- **Add project** manual shortcut form: enter a project name, paste its existing ChatGPT project URL, choose a virtual category. Saved manual project shortcuts reappear after refresh even when ChatGPT has not loaded them into its sidebar.
- Saved project shortcuts can be removed from SwiftClick without affecting ChatGPT.
- Assigning a *discovered* project to any virtual category now saves its project link across reloads, just like using the intake form. The UI calls both types **Project**; only a saved link offers a local **Remove shortcut** action.
- Category pickers offer only the six top-level categories; the nested options no longer exist.
- Native ChatGPT links remain intact; regular click closes the organizer, modified/middle clicks preserve their browser behavior.
- Close button, Escape, click-outside dismissal, Tampermonkey menu command, and a fixed floating launcher outside ChatGPT-owned navigation.
- Shadow DOM, constructed stylesheets with fallback, explicit DOM element creation; broken-CSS detection closes the overlay.

## Deliberate limitations

1. **Not a complete account inventory.** The script sees loaded links only. A collapsed or virtualized ChatGPT sidebar can yield an incomplete or empty list; ChatGPT can change its DOM at any time. The on-screen count says "observed", never "total".
2. Discovery is session-only for *unassigned* chats/projects. Once a user assigns a **project or chat** to a category, SwiftClick retains its validated title and URL locally for future visits. It also backfills previously categorized chat shortcuts when ChatGPT loads them again. For older chat IDs whose link/title never reappears, no name or URL can be reliably restored solely from their old category assignment; revisit the chat to index it. Account/workspace isolation is not implemented: avoid multiple ChatGPT accounts in the same browser profile until scoping is added. Titles and URLs of explicitly organized items remain in local Tampermonkey storage; no message bodies are stored.
3. The PoC does not infer that a chat belongs to a project, so project assignment **does not automatically assign its conversations** yet. The hierarchy is virtual.
4. Category names and ordering are seeded, **not yet editable**. This is a technical PoC, not the finished MVP.
5. Project/chat title extraction relies on page navigation links and can miss items or show imperfect titles; no hidden ChatGPT endpoints or scraping of messages.
6. Does not move, delete or rename ChatGPT content, alter project instructions, call external APIs, or use AI.
7. Browser UI has not been validated against a logged-in 2026 ChatGPT account; DOM, CSS, and accessibility require manual testing before a release.

## Manual Firefox + Tampermonkey test procedure

1. Visit [the branch's raw script](https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/feat/swiftclick-organizer-poc-20261111/swiftclick-organizer.user.js). Install it in Tampermonkey, or create a new userscript and paste the full source. **Do not replace an existing production userscript.**
2. Confirm Tampermonkey displays **SwiftClick Organizer (Technical PoC)** version `0.1.0-alpha.7`. The development script deliberately has **no** production `@updateURL` or `@downloadURL`; reinstall from this branch for new PoC revisions.
3. Open `https://chatgpt.com/` in a **fresh tab**. Verify the front door appears automatically, is styled, and shows the expected category cards.
4. Click Family. It should show projects/chats directly and a **← Categories** button; there should be no Henry/Bradley folder tiles. Return to Categories; enter Hobbies & Interests. **Cinema Decoder** should appear as a project row—not as a subcategory card.
5. Expand native ChatGPT Projects/Recents sidebar sections, use the launcher or Tampermonkey menu command to reopen, and look in **Uncategorized**. Confirm loaded links appear. If a link is absent, record whether it was visible in the sidebar at that moment.
6. Place one observed project or chat in Family using its select menu. Close and reopen; verify it appears under Family. Refresh and leave its native sidebar entry collapsed; the saved shortcut should still be visible. Repeat with a chat to verify local chat-link persistence.
7. From the organizer home, click **+ Add project**. Open an existing ChatGPT project in another tab, copy its full browser URL, enter its name, paste the URL, and select **SwiftClick Business** (or another category). Save; close/reopen/refresh to confirm the project shortcut stays visible in the selected category even when its native sidebar entry is hidden. A conversation URL must be rejected as an invalid project URL.
8. With Organizer dismissed, hover over multiple native ChatGPT project rows and confirm the three-dot action menu and New Chat icon appear and are clickable. Verify their behavior with the userscript enabled. The launcher must remain outside the sidebar (right edge of viewport).
9. Click a discovered chat/project. Verify ordinary ChatGPT navigation occurs and the organizer disappears. Refresh a deep chat URL: it must **not** auto-open. Click the launcher to open manually.
10. Test Ctrl-click/middle-click a destination, Escape, outside-click, narrow windows, and both light/dark ChatGPT settings. Verify the original ChatGPT UI stays functional.
11. Confirm the browser's Network panel shows **no SwiftClick or third-party HTTP requests** made by this script; verify the PoC does not access conversation message bodies.
12. Check the browser console for `[SwiftClick Organizer]` warnings. Report a screenshot of a missing launcher, unstyled overlay, or missing visible link along with the route and browser version.

### Return evidence before release

- Firefox/Tampermonkey versions and whether the script was installed from the branch.
- Screenshot of the home modal and launcher placement.
- Count of discovered projects/chats versus the links visibly loaded.
- Pass/fail for auto-open, native click + dismiss, persistence, direct-link bypass, Esc, project hover controls (three-dot/New Chat), and light/dark styles.
- Any console errors.

## Automated checks

Run locally from repository root:

```bash
node --check swiftclick-organizer.user.js
node --test tests/swiftclick-organizer.test.cjs
```

CI workflow for the development branch/PR is `.github/workflows/swiftclick-organizer-poc.yml`. Tests cover route guards, link parsing, flat-category migration, saved chat/project URL validation, and static privacy/HTML-injection regression checks. They **cannot** replace logged-in Firefox/Tampermonkey acceptance.

## Post-PoC MVP decisions

- Identify a privacy-safe stable account/workspace scope before retaining a persistent link inventory.
- Decide whether to import a user-supplied ChatGPT export to seed a complete historic index.
- Investigate why some native project links are not observed even when sidebar project names are visible; do not claim all projects are auto-discovered.
- Add editable/reorderable categories, then optional favorites and recent items.
- Detect and validate real project→chat relationships instead of guessing from sidebar proximity.
- Consider dashboard-wide CSP testing and more robust launch placement/accessibility.
- Only after approval: promote a stable filename on main, add canonical raw-main update/download metadata, and bump to a release version.

## Alpha.3 regression: ChatGPT native project hover controls (2026-11-11)

A user observed that the native sidebar project hover actions (three-dot menu and New Chat button) disappeared while the alpha.2 userscript was active. Code inspection identified a plausible source: `positionLauncher()` inserted the SwiftClick launcher as the first child of the detected ChatGPT `nav`/sidebar element, changing React-owned navigation DOM and potentially its hover/layout selectors. This was a risky DOM mutation and should never have been done.

**Change:** Remove all sidebar launcher insertion/repositioning logic. Mount the launcher only as a top-level `document.body` child with fixed positioning on the right edge of the viewport. Keep discovery read-only (querySelectorAll) and the organizer overlay in its own Shadow DOM. The new regression test rejects the prior `sidebar.insertBefore` behavior.

**Status:** Strong code-level fix, but not yet verified in the logged-in ChatGPT sidebar. Compare project hover controls in Firefox with alpha.3 enabled vs disabled and report any remaining difference. No ChatGPT projects or existing SwiftClick assignments are altered.


## Alpha.4 contextual menu intake prototype (2026-11-11)

**Goal:** Add an existing project to SwiftClick from its native ChatGPT three-dot menu without asking the user to copy the Project Home URL manually.

**Behavior:**

1. In ChatGPT's sidebar, open the three-dot menu for an existing project.
2. When that native menu contains an explicit **Project home** command, a separate small **＋ Add to SwiftClick Organizer** companion action appears near the menu.
3. Clicking that companion action either reads a validated project URL already on the native Project home link or invokes the native Project home command and waits for a newly observed project route.
4. SwiftClick opens its intake screen showing the detected project URL, a name field, and a category picker. Confirm/save to store a local shortcut. The project itself is untouched.

**DOM safety:** The script does **not** insert a child into React-owned native ChatGPT menus or the native project sidebar. It only observes visible native menu structure, temporarily mounts a separate fixed-position Shadow DOM action in document.body, and uses native Project home navigation when needed. The companion is visually adjacent to (not literally inside) the native menu. This is intentional: editing React-owned menus previously caused sidebar regressions.

**Safety boundary:** It must not use the currently open project as an identifier for an unrelated sidebar project's menu. If no native Project home menu item is available, the companion action will not appear; retain the manual **+ Add project** fallback. If the native Home navigation fails to yield a new valid project route, SwiftClick shows a short error and does not store a guessed project.

**Historical Firefox/Tampermonkey manual acceptance checklist for alpha.4:**

- [ ] Hover a project row and open its three-dot menu. Its native controls and options still work.
- [ ] Companion **＋ Add to SwiftClick Organizer** appears beside the native menu (the native menu items remain unchanged).
- [ ] Click the companion from a project **different from the currently open project**. The resulting intake must show the *selected* project, never the project already on-screen.
- [ ] Name and URL are correct (or a name field is left editable when the menu's link lacks title metadata).
- [ ] Choose Family → Henry or Hobbies & Interests → Cinema Decoder, then save. Verify saved shortcut under that category after refresh.
- [ ] The existing manually added project is updated by identifier rather than duplicated.
- [ ] Escape/cancel without saving does not create a shortcut.
- [ ] The companion does not show for a chat's three-dot menu or generic site menus.
- [ ] If the companion does not appear, inspect whether the native menu has role=menu and a **Project home** menuitem. Capture a safe screenshot/DOM sample without conversation text for selector adjustment.
- [ ] Verify Firefox both light/dark ChatGPT themes, project menu near viewport bottom, and original three-dot/New Chat controls.

**Not yet verified:** We cannot execute an authenticated Firefox session against the user's ChatGPT UI from the GitHub CI environment. The current implementation and selector assumptions are based on the user-supplied screenshot and browser-compatible DOM conventions; manual acceptance is required. Keep PR #6 draft and do not merge into main.


## Alpha.5: navigation intake + project model consolidation (2026-11-11)

### User feedback
- The menu-adjacent action appeared and opened SwiftClick intake, but the modal disappeared almost immediately.
- The organizer showed **Saved project** and **Project** badges for different project-link acquisition methods, leading to confusion.
- A discovered project could have a saved category assignment but disappear from SwiftClick after reload because only its identifier-to-category mapping was stored.

### Root cause and fix
- The ordinary 1-second route monitor closed any open SwiftClick overlay after ChatGPT navigated to native Project home, including the intake overlay that the navigation itself created. The intake handler now adopts the new pathname *before* displaying the form. The monitor resolves a pending intake transition before applying normal navigation dismissal. A short-lived tab-only sessionStorage intent is used to recover across a full navigation/reload; the intent is cleared on successful handoff or timeout.
- Both source paths now render the single **Project** item type. A local persistence distinction remains internal; items are deduplicated by parsed project identifier.
- Assigning a discovered project now also saves its validated project name and URL as a durable local shortcut. Existing saved shortcuts and category mappings remain in the same Tampermonkey storage keys; no migration or reset needed.
- Dropdowns show full category paths, and discovered document-style titles such as `ChatGPT - Cinema Decoder - Project` are displayed as `Cinema Decoder`.

### Acceptance tests for alpha.5 (Firefox/Tampermonkey)
1. Update the single existing SwiftClick Organizer script to **0.1.0-alpha.5** and reload ChatGPT. Existing assignments and saved shortcuts must remain.
2. While viewing project A, open project B's three-dot menu and select **Add to SwiftClick Organizer**. ChatGPT should navigate to B and show the intake form for B. **The intake should remain open** until Cancel, Escape, or Save.
3. Choose **Hobbies & Interests › Cinema Decoder** and Save. Confirm the project appears inside Cinema Decoder, including after a hard refresh with its native sidebar entry collapsed.
4. Open **Hobbies & Interests** and inspect rows. Both preexisting manually added projects and discovered projects should read **Project**, not **Saved project**. The subcategory count includes projects assigned to the subcategory, not projects assigned only to the parent.
5. Find a project with the regular ChatGPT sidebar that was *not* saved through intake. Change its category from Uncategorized to My Health or another category; refresh and collapse its ChatGPT sidebar entry. SwiftClick should still show it, with only one copy per project ID.
6. Cancel an intake without saving. It should not register a persistent shortcut unless that project had already been saved previously.
7. Confirm that a normal navigation to another chat still closes the organizer. Native project menu actions, hover icons, and New Chat must remain functional.
8. If the intake still flashes, record whether ChatGPT's URL changed and whether it fully reloaded. A Firefox console warning is useful; no private conversation text is needed.

**Status:** automated test coverage and syntax checks are available in GitHub Actions, but live Firefox/Tampermonkey behavior is pending user verification. Keep draft PR #6 unmerged until acceptance.


## Alpha.6 — flat categories and saved chat shortcuts (2026-11-11)

### Why this changed

In Firefox, Hobbies & Interests displayed a large **Cinema Decoder** category tile above the actual **Cinema Decoder** project. The project was assigned to the parent, while a chat such as **Transcript Content Warning** had been assigned to the child. Clicking the child tile therefore did not open the actual project and could yield an empty view if the chat was not loaded into the sidebar.

The user explicitly requested a **flat, category-first** system with only projects and chats under each category; nesting is postponed.

### New data model

- Exactly six top-level SwiftClick categories: **Family**, **My Health**, **SwiftClick Business**, **Generative AI**, **Hobbies & Interests**, **Uncategorized**.
- No nested category tiles or paths. Within one category, rows are only native **Project** or **Chat** shortcuts.
- **One-time, idempotent, non-resetting migration** of saved category assignments on startup:
  - `henry`, `bradley`, `family-other` → `family`
  - `cinema` → `hobbies`
  - All other valid top-level category IDs remain unchanged.
- The existing key `swiftclick-organizer-poc.assignments.v1` is reused and its value version increments to 2; project links under `manualProjects.v1` are unchanged.
- Explicitly categorized **chat links and titles** now persist under the new local key `swiftclick-organizer-poc.savedChats.v1`, using validated ChatGPT URLs and chat IDs. No message bodies are read/stored; no network requests.
- Prior category-only chat assignments are preserved and upgraded to saved chat shortcuts **when their links are observed again**. An old chat that is not currently visible in native ChatGPT navigation may need to be visited again for its title/URL to be recovered.

### Alpha.6 acceptance / regression checks

1. Install alpha.6 over alpha.5 in Tampermonkey; **do not clear labels or storage**.
2. Reopen the organizer. Home shows six top-level category cards; no Henry, Bradley, or Cinema Decoder child tile.
3. Open **Hobbies & Interests**. Expect **AI Video** (project), **Cinema Decoder** (project), and **Transcript Content Warning** (chat) directly, *provided the previously assigned chat was indexed during this session or persisted as a shortcut*. All should use the same category selector.
4. Verify a previously nested Cinema Decoder chat now displays the category **Hobbies & Interests**. Verify previously nested Henry/Bradley items under Family.
5. Assign a newly observed chat to **My Health**; refresh ChatGPT while its native sidebar entry is not loaded. Its name and direct chat shortcut should still appear under My Health. Save the same chat again and confirm there is only one entry.
6. Confirm the Cinema Decoder **project** row navigates to ChatGPT Project Home; the extra Cinema Decoder *category box* must not exist.
7. Confirm the native three-dot menu, project intake, launcher, native New Chat buttons, and direct-link auto-open exceptions continue to work.
8. The status count may still be incomplete for *unassigned* ChatGPT chats; this remains a known PoC limitation.
9. Confirm the local Tampermonkey data was preserved from alpha.5, and the project/chat assignment migration does not re-run unnecessarily upon subsequent reloads.

**Current status:** code and automated tests are available in the same development branch and draft PR #6. Firefox acceptance is still required before merging/releasing. The older alpha.3–5 sections above are historical design notes, not current UI requirements.

## Alpha.7 — custom drag-and-drop order inside categories (2026-11-11)

User requested direct reordering of projects/chats inside a flat category (for example AI Video, Cinema Decoder, Image Production within Hobbies & Interests).

### Behavior

- Each project/chat row now has an **⠿ drag handle** at the left while browsing a category. Drag the handle and drop the item above/below another row. An insertion border marks before or after.
- Rows can mix both kinds of item; drag affects **SwiftClick's display order only**, never ChatGPT project/chat membership.
- **Keyboard fallback:** focus the handle (Tab), then press **Arrow Up** / **Arrow Down** to move one position. Focus follows the moved handle.
- Changes persist locally in Tampermonkey under a new isolated key `swiftclick-organizer-poc.categoryOrder.v1`, one ordered ID list per category. Previous category labels and saved links remain untouched.
- New/previously undiscovered items append after a category's saved order. Reordering preserves IDs not presently visible because ChatGPT's sidebar inventory is incomplete.
- Moving an item into a different SwiftClick category or removing a shortcut clears its old position; the item enters its new category at the end until reordered.
- A **Reset order** control is available within categories that have a custom order. It returns that category to the original default ordering without affecting any other category.
- Drag handles do not appear on the category-first home screen or in global search results; reordering is disabled in search to avoid ambiguous cross-category changes, and in categories with more than 250 displayed items for this PoC.
- Browser native drag data contains only the harmless text `SwiftClick Organizer`, not a URL, project title, or message data. Drag logic lives entirely in the organizer's Shadow DOM, without altering ChatGPT-native sidebar or menus.

### Manual Firefox/Tampermonkey acceptance

1. Update the existing SwiftClick userscript to **0.1.0-alpha.7** (ensure only one copy is enabled) and reload ChatGPT. Do **not** clear stored categories.
2. Go to **Hobbies & Interests** and drag **Cinema Decoder** above **AI Video** using the ⠿ handle. Verify the visual order changes immediately.
3. Close/reopen the organizer and reload ChatGPT. Confirm the custom order remains, with the projects still opening their correct native ChatGPT URLs.
4. Focus the handle for **Image Production**, press Arrow Up, and verify it moves one row upward; test Arrow Down and that focus stays on the handle.
5. Change **Cinema Decoder** to another category, then return it to Hobbies & Interests. It should appear at the end of the category until reordered. The other items' relative order should not change.
6. Search for a project; confirm search results are navigable but do **not** show drag handles.
7. Choose **Reset order** in Hobbies & Interests. Only that category's manually chosen order resets.
8. Confirm native ChatGPT project hover menus, New Chat buttons, existing saved categories/chats, and menu intake remain functional.

### Limitations

- Browser-native HTML drag and drop is optimized here for desktop mouse/trackpad. Touch/pointer gesture-specific reordering can be considered later.
- The repository's Node tests cover ordering logic and safety invariants. The graphical drag interaction itself still requires logged-in Firefox/Tampermonkey validation.
- Cross-account/workspace storage isolation remains future work; treat the local browser profile as one ChatGPT account.
