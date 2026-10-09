# Cinema Decoder transcript capture (v0.5.0)

## Source
- Scraps from the Loft individual transcript articles on `/movies/*` and `/movie-transcripts/*`
- Archive index itself is intentionally not recognized as a movie transcript.
- The Movie Spoiler, IMDb, and Wikipedia keep their existing extraction paths.

## Behavior
- Isolates the transcript text after the article's **Transcript** heading, dropping page furniture, comments and related-content headings.
- Preserves dialogue, speaker names, and sound/stage cues; strips the source's introductory note.
- Shows **Copy full transcript** and **Save transcript as TXT** for transcript pages.
- Displays captured word/character counts and the extraction method.
- For transcripts over 30,000 characters, **Copy request** creates instructions to attach the saved TXT file instead of silently including only part of the transcript.
- For shorter transcripts the request embeds the captured text as before.
- A minimal length check rejects obviously incomplete extraction, but cannot establish actual completeness versus the released movie.

## Manual browser acceptance checks (required before main release)
1. On `https://scrapsfromtheloft.com/movies/spider-man-brand-new-day-transcript/`, verify the button appears and source is **Scraps from the Loft — Transcript**.
2. Check the preview begins with the first Peter dialogue, not page menus or the synopsis, and ends with the post-credits **Location found** cue; compare source text against the page.
3. Confirm the word/character counts are comfortably above 30,000 characters for this particular transcript. Copy full transcript and check its opening and closing lines.
4. Save the TXT; confirm it includes the title, source URL, full text, and no comments/navigation.
5. Copy the request; confirm it **does not** contain a partial transcript, and clearly asks for a separate TXT attachment.
6. On the archive `https://scrapsfromtheloft.com/movie-transcripts/`, confirm there is no movie-specific launcher.
7. Regression: open a The Movie Spoiler article, an IMDb full synopsis, and a film Wikipedia plot page; verify capture, copy, selections and version label still work.
8. Verify Tampermonkey's automatic update metadata remains pointed at canonical `main`. Once promoted and version bumped there, installed clients should discover the update.

## Known limitations
- No automatic bypass of site access restrictions.
- Full textual extraction does not verify that every movie scene is present.
- Browser-level validation is necessary because live WordPress markup and clipboard/download permissions can differ.
