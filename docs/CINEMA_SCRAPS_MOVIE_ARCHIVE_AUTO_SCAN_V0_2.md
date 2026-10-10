# Cinema Decoder — Scraps Movie Archive Automatic Scan Pilot v0.2

**Status:** Optional automation implemented, committed and CI-verified in research branch `cinema-source-discovery-phase2` only. **No production or Cloudflare catalog writes.** Userscript `0.2.0-alpha.4`, 2026-10-10.

## Existing verified browser baseline

The user previously completed the guided scan of the source's All page plus **A page 1 and A page 2**, yielding **81 distinct staged movie-archive URLs**, **3 visited pages**, and **no flagged extraction errors**. The unfiltered All page reported 1,316 overall but displayed only 60 titles; the letter A pages showed 60+18=78. Source metadata does not verify transcript content. The source's movie archive includes documentary episodes and a few nonstandard article paths, which remain source-index classifications rather than verified film identities.

## New research userscript features

- **Auto scan remaining A–Z** is an explicit opt-in button on Scraps movie archive pages. It is **OFF by default**, including immediately after an update from alpha.3. The existing previous stage and guided visit log are reused without restarting.
- **Before activation**, the operator confirms having checked the site's terms; the script makes one same-origin request to `/robots.txt` *from the user's Firefox browser*, parses general `User-agent: *` allow/disallow and crawl-delay rules, and **fails closed** if inaccessible, malformed, ambiguous or disallowing the movie archive. This is not an anti-block circumvention mechanism.
- **Respectful pacing:** fixed minimum **15 seconds between visible listing-page navigations**, or the higher `Crawl-delay` from robots (up to a conservative cap); **never** fetch transcript bodies or open article pages. The only background request is the initial `/robots.txt` safety check. No server scraping proxy and no tab spawning.
- The script advances through page-defined `a.next.page-numbers` pagination for each letter and then uses the source's A–Z archive filter links. It persists accepted URLs, page provenance and page-by-page log in the existing GM local storage. All links are de-duplicated by canonical URL.
- **Fail-safe conditions:** missing title cards; title cards lost to parser; missing or inconsistent source letter totals; last-page per-letter distinct URL mismatch; navigation loop; malformed/out-of-bounds pagination; 90-page guard; unknown robots rules; rate limit higher than 120 seconds; or final 26-letter distinct total different from source's 1,316 baseline. On these errors the automatic mode disables itself and retains prior captured metadata.
- **Pause movie scan** cancels the pending timer and leaves stage/visited progress intact. Browser tab must remain open; closing it naturally stops progress. **Start / resume movie scan** restores manual guided mode without enabling auto navigation.
- At the end of Z, the script reports **complete only if 26 letters were visited and the union of all indexed canonical URLs matches the source's All-page count**. If not, it stops and asks the operator to inspect rather than claiming full coverage.
- **Download movie archive JSON** exports only films and movie archive pages (not previously staged Scraps television resources) in the existing staging importer schema and checks the 1,500-record / 2MB limits before downloading. Import remains a separate owner-reviewed staging action.
- **Clear staged** now also resets the guided progress (after user confirmation), preventing false completeness checks if the stored URLs have been wiped.

## Operator acceptance in Firefox

1. Update the Cinema Decoder — Source Discovery Tampermonkey research script from its existing update URL and confirm the panel shows **`0.2.0-alpha.4`**.
2. Keep the current **letter A, page 2** open, with the previously staged **81 unique movies and 3 visited pages**.
3. Check the site's automation terms and inspect `https://scrapsfromtheloft.com/robots.txt` yourself if needed. If site terms/robots do not permit repeated automatic archive navigation, stop and use manual guided Next.
4. Click **Auto scan remaining A–Z** and accept the explicit policy confirmation **only after** that verification. The script will request `/robots.txt` and either schedule the next listing at an allowed pace or explain that automatic navigation is blocked.
5. **Pilot:** let the scanner move through **B and C**, then click **Pause movie scan** and send a screenshot with the staged totals and inspection count. This validates browser-timer/navigation persistence before any unattended run through Z.
6. If the B/C pilot passes, resume auto mode from the last successfully recorded page to finish D–Z. Review the final 26-letter and ~1,316-link reconciliation; download the movie-only JSON. Do not apply it to the canonical catalog until a separate explicit staging preview and approval.
7. If the script reports missing robots permission, blocked access, a mismatch, or interrupted navigation, **do not bypass it**. Capture the panel/status and investigate.

