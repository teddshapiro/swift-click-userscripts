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


## Compatibility correction — alpha.9 (important)

The owner successfully finished the TV pilot under alpha.7 and upgraded to alpha.8, but the **Expand pilot to all 328 series** button incorrectly said the completed pilot was incomplete. Investigation of the exact alpha.7 GitHub source revealed the root cause: alpha.7's initial saved `TV_GUIDE_KEY` object did **not** have a `mode` field; alpha.8's expansion gate incorrectly required `state.mode==='pilot'`. The browser panel showed 328 staged series, 47 episodes and 3 of 3 pilot indexes, matching the prior successful run. **No data was lost or proven missing.**

Version `0.2.0-alpha.9` fixes this by using `tvPilotExpansionAudit`. It accepts both a legacy missing mode and the newer `mode:'pilot'` *only after* verifying 328 distinct directory indexes, 3 exact pilot queue URLs, all three individual expected/accepted counts (8, 2, 37), a 3,332 directory total and 47 distinct staged episodes linked to the correct three series. Any mismatch now produces a specific reason. `mode:'full'` is not treated as a pilot; incomplete data cannot be promoted. A dedicated regression test uses an old-format pilot state with no mode, verifies it passes, and confirms incomplete/mismatched cases fail.

**User recovery:** Do NOT Clear staged, Reset TV pilot only or Prepare 3-series TV pilot. Update installed userscript to alpha.9, remain on The Bear index page, and click **Expand pilot to all 328 series** again. It should report successful alpha.7 state migration and queue all 328 series while retaining 3 scanned and 47 episodes. After reviewing site permissions, click **Auto scan TV pilot / archive** to navigate the remaining 325 pages. If a specific problem still appears, copy its new diagnostic line and stop; never restart the pilot unnecessarily.


## Alpha.10 — American Masters movie-path source listing

During the 328-series automatic scan, the source series index for **American Masters** contained one item, **Edgar Allan Poe: Buried Alive (2017)**, linked to `https://scrapsfromtheloft.com/movies/edgar-allan-poe-buried-alive-transcript/`. The first 19 visited series indexes and **145 source-listed episodes** were already stored. The prior parser assumed every indexed TV episode article lived under `/tv-series/`, so it rejected the actual series-index row, paused **before** saving American Masters, and preserved prior progress.

**Fix in research userscript `0.2.0-alpha.10`:** A `/movies/{slug}/` article can be accepted **only when directly listed inside** `.season-groups section.season ol.episode-list li a` on a canonical Scraps series index page with known parent-series title. The article URL and article title are preserved exactly; its `workType` is `episode` as **source-index classification**, `seriesTitle`/`seriesIndexUrl` link it to **American Masters**, `seasonNumber` and `episodeNumber` remain `null`, and `reviewStatus` is `needs-episode-review`. This is **not a verified TV episode identity or proof that article text exists**. The UI reports a separate TV identity review flag. An actual source-listed row therefore satisfies the source count, while unsupported/foreign links and unlisted movie articles remain invalid. Previous movie-archive source metadata are not reclassified. Regression tests cover this exact URL and all these negative cases; CI passed at https://github.com/teddshapiro/swift-click-userscripts/actions/runs/38078343612.

**Continue without restarting:** Update Tampermonkey to alpha.10, stay on the **American Masters** index page, click **Resume TV scan**. This reattempts only the previously failed series page and should advance from **19/328** visited and **145** episodes to **20/328** visited and **146** source-listed episode links, with **1 TV identity review flag**. Then, after ensuring permission to automate, click **Auto scan TV pilot / archive**. No need to click Prepare or Expand again. Avoid **Reset TV pilot only**, **Clear legacy staged**, and source data deletion. The staging importer remains unchanged; its handling of cross-category source-linked episodes will be audited separately before the eventual TV import.

## Alpha.11 — The Daily Show cross-category and transcript-less index entries

The full scan paused safely on The Daily Show, with 67/328 validated series indexes, 601 stored episode source URLs, seven previous identity review flags and 328 series directory entries preserved. Three source-listed items caused the stop:

- Jimmy Kimmel’s Suspension Was Always About Censorship (Just Ask Trump), at /comedy/jimmy-kimmels-suspension-was-always-about-censorship-transcript/
- Jon Stewart on Butker, Conservative “Outrage” & The Real Cancel Culture | The Daily Show, at /tv-series/jon-stewart-butker-conservative-outrage-real-cancel-culture/ (no transcript in the slug)
- Jon Stewart’s Post-Kimmel Primer on Free Speech in the Glorious Trump Era, at /comedy/jon-stewart-on-jimmy-kimmel-transcript/

Alpha.11 generalized the source-list-specific classification rule instead of adding a special Daily Show list. Only an actual series season episode-list link from a valid source series-index page can qualify. Recognized article directories are tv-series, movies, comedy; other sections, foreign sites, unexpected queries, missing titles, duplicate canonical URLs and incorrect source counts still block the index. Preserve its source URL and parent-series association and flag cross-category/transcript-less items as needs-episode-review (no claim of verified episode identity or downloaded body). The fix retains compatibility with American Masters and prior normal TV indexes.

