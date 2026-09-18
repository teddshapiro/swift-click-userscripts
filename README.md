# Swift Click Userscripts

Canonical distribution repository for Swift Click Tampermonkey userscripts.

## Swift Click GPT Swiss Army Knife

Canonical install/update file:

`swift-click-gpt-swiss-army-knife.user.js`

Tampermonkey update metadata points to the raw `main` branch version of that file. Future releases should increment `@version` before publishing.

## Release workflow

1. Make and test changes in a working copy.
2. Increment the userscript `@version`.
3. Syntax-check the script.
4. Publish the approved complete `.user.js` file to `main`.
5. Tampermonkey clients discover the newer version from `@updateURL` and install it from `@downloadURL`.

Do not publish partially tested development versions to the canonical file on `main`.
