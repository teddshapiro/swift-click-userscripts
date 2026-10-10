# Cinema Decoder — Scraps TV index discovery pilot v0.1

**Status:** Source Discovery research build `0.2.0-alpha.7`, branch `cinema-source-discovery-phase2`. Proof-of-concept for THREE episode indexes only. Not a full 328-series scan; no production or staging catalog data is modified.

## Direct evidence from user's saved Firefox HTML

Four saved HTML pages from 2026-10-10 were examined with HTML selectors, not merely inferred from screenshots:

- Main directory: `https://scrapsfromtheloft.com/tv-series-transcripts/`
  - Descriptive paragraph advertises **328 series** and **3,332 complete television episode transcripts**. The latter is the website's description only; the pilot does not read bodies or verify completeness.
  - `.series-list .series-item h3 a[href]` includes **328** distinct series-index URLs directly on the unfiltered page, with `.series-item__count` per series. Sum of all 328 listed counts is **3,332**, with no directory pagination in the sample. A–Z filters exist but are not necessary to establish the sampled baseline.
  - **Dark Matter** and **Slow Horses** each have two separate series URLs sharing a display title; never merge by title. The main directory also has three **Latest TV transcripts** cards, which are NOT part of the 328 series-index list.
- `3-body-problem-tv-series/`: `.library__header .library__intro` reports **8**, `.season-groups section.season ol.episode-list li a` yields **8**, all season 1.
- `american-gods-tv-series/`: reports **2**, and exactly **S03E09** and **S03E10** on season 3. Missing other seasons must not be fabricated or treated as source extraction failures.
- `the-bear-tv-series/`: reports **37**, all 37 are visible; season group counts **8,10,10,9** for seasons **1,2,3,5**, including **S05E00**. Season 4 is not represented on the sampled page; a gap/episode zero is a diagnostic, not an automatic assertion of a missing website transcript.

No series-page pagination was observed in the THREE provided index samples. Additional layouts may exist among the 328; the full run must retain strict validation, stop and report unexpected cases.

## New TV pilot in Tampermonkey

- The new pilot has its **own local GM storage keys** for the queue, visited series, links, and provenance. It does not alter the existing completed movie scan (1,316) or the legacy Scraps staged items, and it does not publish anything to Cloudflare.
- On the MAIN, unfiltered TV directory: press **Prepare 3-series TV pilot**. The script checks 328 unique series URLs and that their advertised per-series counts sum to 3,332. It stages 328 series-index metadata records in the separate TV pilot store and initializes only three visited-page targets.
- Choose **Scan next TV series ↗** to navigate manually, or opt in to **Auto scan TV pilot** after checking Scraps' terms and confirming. Automatic mode checks `/robots.txt` from the current Firefox tab; unavailable or disallowing robots policy **blocks** automatic navigation. It uses at least **15 seconds** between visible page navigations or longer under the source's crawl delay. No hidden transcript/article fetching or anti-block mechanism.
- At each visited series index, verify its canonical URL and title match the queued series, header count matches directory, each season-heading count matches visible episode rows, every row is extracted from `ol.episode-list li a` as a valid unique source episode URL, and the extracted total matches the reported total. Fail closed on mismatches, preserve successful data, display a brief exception.
- Numbering gaps (American Gods only Season 3; The Bear absent Season 4, S05E00) are **observations only**, not blockers and not proof of missing transcripts.
- The pilot expected outcome is **3 validated indexes and 47 source episode links**. It retains the separate 328 series-index metadata snapshot.
- **Pause TV pilot** persists the state. **Resume TV pilot** reactivates without resetting any progress. **Download TV pilot JSON** emits metadata only, with 328 series and 47 discovered episodes upon completion. Do not import the pilot until separate audit.
- In this TV UI, legacy controls are visibly marked **legacy** to reduce the chance of accidentally clearing the saved movie scan. **Reset TV pilot only** deletes only the pilot's two storage keys.
- Test-safe scopes: research userscript branch only; current staging catalog remains **2,837 source links and 434 work records** until a separately approved import. No production deployment.

## Browser acceptance steps

1. Update the Source Discovery userscript to **0.2.0-alpha.7** using the existing Tampermonkey update workflow.
2. Open `https://scrapsfromtheloft.com/tv-series-transcripts/` **without A–Z filters**. The panel should show **Prepare 3-series TV pilot**.
3. Click **Prepare 3-series TV pilot** and confirm a 328-series / 3,332-episode directory baseline.
4. After independently reviewing site permissions, choose **Auto scan TV pilot** (or **Scan next TV series ↗** to do a manual guided pilot). Leave the same Firefox tab open.
5. The scanner should visit **3 Body Problem (8), American Gods (2), The Bear (37)**, then stop. Capture a screenshot showing 3/3 indexes, **47** episode links, **328** series indexes and no blocking exceptions.
6. Optionally download **TV pilot JSON** and provide it in chat for validation. **Do not click a catalog Apply control** at this stage.
7. If any series fails its source count, preserve data and send the reported exception. Do not bypass/restart.

## Future full-catalog phase

After browser pilot acceptance, expand the queue to all 328 indexes and add a **batchable source-metadata export**. Total candidate episode URLs ~3,332 plus 328 series indexes exceeds one staging JSON importer batch (1,500 records / 2 MB). Build stable multi-file batches, deduplicate existing 328 series records and 52 episode articles against production-candidate staging URLs, preserve seriesIndexUrl relationships without automatically merging identical series names or fabricating missing episodes. Import only through owner-reviewed draft + approval + apply; verify staging receipts and counts. Protect original movie state and catalog throughout.
