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
 assert.equal(p('User-agent: *\nDisallow: /wp-admin/','/tv-series-transcripts/law-order/',5000).delayMs,5000);
 assert.equal(p('User-agent: *\nCrawl-delay: 12\nDisallow: /wp-admin/','/tv-series-transcripts/law-order/',5000).delayMs,12000);
 assert.equal(p('User-agent: *\nDisallow: /tv-series-transcripts/','/tv-series-transcripts/law-order/',5000).allowed,false);
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


test('H page 1 business-path exception is a valid archive-listed source without bypassing unrelated links',()=>{
 const base='https://scrapsfromtheloft.com/movie-transcripts/?mt_letter=H';
 const business='https://scrapsfromtheloft.com/business/how-brands-use-design-marketing-to-control-your-mind-transcript/';
 const links=[
  {href:'/movies/hamnet-transcript/',text:'Hamnet (2025)',contextTitle:'Hamnet (2025)',archiveListed:true},
  {href:business,text:'How Brands Use Design & Marketing to Control Your Mind (2023)',
    contextTitle:'How Brands Use Design & Marketing to Control Your Mind (2023)',archiveListed:true}
 ];
 const audit=core.filmArchiveExtractionAudit(links,base);
 assert.equal(audit.listed,2);
 assert.equal(audit.accepted,2);
 assert.equal(audit.rejected,0);
 assert.equal(audit.duplicateUrls,0);
 assert.equal(audit.issues.length,0);
 const special=audit.items.find(x=>x.canonicalUrl===business);
 assert.ok(special);
 assert.equal(special.articleTitle,'How Brands Use Design & Marketing to Control Your Mind (2023)');
 assert.equal(special.releaseYear,2023);
 assert.equal(special.workType,'film');
 assert.equal(special.foundOn,base);
 assert.equal(core.candidateFromLink({href:business,text:'How Brands Use Design & Marketing to Control Your Mind (2023)'},'film',base),null,
  'business article outside the movie listing cards must not become a film');
 assert.equal(core.extractCandidates([{href:business,text:'How Brands Use Design & Marketing to Control Your Mind (2023)'}],'tv-archive',
  'https://scrapsfromtheloft.com/tv-series-transcripts/').items.length,0);
});

test('TV directory recognizes 328 source index entries and 3332 total episodes',()=>{
const prefix='https://scrapsfromtheloft.com/tv-series-transcripts/';
const entries=Array.from({length:328},(_,i)=>({url:prefix+'series-'+i+'/',title:'Show '+i,count:i===327?3005:1}));
const good=core.tvDirectoryAudit(entries,328,3332);
assert.equal(good.valid,true);assert.equal(good.items.length,328);
assert.equal(core.tvDirectoryAudit(entries,328,3333).valid,false);
assert.equal(core.tvDirectoryAudit(entries.slice(1),328,3332).valid,false);
});

test('TV series index pilot handles 8 and 2 listed episodes without inventing gaps',()=>{
 const base='https://scrapsfromtheloft.com/tv-series-transcripts/';
 for(const [name,slug,season,nums] of [['3 Body Problem','3-body-problem-tv-series',1,[1,2,3,4,5,6,7,8]],['American Gods','american-gods-tv-series',3,[9,10]]]){
  const url=base+slug+'/';
  const links=nums.map(n=>({href:'https://scrapsfromtheloft.com/tv-series/'+slug+'-s'+String(season).padStart(2,'0')+'e'+String(n).padStart(2,'0')+'-transcript/',text:'S'+String(season).padStart(2,'0')+'E'+String(n).padStart(2,'0')+' – Episode '+n}));
  const audit=core.tvSeriesAudit({indexUrl:url,entry:{url,title:name,count:nums.length},pageTitle:name,reportedCount:nums.length,sections:[{id:'season-'+season,count:nums.length,links}]});
  assert.equal(audit.valid,true); assert.equal(audit.items.length,nums.length);
  assert.ok(audit.items.every(x=>x.seriesTitle===name&&x.seriesIndexUrl===url));
  assert.equal(audit.coverage.missingSeasons.length,0);
  assert.equal(core.tvSeriesAudit({indexUrl:url,entry:{url,title:name,count:nums.length},pageTitle:name,reportedCount:nums.length,sections:[{id:'season-'+season,count:nums.length,links:links.slice(1)}]}).valid,false);
 }
});

test('The Bear TV pilot counts all 37 episodes; absent season 4 and S05E00 are diagnostic',()=>{
 const url='https://scrapsfromtheloft.com/tv-series-transcripts/the-bear-tv-series/';
 const seasons=[[1,8,1],[2,10,1],[3,10,1],[5,9,0]];
 const groups=seasons.map(([season,count,start])=>({id:'season-'+season,count,links:Array.from({length:count},(_,i)=>{
  const ep=start+i;const tag='S'+String(season).padStart(2,'0')+'E'+String(ep).padStart(2,'0');
  return {href:'https://scrapsfromtheloft.com/tv-series/the-bear-'+tag.toLowerCase()+'-episode-transcript/',text:tag+' – Episode '+ep};
 })}));
 const input={indexUrl:url,entry:{url,title:'The Bear',count:37},pageTitle:'The Bear',reportedCount:37,sections:groups};
 const audit=core.tvSeriesAudit(input);
 assert.equal(audit.valid,true);assert.equal(audit.items.length,37);
 assert.deepEqual(audit.coverage.observedSeasons,[1,2,3,5]);
 assert.deepEqual(audit.coverage.missingSeasons,[4]);
 assert.deepEqual(audit.coverage.episodeZeroSeasons,[5]);
 assert.equal(audit.coverage.completenessVerified,false);
 const altered=structuredClone(input);altered.sections[3].links.pop();
 assert.equal(core.tvSeriesAudit(altered).valid,false);
});


