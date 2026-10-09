'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../cinema-decoder-source-discovery.user.js');

const moviePage = 'https://scrapsfromtheloft.com/movie-transcripts/';
const tvPage = 'https://scrapsfromtheloft.com/tv-series-transcripts/page/2/';

test('detects only registered archive categories', () => {
  assert.equal(core.archiveKind('/movie-transcripts/'), 'film');
  assert.equal(core.archiveKind('/movie-transcripts/page/2/'), 'film');
  assert.equal(core.archiveKind('/tv-series-transcripts/'), 'tv-archive');
  assert.equal(core.archiveKind('/tv-series-transcripts/page/5/'), 'tv-archive');
  assert.equal(core.archiveKind('/movies/title-transcript/'), null);
  assert.equal(core.archiveKind('/tv-series-transcripts/the-bear-tv-series/'), 'tv-series-page');
});

test('canonicalizes expected HTTPS article host and strips tracking', () => {
  assert.equal(
    core.canonicalUrl('https://www.scrapsfromtheloft.com/movies/film-transcript/?utm_source=x#chapter', moviePage),
    'https://scrapsfromtheloft.com/movies/film-transcript/'
  );
  assert.equal(core.canonicalUrl('javascript:alert(1)', moviePage), null);
  assert.equal(core.canonicalUrl('https://evil.example/movies/film-transcript/', moviePage), null);
  assert.equal(core.canonicalUrl('http://scrapsfromtheloft.com/movies/film-transcript/', moviePage), null);
});

test('film year comes only from the article title, never its URL or page date', () => {
  const known = core.candidateFromLink(
    { href: '/movies/something-2026-transcript/', text: 'Something (1999) | Transcript' },
    'film', moviePage
  );
  assert.equal(known.releaseYear, 1999);
  assert.equal(known.articleTitle, 'Something (1999)');
  const unknown = core.candidateFromLink(
    { href: '/movies/something-2026-transcript/', text: 'Something | Transcript' },
    'film', moviePage
  );
  assert.equal(unknown.releaseYear, null);
  assert.equal(unknown.reviewStatus, 'needs-year-review');
});

test('TV episode parser associates episode with series, season and episode', () => {
  const item = core.candidateFromLink(
    { href: '/tv-series/the-bear-s03e03-doors-transcript/', text: 'The Bear S03E03 Doors | Transcript' },
    'tv-archive', tvPage
  );
  assert.equal(item.seriesTitle, 'The Bear');
  assert.equal(item.seasonNumber, 3);
  assert.equal(item.episodeNumber, 3);
  assert.equal(item.episodeTitle, 'Doors');
  assert.equal(item.reviewStatus, 'candidate');
});

test('TV series identity is uncertain when no reliable episode number is in title', () => {
  const item = core.candidateFromLink(
    { href: '/tv-series/mysterious-show-transcript/', text: 'Mysterious Show | Transcript' },
    'tv-archive', tvPage
  );
  assert.equal(item.seriesTitle, null);
  assert.equal(item.seasonNumber, null);
  assert.equal(item.reviewStatus, 'needs-episode-review');
});

test('rejects category-crossed, irrelevant, non-transcript and archive links', () => {
  const links = [
    { href: '/tv-series/the-bear-s03e03-doors-transcript/', text: 'The Bear S03E03 Doors Transcript' },
    { href: '/movies/no-transcript/', text: 'No Transcript' },
    { href: '/movies/a-film/', text: 'A Film' },
    { href: '/movie-transcripts/', text: 'Movie Transcript Archive' },
    { href: '/other/advertisement-transcript/', text: 'Advertisement Transcript' }
  ];
  const result = core.extractCandidates(links, 'film', moviePage);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].canonicalUrl, 'https://scrapsfromtheloft.com/movies/no-transcript/');
});

test('deduplicates repeated article links within a page', () => {
  const links = [
    { href: '/movies/film-transcript/', text: 'Film (2020) | Transcript' },
    { href: '/movies/film-transcript/#top', text: 'Film (2020) | Transcript' },
    { href: '/movies/film-transcript/?utm_source=footer', text: 'Film (2020) | Transcript' }
  ];
  const r = core.extractCandidates(links, 'film', moviePage);
  assert.equal(r.items.length, 1);
  assert.equal(r.duplicates, 2);
});

test('staging a repeated page is idempotent across film and TV visits', () => {
  const m = core.extractCandidates(
    [{ href: '/movies/film-transcript/', text: 'Film (2020) | Transcript' }],
    'film', moviePage
  ).items;
  const t = core.extractCandidates(
    [{ href: '/tv-series/the-bear-s03e03-doors-transcript/', text: 'The Bear S03E03 Doors Transcript' }],
    'tv-archive', tvPage
  ).items;
  const one = core.mergeStage(null, m, moviePage);
  assert.equal(one.added, 1);
  const two = core.mergeStage(one.stage, t, tvPage);
  assert.equal(two.added, 1);
  const three = core.mergeStage(two.stage, m, moviePage);
  assert.equal(three.added, 0);
  assert.equal(three.stage.items.length, 2);
  assert.equal(three.stage.pages.length, 2);
});

test('no qualifying source links result in zero proposed additions', () => {
  const r = core.extractCandidates([{ href: '/about/', text: 'About' }], 'film', moviePage);
  assert.equal(r.items.length, 0);
});