## Verification and limitations

- Node source-discovery tests (including real A-page URL patterns, special `/comedy/` articles, robots allow/disallow and crawl delays, 26-letter coverage checks) and the userscript GitHub CI passed at commit `7da422f2d5ebfc68c1eebcef84a756aca03965d5`, run https://github.com/teddshapiro/swift-click-userscripts/actions/runs/38057457687.
- The attached HTML samples are sufficient to design the ordinary filtered A–Z navigation; we have not run or observed the full A–Z scan in Firefox yet.
- The remote research environment could **not verify** Scraps' live `robots.txt` or terms (request rejected), so the in-browser robots check and explicit human term confirmation are mandatory safeguards.
- This is a single user-supervised browser-tab session, **not a detached/background continuous crawler**. It does not verify that transcripts exist or their text is complete.
- The Cloudflare staging importer was previously updated to accept `mt_letter`/`mt_page` provenance and atypical source-indexed movie URLs. No new Cloudflare deployment is required solely to activate the research userscript.
- Never promote directly to userscript `main` or public Cinema Decoder production without a separate review.

## H page 1 stop; extraction diagnostics v0.2.0-alpha.5

At approximately 2026-10-10 10:30 ET the owner's Firefox scan stopped on H page 1. The site rendered **60 index cards**, but the extractor accepted **59**, pausing automatically with **486 previously staged unique film URLs and 13 completed listing pages** intact. No unreviewed H page data was written, and no catalog/production data was changed. The exceptional title or URL is **not yet identified** because the screenshot contains no underlying article-href evidence.

Update the existing userscript research branch to **0.2.0-alpha.5**. Its audit reuses the actual extraction rules and distinguishes rejected cards, duplicated canonical URLs, and other validation errors. On the still-open H page click **Start / resume movie scan** to get the first offending card's title, URL and cause. Alternatively click **Copy scan diagnostics** and paste its small, metadata-only JSON report. **Do not clear staged data or manually skip H.** With that concrete evidence, make the narrowly scoped correction and rerun H before resuming the automatic scan. The B/C and earlier page work is preserved by separate GM storage.

Commit: `fe47f92de8b81329c30d1211935c4356286bf4c3` (test CI passing); the diagnostic release has no new catalog deployment or cloud writes.

## H-page source URL correction — v0.2.0-alpha.6

The diagnostic reporter identified the exact issue in a browser screenshot: Scraps' H archive page 1 contains a movie-index entry **How Brands Use Design & Marketing to Control Your Mind (2023)** pointing to `https://scrapsfromtheloft.com/business/how-brands-use-design-marketing-to-control-your-mind-transcript/`. The old link-type classifier recognized only `/movies/` and, by trusted archive exception, `/comedy/`, so it stopped at **59 accepted of 60 listed**, safely preserving **486 collected movie links over 13 completed pages**. This is an **article path classification** issue, not evidence of a missing film or incomplete page.

Research userscript **0.2.0-alpha.6** extends the trusted movie-directory-card exception to `/business/{slug}/`, but does **not** turn arbitrary business URLs elsewhere on the site into movies. The staging catalog preview validator was updated to accept that exact category only when its `foundOn` provenance is a Scraps movie archive listing. Both repositories' CI pass, and the preview validator was deployed to owner-only Cloudflare staging 2026-10-10T14:40:06Z. Readback confirms catalog resources **1,582 (441 Scraps, 1,141 Movie Spoiler)**, works **434**, and owner Access binding preserved. No source records were imported automatically.

To continue: update the installed script to alpha.6, remain on **H page 1**, click **Start / resume movie scan** (expects **60 captured, zero rejected**), then use **Auto scan remaining A–Z** and reconfirm the site's automation terms/robots. Pause if the count is not 60 or it reports new exceptions. Old A–G progress should remain intact. This fix makes no claims about full article/transcript contents or canonical movie identity.