test('reconciles full TV directory scan only with 328 indexes and 3332 valid episode links',()=>{
 const root='https://scrapsfromtheloft.com/tv-series-transcripts/';
 const entries=Array.from({length:328},(_,i)=>({title:'Series '+i,url:root+'series-'+i+'/',count:i<44?11:10}));
 // Expected 328 * 10 + 44 = 3324, with eight extra episodes on last index.
 entries[327].count+=8;
 const queue=entries.map(e=>e.url),visited=entries.map(e=>({
   url:e.url,expected:e.count,accepted:e.count,title:e.title
 }));
 const indexes=entries.map(e=>({workType:'series',canonicalUrl:e.url,foundOn:root}));
 const episodes=entries.flatMap(e=>Array.from({length:e.count},(_,n)=>({
   workType:'episode',canonicalUrl:'https://scrapsfromtheloft.com/tv-series/'+
     e.title.toLowerCase().replace(' ','-')+'-s01e'+String(n).padStart(2,'0')+'/',
   foundOn:e.url,seriesIndexUrl:e.url
 })));
 assert.equal(episodes.length,3332);
 const state={queue,entries,visited,directoryTotal:3332};
 const stage={items:[...indexes,...episodes]};
 const good=core.tvFullCoverage(state,stage);
 assert.equal(good.complete,true);
 assert.equal(good.series,328);
 assert.equal(good.episodes,3332);
 const short=structuredClone(state);short.visited.pop();
 assert.equal(core.tvFullCoverage(short,stage).complete,false);
 const missing=structuredClone(stage);missing.items.pop();
 assert.equal(core.tvFullCoverage(state,missing).complete,false);
});


test('TV collection safely exceeds legacy 1500 source cap and splits into seven import-ready batches',()=>{
 const root='https://scrapsfromtheloft.com/tv-series-transcripts/';
 const indexes=Array.from({length:328},(_,i)=>({
   workType:'series',canonicalUrl:root+'series-'+i+'/',foundOn:root
 }));
 const items=Array.from({length:3332},(_,i)=>({
   workType:'episode',canonicalUrl:'https://scrapsfromtheloft.com/tv-series/show-'+i+'-transcript/',
   seriesIndexUrl:root+'series-'+(i%328)+'/',foundOn:root+'series-'+(i%328)+'/'
 }));
 let stage=core.mergeTvStage(null,indexes,root);
 assert.equal(stage.error,null);
 for(let i=0;i<items.length;i+=300){
   stage=core.mergeTvStage(stage.stage,items.slice(i,i+300),root+'series-'+i+'/');
   assert.equal(stage.error,null);
 }
 assert.equal(stage.stage.items.length,3660);
 const batches=core.tvImportBatches(stage.stage.items,600);
 assert.equal(batches.length,7);
 assert.deepEqual(batches.map(b=>b.items.length),[600,600,600,600,600,600,60]);
 assert.equal(batches.reduce((n,b)=>n+b.items.length,0),3660);
 assert.ok(batches.every(b=>b.items.every(item=>b.pages.includes(item.foundOn))));
 const invalid=structuredClone(stage.stage.items);
 invalid[1].canonicalUrl=invalid[0].canonicalUrl;
 assert.throws(()=>core.tvImportBatches(invalid,600),/duplicate/i);
 assert.throws(()=>core.tvImportBatches(stage.stage.items,751),/size/);
});

