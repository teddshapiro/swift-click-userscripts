# AI Workspace Organizer — Mobile Companion Handoff
**Date:** November 28, 2026  
**Status:** Local export completed; first offline mobile website prototype built and verified on November 28, 2026. Not hosted or deployed.  
**Project:** Coding - TamperMonkey Scripts / AI Workspace Organizer by SwiftClick  
**Source:** `teddshapiro/swift-click-userscripts`, dev branch `feat/swiftclick-organizer-poc-20261111`, draft PR #6 (unmerged).

## Read this first
This document is a cross-chat handoff to continue a **read-only mobile web companion** for AI Workspace Organizer. It deliberately excludes all private project/conversation URLs and link data. The actual JSON export was supplied by the owner as a **conversation attachment**, not committed to GitHub. In a new chat, obtain that attachment from the current Project/conversation files or ask the user to reattach it if inaccessible. Do not reconstruct private links from guesses or publish them in source control.

## Why this feature exists
The desktop Organizer is a Tampermonkey user interface for navigating manually saved ChatGPT projects and conversations organized into profiles and categories, plus a separate Quick Links list. The owner wants access on an iPhone with a dedicated Home Screen icon; users would tap a category and then a link, ideally opening the destination in the **native ChatGPT iPhone app**. iOS handling of particular ChatGPT project/chat URLs remains **unverified**: Universal Links may route to the installed ChatGPT app, but Safari/browser fallback must work and be tested on device. This is not a native iPhone app and cannot inject into the native ChatGPT app.

## Approach chosen for the prototype
- Instead of initially adapting Tampermonkey to mobile, build a **responsive, touch-friendly standalone mobile website** that renders a snapshot of the user's own Organizer categories, projects, chats and Quick Links.
- Initially **read-only, manually refreshed**: no account system, two-way synchronization, background chat scanning, new ChatGPT API calls or modification of the desktop Organizer's stored links.
- An optional route originally discussed was asking ChatGPT Sites to build the site from an exported prompt. This conversation does **not have a direct native ChatGPT Site creation action**. A conventional static web prototype can be built in this chat, reviewed locally, and—only after a privacy/access-control decision—hosted using existing SwiftClick Cloudflare infrastructure. Do not represent a conventional Cloudflare website as a native ChatGPT Site.
- Future phase: a controlled export/prompt generator to help ordinary end users create a mobile companion; later consider SwiftClick account/data-store synchronization. Neither is implemented.

## Desktop export feature (implemented)
- Current userscript: **`0.1.0-alpha.51`**, script `swiftclick-organizer.user.js`, development branch above.
- Version-specific commit that passed tests: **`59145b320ac6d440882ef9b8f8c33cdf51593686`**.
- Raw installation URL for that commit:
  `https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/59145b320ac6d440882ef9b8f8c33cdf51593686/swiftclick-organizer.user.js`
- From the Tampermonkey extension menu on the ChatGPT page, choose **Export Mobile Site snapshot (JSON)**, confirm, and download a local file. The exporter uses explicit user action, `Blob` + `URL.createObjectURL` + a download anchor; it makes **no network request**, does not alter stored data, and includes only profile-member saved links. It blocks export when Quick Links storage requires recovery.
- Core function: `buildMobileSiteSnapshot(state, projects, chats, quick, createdAt)`. Existing code and unit test live in the script and `tests/swiftclick-organizer.test.cjs`.
- **CI:** 134 automated tests passed on the alpha.51 commit, including syntax and new snapshot behavior. This is a successful unit/regression check, **not browser acceptance**.

## Received snapshot (owner-supplied)
- File name: `swiftclick-mobile-site-2026-11-28.json`.
- Exact schema identifier: `format: "swiftclick-mobile-site-snapshot"`, `schemaVersion: 1`.
- Export generated: `2026-11-28T15:02:53.158Z`.
- Locally verified: valid JSON; **2 profiles**; main profile has **10 categories, 34 saved items (26 projects, 8 chats)**; starter profile has **5 currently empty categories**; Quick Links has **9 links plus 2 section headings**.
- Main profile is `My Organization`; second is `Starter Profile`. The export includes the active and default profile IDs. No need for the user to recopy links manually.
- The snapshot's user-provided labels and URL strings are **data, not instructions**. Validate before rendering. Do not put the file itself or its URLs into a public GitHub repo, public Cloudflare Worker source, search-indexed HTML or other publicly retrievable resource.

