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

test('series coverage describes observed numbering gaps without inventing missing episodes', () => {
  const index = 'https://scrapsfromtheloft.com/tv-series-transcripts/the-bear-tv-series/';
  const episode = (season, n) => ({
    workType: 'episode', seasonNumber: season, episodeNumber: n, seriesIndexUrl: index
  });
  const items = [
    ...Array.from({ length: 8 }, (_, n) => episode(1, n+1)),
    ...Array.from({ length: 10 }, (_, n) => episode(2, n+1)),
    ...Array.from({ length: 10 }, (_, n) => episode(3, n+1)),
    episode(5, 0),
    ...Array.from({ length: 8 }, (_, n) => episode(5, n+1)),
    { workType: 'episode', seasonNumber: 4, episodeNumber: 1, seriesIndexUrl: 'https://other.example/' },
    { workType: 'series', seasonNumber: 4, seriesIndexUrl: index }
  ];
  const c = core.seriesCoverage(items, index);
  assert.equal(c.observedLinks, 37);
  assert.deepEqual(c.observedSeasons, [1, 2, 3, 5]);
  assert.deepEqual(c.missingSeasons, [4]);
  assert.deepEqual(c.episodeZeroSeasons, [5]);
  assert.deepEqual(c.missingWithinSeasons, []);
  assert.equal(c.unnumbered, 0);
  assert.equal(c.completenessVerified, false);
});

test('season coverage distinguishes a gap in observed episode numbers from a confirmed missing episode', () => {
  const index = 'https://scrapsfromtheloft.com/tv-series-transcripts/other-show/';
  const r = core.seriesCoverage([
    { workType: 'episode', seasonNumber: 1, episodeNumber: 1, seriesIndexUrl: index },
    { workType: 'episode', seasonNumber: 1, episodeNumber: 3, seriesIndexUrl: index },
    { workType: 'episode', seasonNumber: null, episodeNumber: null, seriesIndexUrl: index }
  ], index);
  assert.deepEqual(r.missingSeasons, []);
  assert.deepEqual(r.missingWithinSeasons, [{ season: 1, episodes: [2] }]);
  assert.equal(r.unnumbered, 1);
  assert.equal(r.completenessVerified, false);
});

test('Andor actual browser sample: 12 numbered Season 1 links from a different series index', () => {
  const index = 'https://scrapsfromtheloft.com/tv-series-transcripts/andor-tv-series/';
  const episodeTitles = [
    'Kassa', 'That Would Be Me', 'Reckoning', 'Aldhani',
    'The Axe Forgets', 'The Eye', 'Announcement', 'Narkina 5',
    'Nobody’s Listening!', 'One Way Out', 'Daughter of Ferrix', 'Rix Road'
  ];
  const links = episodeTitles.map((title, i) => {
    const seq = String(i + 1).padStart(2, '0');
    return {
      href: '/tv-series/andor-s01e' + seq + '-transcript/',
      text: 'Andor S01E' + seq + ' – ' + title
    };
  });
  const candidates = core.extractCandidates(links, 'tv-series-page', index, 'Andor');
  assert.equal(candidates.items.length, 12);
  assert.equal(candidates.items.every(x => x.workType === 'episode' && x.seriesTitle === 'Andor'), true);
  assert.deepEqual(candidates.items.map(x => x.episodeNumber), Array.from({length: 12}, (_, n) => n+1));
  assert.deepEqual(candidates.items.map(x => x.episodeTitle), episodeTitles);
  assert.equal(candidates.items.every(x => x.seriesIndexUrl === index && x.reviewStatus === 'candidate'), true);
  const coverage = core.seriesCoverage(candidates.items, index);
  assert.deepEqual(coverage.observedSeasons, [1]);
  assert.deepEqual(coverage.missingSeasons, []);
  assert.deepEqual(coverage.missingWithinSeasons, []);
  // A season beyond the observed season cannot be deduced from its numbering.
  assert.equal(coverage.completenessVerified, false);
});