test('alpha.14: Law & Order can save a source-list link already listed by another series',()=>{
 const root='https://scrapsfromtheloft.com/tv-series-transcripts/';
 const article='https://scrapsfromtheloft.com/tv-series/shared-law-order-transcript/';
 const other=root+'another-law-order-series/';
 const law=root+'law-order/';
 const indexRows=[
  {workType:'series',canonicalUrl:other,foundOn:root},
  {workType:'series',canonicalUrl:law,foundOn:root}
 ];
 const previous={version:2,items:[...indexRows,{
  workType:'episode',canonicalUrl:article,seriesIndexUrl:other,seriesTitle:'Another Law & Order Series',
  articleTitle:'Shared transcript',foundOn:other,reviewStatus:'candidate',
  firstSeenAt:'2026-10-09T10:00:00.000Z'}],pages:[root,other]};
 const incoming=[{workType:'episode',canonicalUrl:article,seriesIndexUrl:law,
  seriesTitle:'Law & Order',articleTitle:'Law & Order linked entry',
  foundOn:law,reviewStatus:'candidate'}];
 const result=core.mergeTvStage(previous,incoming,law);
 assert.equal(result.error,null);
 assert.equal(result.added,1,'source-list relationship should count as a new reference');
 assert.equal(result.sharedArticleUrls,1);
 assert.equal(result.sharedReferences,2);
 assert.deepEqual(result.newSharedArticleUrls,[article]);
 assert.equal(result.stage.items.length,4);
 const related=result.stage.items.filter(x=>x.workType==='episode');
 assert.deepEqual(related.map(x=>x.seriesIndexUrl),[other,law]);
 assert.ok(related.every(x=>x.sharedAcrossSeries&&x.reviewStatus==='needs-episode-review'));
 assert.deepEqual(related[0].sharedWithSeriesIndexUrls,[law]);
 assert.deepEqual(related[1].sharedWithSeriesIndexUrls,[other]);
 assert.equal(related[0].firstSeenAt,'2026-10-09T10:00:00.000Z','earlier stage provenance preserved');
 assert.equal(previous.items[2].reviewStatus,'candidate','previous input object must not be mutated');
 const batches=core.tvImportBatches(result.stage.items,2);
 assert.equal(batches.length,2,'shared article relationships must survive across batches');
 assert.equal(batches[1].items.filter(x=>x.canonicalUrl===article).length,2);
 const same=core.mergeTvStage(result.stage,incoming,law);
 assert.match(same.error,/duplicate|identity/i);
 assert.equal(same.stage.items.length,result.stage.items.length,'duplicate same index must not overwrite stored stage');
 const independent=core.mergeTvStage(result.stage,[{workType:'episode',canonicalUrl:'https://scrapsfromtheloft.com/tv-series/new-unique-transcript/',seriesIndexUrl:law,foundOn:law,reviewStatus:'candidate'}],law);
 assert.equal(independent.error,null);
 assert.deepEqual(independent.newSharedArticleUrls,[],'previous shared URLs should not be reported anew');
 const unsafe=structuredClone(result.stage.items);
 unsafe.push({...unsafe[3]});
 assert.throws(()=>core.tvImportBatches(unsafe,600),/duplicate/i);
 const unflagged=structuredClone(result.stage.items);
 unflagged[2].sharedAcrossSeries=false;
 assert.throws(()=>core.tvImportBatches(unflagged,600),/shared|review/i);
});

test('alpha.14: full TV reconciliation counts source listings, not exclusively unique article URLs',()=>{
 const root='https://scrapsfromtheloft.com/tv-series-transcripts/';
 const entries=Array.from({length:328},(_,i)=>({
  title:'Series '+i,url:root+'series-'+i+'/',count:i<52?11:10
 }));
 // 3280 + 52 = 3332 source-listed relationships.
 const queue=entries.map(x=>x.url);
 const visited=entries.map(x=>({url:x.url,title:x.title,expected:x.count,accepted:x.count}));
 const series=entries.map(e=>({workType:'series',canonicalUrl:e.url,foundOn:root}));
 const episodes=entries.flatMap((e,i)=>Array.from({length:e.count},(_,j)=>({
  workType:'episode',canonicalUrl:'https://scrapsfromtheloft.com/tv-series/article-'+i+'-'+j+'/',
  seriesIndexUrl:e.url,foundOn:e.url,reviewStatus:'candidate'
 })));
 assert.equal(episodes.length,3332);
 // Two independently validated indexes list the same article URL.
 episodes[entries[0].count].canonicalUrl=episodes[0].canonicalUrl;
 const staged={version:2,items:[...series,...episodes],pages:queue};
 const unreviewed=core.tvFullCoverage({entries,queue,visited,directoryTotal:3332},staged);
 assert.equal(unreviewed.complete,false,'unflagged reuse cannot be reported as fully reconciled');
 const shared=core.mergeTvStage(null,staged.items,root);
 assert.equal(shared.error,null);
 const audited=core.tvFullCoverage({entries,queue,visited,directoryTotal:3332},shared.stage);
 assert.equal(audited.complete,true,JSON.stringify(audited));
 assert.equal(audited.episodes,3332);
 assert.equal(audited.uniqueEpisodes,3331);
 assert.equal(audited.sharedArticleUrls,1);
 assert.equal(audited.sharedReferences,2);
 assert.equal(audited.listingKeysValid,true);
 assert.equal(core.tvImportBatches(shared.stage.items,600).length,7);
 const wrongParent=structuredClone(shared.stage);
 const bad=wrongParent.items.find(x=>x.workType==='episode');
 bad.foundOn=entries[1].url;
 assert.equal(core.tvFullCoverage({entries,queue,visited,directoryTotal:3332},wrongParent).complete,false);
 const missing=structuredClone(shared.stage);
 missing.items.pop();
 assert.equal(core.tvFullCoverage({entries,queue,visited,directoryTotal:3332},missing).complete,false);
});

