# Swift Click Userscripts

Canonical distribution repository for Swift Click Tampermonkey userscripts.

## Canonical userscripts

- `swift-click-gpt-swiss-army-knife.user.js`
- `swift-click-semantic-researcher.user.js`
- `swift-click-haunted-web.user.js`
- `cinema-decoder-plot-bridge.user.js`
- `nyt-connections-tools.user.js`
- `bypass-skimresources-redirect.user.js`
- `tivocommunity-external-links.user.js`
- `youtube-transcript-copy-contrast.user.js`
- `yts-clean-magnet-links.user.js`
- `chatgpt-highlight-engagement-tails.user.js`
- `cielo-home-climate-snapshot.user.js`
- `ebay-comps-buttons.user.js`
- `hide-facebook-sponsored-posts.user.js`
- `reddit-hide-promoted-posts.user.js`

Each canonical file keeps a stable filename. Tampermonkey update metadata points to the raw `main` branch version of the same file. Future releases increment `@version`; the filename and update URLs stay unchanged.

## Experimental: AI Workspace Organizer

**AI Workspace Organizer** is in a separate development branch and is **not a canonical `main` release**. The current experimental build is `swiftclick-organizer.user.js`, **0.1.0-alpha.46** (full-width welcome heading and bottom-aligned control guide).

