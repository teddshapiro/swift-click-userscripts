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

**SwiftClick Organizer** is in a separate development branch and is **not a canonical `main` release**. The current experimental build is `swiftclick-organizer.user.js`, **0.1.0-alpha.38** (collapsible Settings, Conversation Overrun Warning Beta, visible scrollbars and optional Ko-fi support).

- [Current technical status and chronological PoC history](docs/SWIFTCLICK_ORGANIZER_POC.md)
- [Alpha.34 development handoff (historical)](docs/SWIFTCLICK_ORGANIZER_HANDOFF_2026-11-14.md)
- [Draft pull request #6](https://github.com/teddshapiro/swift-click-userscripts/pull/6)
- [Cross-product design standard — Organizer, Shortcut & Collection Tools](https://docs.google.com/document/d/1qmOF-Se8by2fFnUIFbx1e9QmpuGJ-H2605hagWHTUoE/edit?usp=drivesdk) (Web App Development Standards → Human-Centered Design)

The sole current tester reported favorable initial Firefox testing of alpha.34 on November 14, 2026. Alpha.36 is the latest owner-approved Firefox baseline; alpha.38 is the current development candidate (building on the unapproved alpha.37 candidate) and still needs owner testing. Organizational profile storage is V2-only. Alpha.36 preserves historical category identifiers, enables deletion of any profile except the last, and writes a Quick Links V2 snapshot when only V1 or fresh defaults exist. The old V1 key is read-only and retained for recovery; alpha.37 no longer auto-imports V1 Quick Links. Installations missing V2 while containing older Quick Links data show a blocking warning rather than reset it. Legacy profile keys remain untouched as recovery records. No public release or merge is authorized.

## Reusable design reminder

When starting any bookmark, collection, link-management, personal dashboard, or helper-organizer product—even outside Tampermonkey—consult the [Organizer / Shortcut / Collection Design Patterns](https://docs.google.com/document/d/1qmOF-Se8by2fFnUIFbx1e9QmpuGJ-H2605hagWHTUoE/edit?usp=drivesdk) standard during the initial design brief. Explicitly consider whether profiles are necessary, what each control edits (global vs profile vs item vs session), whether membership is explicit, what “Uncategorized” means, how deletion of an item differs from deleting the underlying resource, how active/default profiles transition, and how to protect user configuration during updates. Profiles are a **design option**, not a default requirement.

## Settings / Conversation Overrun Warning (Beta)

A gear button in the Organizer header opens a dedicated Settings screen with a collapsed **Conversation Overrun Warning (Beta)** feature row. Open **Configure** to access its reminder settings, manual handoff preparation and reminder preview together. This feature is **Off by default** with Low/Medium/High optional reminder levels. These levels count only user send gestures observed locally in the current browser tab while enabled, after which they may suggest a handoff. It does **not** measure actual ChatGPT context usage, read conversation content, intercept replies, auto-submit messages, or synchronize across browsers. The editable handoff request is user-copied and user-sent; a preview control allows visual acceptance testing without creating a long conversation. The userscript retains no new privileges or network calls. See the [technical PoC](docs/SWIFTCLICK_ORGANIZER_POC.md) for thresholds and limitations.

## Alpha.38 interface refinements and voluntary support

- The Settings feature starts collapsed on ordinary entry and can be expanded/collapsed independently, leaving room for more settings later. Opening Settings through an actual warning automatically expands the relevant feature and focuses its handoff request.
- The Organizer content area uses a reserved, high-contrast, styled vertical scrollbar in supported browsers (Firefox and Chromium rules), with scroll position preserved when changing reminder sensitivity.
- A quiet **☕ Support SwiftClick** button appears in each Organizer footer. The first click opens a dismissible, keyboard-accessible support pop-up; **Visit Ko-fi** links in a new tab to `https://ko-fi.com/teddshapiro` only when selected. Every feature remains free; no requests, payments, trackers, or network calls are added to the userscript.
- No public `@contributionURL` metadata or release channel is enabled yet. All changes stay in the existing feature branch and draft PR #6.

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
