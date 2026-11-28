# AI Workspace Organizer — public user guide

Public URL: **https://organizer.swiftclicktools.com/**

## Purpose and status

This is a static, reader-facing guide based on the Organizer development-branch source and the [editable website-copy review document](https://docs.google.com/document/d/1LuYjvw5saGimSYNDz_dcnmBThdsrbqw-T3WiGVRoBEU/edit?usp=drivesdk). It describes the alpha.50 development preview, with the alpha.50 project-name fix accepted for documentation following positive owner testing; the userscript itself is not publicly released. The earlier alpha.43 draft remains historical, not the active editorial review copy. Historical addenda, internal tester checklists and development-only installation URLs are intentionally not published.

**Organizer itself is not publicly released.** The guide is an accessible documentation preview. The site emits `noindex,nofollow` and disallows search crawling until the public userscript release is approved. The site has no analytics, JS tracking, external images, or form submissions.

## Hosting

- Cloudflare zone: `swiftclicktools.com` (already Cloudflare-managed).
- Worker script: `swiftclick-organizer-guide` in the owner's existing Cloudflare account.
- Custom domain: `organizer.swiftclicktools.com`.
- Source: `docs/public-guide/worker.js` (single ES module containing static HTML/CSS and a minimal fetch handler).
- Routes: `/` and `/index.html` serve the guide; `/healthz` is a plain-text health check; `/robots.txt` disallows indexing; other paths return 404.
- Security: strict response CSP, no third-party assets, static HTML only.
- Worker may take a short period to become externally resolvable after first Cloudflare DNS and certificate provisioning.

## Editing and deployment

1. Update this site's content in `worker.js` based on the latest **approved** Organizer UI and user guide. Do not silently publish untested or historical features.
2. Validate the HTML: navigation anchors, mobile layout, links, keyboard accessibility, security headers, and no development-only installation links.
3. Upload `worker.js` as the `main_module` in Cloudflare Workers (module MIME type `application/javascript+module`) to the existing `swiftclick-organizer-guide` Worker. This deployment does not change the userscript or its GitHub release process.
4. Verify Cloudflare custom-domain mapping and public HTTPS response at `https://organizer.swiftclicktools.com/`. Cloudflare's worker custom domain supplies DNS and certificate management.
5. When the public release is approved, insert the verified Greasy Fork installation URL, test installing/updating from that URL, then remove the preview notice and both robots noindex controls **only after approval**.
6. Update the future Organizer welcome/help UI to link to this URL after the product's own changes are reviewed and accepted.

## Source-of-truth separation

The linked Google Doc is the **editorial working draft**. This committed Worker module is the **published static snapshot**. Updating the Google Doc alone does not redeploy Cloudflare. Updating the userscript alone does not update the guide. Keep the page aligned with each approved public feature version.

Do not merge draft PR #6, change `main`, or publish the userscript merely because this guide is online.

## Alpha.50 development preview and documentation

The product is **AI Workspace Organizer by SwiftClick**, with **SwiftClick** retained as publisher/support brand. The current guide includes first-run startup controls, the direct ChatGPT Personalization URL, hidden-by-default Find Workspaces, actionable missing-link setup, and the lower-right bookmark/upward editor. **Alpha.44** adds the enlarged category icon/name/count heading and **← All categories** navigation; Search and Profile selection are exclusively on the ChatGPT Categories overview. Editing, drag/keyboard reordering, and the Add project/Add chat footer remain. The owner confirmed alpha.44 as their sole installed copy on November 16, 2026. Alpha.48 has since been provided for testing and is not yet explicitly approved for public release. Public docs continue to use `organizer.swiftclicktools.com` intentionally for link stability. The guide is not a public userscript release; it stays noindex and omits unapproved installation links.

## November 21, 2026 — Documentation parity check

The public website's source and live Cloudflare Worker, plus the existing editable Google Doc, are aligned to the latest **alpha.48 development preview**. Updated instructions cover: the two-column welcome/help window with exact launcher and bookmark icon references (plus alpha.46 full-width heading and bottom alignment); the Space tile and suggested-view URL replacing the default Library tile while preserving the stored `library` identifier and existing overrides; and folder/rounded-speech-bubble icons above PROJECT and CHAT labels in category shortcut cards. All previous approved category, profile, Quick Save, Tools, and settings instructions remain.

Release safety is unchanged: `noindex,nofollow` on the guide, no public userscript installation URL or Greasy Fork listing, PR #6 still draft, and `main` unaffected. The documentation preview should not be interpreted as product signoff.

## November 23, 2026 — Alpha.50 project-name guidance

The preview website and existing editable Google Doc are now updated to alpha.50. During an explicit project bookmark or + Add project, Organizer first looks up the **exact current project ID** in ChatGPT's native sidebar, including newer button-based project rows, before using other project-specific fallbacks. End users are advised to verify the prefilled display name, enter it themselves if left empty, and use the pencil editor to correct a previously saved wrong name. No background project indexing or automatic rewriting of existing saved titles is implied. The change has received positive owner testing sufficient to update documentation; broader browser acceptance and public release remain separate decisions. Site remains noindex, guide has no public install link, PR #6 remains draft, and `main` is unchanged.