test('The Movie Spoiler adapter accepts manually visited listing pages and actual movie articles only',()=>{
  assert.equal(core.spoilerPageKind('/'), 'spoiler-list');
  assert.equal(core.spoilerPageKind('/genres/action/'), 'spoiler-list');
  assert.equal(core.spoilerPageKind('/details/avengers/'), 'spoiler-list');
  assert.equal(core.spoilerPageKind('/page/2/'), 'spoiler-list');
  assert.equal(core.spoilerPageKind('/genres/horror/page/3/'), 'spoiler-list');
  assert.equal(core.spoilerPageKind('/movies/obsession/'), 'spoiler-article');
  assert.equal(core.spoilerPageKind('/Pages/Spoilers.html'), null);
  assert.equal(core.spoilerPageKind('/cdn-cgi/access/login'), null);
});
test('The Movie Spoiler canonicalization preserves search-page provenance but not article tracking queries',()=>{
  assert.equal(core.spoilerCanonicalUrl('https://www.themoviespoiler.com/movies/obsession/?utm_source=spam#read','https://themoviespoiler.com/'),
    'https://themoviespoiler.com/movies/obsession/');
  assert.equal(core.spoilerCanonicalUrl('/?s=obsession&vm=r','https://themoviespoiler.com/'),
    'https://themoviespoiler.com/?s=obsession');
  assert.equal(core.spoilerCanonicalUrl('http://themoviespoiler.com/movies/obsession/','https://themoviespoiler.com/'),null);
  assert.equal(core.spoilerCanonicalUrl('https://not-the-movie-spoiler.com/movies/obsession/','https://themoviespoiler.com/'),null);
  assert.equal(core.spoilerCanonicalUrl('javascript:alert(1)','https://themoviespoiler.com/'),null);
});
test('The Movie Spoiler listing extracts only movie-page metadata, excluding detail indexes and off-site links',()=>{
  const base='https://themoviespoiler.com/';
  const out=core.extractSpoilerCandidates([
    {href:'/movies/obsession/',text:'OBSESSION',contextTitle:'OBSESSION'},
    {href:'/movies/verity/',text:'Image',contextTitle:'VERITY (2026)'},
    {href:'/movies/the-430-movie/',text:'THE 4:30 MOVIE',contextTitle:'THE 4:30 MOVIE'},
    {href:'/details/avengers/',text:'Avengers'},
    {href:'/genres/action/',text:'Action'},
    {href:'https://imdb.com/title/tt0123456/',text:'IMDb'},
    {href:'/movies/obsession/?utm_campaign=x',text:'OBSESSION'},
    {href:'/movies/a-movie-without-plot-yet/',text:'A MOVIE',surroundingText:'Spoiler Needed, Check Back Later'}
  ],'spoiler-list',base);
  assert.equal(out.items.length,4);
  assert.equal(out.duplicates,1);
  assert.equal(out.items[0].sourceId,'the-movie-spoiler');
  assert.equal(out.items[0].resourceType,'plot-synopsis');
  assert.equal(out.items[0].workType,'film');
  assert.equal(out.items[0].releaseYear,null);
  assert.equal(out.items[1].articleTitle,'VERITY (2026)');
  assert.equal(out.items[1].releaseYear,2026);
  assert.equal(out.items[1].reviewStatus,'needs-plot-review');
  assert.equal(out.items[3].reviewStatus,'needs-plot-review');
  assert.equal(out.items[0].foundOn,base);
  assert.equal(out.items[0].seriesIndexUrl,null);
});
test('The Movie Spoiler scan of a search page is not confused with a transcript or a series index',()=>{
 const out=core.extractSpoilerCandidates([
  {href:'/movies/obsession/',text:'OBSESSION'},
  {href:'/movies/verity/',text:'VERITY'}
 ],'spoiler-list','https://themoviespoiler.com/?s=obsession&vm=r');
 assert.equal(out.items.length,2);
 assert.equal(out.items[0].foundOn,'https://themoviespoiler.com/?s=obsession');
 assert.ok(out.items.every(x=>x.resourceType==='plot-synopsis'&&x.workType==='film'));
});
test('The Movie Spoiler stage merging preserves distinct URLs, pages and separate source metadata',()=>{
 const base='https://themoviespoiler.com/';
 const one=core.extractSpoilerCandidates([{href:'/movies/obsession/',text:'OBSESSION'}],'spoiler-list',base);
 const first=core.mergeStage(null,one.items,base);
 const second=core.mergeStage(first.stage,one.items,'https://themoviespoiler.com/?s=obsession');
 assert.equal(first.stage.items.length,1);
 assert.equal(second.stage.items.length,1);
 assert.equal(second.added,0);
 assert.deepEqual(second.stage.pages,[base,'https://themoviespoiler.com/?s=obsession']);
 assert.ok(second.stage.items[0].firstSeenAt);
});

test('Movie Spoiler strips homepage ranking and promotional prefixes from movie titles',()=>{
 const r=core.extractSpoilerCandidates([
  {href:'/movies/verity/',text:'#1 New VERITY'},
  {href:'/movies/avengers-endgame/',text:'#7 2026 Re-Release AVENGERS: ENDGAME'},
  {href:'/movies/obsession/',text:'OBSESSION'},
  {href:'/movies/supergirl-2026/',text:'HBO MAX#1 Movie SUPERGIRL (2026)'},
  {href:'/movies/avatar-ang-the-last-airbender/',text:'Paramount +#1 Movie AVATAR AANG: The Last Airbender'}
 ],'spoiler-list','https://themoviespoiler.com/');
 assert.deepEqual(r.items.map(x=>x.articleTitle),['VERITY','AVENGERS: ENDGAME','OBSESSION','SUPERGIRL (2026)','AVATAR AANG: The Last Airbender']);
 assert.ok(r.items.every(x=>x.reviewStatus==='needs-plot-review'));
});

