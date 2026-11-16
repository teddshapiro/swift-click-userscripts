# AI Workspace Organizer — public user guide

Public URL: **https://organizer.swiftclicktools.com/**

## Purpose and status

This is a static, reader-facing guide based on the Organizer development-branch source and the [editable website-copy review document](https://docs.google.com/document/d/1LuYjvw5saGimSYNDz_dcnmBThdsrbqw-T3WiGVRoBEU/edit?usp=drivesdk). It consolidates the current owner-approved alpha.44 user instructions. The earlier alpha.43 draft remains historical, not the active editorial review copy. Historical addenda, internal tester checklists and development-only installation URLs are intentionally not published.

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

## Alpha.44 approved category view and documentation

The product is **AI Workspace Organizer by SwiftClick**, with **SwiftClick** retained as publisher/support brand. The current guide includes first-run startup controls, the direct ChatGPT Personalization URL, hidden-by-default Find Workspaces, actionable missing-link setup, and the lower-right bookmark/upward editor. **Alpha.44** adds the enlarged category icon/name/count heading and **← All categories** navigation; Search and Profile selection are exclusively on the ChatGPT Categories overview. Editing, drag/keyboard reordering, and the Add project/Add chat footer remain. The owner confirmed alpha.44 approved and installed as their sole copy on November 16, 2026. Public docs continue to use `organizer.swiftclicktools.com` intentionally for link stability. The guide is not a public userscript release; it stays noindex and omits unapproved installation links.
