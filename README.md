# Swift Click Userscripts

Canonical distribution repository for Swift Click Tampermonkey userscripts.

## Canonical userscripts

- `swift-click-gpt-swiss-army-knife.user.js`
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
