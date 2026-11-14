> **Historical handoff notice (alpha.34):** The active development branch has advanced to **0.1.0-alpha.36**. Refer to the [latest alpha.36 section of the technical PoC](SWIFTCLICK_ORGANIZER_POC.md#alpha36--restore-profile-deletion-and-finalize-safe-legacy-cleanup-2026-11-14) and the actual userscript for current behavior. This document deliberately preserves the alpha.34 migration procedures as historical evidence, not current instructions.

# SwiftClick Organizer — Development Handoff (2026-11-14)

**Current version:** `0.1.0-alpha.34` — Stage 1.5 explicit profile membership  
**Repository:** `teddshapiro/swift-click-userscripts`  
**Development branch:** `feat/swiftclick-organizer-poc-20261111`  
**Userscript:** [swiftclick-organizer.user.js](../swiftclick-organizer.user.js)  
**Full chronological PoC notes:** [SWIFTCLICK_ORGANIZER_POC.md](SWIFTCLICK_ORGANIZER_POC.md)  
**Draft PR:** [#6](https://github.com/teddshapiro/swift-click-userscripts/pull/6)  
**Tracking issue:** [#5](https://github.com/teddshapiro/swift-click-userscripts/issues/5)  
**Latest verified CI:** [GitHub Actions run 43639777472](https://github.com/teddshapiro/swift-click-userscripts/actions/runs/43639777472) — passed **91/91 tests** and JavaScript syntax check, commit `ea7b94c9d331bc3ac8f7e7ea50973bf07b92da5e`.

## Status and acceptance

The project owner is the sole current tester. On 2026-11-14, after installing alpha.34 and doing initial Firefox testing, the owner reported that it **looks good and no functional problems were observed**. Treat this as **initial browser acceptance**, *not* comprehensive cross-browser, stress, storage-failure, or multi-tab validation. The owner requested a new-chat handoff before undertaking further design or implementation.

**No code change or new release is requested by this handoff.** Keep the existing script on the development branch; do not merge draft PR #6 or promote to `main` without explicit direction.

## User-facing product — current authoritative behavior

- **Purpose:** Category-first ChatGPT front door in a Tampermonkey userscript. Auto-opens on the supported home route, tucks away after opening a project/chat; a compact launcher reopens it. Does not auto-open on deep chat/project URLs.
- **Four top-level tabs:** **ChatGPT Categories**, **Quick Links**, **ChatGPT Tools**, **Prompt Builder**. Profiles are **not** a global tab.
- **ChatGPT Categories:** category cards with counts, category/item navigation, manual Add Project and Add Chat flows, item editor, search and drag/keyboard ordering. The **active profile selector shares the search row** and switches the view immediately.
- **Manage Profiles & Categories:** accessed from the ChatGPT Categories footer. Pick which profile to edit; edit categories and icons; expand **Manage profiles** to create/duplicate, rename, activate, select default, or delete eligible profiles. Categories are flat; no subcategory tree.
- **Profiles:** per-profile names, ordered category definitions, explicit included-link membership, category assignments, and per-category item order. **Uncategorized only holds links expressly included in that profile but not assigned to another category.** A link excluded from a profile is absent from all its categories and search.
- **Hidden master link library:** one shared saved URL/title record per explicitly saved ChatGPT chat or project. The same link can be included in multiple profiles under different categories. Display names remain global; category assignments, order, and inclusion are per-profile.
- **Removal semantics:** `Remove from profile` removes only the active profile membership. If it is the link's **last** membership, remove the orphaned shared SwiftClick library shortcut; never delete the original ChatGPT object. Deleting a profile warns about its exclusive links before orphan cleanup. Active/default profiles cannot be deleted until changed.
- **Bookmark/Quick Save widget:** a small clickable button on supported chat/project pages, separate Shadow DOM popup, profile picker, inclusion status, category grid, Add/Save placement, Remove from profile. Green bookmark denotes **inclusion in current active profile**, not mere existence in the library. Users may step through profiles and add the same ChatGPT item to different categories. Selecting a profile in the widget also selects the tab's active profile, but **does not change the default**.
- **Native ChatGPT project-menu companion action:** respects whether the project is already included in *this* profile versus only in the hidden library. Never automatically navigates native menu items to find unknown links.
- **Quick Links and ChatGPT Tools** preferences and **Prompt Builder** are global, not per-profile. Prompt Builder currently includes 25 templates.
- **User privacy/compatibility:** no AI requests or API keys required, no automatic extraction of ChatGPT conversation content, no background shortcut discovery, no new network calls. Prefer `createElement`, `createElementNS`, `textContent`, `append`; **do not introduce `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or `document.write` in injected UI**, due to Trusted Types/CSP compatibility. Use Shadow DOM and ensure a graceful fallback on restrictive sites. Firefox is the principal test browser.

## Versioned storage and migration — safety-critical

Tampermonkey `GM_getValue/GM_setValue` storage, app prefix `swiftclick-organizer-poc`:

- **Current profile store:** `swiftclick-organizer-poc.profiles.v2` (`version:2`), with `members: string[]` in each profile, plus IDs, names, categories/icons, assignments, item orders, active/default IDs.
- **Previous profile store:** `swiftclick-organizer-poc.profiles.v1`, retained untouched as an alpha.33 recovery source.
- **Pre-profile legacy keys:** category definitions, assignments and order, retained as earlier recovery sources; they are **not live copies of later edits**.
- **Shared shortcut stores:** `swiftclick-organizer-poc.manualProjects.v1` and `swiftclick-organizer-poc.savedChats.v1`. Quick Links/tools/prompt data have separate global keys; check code before changing any.
- **Preservation-first migration to V2:** loads existing saved shortcut inventory, then explicitly includes every existing shortcut in every existing V1 profile; retains category assignments and ordering. It intentionally does *not* guess which previously Uncategorized links were unwanted. New blank starter profiles have **zero members**; duplicated profiles copy membership. V2 validation fails closed and does not overwrite V1 on a failed migration.
- **Last-reference cleanup:** calculate lost members when persisting V2 edits; remove shared library records only for links that lost their last profile reference in that operation. No cleanup during initial migration. Shared-library writes have best-effort rollback, but **cross-tab synchronization and fully atomic persistence under storage failure are not guaranteed**.
- **Active vs default:** active view changes are tab-local (via sessionStorage for reload), while default selects the layout for a new tab. Do not silently change default while working in bookmark/widget.

## Verification and remaining risks

- Latest alpha.34 GitHub Actions regression run: **91 passed, 0 failed**, syntax check passed.
- Owner's initial Firefox hands-on check of alpha.34: **no functional issues reported**. No claim that all acceptance-checklist scenarios were individually tested.
- No known outstanding functional defects were reported at handoff.
- **Still worth testing before public release:** simultaneous edits in multiple tabs; abnormal/failed Tampermonkey writes and recovery; profile deletion with several uniquely owned links; full reload/refresh persistence; high category/profile counts and small-viewports; accessibility/keyboard and Firefox popup hover/contrast; migrations from various older installed alphas; ChatGPT UI changes impacting menu hooks. Do not infer these have already passed.
- A prior known class of failure was incorrectly escaped CSS line separators causing an unstyled bookmark (alpha.28), fixed in alpha.29 and regression-tested.
- Existing technical documentation is a **chronological record**, containing historical statements about global Uncategorized and older tab placement. Follow the **current-state sections here and the actual alpha.34 code**, not old alpha-specific history.

## Project direction / next stage

**Stage 1** delivered profiles; **Stage 1.5** delivered explicit membership and hidden-library cleanup. **Stage 2 is not implemented:** optional ChatGPT-assisted category/profile recommendations, reviewable structured import, preview/diff and non-destructive profile creation.

Previously agreed design direction:
1. Prompt the user's own ChatGPT to recommend ~5–8 broad high-level categories based on available memory/context, without falsely claiming a complete history.
2. Optionally supply the currently selected profile's categories and a user-approved inventory of saved titles; minimize unnecessary personal data exposure.
3. Have ChatGPT return a validated structured proposal; SwiftClick parses it without network calls or automatically scraping ChatGPT.
4. Import suggestions **only as a new profile**, preserving the original and letting the user preview, rename, edit memberships/categories, and choose to activate or make default.
5. Avoid automatically creating sensitive inferred categories; never silently overwrite an existing profile. There is no request to implement Stage 2 yet.

## Next-chat working agreement

Start by reading this handoff, the top/current and latest alpha.34 sections of [SWIFTCLICK_ORGANIZER_POC.md](SWIFTCLICK_ORGANIZER_POC.md), the actual script and tests on the named **development branch**, and the latest CI run if the upcoming task involves coding. Do not assume the text of this document is more current than later commits. Ask the owner for new requirements before making speculative changes. Keep the alpha.34 version stable unless changes are requested; implement requested improvements on this branch, increase userscript `@version`, add/update targeted tests and docs, check GitHub Actions, and distinguish CI from owner Firefox validation. Preserve user data and recovery keys.

**Raw alpha.34 installer:** https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/feat/swiftclick-organizer-poc-20261111/swiftclick-organizer.user.js
