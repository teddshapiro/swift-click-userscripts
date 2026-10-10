# Scraps From the Loft — Guided Movie Archive Scan v0.1

**Date:** 2026-10-10. **Research-only pilot**. No production deployment, catalog import or page-body copying. Branch `cinema-source-discovery-phase2`. Source Discovery userscript version `0.2.0-alpha.3`.

## Evidence from actual saved Firefox page source

The user provided the unfiltered movie archive, `?mt_letter=A&mt_page=1`, and `?mt_letter=A&mt_page=2`, plus screenshots. We parsed the actual `.catalog-list .catalog-item h3 a` nodes:

| Source page | Displayed cards | Site's reported total | Pagination |
| --- | ---: | ---: | --- |
| `/movie-transcripts/` (All) | 60 | 1,316 | **none** |
| `?mt_letter=A&mt_page=1` | 60 | 78 | Next / 2 |
| `?mt_letter=A&mt_page=2` | 18 | 78 | Previous / 1 |

The All page displays **only a truncated first slice**, while A has a complete two-page breakdown. Do not assume All provides the full source catalog.

The source has `nav.alphabet a` links with `mt_letter=A` through Z, plus a potentially ambiguous `#` link rendered as `?mt_letter=#`. The pilot captures the unfiltered page first to capture leading-number titles and then follows A–Z. Its completion must be reconciled against the site's reported 1,316 total. This is **index coverage**, not confirmation that all article bodies are accessible or transcripts complete.

The A listing includes two structurally important outliers:
- **Argylle (2024)**: indexed as a movie transcript but article URL is `/comedy/argylle-transcript/`.
- **Amazon Empire: The Rise and Reign of Jeff Bezos (2020)**: article URL `/movies/amazon-empire-the-rise-and-reign-of-jeff-bezos-frontline/` lacks `transcript` in its slug.

The original extractor would omit such index-listed entries. The pilot only trusts such nonstandard links when they occur as title anchors inside **the site's movie-index cards**, not as unrelated page navigation or arbitrary links.

## Pilot implementation

Userscript `cinema-decoder-source-discovery.user.js`, research branch `cinema-source-discovery-phase2`, v`0.2.0-alpha.3`.

1. Open [All movie transcripts](https://scrapsfromtheloft.com/movie-transcripts/) in Firefox. The script panel shows **Start / resume movie scan**, **Scan next listing ↗**, **Pause movie scan**, **Download movie archive JSON**, and original controls.
2. Choose **Start / resume movie scan**. It records only the 60 visible transcript-card titles and URLs, stores progress in a dedicated GM storage key, preserves earlier TV and film staging, and never fetches individual transcript pages.
3. Click **Scan next listing ↗** to visit the first letter A page. Once that page loads, the userscript automatically captures its currently visible listing. Click once more for A page 2. The script verifies that the union of URLs across A pages equals the reported **78**, otherwise pauses and requires investigation.
4. For the first browser acceptance stop after **A page 2**. Confirm the old stage isn't cleared and that the two unusual entries are included. Review the source counts and any warnings. Do not run all letters until the A pilot is accepted.
5. A–Z navigation is **one user-confirmed page visit at a time**. No background fetch, no scheduled crawl, no anti-bot circumvention. The guide can be paused/resumed. Page refresh is idempotent and logged.
6. **Download movie archive JSON** exports only staged `film` records and movie archive visited-page provenance, not the old staged TV links. This makes a complete movie archive export fit the 1,500-record / 2 MB staging importer constraints (subject to actual final export size). No cloud resources are added by the userscript.

## Staging importer compatibility

In catalog repo `teddshapiro/cinema-decoder`, branch `catalog-private-import-design`, the owner-only staging preview now validates narrowly scoped Scraps `/movie-transcripts/?mt_letter=A&mt_page=2` visit provenance and movie-index-sourced `/comedy/{slug}/` or `/movies/{slug}/` article paths without requiring `transcript` in each slug. It still rejects unrelated view, search, genre and malformed pagination parameters. Metadata does not prove body content.

Deployed *to existing private staging* and confirmed existing data preserved: **1,582 resources** total (**441 Scraps; 1,141 Movie Spoiler**) and **434 provisional works**. No automatic import/publishing.

## Explicit limitations

- Full website archive completeness is not yet demonstrated. Need to scan all letters and reconcile the distinct indexed URLs against the advertised 1,316 (including possible index duplicates).
- This version performs **guided page-by-page navigation**: a single user click advances to the next page. It does not navigate unattended. Any more automatic mode should first confirm site terms/robots and include conservative pacing and safe stop behavior.
- TV series-index/episode discovery is a separate next phase.
- New URL metadata must be previewed, reviewed and explicitly imported, and unchanged URLs should remain unchanged. Do not infer film identity from title, nor article completeness from source index listing.
- Preserve staging-only development branches and original GM data; do not promote to main or production without explicit user approval.

## Regression verification

- User script CI on `cinema-source-discovery-phase2`: passed, including new navigation and archive-card outlier tests.
- Catalog staging CI on `catalog-private-import-design`: passed, including Scraps letter-page provenance, special article URLs and existing Scraps/Movie Spoiler regressions.
