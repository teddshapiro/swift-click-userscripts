# Cinema Decoder Source Discovery — Phase 0 research handoff

**Status:** Read-only proof scaffold, awaiting site-browser acceptance and source-policy verification  
**Date:** 2026-10-09  
**Basis:** Google Drive "Cinema Decoder Source Discovery — Product Requirements & Implementation Handoff v0.1" plus approved scope expansion to television episode transcripts.

## Scope and invariant

Source Discovery catalogs third-party **titles and article URLs**, not transcript bodies. It is a separate Tampermonkey product; do not modify `cinema-decoder-plot-bridge.user.js`. The existing Plot Bridge is now **v0.5.3**, already recognizing movie and television episode transcript pages. Film and TV catalog identities must be separate from individual third-party resource records.

## Inspected infrastructure

- `teddshapiro/swift-click-userscripts`: canonical userscripts live at repository root; production uses main-branch auto-update metadata, with explicit version increments.
- `teddshapiro/cinema-decoder`: existing external Cloudflare Worker (via `worker/external.js`), D1 `cinema-decoder-prod`, and R2 uploads. External Studio already checks a Cloudflare Access JWT, exact owner identity, dedicated admin hostname, origin and request headers.
- `teddshapiro/swiftclick-control-center`: owner-only Cloudflare Access and administrative audit pattern.
- `swiftclick-data-store`: deployed independent Worker using `swiftclick-data-store-prod`. Generic RPC address is namespace/kind/key/subjectId; `list()` currently caps at 100 and has no title-search query or pagination, so **not** recommended as the catalog's primary read/search path.
- **Proposed future storage**: product-owned tables in the existing `cinema-decoder-prod` D1, introduced with a versioned migration and tested on local/staging data first. No schema or production resource changes were made by this Phase 0 work.

## External source investigation

Probed these Scraps from the Loft URLs using an unauthenticated web reader:

- `/robots.txt`
- `/wp-sitemap.xml`
- `/sitemap_index.xml`
- `/movie-transcripts/`
- `/tv-series-transcripts/`

Archive pages returned HTTP 403 to the reader; robots/sitemaps were unavailable or failed to fetch. **This does not establish site policy, a prohibited path, or browser availability.** The actual robots instructions, site terms, public API availability, archive markup, pagination design, and number of listings remain **unverified**. Do not bypass restrictions, alter identity to evade blocking, or schedule an automated crawl before explicit verification. A WordPress-derived sitemap or public JSON endpoint is not assumed just because WordPress appears to be used.

The current proof avoids automated network requests entirely: it inspects metadata links only on archive pages explicitly opened by the operator in their normal browser.

## Actual browser export — 2026-10-09

An operator opened both archives in Firefox with Tampermonkey `0.1.0-alpha.1` and exported `cinema-source-discovery-preview.json` (metadata only). A complete local inspection of the supplied JSON found:

| Finding | Count |
| --- | ---: |
| Distinct URLs | 392 |
| Direct movie transcript URLs (`/movies/`) | 61 |
| Direct television episode transcript URLs (`/tv-series/`) | 3 |
| Television series index URLs (`/tv-series-transcripts/{series}/`) | 328 |
| Duplicate URLs | 0 |
| Archive pages inspected | 2 |

**Key discovery:** The TV directory is primarily a **series-index catalog**, not an episode catalog. In the first alpha, the 328 series index pages were wrongly marked `workType=episode` and `resourceType=dialogue-transcript`. The corrected `0.1.0-alpha.2` recognizes `workType=series` and `resourceType=transcript-index` instead. This is a link to a landing page, **not proof that the URL hosts an individual transcript**.

Alpha.2 migrates locally staged alpha.1 records in-place (version 1 → version 2) while preserving canonical URL, title, first-seen timestamps, and scan-page provenance. The same-title pairs **Dark Matter** and **Slow Horses** have separate URLs and must not be silently merged by title. The three direct television episode links were Chicago P.D. S14E01, Chicago Fire S15E01, and Chicago Med S12E01; all three were parsed for series/season/episode successfully in the initial export.

The exported 61 movie entries are only a **page-level discovery sample**, not a measure of full archive coverage. Do not claim all available movies or TV episodes have been found.

**Next in-browser validation:** After installing/updating alpha.2, reopen either archive and verify that the staging panel shows **61 movies, 328 series indexes, 3 TV episodes** without clearing old storage. Then manually open a series index, e.g. `https://scrapsfromtheloft.com/tv-series-transcripts/the-bear-tv-series/`, and click **Discover visible titles** to test whether child episode article links can be found. Capture a metadata-only JSON export; **no automated page crawling**. If the series page contains no qualifying links, inspect its visible link destinations and stop rather than guessing the markup.

## Second in-browser export — 2026-10-09