test('alpha.15: SEAL Team 112 linked rows out of 113 is saved as an explicit, single deferred source gap',()=>{
 const index='https://scrapsfromtheloft.com/tv-series-transcripts/seal-team/';
 const mk=(season,n)=>({href:'https://scrapsfromtheloft.com/tv-series/seal-team-s'+season+'e'+n+'-transcript/',
  text:'SEAL Team S'+season+'E'+n,indexEpisodeListed:true});
 const seasonOther=Array.from({length:97},(_,i)=>mk('03',String(i+1).padStart(3,'0')));
 const season4=Array.from({length:15},(_,i)=>mk('04',String(i+1).padStart(2,'0')));
 const input={indexUrl:index,entry:{url:index,title:'SEAL Team',count:113},
  pageTitle:'SEAL Team',reportedCount:113,
  sections:[{id:'season-3',count:97,links:seasonOther,domRows:97,unlinkedRows:[]},
    {id:'season-4',count:16,links:season4,domRows:16,unlinkedRows:['Unlinked episode row']}]};
 const good=core.tvSeriesAudit(input);
 assert.equal(good.valid,true,JSON.stringify(good.issues));
 assert.equal(good.deferred,true);
 assert.equal(good.items.length,112);
 assert.equal(good.observed,112);
 assert.equal(good.sourceGaps.length,1);
 assert.deepEqual(good.sourceGaps[0],{
  section:'season-4',reported:16,observed:15,missing:1,
  domRows:16,unlinkedRows:['Unlinked episode row']
 });
 assert.equal(good.items.every(x=>x.canonicalUrl&&x.seriesIndexUrl===index),true);
 const moreMissing=structuredClone(input);
 moreMissing.sections[1].links.pop();
 assert.equal(core.tvSeriesAudit(moreMissing).valid,false,
  'two missing source links must still halt');
 const wrongIndex=structuredClone(input);wrongIndex.pageTitle='Wrong Show';
 assert.equal(core.tvSeriesAudit(wrongIndex).valid,false);
 const wrongTotals=structuredClone(input);wrongTotals.reportedCount=114;
 assert.equal(core.tvSeriesAudit(wrongTotals).valid,false);
 const duplicate=structuredClone(input);
 duplicate.sections[1].links[0].href=duplicate.sections[0].links[0].href;
 assert.equal(core.tvSeriesAudit(duplicate).valid,false,
  'repeated article on same series must not be treated as missing link');
 const malformed=structuredClone(input);
 malformed.sections[1].links[0].href='https://other.example/invalid/';
 assert.equal(core.tvSeriesAudit(malformed).valid,false);
 const extraLink=structuredClone(input);
 extraLink.sections[1].links.push(mk('04','16'));
 assert.equal(core.tvSeriesAudit(extraLink).valid,true);
 assert.equal(core.tvSeriesAudit(extraLink).deferred,false);
 assert.equal(core.tvSeriesAudit(extraLink).items.length,113);
});

test('alpha.15: 328 pages can finish with 3331 real links and one disclosed source-index discrepancy',()=>{
 const root='https://scrapsfromtheloft.com/tv-series-transcripts/';
 const entries=Array.from({length:328},(_,i)=>({
   title:'Series '+i,url:root+'series-'+i+'/',count:i<52?11:10
 }));
 const queue=entries.map(e=>e.url);
 const visited=entries.map(e=>({url:e.url,title:e.title,expected:e.count,accepted:e.count,
   sourceGaps:[]}));
 const indexes=entries.map(e=>({workType:'series',canonicalUrl:e.url,foundOn:root}));
 const episodes=entries.flatMap((e,i)=>Array.from({length:e.count},(_,n)=>({
  workType:'episode',canonicalUrl:'https://scrapsfromtheloft.com/tv-series/index-'+i+'-episode-'+n+'/',
  seriesIndexUrl:e.url,foundOn:e.url,reviewStatus:'candidate'
 })));
 assert.equal(episodes.length,3332);
 const complete=core.tvFullCoverage({entries,queue,visited,directoryTotal:3332},
  {items:[...indexes,...episodes]});
 assert.equal(complete.complete,true);
 assert.equal(complete.readyForReview,true);
 const missingEntry=entries[247];
 visited[247].accepted--;
 visited[247].sourceGaps=[{section:'season-4',reported:16,observed:15,
   missing:1,domRows:15,unlinkedRows:[]}];
 const omitted=episodes.filter((item,i)=>!(item.seriesIndexUrl===missingEntry.url &&
   item.canonicalUrl.endsWith('-episode-0/')));
 assert.equal(omitted.length,3331);
 const snapshot={items:[...indexes,...omitted]};
 const deferred=core.tvFullCoverage({entries,queue,visited,directoryTotal:3332},snapshot);
 assert.equal(deferred.complete,false);
 assert.equal(deferred.readyForReview,true,JSON.stringify(deferred));
 assert.equal(deferred.episodes,3331);
 assert.equal(deferred.missingSourceLinks,1);
 assert.equal(deferred.sourceGaps.length,1);
 assert.equal(deferred.sourceGaps[0].indexUrl,missingEntry.url);
 assert.equal(deferred.sourceGaps[0].title,missingEntry.title);
 const batches=core.tvImportBatches(snapshot.items,600);
 assert.deepEqual(batches.map(b=>b.items.length),[600,600,600,600,600,600,59]);
 const unflagged=structuredClone(visited);unflagged[247].sourceGaps=[];
 assert.equal(core.tvFullCoverage({entries,queue,visited:unflagged,directoryTotal:3332},snapshot).readyForReview,false);
 const misaccounted=structuredClone(visited);misaccounted[247].accepted=missingEntry.count;
 assert.equal(core.tvFullCoverage({entries,queue,visited:misaccounted,directoryTotal:3332},snapshot).readyForReview,false);
 const notFinished=visited.slice(0,-1);
 assert.equal(core.tvFullCoverage({entries,queue,visited:notFinished,directoryTotal:3332},snapshot).readyForReview,false);
});

