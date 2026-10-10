# Cinema Decoder Source Discovery — Phase 2: The Movie Spoiler

**Date:** 2026-10-09. **Status:** Code and Node regression checks pass; awaiting first operator Firefox DOM scan/export verification. **Scope:** Source link metadata only, **not full plot text**. **Branch:** \`cinema-source-discovery-phase2\`. **Production/main unaffected.**

## Why this source is different

\`https://themoviespoiler.com/\` is a movie-plot website, not a transcript site. Representative public pages:

- Homepage \`https://themoviespoiler.com/\` — movie links and newly added listings.
- Native WordPress search \`https://themoviespoiler.com/?s=obsession\` — title search. Other query parameters in search URLs are excluded from export provenance.
- Genre index \`https://themoviespoiler.com/genres/action/\` — many movie listings.
- Search/detail-style index \`https://themoviespoiler.com/details/avengers/\` — page of related film links, **not** itself a plot.
- Individual film article \`https://themoviespoiler.com/movies/obsession/\` and \`https://themoviespoiler.com/movies/verity/\` — plot article pages.

**Important:** Home, genre, and search pages may display "Spoiler Needed," "Spoiler Coming," or "Check Back Later" placeholders. The presence of a \`/movies/{slug}/\` link **does not prove the full plot text has been supplied**. Thus every newly discovered link has \`reviewStatus:"needs-plot-review"\` regardless of release-year hints, and the private catalog importer holds every Movie Spoiler row for an explicit approval/exclusion decision. The operator should inspect questionable source pages.

The source's "ARCHIVES" button linked to legacy \`/Pages/Spoilers.html\`, which returned 404 when investigated by the public web reader on 2026-10-09. Treat its availability as uncertain; use the homepage, genre pages and native search manually rather than depending on legacy archive navigation. **Do not automatically crawl archives or search-result pages.**

## Userscript implementation

File: \`cinema-decoder-source-discovery.user.js\`, research build **0.2.0-alpha.1**. The existing Scraps from the Loft extractor and the old Scraps local data are retained. This branch's \`@match\` entries additionally cover \`themoviespoiler.com/*\` and its \`www\` alias.

Install/update the research script from:

https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/cinema-source-discovery-phase2/cinema-decoder-source-discovery.user.js

Its update and download URLs are pinned to this dedicated branch; do **not** promote to \`main\` or replace the working Plot Bridge userscript during research.

**Source isolation:** The Movie Spoiler uses Tampermonkey GM value key \`cinema-source-discovery-movie-spoiler-v1\`, while Scraps retains \`cinema-source-discovery-staged-v1\`. The Movie Spoiler source ID is \`the-movie-spoiler\`; its output export is \`cinema-movie-spoiler-preview.json\`, distinct from the existing 441-record \`cinema-source-discovery-preview(2).json\` Scraps dataset. An export has the existing \`cinema-decoder-source-discovery-preview-v1\` envelope, stage version 2, \`publicationApproved:false\`, source-scoped \`items[]\` and \`pages[]\`.

**Parser specifics:** HTTPS exact-host URL allowlist and canonical \`/movies/{slug}/\` URLs; known genre/detail pages never become plot candidates; native search pages are recorded as scan provenance only. Whitespace and promotional ranking labels are normalized out of titles where recognizable. A title year is extracted **only from a visible title containing (YYYY)**; no year is inferred from the URL. Series and episode fields remain null. Only currently loaded DOM links are examined on a manual "Discover visible titles" click; on a single plot article the script can stage that current article's URL from its displayed heading. Repeated scans dedupe by canonical URL. Safety caps: 2,000 DOM links per manual page scan and 15,000 locally staged resources in total; no automatic pagination, timers, remote fetch, hidden page scraping, or upload.

**Research caveat:** Tests use synthetic DOM/link fixtures and documented real public URLs. Whether the current live site exposes film titles through expected anchor/wrapper semantics remains subject to the owner's browser smoke test. A zero-candidate scan must **not** be presented as site completeness.

## Staging catalog integration

Staging application: https://catalog-staging.cinemadecoder.com/ (owner-only). Private Research Hub: https://catalog-staging.cinemadecoder.com/catalog.

- Staging D1 additive migration \`drizzle/0013_movie_spoiler_source.sql\` registers \`the-movie-spoiler\`, exact host \`themoviespoiler.com\`.
- \`worker/catalog-preview.js\`: accepts the existing export envelope from either registered source but validates URL families per source; Movie Spoiler items must be \`workType:"film"\`, \`resourceType:"plot-synopsis"\`, and \`/movies/{slug}/\` HTTPS links. Search pages with \`?s=\` and genre/detail listing URLs are allowed **only as scan-page provenance**. Cross-source/forged URLs, query parameters on articles and wrong resource types are rejected.
- \`worker/catalog-import.js\`: Movie Spoiler draft rows all start \`proposed_action='needs-review'\`; **bulk "Approve only unambiguous" cannot approve them**. Explicit owner review is required. Accepted plot links persist as \`catalog_resources\` with \`work_id=NULL\`, so a matching Scraps transcript for a film does **not** automatically cause duplicate or wrongly merged \`catalog_works\`. A later cross-source work-matching step can link them with verified identity.
- \`worker/catalog-browser.js\`, \`worker/catalog-hub-page.js\`: Source Websites now uses The Movie Spoiler's own \`?s=\` search URL, not a Google fallback. Its catalog registry/filter and per-source indexed counts correctly reflect zero approved Movie Spoiler items until a reviewed import occurs.
- All code and migration were deployed **only to staging**. The existing Scraps 441 source resources and 434 provisional works were preserved. No user plot-data imports, no production migration, and no unattended article downloads.

## First owner acceptance test (do this before importing)

1. In Firefox, install or update Source Discovery from the phase2 raw URL above; verify its panel shows **research build 0.2.0-alpha.1**.
2. Open \`https://themoviespoiler.com/\` and click **Discover visible titles**. Check a few displayed titles and open their source URLs to confirm they lead to individual plot articles or obvious placeholders.
3. Search on the same website using \`https://themoviespoiler.com/?s=obsession\`; click Discover again. Optionally try \`https://themoviespoiler.com/genres/horror/\`. Confirm new unique URLs are added and rescanning does not duplicate records.
4. Click **Download JSON** and inspect the envelope: sourceId \`the-movie-spoiler\`, \`resourceType:"plot-synopsis"\`, plot article URLs \`/movies/...\`, appropriate scanned pages, no full narrative article text. Do **not** clear staging until the export is safe.
5. In private Cinema Decoder staging, use **Preview catalog changes** with \`cinema-movie-spoiler-preview.json\`. Validate the accepted count, warnings about unverified content, zero auto-matched movie works, and distinct source label. **STOP BEFORE clicking Save draft or Apply** on this first test; provide the generated JSON or UI screenshot for comparison with the actual site.
6. Test the private Research Hub source website search for a title; verify it opens The Movie Spoiler's native search, not an invented endpoint. Then test the catalog search source dropdown, which should include The Movie Spoiler but currently show zero results until reviewed import.

Once that passes, proceed deliberately through draft review and approved metadata import, then create a separate **cross-source work identity review** linking truly matching films. No automatic title-only merging or deletion of source records.

## Automated checks

- \`node --check cinema-decoder-source-discovery.user.js\`
- \`node --test tests/cinema-source-discovery.test.cjs\`
- Cinema Decoder repo: \`node --test tests/catalog-preview.test.mjs tests/catalog-import.test.mjs tests/catalog-browser.test.mjs\`, plus Access and Sites regressions.
- Source Discovery CI: https://github.com/teddshapiro/swift-click-userscripts/actions/runs/38013442328
- Private catalog CI: https://github.com/teddshapiro/cinema-decoder/actions/runs/38013327415

All are code-level checks; direct live browser source-site extraction must still be confirmed with the user's export.


## First real 1,141-record Firefox export QA (2026-10-09 EDT)

The operator manually discovered **1,141 movie-page link candidates** on `https://themoviespoiler.com/` and exported `cinema-movie-spoiler-preview.json` (668,235 bytes). Independent full-file inspection found **1,141 distinct canonical HTTPS `/movies/{slug}/` URLs, zero duplicate URLs, 1 scan-provenance page, all 1,141 `needs-plot-review`, and zero malformed article URL patterns**. Only 121 of the candidate titles explicitly contained a four-digit release year in the export; 1,020 have null year. Distinct source URLs for the display title **Deep Water** must not be merged automatically. The large single-page scan exceeded the catalog upload cap of 750 rows although it was under 2 MB.

