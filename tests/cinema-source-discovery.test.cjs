'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../cinema-decoder-source-discovery.user.js');

const moviePage = 'https://scrapsfromtheloft.com/movie-transcripts/';
const tvPage = 'https://scrapsfromtheloft.com/tv-series-transcripts/page/2/';

test('detects only registered archive categories', () => {
  assert.equal(core.archiveKind('/movie-transcripts/'), 'film');
  assert.equal(core.archiveKind('/movie-transcripts/page/2/'), 'film');
  assert.equal(core.archiveKind('/tv-series-transcripts/'), 'episode');
  assert.equal(core.archiveKind('/tv-series-transcripts/page/5/'), 'episode');
  assert.equal(core.archiveKind('/movies/title-transcript/'), null);
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
    'episode', tvPage
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
    'episode', tvPage
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
    'episode', tvPage
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