test('alpha.7 saved TV pilot expands on alpha.9 without mode or rescanning',()=>{
  const base='https://scrapsfromtheloft.com/tv-series-transcripts/';
  const seeds=[['3-body-problem-tv-series',8],['american-gods-tv-series',2],['the-bear-tv-series',37]];
  const entries=Array.from({length:328},(_,i)=>({
    url:base+'other-series-'+i+'/',title:'Other Series '+i,count:i<3?11:10
  }));
  for(let i=0;i<seeds.length;i++){
    entries[i]={url:base+seeds[i][0]+'/',title:['3 Body Problem','American Gods','The Bear'][i],count:seeds[i][1]};
  }
  const queue=entries.slice(0,3).map(x=>x.url);
  const visited=entries.slice(0,3).map(x=>({url:x.url,expected:x.count,accepted:x.count}));
  const indexes=entries.map(x=>({workType:'series',canonicalUrl:x.url}));
  const episodes=entries.slice(0,3).flatMap((x,i)=>Array.from({length:x.count},(_,n)=>({
    workType:'episode',seriesIndexUrl:x.url,
    canonicalUrl:'https://scrapsfromtheloft.com/tv-series/'+i+'-ep-'+n+'/'
  })));
  const oldState={active:false,auto:false,queue,entries,visited,directoryTotal:3332};
  const stage={items:[...indexes,...episodes]};
  assert.equal(episodes.length,47);
  const recovered=core.tvPilotExpansionAudit(oldState,stage);
  assert.equal(recovered.valid,true,JSON.stringify(recovered.issues));
  assert.equal(recovered.legacyMode,true);
  assert.equal(core.tvPilotExpansionAudit({...oldState,mode:'pilot'},stage).valid,true);
  assert.equal(core.tvPilotExpansionAudit({...oldState,mode:'full'},stage).valid,false);
  const partial=structuredClone(stage);partial.items.pop();
  const broken=core.tvPilotExpansionAudit(oldState,partial);
  assert.equal(broken.valid,false);
  assert.ok(broken.issues.some(x=>x.includes('47')));
  const unvisited={...oldState,visited:visited.slice(0,2)};
  assert.equal(core.tvPilotExpansionAudit(unvisited,stage).valid,false);
  assert.equal(core.tvPilotExpansionAudit({...oldState,directoryTotal:3333},stage).valid,false);
});


test('American Masters source lists an unnumbered documentary under /movies/ as reviewable TV-index episode',()=>{
 const series='https://scrapsfromtheloft.com/tv-series-transcripts/american-masters/';
 const article='https://scrapsfromtheloft.com/movies/edgar-allan-poe-buried-alive-transcript/';
 const link={href:article,text:'Edgar Allan Poe: Buried Alive (2017)',
   contextTitle:'',indexEpisodeListed:true};
 const result=core.tvSeriesAudit({indexUrl:series,
   entry:{title:'American Masters',url:series,count:1},
   pageTitle:'American Masters',reportedCount:1,
   sections:[{id:'season-1',count:1,links:[link]}]});
 assert.equal(result.valid,true,JSON.stringify(result.issues));
 assert.equal(result.items.length,1);
 const entry=result.items[0];
 assert.equal(entry.canonicalUrl,article);
 assert.equal(entry.workType,'episode');
 assert.equal(entry.resourceType,'dialogue-transcript');
 assert.equal(entry.seriesTitle,'American Masters');
 assert.equal(entry.seriesIndexUrl,series);
 assert.equal(entry.articleTitle,'Edgar Allan Poe: Buried Alive (2017)');
 assert.equal(entry.episodeTitle,'Edgar Allan Poe: Buried Alive (2017)');
 assert.equal(entry.seasonNumber,null);
 assert.equal(entry.episodeNumber,null);
 assert.equal(entry.reviewStatus,'needs-episode-review');
 assert.equal(result.coverage.unnumbered,1);
 assert.equal(result.reviewable.length,1);
 assert.match(result.reviewable[0].reason,/cross-category/);
});