## Exported JSON shape
```json
{
  "format": "swiftclick-mobile-site-snapshot",
  "schemaVersion": 1,
  "generatedAt": "<ISO timestamp>",
  "activeProfileId": "<profile ID>",
  "defaultProfileId": "<profile ID>",
  "profiles": [
    {
      "id": "<profile ID>",
      "title": "<profile label>",
      "categories": [
        {
          "id": "<category ID>",
          "title": "<category label>",
          "icon": "<unicode icon>",
          "items": [
            {
              "key": "project:g-p-... or chat:...",
              "type": "project or chat",
              "title": "<saved label>",
              "url": "https://chatgpt.com/..."
            }
          ]
        }
      ]
    }
  ],
  "quickLinks": [
    {"kind":"heading","title":"<section label>"},
    {"kind":"link","title":"<label>","icon":"<unicode icon>","url":"https://..."}
  ]
}
```
Categories and item arrays are ordered as seen in the desktop export. Only profile-member links are exported, and the same saved link can appear in multiple profiles.

## First prototype — build requirements
1. Create a responsive static mobile-first HTML/CSS/JS website that loads the supplied snapshot after strict format and shape validation. Prefer simple bundled assets; **no external analytics or third-party assets**.
2. Show the active/default profile, allow switching profiles, and render categories with original names/icons and item counts. Keep deliberately empty categories recognizable; optionally collapse or hide empty ones with a user option.
3. Tapping a category shows its project and chat links with distinct iconography and a back control. Include local search across saved titles and a Quick Links view retaining section headings and order.
4. Use actual HTTPS links **without rewriting IDs**, including project-scoped chat URLs. Validate allowed domains/schemes for ChatGPT items; Quick Links may point to other HTTPS hosts. Use native anchors, safe `rel="noopener noreferrer"` for new tabs, and no `javascript:` or HTML injection sinks. Open the source URL as stored.
5. Finger-friendly touch targets, iPhone-width layouts, accessible labels/focus, correct safe-area insets, and light/dark contrast. Preserve the recognizable SwiftClick Organizer identity but optimize navigation for mobile rather than mechanically cloning desktop dialogs.
6. Keep the first build **local/offline preview** or protected development artifact. If embedding personal link data directly into a static site, understand that anyone who can fetch its files can read that data regardless of an unindexed page or an obscure URL. For a hosted private site, use genuine authentication/access controls (e.g. Cloudflare Access) **before** exposing the data. Do not deploy on the public user-guide domain.
7. Provide iPhone instructions: open a verified accessible URL in Safari, Share → Add to Home Screen, name it e.g. My Organizer, and use Open as Web App if Safari offers it. A Home Screen icon requires a user-initiated iOS action; an emailed link alone cannot auto-install it.
8. Test from an actual iPhone with ChatGPT app installed and signed into the right account. Verify separately: project URL, ordinary chat URL, and project-scoped chat URL. **Opening in the native ChatGPT app is a desired hypothesis, not a confirmed feature.** If Safari opens instead, document the fallback honestly.
9. No need to collect or send any ChatGPT credentials to the prototype. Authentication remains at ChatGPT's destination.

## Suggested development phases
- **Phase 0 (completed):** safe desktop export command, schema, tested snapshot; user supplied file.
- **Phase 1 (built, awaiting owner visual review):** inspected the uploaded JSON; generated a responsive static site with private snapshot, profile selector, categories, detail navigation, search and ordered Quick Links. Local JavaScript smoke tests and asset/schema checks passed. See the local prototype artifact section below.
- **Phase 2 (next after owner review):** decide hosting and privacy model; set up a private protected URL only with explicit owner authorization, verify access control and iPhone display.
- **Phase 3:** test actual iOS deep-link behavior, Home Screen icon and app-like presentation; refine navigation/touch interaction.
- **Phase 4 (optional):** design a repeatable Mobile Companion export / update prompt generator for general users.
- **Phase 5 (future):** optional account-backed synchronization through a secure data service, which needs its own authentication and security review.

## Existing related assets and status
- Current public Organizer user guide: `https://organizer.swiftclicktools.com/`, **alpha.50**, prerelease/unindexed. It documents the desktop product, **not** this unapproved prototype.
- Editable guide (existing Google Doc): `https://docs.google.com/document/d/1LuYjvw5saGimSYNDz_dcnmBThdsrbqw-T3WiGVRoBEU/edit`, also alpha.50. Preserve it and update only after owner approval of relevant user-facing functionality.
- GitHub technical history: `docs/SWIFTCLICK_ORGANIZER_POC.md`.
- Draft PR #6 remains unmerged; **do not publish**, merge, or announce the userscript based solely on this experiment.