The operator opened the **The Bear** index at `https://scrapsfromtheloft.com/tv-series-transcripts/the-bear-tv-series/` with alpha.2, clicked **Discover visible titles**, and provided a new metadata-only export. This confirms that manual navigation from a series index to individual episode links works.

| Classification | Count |
| --- | ---: |
| Film transcript links (existing) | 61 |
| TV series index links (reclassified from alpha.1) | 328 |
| TV episode transcript links, including 3 previously collected | 40 |
| **Total distinct links** | **429** |
| Newly added The Bear episode links | 37 |
| Duplicated URLs | 0 |
| Distinct pages inspected | 3 |
| ReviewStatus=candidate | 429 |

Each of the 37 new episodes has a canonical `/tv-series/` URL, `seriesTitle = "The Bear"`, and `seriesIndexUrl` pointing to its parent series page. Season and episode numbers and episode titles were parsed from the visible link titles. Original alpha.1 metadata was preserved and the 328 series index records were migrated to `workType=series`, `resourceType=transcript-index`. Both same-title **Dark Matter** index URLs remain separate.

**Observed The Bear season distribution:** S01=8, S02=10, S03=10, S04=0, S05=9, including `S05E00 — Gary`. All links were marked `candidate`, but this does **not** imply completeness or confirm episode existence independently. The missing S04 sequence and episode 00 numbering merit manual verification of source organization, paging, and actual publication state.

A third research build, `0.1.0-alpha.3`, adds **non-destructive coverage hints** after a manually initiated series-page scan: gaps *between observed season numbers*, gaps *within observed episode number sequences*, and episode-00 notation. It does not modify or discard candidates or imply that a successful scan is complete.

**Next tests:** Repeat on a different series page with different episode naming conventions; manually check whether its archive indexes all seasons and/or exposes pagination. Repeat discovery to prove idempotence. Also manually inspect movie archive paging before claiming coverage. Do not enable unattended multi-series crawling or publish the findings to production.

## Third in-browser export — Andor, 2026-10-09

The operator updated to research build `0.1.0-alpha.3` and manually discovered linked episodes on `https://scrapsfromtheloft.com/tv-series-transcripts/andor-tv-series/`. The resulting metadata-only export has `version=2`, `publicationApproved=false`, and **four** manually inspected source pages.

| Classification | Count | Change from second export |
| --- | ---: | ---: |
| Direct film transcript links | 61 | 0 |
| TV series index links | 328 | 0 |
| TV episode transcript links | 52 | +12 |
| **Unique URLs** | **441** | **+12** |
| Duplicate canonical URLs | 0 | 0 |

The added 12 links are exactly `Andor S01E01` through `Andor S01E12` in order, each retaining `seriesTitle="Andor"`, the source series index URL, an individually parsed episode title, provenance, and `adapterVersion="0.1.0-alpha.3"`. All 429 earlier URLs are preserved. No missing numbered episodes *within the observed S01 sequence*; there are zero flagged records in the export.