test('cross-category TV exception is allowed only for trusted series episode-list links',()=>{
 const parent='https://scrapsfromtheloft.com/tv-series-transcripts/american-masters/';
 const article='https://scrapsfromtheloft.com/movies/edgar-allan-poe-buried-alive-transcript/';
 const trusted={href:article,text:'Edgar Allan Poe: Buried Alive (2017)',indexEpisodeListed:true};
 assert.equal(core.candidateFromLink({...trusted,indexEpisodeListed:false},'tv-series-page',parent,'American Masters'),null);
 assert.equal(core.candidateFromLink(trusted,'tv-series-page',parent,null),null);
 assert.equal(core.candidateFromLink(trusted,'tv-archive','https://scrapsfromtheloft.com/tv-series-transcripts/','American Masters'),null);
 assert.equal(core.candidateFromLink(trusted,'tv-series-page','https://scrapsfromtheloft.com/movies/film-transcript/','American Masters'),null);
 assert.equal(core.candidateFromLink({...trusted,href:'https://evil.example/movies/edgar-allan-poe-buried-alive-transcript/'},'tv-series-page',parent,'American Masters'),null);
 const movie=core.candidateFromLink({href:article,text:'Edgar Allan Poe: Buried Alive (2017)',archiveListed:true},
 'film','https://scrapsfromtheloft.com/movie-transcripts/?mt_letter=E');
 assert.equal(movie.workType,'film','Existing movie archive metadata must not be retroactively reclassified');
});

test('American Masters unnumbered cross-category item stays subject to count and path validation',()=>{
 const parent='https://scrapsfromtheloft.com/tv-series-transcripts/american-masters/';
 const article='https://scrapsfromtheloft.com/movies/edgar-allan-poe-buried-alive-transcript/';
 const entry={title:'American Masters',url:parent,count:1};
 const base={indexUrl:parent,entry,pageTitle:entry.title,reportedCount:1,
   sections:[{id:'season-3',count:1,links:[{href:article,text:'Edgar Allan Poe: Buried Alive (2017)',indexEpisodeListed:true}]}]};
 const missing=structuredClone(base);missing.sections[0].links=[];
 assert.equal(core.tvSeriesAudit(missing).valid,false);
 const sourcedBusiness=structuredClone(base);
 sourcedBusiness.sections[0].links[0].href='https://scrapsfromtheloft.com/business/random-transcript/';
 const supported=core.tvSeriesAudit(sourcedBusiness);
 assert.equal(supported.valid,true,'a literal index-listed business article is a legitimate reviewable source link');
 assert.equal(supported.items[0].reviewStatus,'needs-episode-review');
 assert.equal(supported.reviewable.length,1);
 const nonArticle=structuredClone(base);nonArticle.sections[0].links[0].href='https://scrapsfromtheloft.com/uncategorized/random-transcript/';
 assert.equal(core.tvSeriesAudit(nonArticle).valid,false);
 const unlabeled=structuredClone(base);unlabeled.sections[0].links[0].indexEpisodeListed=false;
 assert.equal(core.tvSeriesAudit(unlabeled).valid,false);
});


test('The Daily Show captures source-listed comedy and non-transcript TV URLs but flags uncertain identities',()=>{
 const series='https://scrapsfromtheloft.com/tv-series-transcripts/the-daily-show-tv-series/';
 const entries=[
  ['Jimmy Kimmel’s Suspension Was Always About Censorship (Just Ask Trump)',
   'https://scrapsfromtheloft.com/comedy/jimmy-kimmels-suspension-was-always-about-censorship-transcript/'],
  ['Jon Stewart on Butker, Conservative “Outrage” & The Real Cancel Culture | The Daily Show',
   'https://scrapsfromtheloft.com/tv-series/jon-stewart-butker-conservative-outrage-real-cancel-culture/'],
  ['Jon Stewart’s Post-Kimmel Primer on Free Speech in the Glorious Trump Era',
   'https://scrapsfromtheloft.com/comedy/jon-stewart-on-jimmy-kimmel-transcript/']
 ];
 const links=entries.map(([title,href])=>({
   href,text:title,contextTitle:'',indexEpisodeListed:true
 }));
 const audit=core.tvSeriesAudit({indexUrl:series,
   entry:{title:'The Daily Show',url:series,count:3},
   pageTitle:'The Daily Show',reportedCount:3,
   sections:[{id:'season-1',count:3,links}]});
 assert.deepEqual(audit.issues,[]);
 assert.equal(audit.valid,true);
 assert.equal(audit.items.length,3);
 assert.equal(audit.reviewable.length,3);
 for(let i=0;i<3;i++){
   const item=audit.items[i];
   assert.equal(item.canonicalUrl,entries[i][1]);
   assert.equal(item.articleTitle,entries[i][0]);
   assert.equal(item.workType,'episode');
   assert.equal(item.seriesTitle,'The Daily Show');
   assert.equal(item.seriesIndexUrl,series);
   assert.equal(item.reviewStatus,'needs-episode-review');
   assert.equal(item.seasonNumber,null);
   assert.equal(item.episodeNumber,null);
 }
 assert.match(audit.reviewable[1].reason,/without transcript URL marker/);
 assert.match(audit.reviewable[0].reason,/cross-category/);
});

