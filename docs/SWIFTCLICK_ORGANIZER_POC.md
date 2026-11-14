# SwiftClick Organizer — Technical Proof of Concept

Status: experimental / development branch only  
Tracking: [Issue #5](https://github.com/teddshapiro/swift-click-userscripts/issues/5)  
Script: root-level `swiftclick-organizer.user.js` (0.1.0-alpha.28)  
Branch: `feat/swiftclick-organizer-poc-20261111`

## Intent

Provide a category-first **front door** to ChatGPT, not a permanent replacement sidebar. On an initial visit to the ChatGPT home route, the organizer opens. After choosing a native project or chat link it gets out of the way. On direct/deep links to a chat or project, it does **not** auto-open. A compact header-adjacent launcher (with a safe right-edge fallback) reopens it; the launcher remains outside ChatGPT's React-managed header and sidebar.

This is *not* yet an account-wide conversation database or final visual design.

## What currently works in the PoC

- Standalone Tampermonkey script limited to ChatGPT domains.
- Flat category-first opening screen: Family; My Health; Finances; Home; SwiftClick Business; Generative AI; Hobbies & Interests; Uncategorized. Each category contains **only ChatGPT projects and conversations**, with no subcategories.
- Clickable flat virtual categories and global title search. The Cinema Decoder **project** is a normal item inside Hobbies & Interests—not another SwiftClick category.
- **Manual-only collection:** no automatic inventory discovery from the ChatGPT sidebar, current URL, or project/chats on page load. Only explicitly saved shortcuts are listed. The script still observes a native **Project home** menu when the user deliberately invokes its add action; it does not index that menu until the user confirms Save.
- Per-item category picker. Category assignments persist via Tampermonkey values, keyed to the link identifier.
- **Add project** manual shortcut form: enter a project name, paste its existing ChatGPT project URL, choose a virtual category. Saved manual project shortcuts reappear after refresh even when ChatGPT has not loaded them into its sidebar.
- Saved project shortcuts can be removed from SwiftClick without affecting ChatGPT.
- Saved **Project** and **Chat** rows are the only inventory. Any link explicitly saved in an earlier alpha version remains; links that were only transiently observed in old versions are no longer shown until added manually.
- Category pickers offer the locally configured flat top-level categories; the nested options no longer exist. Category names, display order, creation, and deletion are user-managed in **Manage categories**.
- Native ChatGPT links remain intact; regular click closes the organizer, modified/middle clicks preserve their browser behavior.
- Close button, Escape, click-outside dismissal, Tampermonkey menu command, and a fixed floating launcher outside ChatGPT-owned navigation.
- Shadow DOM, constructed stylesheets with fallback, explicit DOM element creation; broken-CSS detection closes the overlay.

## Deliberate limitations

1. **A curated inventory, not an account-wide inventory.** SwiftClick intentionally lists only projects and chats explicitly saved through its controls. Opening or expanding ChatGPT's sidebar by itself does not add anything.
2. Existing **saved** project/chat shortcuts, categories, and manually arranged order survive this update. Old **category-only** chat assignments without a stored URL/title are retained as metadata but cannot appear until the user manually adds that chat. Account/workspace isolation is still absent: use one ChatGPT account per browser profile. Only explicitly saved titles and URLs—not message bodies—are stored in Tampermonkey.
3. The PoC does not infer that a chat belongs to a project, so project assignment **does not automatically assign its conversations** yet. The hierarchy is virtual.
4. Top-level categories can be **created, renamed, deleted, and reordered** using Manage categories; their internal IDs remain stable on rename. Saved projects and chats can be reordered by drag-and-drop and keyboard in each category. The Uncategorized inbox is always retained.
5. During a **user-triggered project intake**, SwiftClick tries to read the selected sidebar project title before ChatGPT navigates, or finds the selected project's link by ID. If it cannot verify a title, the input remains editable and may be blank; no other open project's title should be substituted. No hidden ChatGPT APIs or message-body scraping.
6. Does not move, delete or rename ChatGPT content, alter project instructions, call external APIs, or use AI.
7. Earlier versions have been visually checked in a logged-in Firefox session; **alpha.8's manual-only behavior and project-name autofill still require user acceptance** before release.

## Manual Firefox + Tampermonkey test procedure

1. Visit [the branch's raw script](https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/feat/swiftclick-organizer-poc-20261111/swiftclick-organizer.user.js). Install it in Tampermonkey, or create a new userscript and paste the full source. **Do not replace an existing production userscript.**
2. Confirm Tampermonkey displays **SwiftClick Organizer (Technical PoC)** version `0.1.0-alpha.10`. The development script deliberately has **no** production `@updateURL` or `@downloadURL`; reinstall from this branch for new PoC revisions.
3. Open `https://chatgpt.com/` in a **fresh tab**. Verify the front door appears automatically, is styled, and shows the expected category cards.
4. Click Family. It should show projects/chats directly and a **← Categories** button; there should be no Henry/Bradley folder tiles. Return to Categories; enter Hobbies & Interests. **Cinema Decoder** should appear as a project row—not as a subcategory card.
5. Expand/collapse native ChatGPT sidebar sections and reopen SwiftClick. **Nothing new should appear** unless you explicitly saved it; only previously saved shortcuts are listed.
6. Add an existing project through the native three-dot menu's **Add to SwiftClick Organizer** companion control. Verify the selected project's **name and URL** are prefilled, then choose Family and Save. Reopen and refresh to confirm persistence.
7. Use **+ Add project** to paste a project URL manually as a fallback. Use **+ Add chat** while viewing a chat to prefill its current URL and title when available; alternatively paste a chat URL and name manually. Confirm saving and persistence in a selected category.
8. With Organizer dismissed, hover over multiple native ChatGPT project rows and confirm the three-dot action menu and New Chat icon appear and are clickable. Verify their behavior with the userscript enabled. The launcher must remain outside the sidebar (right edge of viewport).
9. Click a saved chat/project. Verify ordinary ChatGPT navigation occurs and the organizer disappears. Refresh a deep chat URL: it must **not** auto-open. Click the launcher to open manually.
10. Test Ctrl-click/middle-click a destination, Escape, outside-click, narrow windows, and both light/dark ChatGPT settings. Verify the original ChatGPT UI stays functional.
11. Confirm the browser's Network panel shows **no SwiftClick or third-party HTTP requests** made by this script; verify the PoC does not access conversation message bodies.
12. Check the browser console for `[SwiftClick Organizer]` warnings. Report a screenshot of a missing launcher, unstyled overlay, or missing visible link along with the route and browser version.

### Return evidence before release

- Firefox/Tampermonkey versions and whether the script was installed from the branch.
- Screenshot of the home modal and launcher placement.
- Count of saved projects/chats and whether a deliberately opened project prefilled the right name/URL.
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
- Do **not** reintroduce automatic sidebar indexing or export-driven bulk discovery without a new user decision; manual intake is the deliberate default.
- Improve manual intake when ChatGPT changes its native menu or project-row structure; preserve the fallback to editable name and pasted URL.
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

## Alpha.8 — manual-only project/chat collection and project-name autofill (2026-11-12)

### User decision

The user prefers **manual curation** over passive automatic discovery. Browsing ChatGPT, opening the sidebar, or opening a new project/chat must never populate SwiftClick's library. Keep the existing category-first home screen and drag-and-drop category order.

### Behavior now

- Remove the old \`collectLoadedLinks\` and \`indexAnchor\` paths completely, including calls during initialization, overlay opening, sidebar mutation, and route changes. The remaining MutationObserver only detects the **open Project Home menu**, so the explicit Add companion still appears.
- Seed the organizer library exclusively from existing manually saved project shortcuts (\`manualProjects.v1\`) and chats (\`savedChats.v1\`). **Do not reset existing data.** Existing category mappings and custom order remain intact.
- Project intake via the native three-dot menu now captures the clicked project's sidebar **name and link identity** on user interaction before React opens its menu. That name is carried through the project's native navigation, including across a full reload using a short-lived tab session intent.
- When the menu has a project link but the click-capture fails, a targeted search for that exact project's sidebar anchor label is permitted **only after** the user selects the SwiftClick Add action. This does not index or save anything.
- Name selection is guarded by project ID: if the clicked row's ID is not the Project Home destination's ID, do not use the unrelated row name. Previously saved title or the destination's title can be used as a fallback. If name is unavailable, leave the required text input editable rather than falsely asserting "Unnamed project".
- The organizer now provides **+ Add chat**. While viewing a chat, clicking it pre-fills the chat URL and available title. Alternatively the user can paste a link and name manually. Choosing a category and Save explicitly stores the shortcut.
- Users can still use **+ Add project** with pasted name/URL and choose a category. These explicit actions are the only ways to add inventory, aside from already saved items.
- No undocumented ChatGPT API requests, no message extraction, no background indexing, and no mutations of native ChatGPT projects/chats.

### Firefox/Tampermonkey acceptance

1. Upgrade the existing installation to **0.1.0-alpha.8** without clearing Tampermonkey data; ensure exactly one copy of the script is enabled.
2. Verify **Hobbies & Interests** still contains existing saved projects such as AI Video, Cinema Decoder, and Image Production in the custom drag order.
3. While viewing project A, open project B's native three-dot menu. Select **＋ Add to SwiftClick Organizer**. Confirm the intake name is **B's name**, not "Unnamed project" or A's name; the URL must point to B.
4. Save to a category and refresh. Confirm one shortcut for B, without duplicates or lost prior assignments. Repeat with a project that has not been saved previously.
5. If the name cannot be captured, it must remain editable and the project URL must still be prefilled. Record the screenshot and the exact visible project row label so its DOM structure can be debugged.
6. Open a chat, click **+ Add chat**, confirm title and URL prefill, assign to a category and Save. Reopen on a different chat; the saved one must remain. Try a manually pasted chat URL from a project where no chat is currently open.
7. Expand sidebar projects/chats, switch conversations, and navigate projects without clicking Add. Verify **no new items appear** in SwiftClick even if visible natively.
8. Verify normal ChatGPT project menus, hover controls, New Chat, project instructions, launcher behavior, and direct-link bypass still work.
9. Verify local save data unchanged except explicit saved items; no message body data or SwiftClick network requests.

### Known limitations

- Automatic indexing is intentionally disabled. Previously visible-but-not-saved items in older builds will no longer appear. Re-add them manually when wanted.
- Old category assignments with no saved title/URL remain in local storage but cannot display until the link is manually added again.
- ChatGPT may change its DOM structure or title markup; this contextual name capture still needs Firefox validation on the current live interface. A blank name is a safer failure than copying the wrong project's title.
- Multiple ChatGPT accounts in a single browser profile are not isolated. Browser-native HTML drag and drop remains desktop-oriented.

**Current status:** source and automated tests on the feature branch; manual Firefox acceptance pending. Keep PR #6 draft and \`main\` unchanged.

## Alpha.9 — compact two-column category cards and on-demand editing (2026-11-12)

### User feedback

The previous category list showed one full-width row per project/chat, with the category selector and Remove shortcut button always visible. This made the front door feel more like an administrative table than a compact launcher. The user requested two columns, with each card showing only the **drag handle → Project/Chat → title → small edit icon**. Category selection and shortcut removal should appear only when Edit is opened.

### Implementation

- On desktop-width dialogs, each category now uses a **two-column CSS grid** of equal-width tiles, filled **left to right, then top to bottom**. Below 720px viewport width, it becomes one column.
- Each tile presents the drag handle (when manual category ordering is available), a compact Project/Chat label, a single-line link title (native title tooltip for overflow), and a small ✎ edit control with an accessible label.
- Clicking ✎ toggles a **per-card floating edit panel**, not a persistent row of controls. The popover has a category selector, Remove shortcut (with the prior confirmation and local-only semantics), and Close. Only one editor can be open; clicking outside closes it; Escape closes the editor first, then the organizer on a second press.
- The popover is positioned above its card when needed to avoid the bottom of the scroll region.
- Existing **category assignments, local shortcuts, and ordered ID lists are unchanged** by upgrading. No storage schema migration.
- Drag/drop remains confined to SwiftClick's Shadow DOM, without touching native ChatGPT. In the two-column grid, dragging the handle onto a card's **left half inserts before it**, and dragging onto its **right half inserts after it**. Left/right insertion indicators confirm the direction. This supports moving between columns while maintaining a single persistent reading order.
- Keyboard handle Arrow Up/Down still moves one position in the persisted reading order; global search and category-home view remain non-draggable.
- Desktop-sized cards are not divided into two independent columns of storage: they are a visual two-column presentation of one ordered list. This is intentional so the order remains stable when the window narrows.

### Acceptance in Firefox / Tampermonkey

1. Update the single script installation to **0.1.0-alpha.9** and reload ChatGPT. Do not clear local Tampermonkey data.
2. Open **Hobbies & Interests**. Confirm compact two-column rows with the order **⠿ / PROJECT (or CHAT) / title / ✎**, with no visible category selectors or Remove shortcut buttons until clicking ✎.
3. Click ✎ on **Cinema Decoder**. Confirm the popover offers Category and Remove shortcut; close it via Close, click-away, then Escape.
4. In Edit, change a project to another category, reopen that category, and verify its shortcut is in the correct place. Choose Cancel for a removal confirmation and confirm nothing is deleted. (Use a disposable test shortcut if testing actual removal.)
5. Drag **Cinema Decoder** from its tile to the left or right half of a tile in the other column; watch the left/right border highlight, release, and verify the new reading order.
6. Close/reopen and refresh ChatGPT; the drag ordering and category assignments should persist.
7. Try Arrow Up/Down while the drag handle is focused. Search results should remain two-column compact tiles but **not** show drag handles.
8. Narrow the Firefox window to 720px or less; verify a single-column list, full access to editor, and no horizontal clipping.
9. Verify ChatGPT's native sidebar, three-dot menu, New Chat, and selected-project name/URL intake remain unaffected.

### Limitations and follow-up

- This is a technical UI release on the feature branch; a real authenticated Firefox session has not yet validated cross-column dragging and popover placement. Automated Node tests cover hit-testing, ordering, conditional edit controls and CSS structure.
- Touch-specific drag gestures and true independent column positioning are deferred.
- The organizer is still **manual-only**; this revision does not reinstate passive discovery.

**Keep PR #6 as a draft, and do not merge into `main` until browser acceptance.**

## Alpha.10 — compact header icon launcher, visually before Search (2026-11-12)

### User request
Place a small SwiftClick Organizer toggle icon immediately to the left of ChatGPT's Search and Sidebar Toggle icons in the upper-left page header, instead of the conspicuous vertical floating text launcher.

### Design & implementation
- The old large side-floating launcher has been replaced with a **32×32 icon button** displaying a 2×2 tile/grid SVG, created with `document.createElementNS`.
- Clicking toggles the Organizer open or closed; `aria-expanded`, accessible label, tooltip, focus outline and Escape behavior reflect the current state.
- The launcher **looks embedded** in ChatGPT's header. To avoid repeating previous regressions, it is not inserted into the React-owned sidebar/header DOM. It remains inside a top-level Shadow DOM host under `document.body` and is **positioned geometrically 8px to the left of the native Search control**, matching that control's height and computed foreground color.
- Native Search is identified by its visible, labeled button/link metadata; the script does not use hidden APIs or read conversation text. Geometric guards refuse placements too close to the ChatGPT heading, too far into the page, or outside the viewport. A hit test prevents covering another native button/link.
- If the native Search control cannot be identified or there is insufficient space (collapsed sidebar, narrow viewport, changed UI), the icon **falls back to a discreet fixed right-edge position**. This is intentional fail-safe behavior, not a failed UI injection.
- The position is refreshed on ChatGPT DOM changes, resize, scroll and existing periodic checks. It neither mutates nor reorders ChatGPT's header, navigation, or search controls.
- Existing manual-only project/chat collection, categories, order, intake, card edit popovers and local storage remain unchanged.

### Firefox/Tampermonkey acceptance
1. Install `0.1.0-alpha.10` over the existing Tampermonkey script, ensure only one version is enabled, then reload `https://chatgpt.com/`.
2. Check the upper-left **ChatGPT header**: a small tile/grid icon should appear **immediately left of Search**, and Search and Sidebar Toggle must remain clickable, hoverable and visually unchanged.
3. Click the new SwiftClick icon to open the category-first organizer. Close the dialog and reopen using the same icon; verify tooltip/focus behavior and no duplicate icons.
4. Collapse and expand ChatGPT's native sidebar; the icon should adapt to the available header space, or show as a small right-edge fallback if no safe header slot exists. It must not overlap the ChatGPT title, Search, or sidebar toggle.
5. Test a narrow window and ChatGPT light and dark themes; verify legibility and no covered native controls.
6. Open native project menus, use Add to SwiftClick Organizer intake, navigate saved projects/chats and drag items in category cards; no regressions.
7. If the icon remains at the right edge rather than relocating to the header, capture the upper-left header screenshot and, if possible, the Search button's `aria-label`, `title` or `data-testid` from Firefox Inspector. The selector may need adaptation to the current ChatGPT interface.

### Validation status
- Node syntax and pure geometry/regression tests passed on the feature branch; live header DOM placement is **not yet confirmed** on the user's logged-in Firefox session.
- Keep draft PR #6 **unmerged** pending verification. No changes were made to production `main`.

## Alpha.11 — Finances and Home categories (2026-11-12)

The user requested two additional top-level categories in the front-door UI:
- **Finances** (ID `finances`, icon ＄): investment plans, financial dashboards, retirement, banking, household financial topics, etc.
- **Home** (ID `home`, icon ⌂): home maintenance, structural projects, renovations, repairs, and household improvement projects.

The new cards appear after My Health and before SwiftClick Business. Both are ordinary flat categories—no subcategory nesting. They're automatically included in the existing category assignment selector (the ✎ edit panel for saved projects/chats) and the Add project / Add chat intake forms, and use the existing per-category drag ordering.

### Data compatibility
- **No reset, data migration, or automatic reassignment.** Existing saved projects, chats, category IDs, per-category orders, and the header toggle are unaffected. Old data deserializes through the same validation logic.
- The script intentionally does not automatically move an existing project such as **Home Structural Maintenance** from Hobbies & Interests into Home. To file that project, enter its current category, click ✎ on the saved shortcut, and select Home. The original ChatGPT project is not moved.
- Likewise, use the item's ✎ control to move any saved financial projects or chats to Finances.
- Manual-only curation is unchanged: browsing ChatGPT never adds items on its own.
- The icon is generated in the existing category card UI using the same textContent/DOM approach, not HTML injection.

### Firefox acceptance
1. Update the installed userscript to **0.1.0-alpha.11** without clearing Tampermonkey storage.
2. Open the Organizer from its compact header icon; confirm **Finances** and **Home** appear as top-level cards.
3. Go to Hobbies & Interests, find the existing **Home Structural Maintenance** shortcut if already saved, click ✎, choose **Home**. Confirm it appears in Home and remains after reloading.
4. Add or move another item to Finances. Verify the category selector lists Finances and Home on both project and chat forms.
5. Reorder two items in Home or Finances if available, reload, and confirm that local order persists.
6. Confirm preexisting categories and items remain, the native ChatGPT header/sidebar controls still work, and no passive discovery resumes.

**Status:** code and Node tests are in the development branch, draft PR #6 remains unmerged pending Firefox acceptance.

## Alpha.12 — existing-project status in native three-dot menu companion (2026-11-12)

### Desired behavior

After a user opens a project's three-dot menu in ChatGPT, the SwiftClick companion action should know whether that exact project has **already been explicitly saved** in SwiftClick. The action now has two modes:

- **Unsaved**: `＋ Add to SwiftClick Organizer` — previous category intake workflow, including selected-project name/URL.
- **Saved**: `✓ Already in Organizer` — visually confirms membership and, when clicked, opens the **saved project's assigned category** inside SwiftClick rather than opening Add intake or creating another shortcut. This remains useful as a navigation action rather than a disabled dead end.

### Identification and safety

- Project recognition uses the **native project ID** parsed from the selected Project Home menu link, when available. Otherwise, it uses a recent (within 8 seconds) ChatGPT project-row link captured when the three-dot button was clicked.
- The script compares this project ID only with entries in its existing **manually saved projects** list; a matching title by itself is never evidence of membership.
- When the selected project cannot be identified reliably, SwiftClick retains the **Add** label rather than guessing. It does not assume the currently open page is the selected sidebar project.
- As a defensive final check, if Project Home navigation resolves to a project already in SwiftClick, the intake handler routes to the saved category instead of showing another Add form.
- No additional scanning or automatic inventory collection. No native ChatGPT sidebar/menu insertion, no project mutations, and no changes to the saved data schema.
- Existing saved project/chat shortcuts, eight flat categories, header icon launcher, drag ordering and edit controls remain intact.

### Firefox acceptance checklist

1. Update to **0.1.0-alpha.12**, retaining the same Tampermonkey installation and existing local data.
2. Open the three-dot menu for a **project already saved** in SwiftClick (e.g., Home Structural Maintenance if you've saved it). The adjacent action should read **✓ Already in Organizer**, not Add.
3. Click the status action. SwiftClick should open directly to that project's saved category (e.g., Home), without presenting an intake form or duplicating the project.
4. Open the three-dot menu of an **unsaved** project. It should say **＋ Add to SwiftClick Organizer**, lead to the usual name/URL/category intake, then save.
5. Reopen that newly saved project's menu. It should now say **✓ Already in Organizer**.
6. Test when project A is open in the main area but project B's three-dot menu is selected: status must reflect **B**, never A.
7. Test saved projects with similar names. The membership check should rely on the ID, not title.
8. Confirm regular ChatGPT project actions, submenu hover controls, custom categories, and menu styling continue to behave normally.

**Validation:** Node regression tests cover ID matching, expiration, fallback and routing. Logged-in Firefox/Tampermonkey behavior is pending user verification. Keep draft PR #6 unmerged until accepted.

## Alpha.13 — fix incorrect saved status and accidental Project Home navigation (2026-11-12)

### User-reported regression

On alpha.12, projects that were **definitely already saved** still showed Add in ChatGPT's three-dot menu, and clicking the companion sometimes navigated to the project home unexpectedly, leading to unstable modal behavior.

### Code-level diagnosis

1. The project-menu status depended on capturing a project link from the native sidebar row. Not all current ChatGPT rows expose that link within the nearby DOM, so the ID could be absent even when the project existed in SwiftClick.
2. The companion action was previously triggered on **pointerdown**, removing the button before the browser finished the click. This can allow the completed click to target an underlying native menu item, including **Project home**.
3. For missing project IDs, the script invoked the native `Project home` control programmatically to learn the URL. That unexpectedly navigated the user away from their current context.

### Alpha.13 behavior

- **No navigation on companion click**: the action executes only on the completed click, and its identity snapshot is held through pointerup while the native menu can dismiss. The script NEVER invokes `home.click()`, never programmatically changes the ChatGPT route, and deletes the old pending-native-navigation workflow. A leftover tab-only navigation intent from alpha.12 is discarded.
- **ID confirmed**: `✓ Already in Organizer`, clicking opens the saved project's SwiftClick category. This is the authoritative match.
- **No ID, unique saved name match**: `? Possible match — Review`, clicking opens the candidate's category for user review. This is deliberately **not** asserted as an ID-confirmed match, because different projects can share a name.
- **Verified ID, unsaved**: `＋ Add to SwiftClick Organizer`, clicking opens intake directly with the verified project URL and captured name—without navigating to Project Home.
- **Unverifiable project ID**: `＋ Add to SwiftClick Organizer` opens the editable manual Add form with any captured name but no guessed URL. The user may open ChatGPT's native Project Home themselves, and use the normal `+ Add project` control there to have the current project's URL and title prefilled, or paste the project URL into the form.
- Capture remains **user-triggered**: on a sidebar button interaction, inspect only the clicked row's local markup, with an explicit height boundary to avoid taking a neighboring project's ID. Never index projects/chats in the background. Stale row context is cleared on a new click.
- No changes to persistent project/chat records, categories, drag order, or header launcher; no data reset needed.
- Still mounts the menu-adjacent SwiftClick action only in its own Shadow DOM, without modifying ChatGPT's native menu or sidebar markup.

### Manual Firefox/Tampermonkey acceptance

1. Update the existing SwiftClick Organizer script to **0.1.0-alpha.13** (exactly one copy enabled), then refresh ChatGPT. Do not clear local categories or shortcuts.
2. While viewing project A, open the three-dot menu for saved project B. Check for `✓ Already in Organizer`; click it. The organizer should open at B's saved category without navigating ChatGPT to B's Project Home, creating another shortcut, or flickering.
3. If the native project row lacks an ID, a **unique-name** candidate may instead say `? Possible match — Review`. This is a verification prompt, not a duplicate. Clicking it should open the matched category without altering the saved project.
4. Try a **different unsaved project**. If its native ID is discoverable, intake should open with its name and URL; otherwise it should open a manual form with a blank URL and no automatic ChatGPT navigation.
5. For the latter fallback, close the intake, open that project's native **Project home** yourself, then use SwiftClick Organizer's **+ Add project** button. Its name and current URL should prefill. Save to a category and verify the project appears once.
6. Repeat rapidly on two different project menus while a different project is open. Never accept the currently open project's ID as evidence for the clicked project.
7. Confirm native three-dot menu, Project Home, New Chat, other sidebar actions and the SwiftClick header icon remain clickable. No unintended navigation, click-through, or repeated intake loop.
8. Verify existing category assignments and drag order persist after refresh, and background indexing remains disabled.
9. If the label still says Add for a project you know is saved, the project-row markup may not expose either an ID or a reliable title. A screenshot of that specific menu and nearby sidebar row, plus an optional minimal Firefox Inspector DOM snippet for the row (not conversation content), would help refine detection.

### Validation status

Regression and syntax checks are automated on the feature branch, including ID-first matching, unique-title ambiguity, stale context, safe add fallback, and absence of native `home.click()` calls. Real browser behavior remains pending user verification. Draft PR #6 stays unmerged; production `main` stays unchanged.

## Alpha.14 — safer additional project-URL autofill (2026-11-12)

User noticed that some project intake forms now prefill the name but not the project URL after the prior alpha.13 regression fix. This is an expected limitation of the safer design, **not a desired final UX**: alpha.13 eliminated automatic ChatGPT Project Home navigation because it could click through and unexpectedly change pages. Without a project link or identifier on the selected row, the URL cannot be reliably determined.

### What this change does

- During the **user-initiated click on the project's three-dot control only**, inspect the short clicked project row for a single explicit project ID in its native attributes: `data-project-id`, `data-projectid`, `data-project-uuid`, `data-item-id` or `data-entity-id`.
- When precisely one well-formed `g-p-...` ID is present, safely construct the known ChatGPT project URL `/g/{ID}/project` and carry it through the existing intake flow. A native project anchor remains the first choice; the new metadata detection is only a fallback.
- Do not scan the whole sidebar, infer IDs from project titles, call undocumented APIs, click native Project Home, or alter any native element. Ignore conflicting/multiple IDs and unrecognized metadata. No persistent storage changes.
- If neither an anchor nor explicit ID is available, leave the URL field empty and editable. In that case the user can open Project Home **themselves** and use SwiftClick's **+ Add project** there, which pre-fills the current project's URL, or paste the link.
- Existing saved project status logic, category assignments, local ordering and edit controls are unchanged.

### Firefox/Tampermonkey acceptance

1. Upgrade the existing script to **0.1.0-alpha.14**, keeping previous saved items intact, then reload ChatGPT.
2. Open a project's native three-dot menu and click `＋ Add to SwiftClick Organizer`. For a row with an anchor or recognized explicit project ID, verify both **name and correct URL** are prefilled, without navigating away from the current ChatGPT page.
3. For a saved project, confirm the `Already in Organizer` or cautious `Possible match — Review` status still works without duplicate intake.
4. For a menu where the URL remains empty, do **not** assume the script is broken: that row may not expose a usable link/ID. Manually open Project Home, then use `+ Add project` inside the Organizer to prefill the displayed project's URL.
5. Verify the selected project B's URL never incorrectly resolves to currently displayed project A.
6. Confirm native menus, New Chat, sidebar toggle, category ordering and existing links remain unaffected.
7. If metadata capture still does not work on a specific sidebar row, inspect the row's **non-sensitive structural markup** (element and attribute names, omitting personal project names or IDs). Use that evidence before adding further selectors.

### Validation status

Node tests exercise explicit metadata extraction and its safety guards. **A passing unit test does not establish that ChatGPT actually includes these attributes**: logged-in Firefox acceptance is still required. Keep PR #6 draft and main unchanged.

## Alpha.15 — category management and main-screen spacing (2026-11-12)

### User request

The screenshot of the organizer's category-first front door showed the top row of cards immediately touching the bottom of the search input. The user also requested replacing the **Clear local category labels** footer button with an interface to **create, rename, delete, and reorder** top-level categories, retaining the clearing action inside that interface.

### Implementation

- Add **22px of vertical margin** above the category card grid, separating the first row from the search input.
- Replace the footer button with **⚙ Manage categories**. It opens a dedicated manager inside the existing organizer overlay; the manager can be closed using its Back button or Escape.
- Each category has an editable name (Save name or Enter), a drag handle, and Up/Down reorder buttons. Reordering determines how the cards appear on the organizer's front page and how category options are ordered in other pickers.
- **+ Create category** adds a new top-level category (no subcategories) before the Uncategorized inbox. Each new category has an automatically generated stable `custom-...` ID, generic ▦ icon, and an editable label. Names are unique ignoring case, 1–50 characters; maximum 40 categories.
- **Delete** is confirmed with the number of saved items affected. Deleting a category reassigns its projects/chats into **Uncategorized** without deleting their saved links or modifying native ChatGPT projects/chats. Its obsolete per-category ordering is cleared. **Uncategorized cannot be deleted** because it is the fallback inbox. Renaming Uncategorized is allowed.
- The former footer reset is now an **Advanced: Clear all category assignments** operation inside the manager, with explicit confirmation. It reclassifies saved shortcuts to Uncategorized but does not delete shortcuts or categories.
- All user category definitions and display order persist locally under `swiftclick-organizer-poc.categoryDefinitions.v1` as `{version:1,categories:[{id,label},...]}`. This is an independent key: existing assignments, saved projects/chats and per-category item ordering are retained. Existing installations with no category definitions key load the eight prior default categories in their prior order.
- Renaming a category changes **only its display label**, not its ID. Thus existing assignments are preserved. A deliberately deleted default category stays deleted after reload; the script does not reconstruct it.
- All injected UI uses createElement, textContent, appendChild, and isolated Shadow DOM. No string-based HTML injection, no native ChatGPT DOM mutation, no automatic inventory discovery.

### Firefox / Tampermonkey acceptance

1. Install **0.1.0-alpha.15** over the previous userscript (one enabled installation); reload ChatGPT. Do not clear existing local data.
2. On the category-first home screen, verify visible breathing room between the search input and top row of cards.
3. Confirm existing eight categories and their saved project/chat counts remain intact; click **⚙ Manage categories** in the footer.
4. Rename **Hobbies & Interests** temporarily (e.g. **Interests**) and Save; return to the front page and verify the label changes but the same saved projects remain inside. Rename it back afterward if desired.
5. Use the arrow buttons or drag handles to move **Home** ahead of Finances; exit, reopen, and reload ChatGPT to confirm its new position persists. Verify intake category pickers reflect the new order.
6. Create a disposable test category; verify it appears on the front page, in Add project/chat forms and item edit pickers. Assign one disposable shortcut to it, then delete the category. Confirm that shortcut appears under Uncategorized, without being deleted from SwiftClick or ChatGPT.
7. Confirm the manager refuses duplicate/empty category names and does not allow deleting the Uncategorized inbox; confirm no items disappear after deleting a category.
8. The **Advanced** reset should be tested only if you intentionally want to clear all assignments. It is not necessary for ordinary acceptance testing.
9. Confirm native project-menu actions, header launcher, manual-only intake and category item drag/reordering continue to work.

### Limitations

- Categories are stored per Tampermonkey/browser profile, not synchronized between browsers, devices or ChatGPT accounts.
- Custom categories use a generic icon; editable icons or nested categories are future options, not part of alpha.15.
- Automated Node tests verify data models, migration, persistence constraints and static UI invariants. Interactive drag/drop, real-browser rendering and storage persistence still require logged-in Firefox acceptance.

**Status:** experimental feature branch, draft PR #6; do not merge into main before Firefox verification.

## Alpha.16 — editable local names for saved project/chat shortcuts (2026-11-12)

### User request

The existing ✎ edit popover on each saved project/chat card already supports category reassignment and Remove shortcut. The user also wants to rename the **label shown in SwiftClick**, independently of the actual ChatGPT project or conversation title.

### Implementation

- Add a **Display name** text input prefilled with the saved shortcut name to the per-item ✎ popover, above the existing category dropdown.
- **Save changes** now commits the edited display name and category selection together; the category dropdown no longer closes the popover immediately on selection. The user can rename, recategorize, or do both in one interaction. **Close** dismisses without saving either change. Pressing Enter within the name input also saves.
- The optional name is not empty: it must contain 1–140 characters after trimming and normalizing whitespace. Invalid names display an inline error without dismissing the editor.
- For a changed name, the script validates the existing URL/key with the same project/chat sanitizers, then updates **only that saved shortcut's local title** in the existing Tampermonkey `manualProjects.v1` or `savedChats.v1` key. It does not rename anything in ChatGPT and does not alter the shortcut URL or canonical key.
- Persist before updating the in-memory title so a storage error doesn't misleadingly show a successful change. Other saved links are preserved.
- Category assignments are still keyed by canonical project/chat ID, not title. A name-only edit leaves the existing category and custom drag-and-drop order unchanged. A category change retains the previous behavior of clearing the old category's sort position.
- The edit panel's **Remove shortcut** action and confirmation remain available separately. The main two-column card layout and manual-only indexing remain unchanged.
- Everything uses explicit DOM construction and textContent, not Trusted Types-incompatible HTML string injection.

### Firefox/Tampermonkey acceptance

1. Upgrade to **0.1.0-alpha.16** over the existing script and reload ChatGPT; retain all saved data.
2. Open an existing project card's ✎ editor and change **Display name** (e.g., `Cinema Decoder` → `Film analysis`), without changing Category. Click **Save changes**.
3. Verify the card immediately displays the new name and opens the original ChatGPT project URL. Refresh ChatGPT and reopen SwiftClick: the name must persist and remain in the same category and drag order.
4. Repeat with a saved **chat** shortcut. Confirm that both types persist locally and the original chat or project title in ChatGPT itself does not change.
5. Open the editor again, change the name and category together, then Save changes; confirm both changes apply.
6. Change a name but click **Close** instead of saving; confirm that the previous saved name remains. Try blank/whitespace-only names and verify inline validation blocks saving.
7. Confirm Remove shortcut still asks for confirmation and retains its former behavior; use a disposable shortcut for an actual removal test.
8. Check cards, search result titles, category manager, drag ordering, native ChatGPT sidebar and project-menu intake for regressions.

### Validation status

GitHub Node syntax and unit tests for project/chat display-name updates, immutable URL/key and error handling passed. Logged-in Firefox acceptance is still required for the popover interaction. Keep draft PR #6 unmerged and `main` unchanged.

## Alpha.17 — Set icon chooser for Manage Categories (2026-11-12)

The user asked for **Set icon** beside each editable category, opening a visual library of icons.

- Each category row now shows its current icon and a **Set icon** control.
- Clicking Set icon expands a searchable palette directly beneath that row, with 74 bundled icons. Search by name (e.g. home, books, bank) and filter by People, Finances, Home, Technology, Creative, or General.
- Clicking a choice immediately persists the icon and returns to the category list; Cancel or Escape dismisses without saving. The current icon is identified and focus is returned to the Set icon control.
- All previously used glyphs remain available. The library is bundled inside the userscript: no external fonts, networks, APIs or HTML-string injection.
- The existing local `categoryDefinitions.v1` schema is extended to store `icon` alongside `id` and `label`. Earlier records without icons load their original built-in defaults (or ▦ for user-created categories), so there is no reset or migration.
- Changing icons never affects category IDs, project/chat assignments, per-category custom order, shortcut links or native ChatGPT.

**Firefox acceptance:** Update to alpha.17 without clearing Tampermonkey data, open Manage categories, use Set icon for Home, search for house and select 🏡. Confirm the Home card updates and survives a full refresh. Test group filter, Cancel and Escape, create a custom category and assign its icon, then verify its icon survives rename and reorder. Existing projects/chats and category counts should be unchanged.

Keep draft PR #6 unmerged pending browser acceptance.

## Alpha.18 — second front-door tab for customizable Quick Links (2026-11-12)

### Product intent

The existing SwiftClick Organizer front door becomes **two top-level tabs**: **ChatGPT Categories** (the original first/default tab, unchanged) and **Quick Links** (a user-managed launcher for unrelated websites). Quick Links are not ChatGPT projects or chats and do not participate in category assignments or category ordering.

### Defaults, behavior and storage

- On first access, Quick Links contains two starter links: **YouTube** → `https://www.youtube.com/` and **Google Drive** → `https://drive.google.com/`.
- Clicking a Quick Link opens the configured destination using a real `<a>` element with `target="_blank"` and `rel="noopener noreferrer"`. The existing ChatGPT tab is not navigated away.
- **⚙ Manage Quick Links** opens a management view to **add**, **edit** display name/destination URL/icon, **delete**, and **reorder** links. Reordering supports desktop drag handles and keyboard Up/Down controls. Add/Edit forms validate destinations and show errors for invalid input.
- Use the existing built-in category icon library as the icon options; no external fonts/images. Default icon choices: YouTube 🎬 and Google Drive 📁.
- Link validation allows only `http:` and `https:` (including local web apps) and rejects missing hostnames, embedded credentials, script/data/file schemes, empty names and overlong inputs. Users are responsible for the trustworthiness of their saved external destinations. Persist full paths, query strings and URL fragments because bookmarks may intentionally use them.
- Quick Links has its own Tampermonkey key `swiftclick-organizer-poc.quickLinks.v1`, version 1, storing `[{id,title,href,icon}]` in display order. The starter links are seeded **only if this key is absent**. Once a link is removed—or even all links are deleted—it must remain deleted after refresh, never reset to the starters.
- Saving writes storage first and updates the UI only on success. Maximum 100 Quick Links; name length 100 and URL length 2048.
- The existing local categories and chat/project shortcut stores and their IDs/ordering remain untouched. The Organizer opens on **ChatGPT Categories** as before; switching tabs never imports/indexes external sites.

### Browser acceptance

1. Upgrade the single Tampermonkey installation to alpha.18 and reload ChatGPT. Confirm the two tabs and that existing category cards/counts remain unchanged.
2. Click **Quick Links**. The starter YouTube and Google Drive buttons should appear. Click each; it should launch the correct site in a **new browser tab**, leaving the original ChatGPT tab usable.
3. Click Manage Quick Links and add a link (e.g. another useful website). Verify name/URL/icon are displayed, and that clicking it opens exactly the entered address.
4. Edit a link title/URL/icon, save, leave the manager and refresh ChatGPT. Changes should persist.
5. Reorder by dragging and via keyboard Arrow Up/Down while the handle is focused. Confirm the order matches the visual grid and survives refresh.
6. Delete a starter link and refresh. It must remain deleted; test adding it back manually if desired. Deleting all links should show an empty state, not silently restore starter links.
7. Try a `javascript:` or `file:` URL: saving must be rejected. Confirm native ChatGPT project menu, category editing and icon pickers still work.

### Implementation requirements

Pure model helpers and Node regression tests cover starter seeding, blank-list persistence, URL restrictions, add/edit/delete/reorder behavior, no HTML injection, and safe new-tab links. All UI uses explicit `document.createElement` and Shadow DOM rather than `innerHTML`.

**Status:** experimental feature branch, draft PR #6; keep `main` unchanged until Firefox acceptance.

## Alpha.19 — move ChatGPT Add controls into footer (2026-11-12)

- The **ChatGPT Categories** tab now puts the search input first in the scrollable main area, directly below the persistent header and tabs. Removed the redundant “Where would you like to go?” heading, the top Add project/chat toolbar, and explanatory “only explicitly added” wording.
- Its persistent footer groups **+ Add project**, **+ Add chat**, and **⚙ Manage categories** together; the saved project/chat counts remain on the left. Footer controls wrap responsively on smaller screens.
- Clicking an Add action retains project/chat URL and title autofill when available. The form appears **beneath search**; the main pane scrolls to the top and focuses the form's first field. The footer action changes to a Cancel option while that form is open.
- Category navigation, search, saved shortcuts, custom ordering and icons remain unchanged. **Quick Links** and its separate management footer are unchanged.
- No storage schema changes. Injected UI still uses explicit DOM creation with no HTML-string sinks.

### Firefox acceptance
1. Update to alpha.19 without clearing Tampermonkey data and reload ChatGPT.
2. On **ChatGPT Categories**, confirm search is first and the top Add buttons/explanatory text are gone. Footer shows Add project, Add chat, Manage categories beside the saved-item counts.
3. Click Add project while on a native ChatGPT project. Confirm the intake appears below search with the current project's title/URL prefilled. Save or cancel.
4. Repeat Add chat in a ChatGPT conversation and in a category. Confirm footer remains usable while the content area scrolls.
5. Resize the browser narrow: the three controls should wrap rather than be clipped. Switch to Quick Links; its Manage Quick Links footer should still be unchanged.
6. Confirm saved category cards, shortcuts, link editing, drag order and icons are preserved after refresh.

**Status:** development feature branch; Firefox acceptance pending, PR #6 remains draft.

## Planned export/restore privacy requirements (cross-project standard, 2026-11-12)

The authoritative working draft is **“SwiftClick — Backup, Data Export, Import & Privacy Standard — Working Draft v0.1”**, stored privately in Google Drive → **Web App Development Standards / 04 - Operations and Migration**. Refer to that standard before implementing any data export, import, sync, or backup. Its private Google Drive URL is intentionally not embedded in this public repository.

- Treat a full Organizer backup as **private personal data**: saved ChatGPT project/chat titles, category labels, custom ordering, Favorites (when implemented), and Quick Link URLs can reveal personal information even when they do not grant sign-in access.
- Prefer **local, deliberate, export-only** first. No server calls, upload, telemetry, background distribution, or automatic cloud sync. Show item counts and a privacy warning before browser download. Do not export authentication cookies, OAuth sessions, API keys or unrelated page state.
- Inspect stored URLs locally for potentially sensitive query/fragment/path components (token, api_key, signature, code, secret, etc.). Warn users without silently corrupting full-fidelity restore backups. Treat **sanitized sharing exports** as a separate, explicitly lossy feature.
- Version the **backup format independently** of userscript version/internal Tampermonkey storage key suffixes. Record completeness and future compatibility rules. Backup scope should include editable categories/icons/order, manually saved projects/chats, assignments, per-category item ordering and Quick Links; add future Favorites when shipped.
- **Defer full Import/Restore** until after near-term data changes such as Favorites. Future imports must validate untrusted files, detect old versions, preview changes, reject malicious URLs, distinguish Merge/Replace, create a protective pre-import backup, and handle partial write failure.
- Acceptance checks: faithful local export; no missed stored sections, secret leakage or network upload; user warning; URL scan false-positive handling; explicit version and stable IDs; no Trusted Types-unsafe HTML sinks.

**Current status:** documented requirements only. Neither exporter nor importer is implemented in alpha.19. Product features are not considered shipped merely because their requirements are documented.

## Alpha.20 — curated ChatGPT Tools + New Chat actions (2026-11-12)

Added a third **ChatGPT Tools** tab (16 built-in entries in the ChatGPT features, Specialized tools, and Account & support sections). Existing ChatGPT Categories and Quick Links behavior/data remain unchanged.

New Chat is a split control: the main tile starts a regular chat. A ⌄ dropdown offers **New regular chat** and **New temporary chat**. Temporary uses `https://chatgpt.com/?temporary-chat=true`, which responds as a Temporary Chat publicly but is **not an officially stable documented deep-link API**. The menu advises checking the **Temporary** banner and selecting Personalized or Unpersonalized before sending any message. Confirm in the signed-in Firefox session; if the banner is absent, use ChatGPT's native Temporary toggle.

Built-in routes: Scheduled, Library, Plugins, Maps, Images, GPTs, Sites, Finances, Profile, Settings and Help Center. Candidate routes not authenticated-tested show **Check in Firefox**. Adobe, pinned Health, Find Workspaces and Personalization are **visible but not clickable** until a reliable ChatGPT URL is entered through **Manage ChatGPT Tools**. Avoid guessing paths or programmatically clicking native account menus. Help Center opens a new tab; other tools navigate within the current tab.

Management includes **Show/Hide**, **Edit icon**, **optional first-party URL override**, **drag/keyboard order within groups**, and **Restore default Tools settings**. The immutable source catalog is code-defined; only preferences persist in `swiftclick-organizer-poc.chatgptTools.v1` with `version:1,order,hidden,icons,urlOverrides`. Override destinations accept HTTPS ChatGPT hostnames (plus help.openai.com for Help Center), without credentials, query, fragment or custom port. New Chat URLs cannot be overridden. All UI uses explicit DOM creation and textContent, not HTML string sinks.

### Firefox acceptance

1. Update to alpha.20 and reload. Confirm three tabs and preservation of projects, chats, category icons/orders, and Quick Links.
2. Open ChatGPT Tools; verify 16 entries. Try Plugins, Images, Finances and Help Center; verify Help Center opens a new browser tab.
3. Check the candidate routes Scheduled, Library, Maps, GPTs, Sites, Profile and Settings; note unexpected pages. Health, Adobe, Find Workspaces and Personalization should display an honest setup state until configured.
4. Use New Chat's primary action for a regular chat, then dropdown New temporary chat. Confirm the **Temporary** banner and personalization controls before typing; this requires signed-in testing.
5. Manage tools: hide/reveal, choose an icon, reorder via arrow keys and drag, set a verified first-party URL for a setup-only tool, refresh for persistence, reject invalid external URL, restore defaults.
6. Confirm no native ChatGPT sidebar changes or interception of private account data.

**Status:** alpha feature branch, draft PR #6; browser acceptance pending.

## Alpha.21 — New Chat launcher, Health link, neutral browser language, remove Adobe (2026-11-12)

**Browser feedback addressed:**

1. Clicking **New chat** previously navigated to ChatGPT Home where the original userscript automatic Home-opening rule brought the Organizer modal back. The new New Chat navigation writes a short-lived timestamp to *tab-scoped* `sessionStorage`, then closes the Organizer and navigates. On the next document load, the marker is consumed, suppressing automatic Home opening for that one navigation (fresh ordinary Home visits still open as usual). Temporary Chat is also exempt from automatic overlay opening when the URL contains `temporary-chat=true`, even if storage is unavailable.
2. **Health** now opens the user-confirmed direct URL `https://chatgpt.com/health`. No medical records, credentials, or private data are accessed.
3. User-visible **Check in Firefox** labels and Temporary Chat verification wording are browser-agnostic (`Check in your browser`). The underlying documented need to verify routes in a signed-in browser remains.
4. **Adobe** removed from the hard-coded catalog entirely because there is no dependable direct URL. Existing tool preference records are sanitized on read and automatically drop the removed ID without wiping unrelated visibility/order/icon overrides.

**Regression tests:** source, tests and documentation updated together in one commit. Verify ordinary Home auto-opens, New regular chat remains unobstructed, New temporary chat banner stays visible, Health navigates correctly, Adobe is absent, tool preferences persist and all other tabs are unchanged.

**Status:** alpha development branch, draft PR #6. No production merge before browser acceptance.

## Alpha.22 — Category icons and project/chat counts (2026-11-12)

Two UI-only refinements requested after successful browser review of alpha.21:

- Category card icons now have explicit `24px` font size and `1.1` line height via `.card-icon`, matching the existing `.tool-icon` in ChatGPT Tools. The category title, card dimensions, editable category icons and other tabs remain unchanged.
- Each category card now shows **X projects | Y chats** instead of a generic total. Singular values are grammatically correct (`1 project | 1 chat`); zeros remain visible (`0 projects | 2 chats`). The summary is calculated from the same `visibleItems(category.id)` collection used when opening that category and uses each item's `type`; it does not count Quick Links or ChatGPT Tools.
- No Tampermonkey storage changes, migration, new permissions, new network activity or native ChatGPT UI modifications.

**Acceptance:** After updating to alpha.22, open ChatGPT Categories and compare icon sizes with ChatGPT Tools. Confirm category card summaries match project/chat counts after adding, deleting or recategorizing an item. Refresh to confirm no saved items, categories, icons or orders changed.

**Status:** feature development branch and draft PR #6; browser acceptance pending.

## Alpha.23 — Movable Quick Links subheadings (2026-11-12)

**Feature:** Add user-defined, visually distinct **subheadings / section dividers** to the Quick Links tab. Headings are peers in the same ordered list as links, not separate categories or nested containers. **Manage Quick Links** now presents **+ Add quick link** and **+ Add subheading**. Users can enter/rename a heading (maximum 80 characters), edit it, delete it without deleting links, and drag or use Up/Down to move it across links and other headings. The public Quick Links tab renders a full-width heading and a new link-card grid after every subheading, preserving the single-column sequence of heading positions. Links appearing before any heading remain at the top unheaded. Consecutive or trailing headings remain visible and are valid.

**Persistent format:** Original `swiftclick-organizer-poc.quickLinks.v1` is left untouched as a safety fallback. On load, the script first checks the new `swiftclick-organizer-poc.quickLinks.v2`; only if absent does it read v1 or initialize the YouTube/Google Drive defaults. The next real edit writes v2 `{version:2,entries:[...]}` preserving link titles, hrefs, icons and relative order. Normal links retain the previous shape (`id,title,href,icon`); heading records use only `{kind:"heading",id:"qh-...",title}`. IDs remain stable and unique. Deleting a heading retains all following links; they now visually belong to the section before the deleted divider. Deleting all entries is still persistent and must never silently restore defaults. Existing ChatGPT Categories and ChatGPT Tools data are unaffected.

**Security / resilience:** Heading text passes through textContent using explicit DOM constructors, never HTML injection. Headings have no href, cannot navigate, and any extraneous fields on imported/corrupt heading objects are ignored. URL validation for real links and new-tab noreferrer behavior are unchanged. At most 100 combined list entries; migrated old records are validated. Export/import design must eventually treat v2 as the authoritative Quick Links collection.

### Browser acceptance

1. Update without clearing Tampermonkey data. Verify the existing YouTube, Google Drive and any custom Quick Links are unchanged and in the same order.
2. Open Manage Quick Links and choose Add subheading. Enter a title, save, then use drag/Up/Down to place it above a set of links. Return to Quick Links; verify a full-width subheading and a fresh link grid below it.
3. Add another subheading, edit its title and move it up/down among links. Confirm the display grouping follows its exact list position.
4. Refresh ChatGPT; verify headings, links, icons and ordering persist.
5. Delete a heading; verify the links remain, the visual divider disappears, and nothing is lost. If all entries are removed, reload and verify nothing is reseeded.
6. Test a heading at the top, two adjacent headings, a heading at the bottom and zero links. Check both normal and narrow browser widths.
7. Confirm all Quick Links still open new tabs; unrelated Categories/Tools features work and existing data remains intact.

**Status:** feature branch and draft PR #6; browser verification pending. No merge into main until approved.

## Alpha.24 — fourth-tab Prompt Builder (2026-11-12)

**Initial implementation:** Add a Prompt Builder tab with the approved local 25-template catalog across seven task categories. Includes category filtering, text search, task selection, three or four labeled required fields, live editable generated prompt, manual Reset preview, Clear fields, and explicit Copy prompt. There is no AI API call, automatic composer insertion, or sending a chat.

**Privacy:** Inputs and preview are ephemeral per-page JS memory; closing Organizer or leaving Prompt Builder clears them. No user-entered prompt content is written to GM/Tampermonkey storage, sent to a server, or logged. The clipboard operation occurs only after pressing Copy, and the action is disabled for incomplete required fields. HTML is constructed using DOM APIs, not string-based HTML sinks.

**Test:** Verify all 25 starter prompts and form labels, filtering, multiline source pastes, preview edits, reset and clear behavior, clipboard copy, no-copy for required blanks, desktop and narrow browser layouts, and unchanged Categories/Quick Links/ChatGPT Tools storage and navigation.

**Status:** Experimental branch, draft PR #6. Browser acceptance pending.

## Alpha.25 — two-stage Prompt Builder and form accessibility refinements (2026-11-12)

**Browser feedback addressed:**
- Prompt Builder now initially shows only **Category** and **Prompt type** dropdowns and **Initialize Prompt Template**. Neither the task-specific input fields nor generated preview appears until explicit initialization. Category must be selected before the second dropdown becomes usable.
- Changing either selection does not mutate the active form. Choosing **Initialize New Prompt Template** replaces it, with a confirmation whenever the current form has any entered content or edited generated prompt. Cancel leaves all previous work intact. Focus moves to the first field after initialization.
- The selected template displays as a plain section heading with a subtle underline, not a boxed/card-like field. Field inputs, editable preview, Reset preview, Clear fields and explicit Copy Prompt continue as before.
- Across all Organizer screens, native dropdown option text/background is styled dark-on-white, including hover/focus/selected rules. **Known browser limitation:** native select option list/hover painting may be controlled by the browser or operating system; verify in the user's actual browser. If native hover is still too low-contrast, a proper accessible custom listbox component will be necessary for consistent pixel-level colors. Do not claim this CSS guarantees native popup hover appearance.
- All editable text inputs/textareas explicitly use a white insertion caret and a stronger pale focus outline/shadow. Text selection is blue with white foreground. All styles live inside the Organizer's Shadow DOM.

**Privacy:** Prompt inputs remain page-memory only. No new Tampermonkey storage, permissions, network calls, composer access or auto-send. Tab/overlay closing clears the prompt draft as before.

**Browser acceptance:** Test category-first selection, initialize gating, initial empty state, category/template changes with existing values and both Confirm/Cancel branches, active heading style, mobile/narrow layout, native dropdown option hover/selected contrast across Categories/Tools/Quick Links/Prompts, keyboard caret contrast, and preservation of the previous three tabs' saved state. Alpha code remains in draft PR #6 pending approval.

## Alpha.26 — Shared accessible custom dropdowns for Firefox (2026-11-12)

**Reason:** Browser screenshot after alpha.25 showed native Firefox select highlighted option drawn dark-on-dark, despite option background/foreground CSS. Firefox does not support `appearance:base-select` in the normal stable configuration, and OS-owned native popup highlight styling is not reliably configurable.

**Implementation:** Reusable local `enhanceSelects(panel)` adds a custom Shadow DOM listbox to ordinary selects at the end of each Organizer render. The original select remains in the DOM for existing value handling, with `tabIndex=-1` and hidden appearance; selecting the styled option updates `selectedIndex` and dispatches the original `change` event. The styled trigger is `role=combobox` with `aria-expanded`, `aria-controls` and an accessible label; options use `role=option` and `aria-selected`. Supports Arrow Up/Down, Home/End, Enter, Space, Escape, Tab, typeahead, click, outside click, and option overflow scrolling. Disabled selects/options remain disabled. List uses white background, near-black text and a pale hover/active state, fully controlled by userscript CSS. Applies across Prompt Builder, category management, Quick Links and ChatGPT Tools.

**Privacy/compatibility:** All elements are created via explicit DOM APIs, no HTML string injection. No additional permissions, storage, network requests or data model changes. Legacy select change handlers remain authoritative. Requires browser testing of keyboard behavior, open-popup placement, focus, native label interaction and overflow near the bottom of the dialog.

**Status:** experimental branch; draft PR #6 remains unmerged pending browser acceptance.

## Alpha.27 — Public starter categories, existing-user preservation (2026-11-13)

**Goal:** A new SwiftClick Organizer installation must never inherit the developer's personal category set; an existing user's customized categories, projects, chats, ordering and Quick Links must survive all script updates.

- **New first-install starters:** Work & Projects, Personal, Learning & Research, Ideas & Interests, Uncategorized. No projects or chat links are seeded. All user-facing categories remain editable.
- **Saved category definitions are authoritative:** `categoryDefinitions.v1` is read first; if it exists, it is not replaced or supplemented with a newer default set. Deleted starter categories remain deleted.
- **Legacy compatibility:** Historical built-in IDs (family, health, finances, home, business, ai, hobbies, uncategorized) and their fallback icons remain in an immutable compatibility catalog, separate from new public starters. This prevents saved category definitions from disappearing after updating.
- **Legacy installation with no definitions key:** If any established Organizer storage key exists (assignments, saved projects/chats, category order, Quick Links v1/v2, or ChatGPT Tools preferences), initialize the historical categories. Otherwise initialize the public starter set. This inference is unavoidable because older versions had no explicit setup marker; a completely unused old installation with no stored data is indistinguishable from a fresh installation.
- **Persist on first initialization:** When the definitions key is missing, save the selected `version:1` category snapshot, then write `categorySetup.v1` with a setup version, seed designation and category schema version. Future releases must never use an updated starter catalog as a data migration. Existing category-definitions snapshots are not rewritten during initialization.
- **Recovery caveat:** A malformed existing definitions record must not be silently overwritten. The in-memory sanitizer may show fallback categories if the saved version/structure is unrecognized; we should add a warning/recovery UI before introducing a newer category schema.
- **No extra network access or personal content:** User data remains in Tampermonkey storage. No changes to existing Quick Links/Tools/Prompt Builder keys or project/chat URLs.

**Tests:** Regression checks cover generic first installation, legacy bootstrap, saved custom category titles/icons, assignments, ordering and intentional deletion. Browser acceptance should verify upgrading with real existing Tampermonkey data and a fresh isolated browser profile; code-only tests cannot replace these checks.

**Release:** Remains on the alpha development branch with draft PR #6, without production update/download URLs or merge to `main`.

## Alpha.28 — Page-level bookmark Quick Save (2026-11-13)

The Organizer now provides an always-local bookmark control on **recognized ChatGPT project home and chat routes**. It is a separate, body-mounted Shadow DOM widget—not inserted into ChatGPT's React-owned navigation.

- Outline bookmark: project/chat not in saved SwiftClick inventory. Filled green bookmark: matching saved shortcut. The matching key is parsed from the current validated ChatGPT route, **never inferred from a title**.
- Clicking the bookmark opens a small category and display-name editor. Unsaved items may be added; saved items can change category/name or be removed (with explicit confirmation). Removal affects only the SwiftClick shortcut, never the real ChatGPT project/chat.
- The widget reads saved shortcuts from the existing `manualProjects.v1` and `savedChats.v1` stores, and category assignment from `assignments.v1`; **no parallel inventory or new personal-data store** is introduced.
- The status check reads the URL and already saved metadata. Only an explicit user click invokes the existing page-title helpers. It does not read conversation message bodies, make network requests or automatically index sidebar content.
- SPA navigation re-evaluates saved state and dismisses an open editor when the page identifier changes. The bookmark is hidden on Home, unsupported routes and while the full Organizer overlay is open.
- Invalid/missing names block saving. Existing saved titles are preserved unless explicitly edited. Storage writes are checked before changing in-memory state; failure displays a message and attempts to restore the old shortcut list.
- Popover uses direct DOM creation, textContent and its own CSS. No HTML string injection or native ChatGPT DOM mutation.

**Manual acceptance:** Open unsaved project home → outline bookmark → Add in a chosen category → green bookmark. Refresh and verify persistence. Change category and custom name, verify Organizer list changes without renaming the native ChatGPT item. Remove and verify outline and absence from Organizer, with native project unchanged. Repeat with a saved/unsaved chat and with two identically named chats. Navigate within ChatGPT without full reload, ensuring correct state and closed old editor. Check browser narrow width, keyboard focus/Escape, modal overlap, and ordinary sidebar/menu controls.

**Status:** Draft branch only. Browser placement and user acceptance remain pending. The Settings feature toggle discussed for future releases has **not** been implemented.