A **real parser bug** surfaced: the early v0.2.0-alpha.1 title-cleaning regex `/^\s*#?\d{1,2}\s+(?:New\s+)?/i` mistakenly stripped actual leading numbers from film titles, such as `28 YEARS LATER`, `12 YEARS A SLAVE`, `80 FOR BRADY`, `9 (2009)`, and dozens more. Three homepage promotional prefix artifacts also occurred (`#72026 Re-Release AVENGERS: ENDGAME`, `HBO MAX#1 Movie SUPERGIRL (2026)`, `Paramount +#1 Movie AVATAR AANG: The Last Airbender`). The Phase 2 userscript is now **v0.2.0-alpha.2**, with a conservative ranking-label-only regex and numeric-title regression tests; do not repurpose bare numeric prefixes as ranking labels.

To avoid an unnecessary browser rescan, the original uploaded JSON was kept unchanged and an audit/repair step created **three derivative 400 / 400 / 341 candidate files** below both importer caps, with **35 explicit title-only corrections** (32 leading-number restorations inferred from unambiguous article slugs plus 3 promotional-prefix fixes); the rest of every record, including canonical URL, `foundOn`, timestamps, source ID and `needs-plot-review`, is unchanged. The immutable original and a CSV old-title/new-title/url audit establish provenance. The three JSON batches together reconstruct all 1,141 source URLs and original ordering. A standalone manifest includes SHA-256 hashes and byte sizes for audit/reconstruction. Files were created for the user as downloadable chat attachments, **not uploaded to GitHub or automatically imported**.

**Operational constraint:** the importer still treats these as **three independent drafts**, without a collection progress aggregator. Furthermore **all 1,141 rows require manual plot-presence review**, so simply uploading and saving all three drafts should not force 1,141 individual clicks. Next design increment: collection-aware import manifest and UI (progress + batch statuses), and explicit bulk select/approve/exclude with pagination and a careful distinction between discovering an article page and confirming the full plot exists. Retain safeguards against duplicate film works. Until that is developed, browser acceptance should start with **Preview catalog changes** for one 400-row batch and stop before Save/Apply.

Automated regression tests for the numeric-title fix passed on https://github.com/teddshapiro/swift-click-userscripts/actions/runs/38018195472; a follow-up version-bump CI run is pending at the time of this note.