test('TV indexed exceptions remain strictly scoped to actual season episode-list links',()=>{
 const parent='https://scrapsfromtheloft.com/tv-series-transcripts/the-daily-show-tv-series/';
 const unusual=[
  'https://scrapsfromtheloft.com/comedy/jimmy-kimmels-suspension-was-always-about-censorship-transcript/',
  'https://scrapsfromtheloft.com/tv-series/jon-stewart-butker-conservative-outrage-real-cancel-culture/',
  'https://scrapsfromtheloft.com/movies/edgar-allan-poe-buried-alive-transcript/'
 ];
 for(const href of unusual){
   const base={href,text:'Article title',contextTitle:'',indexEpisodeListed:true};
   const good=core.candidateFromLink(base,'tv-series-page',parent,'The Daily Show');
   assert.equal(good?.workType,'episode',href);
   assert.equal(core.candidateFromLink({...base,indexEpisodeListed:false},'tv-series-page',parent,'The Daily Show'),null,href);
   assert.equal(core.candidateFromLink(base,'tv-series-page',parent,null),null,href);
   assert.equal(core.candidateFromLink(base,'tv-archive','https://scrapsfromtheloft.com/tv-series-transcripts/','The Daily Show'),null,href);
   assert.equal(core.candidateFromLink(base,'tv-series-page','https://scrapsfromtheloft.com/movies/other-transcript/','The Daily Show'),null,href);
 }
 for(const href of [
  'https://other.example/comedy/other-transcript/',
  'http://scrapsfromtheloft.com/comedy/other-transcript/',
  'https://scrapsfromtheloft.com/uncategorized/unverified/',
  'https://scrapsfromtheloft.com/comedy/other-transcript/?mode=admin',
  'https://scrapsfromtheloft.com/tv-series-transcripts/another-series/',
  'https://scrapsfromtheloft.com/wp-admin/admin/'
 ]){
   const result=core.candidateFromLink({href,text:'Article title',indexEpisodeListed:true},
     'tv-series-page',parent,'The Daily Show');
   assert.equal(result,null,href);
 }
});

test('Last Week Tonight accepts source-listed politics articles without asserting episode identities',()=>{
 const series='https://scrapsfromtheloft.com/tv-series-transcripts/last-week-tonight-with-john-oliver/';
 const entries=[
  ['China & Uighurs: Last Week Tonight with John Oliver',
   'https://scrapsfromtheloft.com/politics/china-uighurs-last-week-tonight-with-john-oliver-transcript/'],
  ['Coronavirus VIII: Prisons & Jails: Last Week Tonight with John Oliver',
   'https://scrapsfromtheloft.com/politics/coronavirus-viii-prisons-jails-last-week-tonight-with-john-oliver-transcript/'],
  ['Donald Trump: Last Week Tonight with John Oliver',
   'https://scrapsfromtheloft.com/politics/donald-trump-last-week-tonight-with-john-oliver-transcript/']
 ];
 const links=entries.map(([text,href])=>({href,text,indexEpisodeListed:true}));
 const audit=core.tvSeriesAudit({indexUrl:series,
  entry:{title:'Last Week Tonight with John Oliver',url:series,count:3},
  pageTitle:'Last Week Tonight with John Oliver',reportedCount:3,
  sections:[{id:'season-1',count:3,links}]});
 assert.deepEqual(audit.issues,[]);
 assert.equal(audit.valid,true);
 assert.equal(audit.items.length,3);
 assert.equal(audit.reviewable.length,3);
 for(let i=0;i<3;i++){
  const item=audit.items[i];
  assert.equal(item.canonicalUrl,entries[i][1]);
  assert.equal(item.articleTitle,entries[i][0]);
  assert.equal(item.seriesTitle,'Last Week Tonight with John Oliver');
  assert.equal(item.seriesIndexUrl,series);
  assert.equal(item.workType,'episode');
  assert.equal(item.reviewStatus,'needs-episode-review');
  assert.equal(item.seasonNumber,null);
  assert.equal(item.episodeNumber,null);
  assert.match(audit.reviewable[i].reason,/cross-category/);
  assert.equal(core.candidateFromLink({...links[i],indexEpisodeListed:false},
   'tv-series-page',series,'Last Week Tonight with John Oliver'),null);
  assert.equal(core.candidateFromLink(links[i],
   'tv-archive','https://scrapsfromtheloft.com/tv-series-transcripts/','Last Week Tonight with John Oliver'),null);
 }
 const unsafe=core.candidateFromLink(
  {href:entries[0][1]+'?preview=1',text:entries[0][0],indexEpisodeListed:true},
  'tv-series-page',series,'Last Week Tonight with John Oliver');
 assert.equal(unsafe,null,'query-bearing politics URLs must still fail');
 const missing=structuredClone(links);missing.pop();
 assert.equal(core.tvSeriesAudit({indexUrl:series,
  entry:{title:'Last Week Tonight with John Oliver',url:series,count:3},
  pageTitle:'Last Week Tonight with John Oliver',reportedCount:3,
  sections:[{id:'season-1',count:3,links:missing}]}).valid,false);
});