GitHub Actions tests passed: https://github.com/teddshapiro/swift-click-userscripts/actions/runs/38083960291.

Resume without resetting: update installed script to v0.2.0-alpha.11, remain on The Daily Show page, click Resume TV scan. Upon successfully saving that complete series index, click Auto scan TV pilot / archive to continue with source permissions confirmed. The new total depends on all of that series' source-listed rows, not merely the three examples in the exception. Do not clear the TV stage, original movie stage or staging catalog.

Generic lesson: Source archive taxonomy is often inconsistent; initial link-shape profiling should precede long scans when possible. Keep collection accounting strict and provenance-grounded, but classify irregular source-listed articles with uncertainty flags instead of rejecting legitimate references. Make exceptions diagnosable and scanning resumable, and preserve unverified identity separately from verified source-list presence.

## Alpha.12 — Last Week Tonight /politics/ source-listed episodes

At **149 of 328** visited series indexes, **1,395** source-listed episodes and **26** identity review flags, the scanner paused on **Last Week Tonight with John Oliver** before saving the current index. Three source-listed articles live under the site's `/politics/` category: `china-uighurs-last-week-tonight-with-john-oliver-transcript/`, `coronavirus-viii-prisons-jails-last-week-tonight-with-john-oliver-transcript/` and `donald-trump-last-week-tonight-with-john-oliver-transcript/`.

Version `0.2.0-alpha.12` adds `/politics/{slug}/` to the strictly scoped set of paths accepted as **episode-index-listed article links**. This classification requires the literal season episode-list anchor on a recognized Scraps series-index URL with its parent series title; all three are marked `needs-episode-review` (episode numbers stay null). This change does not assert that they are numbered episodes or that the linked article bodies have been fetched or verified. Foreign hosts, unrelated indexes, unlisted links, query-bearing URLs, duplicate episode links and source-count mismatches remain blocked. Regression tests cover the three reported links and negative safeguards; GitHub Actions passed: https://github.com/teddshapiro/swift-click-userscripts/actions/runs/38085899842.

**Continue without restarting:** Remain on the paused **Last Week Tonight with John Oliver** series-index page, update the installed Tampermonkey userscript to **alpha.12**, confirm its displayed version, then click **Resume TV scan**. After the current series validates and is saved, click **Auto scan TV pilot / archive** to continue the full queue with site permission and robots checks. Do not select **Reset TV pilot only**, **Prepare 3-series TV pilot**, or **Clear legacy staged**. The prior 149 visited indexes and 1,395 episode links remain in separate browser-local TV stage; the actual increment after this index depends on the full series count, not just the three irregular links.

## Alpha.13 — generalized cross-category article recognition

After alpha.12 accepted three /politics/ links, the **same paused Last Week Tonight with John Oliver index** revealed three additional source-listed article links under **/technology/** (Facial Recognition), **/food/** (Food Waste), and **/business/** (Native Advertising). The saved baseline remains **149/328 visited series indexes, 1,395 source-listed episodes, 26 identity review flags**: each failure pauses *before saving the whole index*, so the same index can be retried without losing saved TV data.

**Root cause:** Source-listed TV articles use arbitrary editorial category paths; maintaining a narrow allowlist (/tv-series/, /movies/, /comedy/, /politics/) misses real series-index links.

**Alpha.13 fix:** Instead of adding each new category, accept article-shaped /{category}/{article-slug}/ URLs *only when the source-listed link is an actual anchor in .season-groups section.season ol.episode-list li a on a canonical Scraps series index with known parent title*. Editorial categories are open-ended. Reject foreign hosts, non-HTTPS URLs, URL credentials, nondefault ports, unexpected query params, system and navigation roots (including /uncategorized/, /wp-admin/, /category/, /tag/, /movie-transcripts/, and /tv-series-transcripts/), nested paths, and reserved nonarticle slugs. Existing source count, per-season count, duplicate detection, and collection reconciliation remain unchanged. Cross-category or unnumbered links are **source-index-listed episode candidates**, not verified episode identities; record as needs-episode-review with parent-series linkage and null season/episode numbers when unprovided, without accessing transcript bodies.

**Regression:** Tests cover all three newly reported URLs, unknown editorial categories without transcript markers, rejects for unlisted/untrusted links, blocked URL shapes, source count mismatches and existing full-scan safeguards. Legacy test for an arbitrary /business/ index link was updated to reflect the source-list rule: if really listed on the canonical series index, it is accepted provisionally, while unsafe or unlisted links are rejected.

**Recovery:** Install **v0.2.0-alpha.13**, remain on the paused **Last Week Tonight with John Oliver** index page, refresh, click **Resume TV scan** to retry that unsaved page, then click **Auto scan TV pilot / archive** to continue the 328-series queue after consent/robots checks. Do **not** reset, prepare, re-expand, clear, import or export prematurely. Existing saved 149 series indexes and 1,395 episode links remain in separate browser-local TV stage.
