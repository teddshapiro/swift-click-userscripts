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

## Experimental: SwiftClick Organizer

**SwiftClick Organizer** is in a separate development branch and is **not a canonical `main` release**. The current experimental build is `swiftclick-organizer.user.js`, **0.1.0-alpha.41** (collapsed Startup & Welcome settings, optional auto-open, and welcome guide dialog).

- [Current technical status and chronological PoC history](docs/SWIFTCLICK_ORGANIZER_POC.md)
- [Alpha.34 development handoff (historical)](docs/SWIFTCLICK_ORGANIZER_HANDOFF_2026-11-14.md)
- [Draft pull request #6](https://github.com/teddshapiro/swift-click-userscripts/pull/6)
- [Cross-product design standard — Organizer, Shortcut & Collection Tools](https://docs.google.com/document/d/1qmOF-Se8by2fFnUIFbx1e9QmpuGJ-H2605hagWHTUoE/edit?usp=drivesdk) (Web App Development Standards → Human-Centered Design)

The owner approved alpha.40 after successful Firefox acceptance testing on November 15, 2026. Alpha.40 remains the latest approved development baseline; alpha.41 is the current development candidate awaiting owner testing. Organizational profile storage is V2-only. Alpha.36 preserves historical category identifiers, enables deletion of any profile except the last, and writes a Quick Links V2 snapshot when only V1 or fresh defaults exist. The old V1 key is read-only and retained for recovery; alpha.37 no longer auto-imports V1 Quick Links. Installations missing V2 while containing older Quick Links data show a blocking warning rather than reset it. Legacy profile keys remain untouched as recovery records. No public release or merge is authorized.

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