test('alpha.13: cross-category John Oliver episode-list links are accepted without adding category allowlist entries',()=>{
 const series='https://scrapsfromtheloft.com/tv-series-transcripts/last-week-tonight-with-john-oliver/';
 const rows=[
  ['Facial Recognition: Last Week Tonight with John Oliver',
   'https://scrapsfromtheloft.com/technology/facial-recognition-last-week-tonight-with-john-oliver-transcript/'],
  ['Food Waste: Last Week Tonight with John Oliver',
   'https://scrapsfromtheloft.com/food/food-waste-last-week-tonight-with-john-oliver-transcript/'],
  ['Native Advertising: Last Week Tonight with John Oliver',
   'https://scrapsfromtheloft.com/business/native-advertising-last-week-tonight-with-john-oliver-transcript/']
 ];
 const links=rows.map(([text,href])=>({href,text,contextTitle:'',indexEpisodeListed:true}));
 const args={indexUrl:series,
  entry:{title:'Last Week Tonight with John Oliver',url:series,count:links.length},
  pageTitle:'Last Week Tonight with John Oliver',reportedCount:links.length,
  sections:[{id:'season-1',count:links.length,links}]};
 const audit=core.tvSeriesAudit(args);
 assert.deepEqual(audit.issues,[]);
 assert.equal(audit.valid,true);
 assert.equal(audit.items.length,3);
 assert.equal(audit.reviewable.length,3);
 for(let i=0;i<3;i++){
  const item=audit.items[i];
  assert.equal(item.articleTitle,rows[i][0]);
  assert.equal(item.canonicalUrl,rows[i][1]);
  assert.equal(item.seriesIndexUrl,series);
  assert.equal(item.seriesTitle,'Last Week Tonight with John Oliver');
  assert.equal(item.workType,'episode');
  assert.equal(item.reviewStatus,'needs-episode-review');
  assert.equal(item.seasonNumber,null);
  assert.equal(item.episodeNumber,null);
  assert.match(audit.reviewable[i].reason,/cross-category/);
  const unlisted=core.candidateFromLink({...links[i],indexEpisodeListed:false},
   'tv-series-page',series,'Last Week Tonight with John Oliver');
  assert.equal(unlisted,null,'cross-category link without source-list provenance must be rejected');
  assert.equal(core.candidateFromLink(links[i],'tv-series-page',series,null),null);
  assert.equal(core.candidateFromLink(links[i],'tv-archive',
   'https://scrapsfromtheloft.com/tv-series-transcripts/','Last Week Tonight with John Oliver'),null);
 }
 const mismatched=structuredClone(args);
 mismatched.sections[0].links.pop();
 assert.equal(core.tvSeriesAudit(mismatched).valid,false,'missing a source-listed row must fail');
});

test('alpha.13: open-ended category matching rejects non-article and unsafe URL shapes',()=>{
 const parent='https://scrapsfromtheloft.com/tv-series-transcripts/last-week-tonight-with-john-oliver/';
 const title='Facial Recognition: Last Week Tonight with John Oliver';
 const paths=[
  '/tv-series-transcripts/an-unrelated-series/',
  '/movie-transcripts/archive/',
  '/category/technology/',
  '/tag/tv/',
  '/author/editor/',
  '/page/7/',
  '/uncategorized/random-transcript/',
  '/wp-admin/admin/',
  '/wp-content/uploads/',
  '/wp-json/posts/',
  '/technology/page/',
  '/technology/feed/',
  '/technology/index/',
  '/technology/another/story-transcript/',
  '/technology/'
 ];
 for(const pathname of paths){
  const item=core.candidateFromLink({href:'https://scrapsfromtheloft.com'+pathname,
   text:title,indexEpisodeListed:true},'tv-series-page',parent,'Last Week Tonight with John Oliver');
  assert.equal(item,null,pathname);
 }
 for(const href of [
  'https://different.example/technology/episode-transcript/',
  'http://scrapsfromtheloft.com/technology/episode-transcript/',
  'https://scrapsfromtheloft.com/technology/episode-transcript/?preview=yes',
  'https://someone@scrapsfromtheloft.com/technology/episode-transcript/',
  'https://scrapsfromtheloft.com:8443/technology/episode-transcript/'
 ]){
  assert.equal(core.candidateFromLink({href,text:title,indexEpisodeListed:true},
   'tv-series-page',parent,'Last Week Tonight with John Oliver'),null,href);
 }
 const generic=core.candidateFromLink({
  href:'https://scrapsfromtheloft.com/culture/future-entry-no-transcript-marker/',
  text:'An unnumbered special',indexEpisodeListed:true},'tv-series-page',parent,'Last Week Tonight with John Oliver');
 assert.equal(generic?.workType,'episode');
 assert.equal(generic?.reviewStatus,'needs-episode-review');
 assert.equal(generic?.episodeNumber,null);
});

test('TV index audit still stops on incomplete season link counts and duplicates',()=>{
 const series='https://scrapsfromtheloft.com/tv-series-transcripts/the-daily-show-tv-series/';
 const url='https://scrapsfromtheloft.com/comedy/jon-stewart-on-jimmy-kimmel-transcript/';
 const source={indexUrl:series,entry:{title:'The Daily Show',url:series,count:2},
  pageTitle:'The Daily Show',reportedCount:2,
  sections:[{id:'season-1',count:2,links:[
    {href:url,text:'Jon Stewart Commentary',indexEpisodeListed:true},
    {href:url,text:'Same linked item duplicated',indexEpisodeListed:true}
  ]}]};
 assert.equal(core.tvSeriesAudit(source).valid,false);
 const missing=structuredClone(source);missing.sections[0].links.pop();
 assert.equal(core.tvSeriesAudit(missing).valid,false);
});