test('Movie Spoiler numeric-leading film titles are never mistaken for chart ranking badges',()=>{
 const cases=[
  ['/movies/28-years-later/','28 YEARS LATER'],
  ['/movies/12-years-a-slave-2013/','12 YEARS A SLAVE (2013)'],
  ['/movies/9-2009/','9 (2009)'],
  ['/movies/80-for-brady/','80 FOR BRADY'],
  ['/movies/21-bridges/','21 BRIDGES'],
  ['/movies/47-meters-down-uncaged/','47 METERS DOWN: Uncaged'],
  ['/movies/3-days-to-kill-2014/','3 DAYS TO KILL (2014)'],
  ['/movies/3-10-to-yuma-2007/','3:10 TO YUMA (2007)']
 ];
 const results=core.extractSpoilerCandidates(cases.map(([href,text])=>({href,text})),'spoiler-list','https://themoviespoiler.com/');
 assert.equal(results.items.length,cases.length);
 assert.deepEqual(results.items.map(x=>x.articleTitle),cases.map(x=>x[1]));
});


test('Scraps movie archive: 1,316 reported on All but only letter pages paginate',()=>{
 const all='https://scrapsfromtheloft.com/movie-transcripts/';
 const a1=all+'?mt_letter=A&mt_page=1';
 const a2=all+'?mt_letter=A&mt_page=2';
 assert.deepEqual(core.filmArchiveLocation(all),{letter:null,page:1,root:true});
 assert.deepEqual(core.filmArchiveLocation(a1),{letter:'A',page:1,root:false});
 assert.deepEqual(core.filmArchiveLocation(a2),{letter:'A',page:2,root:false});
 assert.equal(core.filmArchiveNextUrl(all,null),all+'?mt_letter=A');
 assert.equal(core.filmArchiveNextUrl(a1,a2),a2);
 assert.equal(core.filmArchiveNextUrl(a2,null),all+'?mt_letter=B');
 assert.equal(core.filmArchiveNextUrl(all+'?mt_letter=Z',null),null);
 assert.equal(core.filmArchiveNextUrl(a1,all+'?mt_letter=Z&mt_page=19'),null);
 assert.equal(core.filmArchiveLocation(all+'?mt_letter=A&mt_page=0'),null);
 assert.equal(core.filmArchiveLocation(all+'?mt_letter=A&view=screenplays'),null);
 assert.equal(core.filmArchiveLocation('https://evil.example/movie-transcripts/?mt_letter=A'),null);
 assert.equal(core.filmArchiveLocation('https://scrapsfromtheloft.com/movie-transcripts/?mt_letter=%23'),null);
});

test('movie index cards are trusted only in archive context including /comedy/ and transcript-less slugs',()=>{
 const doc={querySelectorAll:selector=>{
   assert.equal(selector,'.catalog-list .catalog-item h3 a[href]');
   return [
    {href:'https://scrapsfromtheloft.com/movies/the-abandon-2022-transcript/',textContent:'The Abandon (2022)'},
    {href:'https://scrapsfromtheloft.com/comedy/argylle-transcript/',textContent:'Argylle (2024)'},
    {href:'https://scrapsfromtheloft.com/movies/amazon-empire-the-rise-and-reign-of-jeff-bezos-frontline/',textContent:'Amazon Empire: The Rise and Reign of Jeff Bezos (2020)'}
   ];
 }};
 const links=core.filmArchiveListedLinks(doc);
 assert.equal(links.length,3);
 const result=core.extractCandidates(links,'film','https://scrapsfromtheloft.com/movie-transcripts/?mt_letter=A&mt_page=1');
 assert.equal(result.items.length,3);
 assert.equal(result.items.find(x=>x.articleTitle.startsWith('Argylle')).canonicalUrl,
   'https://scrapsfromtheloft.com/comedy/argylle-transcript/');
 assert.equal(result.items.find(x=>x.articleTitle.startsWith('Amazon Empire')).releaseYear,2020);
 assert.equal(result.items[0].foundOn,'https://scrapsfromtheloft.com/movie-transcripts/?mt_letter=A&mt_page=1');
 assert.equal(core.candidateFromLink({href:'/comedy/argylle-transcript/',text:'Argylle'},'film',moviePage),null,
   'arbitrary /comedy/ site links must not become films outside trusted archive cards');
});


