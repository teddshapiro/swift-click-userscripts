# Cinema Decoder — Scraps full TV directory scan v0.1

**Status:** research userscript 0.2.0-alpha.8 on `cinema-source-discovery-phase2`. This builds on the user's successful Firefox pilot: all **3** source-index pages validated and all **47** associated source URLs staged (3 Body Problem 8, American Gods 2, The Bear 37), with **328** series-index links captured from the directory. The separate "legacy staged: 0 links" indication on this TV screen is expected: the pilot deliberately uses isolated `TV_STAGE_KEY` and `TV_GUIDE_KEY`, not the movie/legacy keys.

## Evidence and limits

Uploaded Scraps directory HTML reported **328 series indexes and 3,332 episode transcripts**, and counted per-index episode links sum to 3,332. Four uploaded HTML pages established source selectors. The pilot screenshot confirms source-level capture for 3 indexes/47 episodes, no review flags. This does **not** verify content in linked transcript pages or that the indexing matches every aired season/episode.

## New full-scan behavior

- On the user's current final pilot page, after updating to **0.2.0-alpha.8**, press **Expand pilot to all 328 series**. Allowed only after exact pilot reconciliation. It preserves the three visited series, all 47 episode links, the 328-series directory snapshot, and all old movie scan data. No restart from first series.
- The new queue contains exactly 328 canonical series-index URLs. It automatically skips all three accepted pilot pages and visits the remaining 325 using real browser navigation. No background article downloads; it processes only the list of episode links on each visited series-index page.
- Before automatic navigation, user confirms having checked source terms; browser fetches `/robots.txt` once and checks the **entire target series URL queue**, using the longest applicable crawl delay, never less than 15 seconds between navigations. Fail closed for inaccessible, disallowing, or ambiguous permission. Requires an open Firefox tab and may take 80+ minutes; tab throttling can extend the time.
- Each index must have the queued canonical URL and expected title, must expose a source count matching the directory, each season group's heading count must equal the corresponding link rows, and every episode link must be safely recognized and unique. On structural exception, stop and retain all existing data; report the title and source mismatch. Source season gaps and episode 00 are diagnostics, not missing-episode assertions.
- The previous legacy 1,500-link storage limit is replaced **only for the isolated TV collection** with a hard 4,200-source-link cap and 370-page provenance cap. The expected end state is **328 indexes + 3,332 unique episode links = 3,660 source URLs**, with 328 separately recorded visits.
- On reaching the end, the tool independently reconciles exact directory counts, 328 distinct accepted index pages, per-index accepted counts, episode source-link uniqueness and source parent associations. It claims only source-index reconciliation, never episode-body verification.

## Safe download and import handoff

A full 3,660-entry export exceeds the private staging import's per-file 1,500-item/2 MB limits. The full mode therefore has:
- **Download next TV archive batch**: on each click downloads the next validated source-metadata JSON batch of up to **600** entries, with only that batch's source-page provenance URLs. Exactly **seven files**, sizes **600, 600, 600, 600, 600, 600, 60**. The download cursor is persistent so page reloads do not reset it.
- **Restart TV batch downloads**: resets only the batch cursor for recovering a missing downloaded file; no scan progress, source links or movies are touched.
- **Copy TV archive manifest**: copies the 7 filenames, split counts, 328/3,332 reconciliation numbers, and a `not imported` status. Share with ChatGPT alongside files.
- **Download TV pilot JSON** remains a pilot artifact; use the seven *archive batch* files, not the pilot JSON, to hand off full data for audit.
- All exports are metadata only and not automatically imported. Before any staging import, the assistant must audit source URL duplicates/collisions and reconcile the already-cataloged 328 series index URLs and 52 TV episode transcript links. Protect same-title series distinctions, known series-index associations, and verify that staged imported records are not auto-merged into wrong works. Use owner-reviewed staging draft/approval/apply only. No production changes.

## Browser acceptance

1. Update installed Source Discovery script to `0.2.0-alpha.8` and keep the TV pilot's final page open; **do not click Reset TV pilot** or Clear legacy staged.
2. Click **Expand pilot to all 328 series**. Should confirm that 3 successful pilot visits and 47 episodes remain and 325 pages are queued.
3. Click **Auto scan TV pilot / archive** and confirm source policy/robots verification. The tab should navigate through the remaining 325 indexes, pausing automatically on mismatches.
4. Optionally pause around ~20 additional indexes for a screenshot; resume with **Resume TV scan**, then **Auto scan TV pilot / archive** to continue. This is a foreground tab workflow, not detached automation.
5. When the panel reports full **328 / 3,332** source-index reconciliation, click **Download next TV archive batch** seven times (one per numbered file), and **Copy TV archive manifest**; share the files and manifest with ChatGPT. Do **not** import them until audited.
6. If halted, send a screenshot and do not override the source mismatch. The scanner should resume after a targeted parser fix without rescanning successful indexes.

No Cloudflare staging/production deployment, canonical catalog writes or previously imported metadata changes were performed in this step.