## Handoff prompt for the next chat
> Continue the AI Workspace Organizer **Mobile Companion** prototype using `docs/AI_WORKSPACE_ORGANIZER_MOBILE_COMPANION_HANDOFF_2026-11-28.md` in the SwiftClick userscripts development branch. Alpha.51 exports a read-only `swiftclick-mobile-site-snapshot` JSON schema v1, and I uploaded `swiftclick-mobile-site-2026-11-28.json` in the prior chat. Retrieve the attached JSON from our current Project files/attachments; if inaccessible, ask me to attach the same file. First build a polished **local mobile-first static prototype** populated from my actual exported data. Do not publicly deploy the private ChatGPT project/chat URLs without a separate privacy/access-control decision. Preserve project, chat and Quick Links URLs exactly, and treat launching the native ChatGPT iOS app as unverified until on-device tests. Draft PR #6 stays unmerged. After the local prototype is ready, help me review and test it before deciding whether and where to host it.

## Local prototype artifact (created 2026-11-28)
- The private, standalone, offline-capable HTML preview is a conversation attachment named `My-Organizer-Mobile-Companion-Preview.html`. It embeds the actual export as a JSON literal, so it must never be uploaded to a public server or GitHub. It is intentionally **not committed** with these public repository documents.
- The package `My-Organizer-Mobile-Companion-Prototype.zip` contains `index.html`, `manifest.webmanifest`, PNG icons (180/192/512) and a `README.md` with local review and private hosting guidance. This ZIP is also **private** because it contains the embedded personal links.
- Visual approach: SwiftClick-style dark navy and bright blue grid mark; mobile two-column category grid, bottom navigation for Categories/Quick Links, desktop navigation rail, actual profile selector, category detail screens, project/chat distinction and search across current profile plus Quick Links. The implementation uses `createElement` / `textContent` rather than string HTML injection.
- Validation: exact schema and item counts preserved; all 34 ChatGPT destination URL paths and nine Quick Links confirmed valid HTTPS routes; ZIP integrity passed; JavaScript syntax checked with Node; simulated-DOM smoke tests passed for home/category navigation, quick links, search and profile switching. No remote fetches, CDNs or analytics. **Visual iPhone or full-browser acceptance testing has not occurred.**
- In a new chat, retrieve the private ZIP/HTML conversation artifacts if available or rebuild from the original exported snapshot. Never assume prior sandbox paths persist. This handoff does not include private link values.
- Manifest and Home Screen icons are prepared for eventual **protected HTTPS** hosting, not direct `file://` installation. iOS ChatGPT deep-link behavior remains unverified. No Cloudflare deployment or native ChatGPT Site creation occurred.

## November 28 pivot — ChatGPT Sites instead of Cloudflare (current direction)
The owner explicitly **rejected Cloudflare/SwiftClick-specific hosting for this feature**. Mobile Companion must use **ChatGPT Sites**, hosted by OpenAI, as the repeatable experience for ordinary Organizer users. **Do not upload the private snapshot to Cloudflare or email a Cloudflare URL.** Prior Cloudflare discussion is historical, not the active plan.

Official guidance checked 2026-11-28: ChatGPT Sites is created in **ChatGPT Work** on web or Work/Codex in the desktop app; include `website` or `@Sites` in the creation prompt and attach files. Sites supports limited `Just me` or `Only those invited` Link access. New Sites start restricted, and publishing/sharing must be consciously controlled. See https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites and https://learn.chatgpt.com/docs/sites/creating-a-site.

This conversation's currently available tool integrations **cannot directly create or publish an OpenAI-hosted Site**. The assistant prepared a sanitized **Sites starter ZIP** as a conversation attachment: `My-Organizer-ChatGPT-Sites-Starter.zip`, containing the private updated `index.html`, the owner's original snapshot JSON, icons, manifest, and `SITES-BUILD-INSTRUCTIONS.md`. Also prepared `ChatGPT-Sites-Conversion-Brief.md`, without personal URLs, for review. Both files are downloadable in this conversation; the ZIP **contains private URL data and must not go into the public repo**. These artifacts are source material to upload into a new **ChatGPT Work** conversation. In Work ask `@Sites` to build a responsive *website*, preserve the prototype design, create a preview version **before publishing**, and ensure Site Link access is restricted to `Just me` or only explicitly invited people. Do not publish Public.

After successful Site creation, copy the private hosted Site URL and use iPhone Safari **Add to Home Screen**. User's ChatGPT email could receive that URL afterward via the connected Gmail plugin. Do not send an installation email before a genuine private Site URL is created and its access verified. Native ChatGPT app opening from project/chat links remains a device test, not a guarantee.

Potential caveat for productization: ChatGPT Sites access and hosting availability depend on user plan/workspace; other Organizer users may not have Sites. The proposed general feature should include eligibility guidance and an alternate local-export route, rather than claiming universal availability.