**Critical distinction: contiguous observed numbering does not establish source coverage.** Official Lucasfilm/Disney press information confirms `Andor` has a **second season with 12 episodes**, released starting April 2025 (e.g. https://press.disney.co.uk/news/lucasfilms-andor-season-2-cast-andfilmmakers-gather-at-londons-lightroom-for-sneak-peek-at-the-final-season and https://news.disney.com/next-on-disney-plus-may-2025). The current **Scraps archive page export** contains only the first season, and a source-site 403 prevented automated inspection of the live series index. We cannot infer whether second-season transcript links are elsewhere on that site, absent from the site, or excluded by page rendering/navigation. `seriesCoverage()` deliberately cannot flag a trailing season that is not observable in the dataset. Do not mark this series complete or create speculative S02 transcript URLs.

**Manual follow-up:** Inspect the Andor series index in Firefox for source-specific pagination, alternate seasons/tabs, separately linked episode pages, or links to another archive. Record which parts of the source were visibly inspected; do not automatically follow all 328 series pages or fetch transcript bodies. Other valid outcomes are "only S01 linked in this index" or "navigation differs"—both are catalog coverage findings, not a parser failure.

The cross-series test confirms the same extraction works for `The Bear` and `Andor`; the next priority should be **coverage/scan provenance and a deliberate admin review/import boundary**, rather than claiming that discovered listings represent all available titles.

## Current research build on this branch

File: `cinema-decoder-source-discovery.user.js` (research build **0.1.0-alpha.3**)

- Separate installable Tampermonkey userscript, scoped only to the two Scraps archive URL families.
- Read-only page-local link extraction for movies, TV series landing indexes, and linked episodes from a manually opened series page.
- Strict HTTPS host/path filtering; movie versus TV series versus episode classification; title-only film-year detection; `S03E03`, `Season 3 Episode 3`, and `3x03` parsing; review flags for unclear identities.
- Canonical URL normalization and duplicate suppression.
- User-initiated collection of currently loaded page links only. Manual pagination and per-series navigation; locally staged results persist in Tampermonkey storage across archive page navigation, with alpha.1-to-alpha.2 migration.
- Preview counts and flags, JSON copy/download, explicit local clear. No transcript/article fetch, sitewide crawl, cloud upload, or administrative credential.
- Refuses to stage a scan containing zero eligible article links or more than the per-page safety limit. **The adapter has not been verified against actual live archive DOM markup; metadata completeness cannot yet be claimed.**

The research build's Tampermonkey update/download URLs deliberately point at the **working branch**, not main. Before a reviewed production release, change both URLs to canonical main, set a stable production version, and test updates. Do not promote this alpha automatically.

## Try it in Firefox / Tampermonkey

1. Open the working-branch `cinema-decoder-source-discovery.user.js` raw link in Tampermonkey and install it as a **research build**. It is isolated from Plot Bridge.
2. In Firefox, manually open `https://scrapsfromtheloft.com/movie-transcripts/` and then `https://scrapsfromtheloft.com/tv-series-transcripts/`. Check that each opens normally. Inspect the site's robots/terms in the browser separately before increasing request volume.
3. On each loaded archive, click **Discover visible titles**. Verify a plausible nonzero candidate count; review the last entries and check actual target URLs. If zero, stop and save a non-sensitive HTML fragment or screenshot of the **archive listing markup** for fixture development.
4. If archive pagination is available, **manually** open the next page and repeat. Confirm staged counts grow only for new URLs; rescanning a previously inspected page adds zero entries.
5. Click **Download JSON** or **Copy staged JSON** and provide that metadata-only preview for assessment. It should contain source URLs and titles only, no article or transcript bodies.
6. Test **Clear staged** only after exporting the test dataset. Do not publish the research build on main.

## Acceptance gate before any automated discovery

- Direct review of source access restrictions, robots rules and terms completed and recorded.
- Representative **real** archive listing output for movie and TV obtained through normal browsing; verify child-series page extraction separately.
- The test parser finds real source article links on both categories; false positives sampled and corrected.
- Manual paging behavior and approximate coverage baseline measured.
- Only then consider testing the lowest-impact explicitly permitted sitemap, API metadata, or archive pagination method with bounded rate and abort controls.

## Proposed v1 catalog data model

The following are **not yet applied migrations**:

- `source_registry`: source ID, archive URLs and types, approved discovery strategy, adapter version, enabled/policy status.
- `catalog_works`: stable ID, kind (film/series/episode), title and normalized title, optional release year, optional parent-series ID, season/episode indexes, review status. Do not infer film release year from webpage dates or URL numbers.
- `catalog_resources`: stable ID, source ID, canonical article URL (unique per source), original article title, resource type, nullable matched work ID, date first/last seen, adapter version, uncertainty state, latest batch.
- `discovery_batches`: source, start/end, coverage metrics, completeness signal, review and publication status, operator approval, idempotency hash and publication receipt.
- `discovery_batch_items`: each candidate and its action (new/unchanged/changed/uncertain/excluded), original values, proposed edits and review reason.

A TV series is a work; its episodes are child works, and **transcript resources attach to episodes**. Uncertain episode identification must not silently merge distinct episodes or attach to an unverified series.

## Future authenticated publication boundary

The read-only userscript must not contain a Cloudflare API token. Plan a dedicated, protected **same-origin** admin import/review page under Cinema Decoder's external Worker, reusing its Cloudflare Access JWT identity validation and CSRF/origin checks. A browser-originated request from Scraps to an Access-protected admin hostname may fail due to third-party cookie policies; the first robust transfer can be JSON download + explicit local import into the admin page.

Backend validation must check expected HTTPS hosts, path allowlists, payload size, canonicalization, schemas, identity collisions, batch completeness and legitimate owner authorization. Handle changes within a D1 transaction or `batch()`-managed atomic write where feasible, persist auditable publication receipts, and verify readback before signaling success. Keep public search endpoints read-only.

## Tests

Run from repository root:

`node --test tests/cinema-source-discovery.test.cjs`

Tests cover archive scope, URL host checks, film years, TV episode parsing, ambiguous episodes, exclusion, deduplication, local staging idempotence and zero-result cases. Browser validation is still essential; no live archive DOM could be collected from this environment.

## Next implementation milestones

1. Validate the read-only adapter on actual archive pages in the operator's browser and capture anonymized metadata-only test exports.
2. Improve site selectors and pagination handling from observed, permitted structure; lock down a coverage baseline.
3. Implement D1 migration and owner-authorized admin review/publish endpoints on a separate Cinema Decoder working branch. No merge or deployment without tests and review.
4. After authenticated publication tests and repeated no-change scans, add the public finder; The Movie Spoiler gets a distinct later adapter.

**Never infer completeness from a successful HTTP response alone, and never delete existing published records solely because a current scan is empty or smaller than a previous one.**
