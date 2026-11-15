# AI Workspace Organizer — public user guide

Public URL: **https://organizer.swiftclicktools.com/**

## Purpose and status

This is a static, reader-facing guide based on the verified Google Doc **AI Workspace Organizer — User Guide (Draft v0.8, alpha.43 candidate)** (ID `1yWMDsQXSx5csmjEqMgKTX0xTZTYCO76LUOIB-AlsdDI`) and the Organizer development-branch source. It consolidates the main user instructions and approved/current features through alpha.43. Historical addenda, internal tester checklists and development-only installation URLs are intentionally not published.

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

The Google Doc is the **editorial working draft**. This committed Worker module is the **published static snapshot**. Updating the Google Doc alone does not redeploy Cloudflare. Updating the userscript alone does not update the guide. Keep the page aligned with each approved public feature version.

Do not merge draft PR #6, change `main`, or publish the userscript merely because this guide is online.

## Alpha.43 branding and version

The product is **AI Workspace Organizer by SwiftClick**, with **SwiftClick** retained as publisher/support brand. The current guide includes first-run startup controls, the direct ChatGPT Personalization URL, hidden-by-default Find Workspaces, actionable missing-link setup, and the lower-right bookmark/upward editor. Public docs continue to use `organizer.swiftclicktools.com` intentionally for link stability. The guide is not a public userscript release; it stays noindex and omits unapproved installation links.