test('real browser fixture: TV directory mixes series indexes and three direct episode articles', () => {
  const links = [
    { href: '/tv-series/chicago-pd-s14e01-demolition-transcript/', text: 'Chicago P.D. – S14E01 – Demolition' },
    { href: '/tv-series/chicago-fire-s15e01-new-blood-transcript/', text: 'Chicago Fire – S15E01 – New Blood' },
    { href: '/tv-series/chicago-med-s12e01-shots-fired-transcript/', text: 'Chicago Med – S12E01 – Shots Fired' },
    { href: '/tv-series-transcripts/the-bear-tv-series/', text: 'The Bear' },
    { href: '/tv-series-transcripts/andor-tv-series/', text: 'Andor' },
    { href: '/tv-series-transcripts/breaking-bad/', text: 'Breaking Bad' }
  ];
  const result = core.extractCandidates(links, 'tv-archive', tvPage);
  assert.equal(result.items.length, 6);
  assert.equal(result.items.filter(x => x.workType === 'series').length, 3);
  assert.equal(result.items.filter(x => x.workType === 'episode').length, 3);
  const series = result.items.find(x => x.articleTitle === 'The Bear');
  assert.equal(series.resourceType, 'transcript-index');
  assert.equal(series.seriesTitle, 'The Bear');
  assert.equal(series.reviewStatus, 'candidate');
  assert.equal(result.items.find(x => x.articleTitle.includes('Chicago Med')).episodeNumber, 1);
});

test('existing alpha.1 staging migrates series indexes without losing URLs or firstSeen timestamps', () => {
  const old = { version: 1, pages: [tvPage], items: [
    { articleTitle: 'The Bear', workType: 'episode', resourceType: 'dialogue-transcript',
      reviewStatus: 'needs-episode-review', canonicalUrl: 'https://scrapsfromtheloft.com/tv-series-transcripts/the-bear-tv-series/',
      firstSeenAt: '2026-10-09T20:22:28.793Z' },
    { articleTitle: 'Chicago Fire – S15E01 – New Blood', workType: 'episode', resourceType: 'dialogue-transcript',
      canonicalUrl: 'https://scrapsfromtheloft.com/tv-series/chicago-fire-s15e01-new-blood-transcript/',
      firstSeenAt: '2026-10-09T20:22:28.793Z' }
  ] };
  const migrated = core.migrateStage(old);
  assert.equal(migrated.version, 2);
  assert.equal(migrated.items.length, 2);
  assert.equal(migrated.items[0].workType, 'series');
  assert.equal(migrated.items[0].resourceType, 'transcript-index');
  assert.equal(migrated.items[0].reviewStatus, 'candidate');
  assert.equal(migrated.items[0].seriesIndexUrl, old.items[0].canonicalUrl);
  assert.equal(migrated.items[0].firstSeenAt, old.items[0].firstSeenAt);
  assert.equal(migrated.items[1].workType, 'episode');
  assert.equal(core.migrateStage(migrated), migrated);
});

test('individual series page scans may stage episode transcripts but not the parent series again', () => {
  const index = 'https://scrapsfromtheloft.com/tv-series-transcripts/the-bear-tv-series/';
  const links = [
    { href: '/tv-series/the-bear-s03e03-doors-transcript/', text: 'S03E03 – Doors', contextTitle: 'The Bear Transcripts' },
    { href: index, text: 'The Bear' },
    { href: '/tv-series/the-bear-s03e04-cages-transcript/', text: 'The Bear S03E04 – Cages' }
  ];
  const result = core.extractCandidates(links, 'tv-series-page', index, 'The Bear');
  assert.equal(result.items.length, 2);
  assert.equal(result.items[0].workType, 'episode');
  assert.equal(result.items[0].seriesTitle, 'The Bear');
  assert.equal(result.items[0].seasonNumber, 3);
  assert.equal(result.items[0].episodeNumber, 3);
  assert.equal(result.items[0].episodeTitle, 'Doors');
  assert.equal(result.items[0].seriesIndexUrl, index);
  assert.equal(result.items[0].reviewStatus, 'candidate');
});

test('distinct same-title series URLs are not silently merged', () => {
  const links = [
    { href: '/tv-series-transcripts/dark-matter/', text: 'Dark Matter' },
    { href: '/tv-series-transcripts/dark-matter-2024-tv-series/', text: 'Dark Matter' },
    { href: '/tv-series-transcripts/slow-horses/', text: 'Slow Horses' },
    { href: '/tv-series-transcripts/slow-horses-tv-series/', text: 'Slow Horses' }
  ];
  const r = core.extractCandidates(links, 'tv-archive', tvPage);
  assert.equal(r.items.length, 4);
  assert.equal(new Set(r.items.map(x => x.canonicalUrl)).size, 4);
});

test('a series page with no accessible episodes produces no false episode records', () => {
  const index = 'https://scrapsfromtheloft.com/tv-series-transcripts/the-bear-tv-series/';
  const r = core.extractCandidates([
    { href: index, text: 'The Bear' },
    { href: '/tv-series-transcripts/andor-tv-series/', text: 'Andor' }
  ], 'tv-series-page', index, 'The Bear');
  assert.equal(r.items.length, 0);
});
