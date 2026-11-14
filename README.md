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

**SwiftClick Organizer** is in a separate development branch and is **not a canonical `main` release**. The current experimental build is `swiftclick-organizer.user.js`, **0.1.0-alpha.36** (profile deletion restored for active/default profiles; V2 Quick Links initialization).

- [Current technical status and chronological PoC history](docs/SWIFTCLICK_ORGANIZER_POC.md)
- [Alpha.34 development handoff (historical)](docs/SWIFTCLICK_ORGANIZER_HANDOFF_2026-11-14.md)
- [Draft pull request #6](https://github.com/teddshapiro/swift-click-userscripts/pull/6)

The sole current tester reported favorable initial Firefox testing of alpha.34 on November 14, 2026. Alpha.35 passed the owner's Firefox testing and was approved; alpha.36 now awaits Firefox acceptance. Organizational profile storage is V2-only. Alpha.36 preserves historical category identifiers, enables deletion of any profile except the last, and writes a Quick Links V2 snapshot when only V1 or fresh defaults exist. The old V1 key is retained for recovery. Legacy storage keys remain untouched as recovery records. No public release or merge is authorized.

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