- [Current technical status and chronological PoC history](docs/SWIFTCLICK_ORGANIZER_POC.md)
- [Alpha.34 development handoff (historical)](docs/SWIFTCLICK_ORGANIZER_HANDOFF_2026-11-14.md)
- [Draft pull request #6](https://github.com/teddshapiro/swift-click-userscripts/pull/6)
- [Cross-product design standard — Organizer, Shortcut & Collection Tools](https://docs.google.com/document/d/1qmOF-Se8by2fFnUIFbx1e9QmpuGJ-H2605hagWHTUoE/edit?usp=drivesdk) (Web App Development Standards → Human-Centered Design)

The owner approved alpha.44 after Firefox testing on November 16, 2026 and confirmed it was the only installed Organizer userscript at that time. Alpha.46 supersedes the alpha.45 welcome-dialog candidate and remains pending visual acceptance. Alpha.40 was the previous fully accepted baseline; intervening candidates are superseded by the accepted alpha.44 build. Organizational profile storage is V2-only. Alpha.36 preserves historical category identifiers, enables deletion of any profile except the last, and writes a Quick Links V2 snapshot when only V1 or fresh defaults exist. The old V1 key is read-only and retained for recovery; alpha.37 no longer auto-imports V1 Quick Links. Installations missing V2 while containing older Quick Links data show a blocking warning rather than reset it. Legacy profile keys remain untouched as recovery records. No public release or merge is authorized.

## Alpha.44 — focused category view

The **ChatGPT Categories** front door still offers search and active-profile switching. Opening a category now shows **← All categories** and a large heading using that category's chosen icon, name, and profile-scoped project/chat counts; there is no redundant search box or profile picker inside the category. Saved links, editors, drag/keyboard ordering, Reset order, and deliberate Add project/Add chat actions remain. This is a presentation-only change with no data migration. The owner accepted and installed alpha.44 on November 16, 2026; no additional code-copying or storage transfer is required for that current installation. The public guide and editable Google Doc now describe the approved layout. No automatic-update mechanism for public distribution has been validated yet.

## Alpha.45 — welcome/help control orientation (candidate, November 17, 2026)

The existing first-use and header **? Help** popup now uses two responsive columns. The left column retains the prior introduction and its three user-initiated links verbatim. The right column explains the two live Organizer controls, showing **clones of the exact SVGs from the four-square launcher and the Quick Save bookmark**, styled like the real buttons. Samples are visual references, not clickable controls. The common footer keeps **Don't show this again** and **Continue to Organizer**, stacking and wrapping appropriately on narrow screens. Original setting semantics, focus trapping, Escape/backdrop behavior, links, and data safety are preserved. No storage migration, new grants, remote requests, or ChatGPT-native DOM changes.

This is an alpha.45 development candidate awaiting owner visual approval; alpha.44 remains the last owner-approved and installed version until updated and tested. The published public guide and editable Google Doc still document alpha.44 and will be updated on approval.

## Alpha.46 — welcome popup alignment refinement (candidate, November 17, 2026)

Following owner screenshot feedback on alpha.45, the welcome kicker and **Welcome to AI Workspace Organizer!** heading now span the full popup width above the two-column content. The existing explanatory paragraph and three support links remain in the left column. The right **Find these two buttons** panel is bottom-aligned with the left column's link group rather than being pinned near the top. Both columns retain their original content and real launcher/bookmark SVG samples; the footer's checkbox and Continue button remain unchanged. The narrow-screen stacked layout and original dialog/keyboard/accessibility settings are preserved. Alpha.46 is pending owner visual acceptance; public guide and editorial Google Doc remain at approved alpha.44.

## Reusable design reminder

When starting any bookmark, collection, link-management, personal dashboard, or helper-organizer product—even outside Tampermonkey—consult the [Organizer / Shortcut / Collection Design Patterns](https://docs.google.com/document/d/1qmOF-Se8by2fFnUIFbx1e9QmpuGJ-H2605hagWHTUoE/edit?usp=drivesdk) standard during the initial design brief. Explicitly consider whether profiles are necessary, what each control edits (global vs profile vs item vs session), whether membership is explicit, what “Uncategorized” means, how deletion of an item differs from deleting the underlying resource, how active/default profiles transition, and how to protect user configuration during updates. Profiles are a **design option**, not a default requirement.

## Settings / Conversation Overrun Warning (Beta)

A gear button in the Organizer header opens a dedicated Settings screen with a collapsed **Conversation Overrun Warning (Beta)** feature row. Open **Configure** to access its reminder settings, manual handoff preparation and reminder preview together. This feature is **Off by default** with Low/Medium/High optional reminder levels. These levels count only user send gestures observed locally in the current browser tab while enabled, after which they may suggest a handoff. It does **not** measure actual ChatGPT context usage, read conversation content, intercept replies, auto-submit messages, or synchronize across browsers. The editable handoff request is user-copied and user-sent; a preview control allows visual acceptance testing without creating a long conversation. The userscript retains no new privileges or network calls. See the [technical PoC](docs/SWIFTCLICK_ORGANIZER_POC.md) for thresholds and limitations.

## Alpha.38 interface refinements and voluntary support

- The Settings feature starts collapsed on ordinary entry and can be expanded/collapsed independently, leaving room for more settings later. Opening Settings through an actual warning automatically expands the relevant feature and focuses its handoff request.
- The Organizer content area uses a reserved, high-contrast, styled vertical scrollbar in supported browsers (Firefox and Chromium rules), with scroll position preserved when changing reminder sensitivity.
- A quiet **☕ Support SwiftClick** button appears in each Organizer footer. The first click opens a dismissible, keyboard-accessible support pop-up; **Visit Ko-fi** links in a new tab to `https://ko-fi.com/teddshapiro` only when selected. Every feature remains free; no requests, payments, trackers, or network calls are added to the userscript.
- No public `@contributionURL` metadata or release channel is enabled yet. All changes stay in the existing feature branch and draft PR #6.

## Alpha.39 ChatGPT category suggestions for new profiles

In **Manage Profiles & Categories → Manage profiles → Create profile**, the starting-configuration dropdown now includes **Ask ChatGPT to suggest categories based on my usage**. The flow is entirely opt-in and clipboard-mediated: name a profile, choose the AI suggestion option, click Create profile, copy the prepared prompt, run it in a **separate new ChatGPT chat with Memory available**, and paste the JSON category package back into the Organizer popup. ChatGPT may use relevant personalized context but does not provide a complete audit of chat history; when unavailable, the prompt asks for generic suggestions instead.

The importer requires an exact versioned JSON schema with 1–20 unique category labels and supported icons, previews the result, and creates a new **empty** profile only after explicit confirmation. `Uncategorized` is added automatically. There is no scraping, background model call, history/memory extraction, imported project links, or automated prompt submission; neither existing profiles nor stored shortcuts are changed by the suggestion workflow. The prompt discourages sensitive personal details and asks for broad functional categories. The importer rejects unsupported fields and never uses unsafe HTML string injection. Existing two profile-creation modes are unchanged.

## Alpha.40 — Editable proposed categories and clean new ChatGPT tab

The AI-guided new-profile workflow introduced in alpha.39 now opens a regular ChatGPT home tab with a one-time `swiftclick-organizer-skip-autoopen=1` query marker. The Organizer startup gate respects this marker and does **not** auto-open the overlay in that new tab; the launcher remains available if clicked. This marker is unrelated to ChatGPT Temporary Chat, so Memory can still participate where enabled. This behavior should be verified in Firefox because ChatGPT controls its own URL routing.

After a valid category JSON package is pasted and checked, the dialog **hides both initial copy/paste steps** and displays a focused, editable review stage. The user can **rename, reorder with up/down controls, delete, and add** suggested categories before explicitly creating the new profile. A fixed Uncategorized entry stays last. All edits remain in temporary UI state until final confirmation, with validation re-run on edits and at save; invalid duplicate, empty, reserved, unsupported or over-limit proposals cannot be saved. The user can return to the pasted JSON stage or cancel without changing existing profiles. New profiles remain empty and do not automatically become active or default.

No changes to existing profile storage schema, permissions, network access, or public installation metadata. No unsafe HTML string insertion. The development branch and unmerged PR #6 remain the only deployment targets.

## Alpha.41 — Startup & Welcome (not yet owner-approved)

The **Organizer Settings** page now starts with a separately collapsed **Startup & Welcome** panel, followed by the existing collapsed **Conversation Overrun Warning (Beta)** panel. It offers two independently persisted, default-On settings:

- **Automatically open Organizer on ChatGPT home** controls only Organizer's automatic welcome overlay on ordinary ChatGPT home-page entry. If Off, the four-square launcher and Tampermonkey menu command still open Organizer manually. The existing one-time New Chat and AI category-suggestion tab suppression markers continue to take priority.
- **Show welcome message when Organizer opens** controls a native, focus-managed welcome dialog. The dialog appears on each Organizer opening while enabled and includes **Read the User Guide**, **Getting Started**, and optional **Support SwiftClick** links. The links open external pages only after the user clicks them. A **Don't show this again** checkbox beside **Continue to Organizer** persists the same setting as the Settings checkbox.

The header **? Help** button and **Show welcome now** in the Startup panel reopen the dialog even if automatic welcome display has been disabled. Closing with Escape, backdrop, or unchecked Continue dismisses it for that opening without silently disabling future welcomes.

Settings persist in the existing `settings.v1` record, with backward-compatible sanitizer defaults. Older beta reminder sensitivity selections are not reset. Both panels are initially collapsed and independent, with accessible expand/collapse states. The welcome uses explicit DOM construction, no unsafe HTML parsing, no new Tampermonkey permissions, and no data collection.

The welcome links to the already deployed documentation preview at [organizer.swiftclicktools.com](https://organizer.swiftclicktools.com/). The live guide remains a draft of alpha.40 until the newer onboarding is accepted and its published text updated. No public userscript release, automatic update metadata or merge to `main` is authorized.

## Alpha.42 — ChatGPT Tools setup and Personalization guidance (pending owner acceptance)

ChatGPT Tools now distinguishes **direct URLs**, **guided actions**, and **shortcuts requiring a user-configured URL**. Previously, a missing URL rendered as a disabled, noninteractive tile.

- **Find Workspaces** stays in the 15-item Tools catalog but is **hidden by default for a new installation** because OpenAI does not provide a universal, verified Find Workspaces destination. Users can select **Manage ChatGPT Tools → Show** to reveal and configure it. **Existing stored visibility settings are honored**, including an older saved `hidden: []` preference; no saved tool collection is rewritten simply because the new default changed.
- **Personalization** stays visible and has a useful built-in guided action without inventing a direct personalization URL. Clicking its tile displays **Settings → Personalization** instructions and an explicitly labeled **Open ChatGPT Settings** button. The button navigates to the same general URL already used by the Settings shortcut, **not** a guaranteed Personalization deep link. If the user supplies a validated custom HTTPS destination in the editor, that override takes precedence and the tile opens it directly.
- All other Tools without a built-in URL or a valid stored override now show an accessible **Needs setup — click to configure** tile. Clicking it opens a modal explaining the missing URL and offering **Cancel** and **Configure shortcut**. Configure immediately opens **Manage ChatGPT Tools** with the *selected tool's editor already expanded, scrolled into view, and URL input focused*. No automatic URL is invented.
- Modals support Escape and backdrop cancellation, focus return, and basic focus trapping. UI uses explicit DOM APIs, not string-based HTML injection. No external requests, new grants, data migrations, or changes to saved profiles or Quick Links.

Verified navigation concepts: [OpenAI — Personalize ChatGPT](https://learn.chatgpt.com/docs/personalize) documents Settings → Personalization; [OpenAI — Enterprise workspaces](https://help.openai.com/en/articles/8265430-what-is-a-chatgpt-enterprise-workspace-how-can-i-switch-workspaces) documents profile-menu workspace switching. Both were checked November 15, 2026.

This build stays on draft PR #6; `main` and public userscript installation remain unchanged.


## Alpha.43 — AI Workspace Organizer by SwiftClick

**Public product identity:** **AI Workspace Organizer**. **SwiftClick** is the publisher/brand, reflected as **AI Workspace Organizer by SwiftClick** in the Tampermonkey script metadata and as **AI Workspace Organizer** in the UI. Text no longer calls the product simply `SwiftClick`. The support link **Support SwiftClick** and historical user category `SwiftClick Business` retain the company name intentionally. Explain the current scope as **for ChatGPT** rather than implying other AI products already work.

**Data and installation compatibility:** This is a text-only rename of UI labels, prompts, tooltips, launcher and bookmark accessibility labels, menu actions, welcome/support copy, and current documentation; it does not rename `APP_ID='swiftclick-organizer-poc'`, storage keys, the `swiftclick-organizer-categories` structured import schema, the existing URL suppression query marker, the existing development-branch userscript filename, or the docs hostname. **Tampermonkey's displayed @name changes**, so existing alpha testers should replace the code **inside their already-installed script entry** and save, rather than installing a second script by URL. Confirm only one active Organizer installation before testing, and back up Tampermonkey storage first. The new official installation/update identity will need its own release review; do not claim a seamless name-based automatic update.

**Tools:** Personalization now has the built-in `https://chatgpt.com/settings/personalization` URL, confirmed by the owner in Firefox on November 15, 2026. User-defined approved URL overrides still take precedence. If a future site change breaks that path, the supported manual route is ChatGPT profile menu → Settings → Personalization; the general Settings URL is a fallback. Alpha.42's missing-URL setup dialog and new-installation default-hidden Find Workspaces continue to work.

**Bookmark:** The distinct Quick Save bookmark widget—not the four-square launcher—is now fixed to the right edge at **80% viewport height**, with `translateY(-50%)`. Its editor opens **upward** using `bottom:44px`, with a viewport-relative max height and scrolling. The small-screen right offset remains 8px, with the same vertical location. Re-test for collisions with native ChatGPT side-panel controls, composer, and narrow mobile windows. Launcher placement is unchanged.

**Documentation:** Both the draft Google Doc and the static guide on `https://organizer.swiftclicktools.com/` reflect the new name and current user instructions. The public guide remains an unindexed development preview; no public userscript release is authorized. Existing raw-file and documentation URLs remain valid.

**Firefox acceptance:** Check the script name and UI labels, test existing stored categories/links/Tools settings, verify only one userscript is active, navigate Personalization directly, and open/close the Quick Save bookmark and upward popover near the lower right with and without ChatGPT's side panel. Test short viewports and reloads. No new grants, remote calls, or data migration.

## Release workflow

1. Make and test changes in a working copy.
2. Increment the userscript `@version`.
3. Syntax-check the script.
4. For shared UI code, avoid string-based HTML injection where practical; prefer explicit DOM construction.
5. Publish the approved complete `.user.js` file to `main`.
6. Tampermonkey clients discover the newer version from `@updateURL` and install it from `@downloadURL`.

Do not publish partially tested development versions to the canonical file on `main`.

## Compatibility note

`cielo-home-climate-snapshot.user.js` still contains a pre-existing large `innerHTML` rendering block. It was intentionally left unchanged during the initial GitHub migration to preserve behavior and should be treated as a future hardening/refactor item.