test('automatic movie archive robots gate respects generic archive blocks, allowances and rate limits',()=>{
 const p=core.robotsMovieArchivePolicy;
 const allowed=p('User-agent: *\nDisallow: /wp-admin/\nAllow: /wp-admin/admin-ajax.php');
 assert.equal(allowed.allowed,true);
 assert.equal(allowed.delayMs,15000);
 assert.equal(p('User-agent: *\nDisallow: /').allowed,false);
 assert.equal(p('User-agent: *\nDisallow: /movie-transcripts/').allowed,false);
 assert.equal(p('User-agent: *\nDisallow: /*?mt_letter').allowed,false);
 assert.equal(p('User-agent: *\nDisallow: /\nAllow: /movie-transcripts/').allowed,true);
 assert.equal(p('User-agent: *\nCrawl-delay: 25\nDisallow: /wp-admin/').delayMs,25000);
 assert.equal(p('User-agent: *\nCrawl-delay: 121').allowed,false);
 assert.equal(p('User-agent: BadCrawler\nDisallow: /\nUser-agent: *\nDisallow: /wp-admin/').allowed,true);
 assert.equal(p('User-agent: EvilBot\nAllow: /').allowed,false);
 assert.equal(p('<html>Bot challenge</html>').allowed,false);
 assert.equal(p('User-agent: *\nDisallow: /movie-transcripts/?mt_letter=A$').allowed,true);
});

test('movie archive complete requires 26 observed letters AND exact unfiltered source count',()=>{
 const all={letter:'ALL',expected:1316,urls:['https://example.test/28-years-later/']};
 const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter,i)=>({
   letter,expected:1,urls:['https://example.test/film-'+letter+'/']
 }));
 let coverage=core.movieArchiveCoverage([all,...letters]);
 assert.equal(coverage.unique,27);
 assert.equal(coverage.expected,1316);
 assert.equal(coverage.lettersSeen,26);
 assert.equal(coverage.complete,false);
 coverage=core.movieArchiveCoverage([{...all,expected:27},...letters]);
 assert.equal(coverage.complete,true);
 assert.equal(core.movieArchiveCoverage([all,...letters.slice(0,25)]).complete,false);
});


test('movie archive exception audit names unsupported article URL instead of silently losing title',()=>{
  const base='https://scrapsfromtheloft.com/movie-transcripts/?mt_letter=H';
  const links=[
    {href:'https://scrapsfromtheloft.com/movies/heat-1995-transcript/',text:'Heat (1995)',contextTitle:'Heat (1995)',archiveListed:true},
    {href:'https://scrapsfromtheloft.com/feature/how-to-train-your-dragon/',text:'How to Train Your Dragon (2025)',contextTitle:'How to Train Your Dragon (2025)',archiveListed:true}
  ];
  const d=core.filmArchiveExtractionAudit(links,base);
  assert.equal(d.listed,2);
  assert.equal(d.accepted,1);
  assert.equal(d.rejected,1);
  assert.equal(d.duplicateUrls,0);
  assert.equal(d.issues.length,1);
  assert.equal(d.issues[0].kind,'rejected-card');
  assert.equal(d.issues[0].title,'How to Train Your Dragon (2025)');
  assert.match(d.issues[0].url,/\/feature\/how-to-train-your-dragon\/$/);
  assert.match(d.issues[0].reason,/not recognized/);
});
test('movie archive exception audit distinguishes duplicate source links from unsupported paths',()=>{
  const base='https://scrapsfromtheloft.com/movie-transcripts/?mt_letter=H';
  const links=[
    {href:'https://scrapsfromtheloft.com/movies/hamnet-transcript/',text:'Hamnet (2025)',archiveListed:true},
    {href:'https://scrapsfromtheloft.com/movies/hamnet-transcript/?utm_campaign=abc',text:'Hamnet (2025)',archiveListed:true}
  ];
  const d=core.filmArchiveExtractionAudit(links,base);
  assert.equal(d.listed,2);
  assert.equal(d.accepted,1);
  assert.equal(d.rejected,0);
  assert.equal(d.duplicateUrls,1);
  assert.equal(d.issues[0].kind,'duplicate-url');
});
test('archive exception audit includes only source index metadata, not page body text',()=>{
 const d=core.filmArchiveExtractionAudit([{href:'javascript:alert(1)',text:'Unusual item',contextTitle:'Unusual item',archiveListed:true}],
 'https://scrapsfromtheloft.com/movie-transcripts/?mt_letter=H');
 assert.equal(d.accepted,0);
 assert.equal(d.issues.length,1);
 assert.equal(d.issues[0].title,'Unusual item');
 assert.match(d.issues[0].reason,/invalid destination URL/);
});
