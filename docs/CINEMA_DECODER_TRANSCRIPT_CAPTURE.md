# Cinema Decoder transcript capture (v0.5.3)

## Source
- Scraps from the Loft movie transcript articles on `/movies/*` and `/movie-transcripts/*`, plus television episode transcripts on `/tv-series/*` and the `/tv-series-transcripts/` archive.
- Movie and TV archive indexes are navigation pages, not individual transcripts, and are intentionally not capture targets.
- The Movie Spoiler, IMDb, and Wikipedia keep their existing extraction paths.

## Behavior
- Isolates the transcript text after the article's **Transcript** heading, dropping page furniture, comments and related-content headings.
- Preserves dialogue, speaker names, and sound/stage cues; strips the source's introductory note.
- Shows **Copy full transcript** and **Save transcript as TXT** for transcript pages.
- Displays captured word/character counts and the extraction method.
- For transcripts over 30,000 characters, **Copy request** creates instructions to attach the saved TXT file instead of silently including only part of the transcript.
- For shorter transcripts the request embeds the captured text as before.
- A minimal length check rejects obviously incomplete extraction, but cannot establish actual completeness versus the released movie.

## Manual browser acceptance and regression checks
1. On `https://scrapsfromtheloft.com/movies/spider-man-brand-new-day-transcript/`, verify the button appears and source is **Scraps from the Loft — Transcript**.
2. Check the preview begins with the first Peter dialogue, not page menus or the synopsis, and ends with the post-credits **Location found** cue; compare source text against the page.
3. Confirm the word/character counts are comfortably above 30,000 characters for this particular transcript. Copy full transcript and check its opening and closing lines.
4. Save the TXT; confirm it includes the title, source URL, full text, and no comments/navigation.
5. Copy the request; confirm it **does not** contain a partial transcript, and clearly asks for a separate TXT attachment.
6. On the archive `https://scrapsfromtheloft.com/movie-transcripts/`, confirm there is no movie-specific launcher.
7. Regression: open a The Movie Spoiler article, an IMDb full synopsis, and a film Wikipedia plot page; verify capture, copy, selections and version label still work.
8. Verify Tampermonkey's automatic update metadata remains pointed at canonical `main`. New released versions should be offered to installed clients.

## Known limitations
- No automatic bypass of site access restrictions.
- Full textual extraction does not verify that every movie scene is present.
- Browser-level validation is necessary because live WordPress markup and clipboard/download permissions can differ.

## v0.5.1 maintenance fix (2026-10-09)
- A real v0.5.0 TXT export retained footer material beginning with `MoreMovie Transcripts`, plus reader comments, after the final `[BEEPING RAPIDLY]` post-credits cue.
- The footer guard now handles `MoreMovie Transcripts`, `More Movie Transcripts`, a standalone `More` link, and common comment/share headings.
- Tested the footer boundary against the uploaded export and six focused JavaScript cases. The script also passed a JavaScript syntax check.
- Browser re-test for v0.5.1: capture the same film and confirm the exported TXT ends at `[BEEPING RAPIDLY]` with no article links or reader comments.

## v0.5.3 television episode expansion (2026-10-09)
- Added Scraps from the Loft TV transcript archive `https://scrapsfromtheloft.com/tv-series-transcripts/` to the source navigator and userscript scope.
- Added TV episode article paths under `/tv-series/*`; title and source metadata identify an episode, and the generated request calls for episode-level decoding without inventing longer series arcs.
- TV episodes use a lower minimum transcript length than movies, while retaining the requirement for a substantial transcript body.
- Footer cleanup recognizes both `MoreMovie Transcripts` and `MoreTV Series Transcripts` site furniture.
- The active source pill follows the TV archive on TV episode pages; existing movie behavior is unchanged.
- Syntax, 6 URL-routing test cases, 4 footer cases, and static checks passed. Direct live-site readback was unavailable; **browser confirmation is still needed**.
- Acceptance: open `https://scrapsfromtheloft.com/tv-series/the-bear-s03e03-doors-transcript/`, verify the Plot Bridge button and TV source pill, inspect beginning/end of preview, save TXT, and confirm it contains the episode body without website comments. Confirm the source archive index itself does not show the capture button.
