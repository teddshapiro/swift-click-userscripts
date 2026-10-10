// ==UserScript==
// @name         Cinema Decoder — Source Discovery (Research Build)
// @namespace    https://cinemadecoder.com/
// @version      0.2.0-alpha.15
// @description  Optional paced A-Z Scraps movie archive scanning; metadata-only TV/Movie Spoiler discovery.
// @author       Cinema Decoder
// @match        https://scrapsfromtheloft.com/movie-transcripts/*
// @match        https://www.scrapsfromtheloft.com/movie-transcripts/*
// @match        https://scrapsfromtheloft.com/tv-series-transcripts/*
// @match        https://www.scrapsfromtheloft.com/tv-series-transcripts/*
// @match        https://themoviespoiler.com/*
// @match        https://www.themoviespoiler.com/*
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/cinema-source-discovery-phase2/cinema-decoder-source-discovery.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/cinema-source-discovery-phase2/cinema-decoder-source-discovery.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const SPOILER_HOSTS = new Set(['themoviespoiler.com','www.themoviespoiler.com']);
  const IS_SPOILER = typeof location !== 'undefined' && SPOILER_HOSTS.has(location.hostname.toLowerCase());
  // Preserve the existing Scraps research staging unchanged. Separate local storage
  // avoids mixing source identities or overwriting earlier 441-record exports.
  const STORAGE_KEY = IS_SPOILER ? 'cinema-source-discovery-movie-spoiler-v1' : 'cinema-source-discovery-staged-v1';
  const SOURCE_ID = IS_SPOILER ? 'the-movie-spoiler' : 'scraps-from-the-loft';
  const SCRIPT_VERSION = '0.2.0-alpha.15';
  const LIMIT_PER_PAGE = 2000;
  const LIMIT_TOTAL = 15000;
  const TV_MIN_DELAY_MS = 5000; // TV-only, subject to any longer robots.txt Crawl-delay.
  const MOVIE_GUIDE_KEY = 'cinema-source-discovery-scraps-movies-guided-v1';
  const TV_GUIDE_KEY = 'cinema-source-discovery-scraps-tv-pilot-v1';
  const TV_STAGE_KEY = 'cinema-source-discovery-scraps-tv-stage-v1';
  const VALID_HOSTS = new Set(['scrapsfromtheloft.com', 'www.scrapsfromtheloft.com']);

  function collapse(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 260);
  }

  function archiveKind(path) {
    if (/^\/movie-transcripts(?:\/|$)/i.test(path)) return 'film';
    if (/^\/tv-series-transcripts\/(?:page\/\d+\/?)?$/i.test(path)) return 'tv-archive';
    if (/^\/tv-series-transcripts\/[^/]+\/?$/i.test(path)) return 'tv-series-page';
    return null;
  }

  function canonicalUrl(value, baseUrl) {
    try {
      const url = new URL(value, baseUrl);
      if (url.protocol !== 'https:' || !VALID_HOSTS.has(url.hostname.toLowerCase())) return null;
      url.hostname = 'scrapsfromtheloft.com';
      url.hash = '';
      for (const key of Array.from(url.searchParams.keys())) {
        if (/^utm_/i.test(key) || /^(fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
      }
      url.pathname = url.pathname.replace(/\/+/g, '/').replace(/\/?$/, '/');
      return url.toString();
    } catch {
      return null;
    }
  }

  function resourceKind(url) {
    try {
      const path = new URL(url).pathname;
      if (/^\/(?:movies|movie-transcripts)\/[^/]+\/?$/i.test(path)) return 'film';
      // Scraps explicitly lists certain movie-archive articles under /comedy/ or /business/.
      // Trust these only when linked from the actual movie archive index cards.
      // These links are only accepted when they come from the trusted movie-index card.
      if (/^\/(?:comedy|business)\/[a-z0-9-]+\/$/i.test(path)) return 'film';
      if (/^\/tv-series\/[^/]+\/?$/i.test(path)) return 'episode';
      if (/^\/tv-series-transcripts\/[^/]+\/?$/i.test(path) && !/^\/tv-series-transcripts\/page\/\d+\/?$/i.test(path)) return 'series';
    } catch {}
    return null;
  }

  function cleanTitle(value) {
    return collapse(value)
      .replace(/\s*[|–—-]\s*(?:movie\s+|tv\s+(?:series\s+)?)?transcript\s*$/i, '')
      .replace(/\s*\|\s*Scraps from the loft\s*$/i, '')
      .trim();
  }

  function episodeParts(title) {
    const patterns = [
      /^(.*?)\s+\bS(\d{1,2})\s*E(\d{1,3})\b\s*[:—–-]?\s*(.*?)$/i,
      /^(.*?)\s+\bSeason\s+(\d{1,2})\s*[,:-]?\s*Episode\s+(\d{1,3})\b\s*[:—–-]?\s*(.*?)$/i,
      /^(.*?)\s+\b(\d{1,2})x(\d{1,3})\b\s*[:—–-]?\s*(.*?)$/i
    ];
    for (const regex of patterns) {
      const m = title.match(regex);
      if (!m) continue;
      return {
        seriesTitle: collapse(m[1].replace(/[\s:—–-]+$/, '')) || null,
        seasonNumber: Number(m[2]),
        episodeNumber: Number(m[3]),
        episodeTitle: collapse(m[4].replace(/^['"“”]+|['"“”]+$/g, '')) || null
      };
    }
    return { seriesTitle: null, seasonNumber: null, episodeNumber: null, episodeTitle: null };
  }

  // The source's editorial article paths are open-ended: /comedy/, /politics/,
  // /technology/, /food/, /business/, etc. Trust only a real episode-list anchor
  // on a validated series index, and reject non-article site/navigation paths.
  const TV_NON_ARTICLE_ROOTS = new Set([
    'tv-series-transcripts','movie-transcripts','category','tag','author',
    'page','search','feed','comments','wp-admin','wp-content','wp-includes',
    'wp-json','uncategorized','sitemap','sitemaps'
  ]);
  function tvIndexedArticlePathAllowed(canonical) {
    const url = new URL(canonical);
    if (url.search || url.username || url.password || url.port) return false;
    const match = url.pathname.match(/^\/([a-z][a-z0-9-]*)\/([a-z0-9][a-z0-9_-]*)\/$/i);
    return !!match && !TV_NON_ARTICLE_ROOTS.has(match[1].toLowerCase()) &&
      !['page','feed','index'].includes(match[2].toLowerCase());
  }

  // The top-level TV directory contains both episode articles and series landing
  // pages. A series landing page is an index, NOT a transcript or an episode.
  function candidateFromLink(link, archiveType, pageUrl, parentSeriesTitle = null) {
    const canonical = canonicalUrl(link.href, pageUrl);
    if (!canonical) return null;
    const nativeKind = resourceKind(canonical);
    // A source-listed season episode link is valid regardless of editorial
    // category. Its relationship is provisional until episode identity review.
    const indexPage = canonicalUrl(pageUrl,pageUrl);
    const seriesListedEpisode = archiveType === 'tv-series-page' &&
      link.indexEpisodeListed === true && !!parentSeriesTitle &&
      !!indexPage && !new URL(indexPage).search &&
      !new URL(indexPage).username && !new URL(indexPage).password &&
      !new URL(indexPage).port &&
      /^\/tv-series-transcripts\/[a-z0-9][a-z0-9_-]*\/$/i.test(new URL(indexPage).pathname) &&
      tvIndexedArticlePathAllowed(canonical);
    const crossCategoryEpisode = seriesListedEpisode && nativeKind !== 'episode';
    const kind = seriesListedEpisode ? 'episode' : nativeKind;
    if (archiveType === 'film' && (kind !== 'film' || (/^\/(?:comedy|business)\//.test(new URL(canonical).pathname) && !link.archiveListed))) return null;
    if (archiveType === 'tv-archive' && kind !== 'series' && kind !== 'episode') return null;
    if (archiveType === 'tv-series-page' && kind !== 'episode') return null;
    if (archiveType !== 'film' && archiveType !== 'tv-archive' && archiveType !== 'tv-series-page') return null;

    const path = new URL(canonical).pathname;
    // On full-series pages, wrapper headings often describe the show, not the
    // individual linked episode. Prefer a link's specific SxxExx title.
    const anchorText = cleanTitle(link.text);
    const contextText = cleanTitle(link.contextTitle);
    let title = kind === 'series' ? (anchorText || contextText)
      : (/\bS\d{1,2}\s*E\d{1,3}\b|\bSeason\s+\d+\s*[,—–:-]?\s*Episode\s+\d+\b|\b\d{1,2}x\d{1,3}\b/i.test(anchorText)
        ? anchorText : (contextText || anchorText));
    if (!title || /^(read more|continue reading|transcript)$/i.test(title)) return null;
    const transcriptSignal = /transcript/i.test(String(link.contextTitle || '') + ' ' + String(link.text || '') + ' ' + path);
    if (kind !== 'series' && !(archiveType === 'film' && link.archiveListed) &&
        !seriesListedEpisode && !transcriptSignal) return null;
    if (kind === 'episode' && parentSeriesTitle && /^(?:S\d{1,2}\s*E\d{1,3}|Season\s+\d+\s*[,—–:-]?\s*Episode\s+\d+)\b/i.test(title)) {
      title = parentSeriesTitle + ' ' + title;
    }
    const filmYear = kind === 'film' ? title.match(/\(((?:19|20)\d{2})\)/) : null;
    const episode = kind === 'episode' ? episodeParts(title) : null;
    const knownSeries = episode ? (seriesListedEpisode ? parentSeriesTitle : (episode.seriesTitle || parentSeriesTitle || null)) : null;
    return {
      sourceId: SOURCE_ID,
      resourceType: kind === 'series' ? 'transcript-index' : 'dialogue-transcript',
      workType: kind,
      articleTitle: title,
      canonicalUrl: canonical,
      releaseYear: filmYear ? Number(filmYear[1]) : null,
      seriesTitle: kind === 'series' ? title : knownSeries,
      seriesIndexUrl: kind === 'series' ? canonical
        : kind === 'episode' && archiveType === 'tv-series-page' ? canonicalUrl(pageUrl, pageUrl) : null,
      seasonNumber: episode ? episode.seasonNumber : null,
      episodeNumber: episode ? episode.episodeNumber : null,
      episodeTitle: episode ? (seriesListedEpisode && !episode.episodeTitle ? title : episode.episodeTitle) : null,
      reviewStatus: kind === 'film' ? (filmYear ? 'candidate' : 'needs-year-review')
        : kind === 'series' ? 'candidate'
        : ((crossCategoryEpisode || seriesListedEpisode && !transcriptSignal)
          ? 'needs-episode-review' :
          knownSeries && episode.seasonNumber !== null ? 'candidate' : 'needs-episode-review'),
      foundOn: canonicalUrl(pageUrl, pageUrl),
      adapterVersion: SCRIPT_VERSION
    };
  }

  function extractCandidates(links, archiveType, pageUrl, parentSeriesTitle = null) {
    const items = [];
    const seen = new Set();
    let invalidOrUnrelated = 0;
    let duplicates = 0;
    for (const link of links.slice(0, LIMIT_PER_PAGE)) {
      const candidate = candidateFromLink(link, archiveType, pageUrl, parentSeriesTitle);
      if (!candidate) { invalidOrUnrelated += 1; continue; }
      if (seen.has(candidate.canonicalUrl)) { duplicates += 1; continue; }
      seen.add(candidate.canonicalUrl);
      items.push(candidate);
    }
    return { items, invalidOrUnrelated, duplicates, truncated: links.length > LIMIT_PER_PAGE };
  }


  // The Movie Spoiler source: all queries read the CURRENT page only. Never follow
  // article links in the background. A /movies/{slug}/ URL is a plot-page candidate;
  // /details/ and /genres/ are browsing indexes, not plot articles.
  function spoilerPageKind(path) {
    if (/^\/movies\/[^/]+\/?$/i.test(path)) return 'spoiler-article';
    if (path === '/' || /^\/(?:genres|details)\/[a-z0-9-]+\/?$/i.test(path) ||
        /^\/(?:page\/\d+|movies\/page\/\d+|genres\/[a-z0-9-]+\/page\/\d+)\/?$/i.test(path))
      return 'spoiler-list';
    return null;
  }
  function spoilerCanonicalUrl(value, baseUrl) {
    try {
      const u = new URL(value, baseUrl);
      if (u.protocol !== 'https:' || !SPOILER_HOSTS.has(u.hostname.toLowerCase()) ||
          u.username || u.password || u.port) return null;
      u.hostname='themoviespoiler.com';
      u.pathname=u.pathname.replace(/\/+/g, '/').replace(/\/?$/, '/');
      u.hash='';
      // Article URLs are stable identities without query parameters.
      if (/^\/movies\/[a-z0-9][a-z0-9-]*\/$/i.test(u.pathname)) u.search='';
      else {
        for(const key of Array.from(u.searchParams.keys())){
          if(!['s','paged','page'].includes(key))u.searchParams.delete(key);
        }
      }
      return u.toString();
    }catch{return null}
  }
  function spoilerCandidateFromLink(link, pageType, pageUrl) {
    const url=spoilerCanonicalUrl(link.href,pageUrl);
    if(!url || !/^\/movies\/[a-z0-9][a-z0-9-]*\/$/i.test(new URL(url).pathname) ||
       (pageType!=='spoiler-list' && pageType!=='spoiler-article')) return null;
    const placeholder=/^(?:image|read more|click here|more|details|view|spoiler coming|check back later|spoiler needed)$/i;
    const anchor=collapse(link.text||link.imageAlt||link.titleAttr);
    const context=collapse(link.contextTitle);
    // A card often puts the film title in a heading and uses its image as the link.
    const article=pageType==='spoiler-article' ? anchor||context :
      !anchor || placeholder.test(anchor) ? context : anchor;
    if(!article || placeholder.test(article))return null;
    const title=article
      // Strip only unmistakable site/ranking labels, never an unprefixed
      // number: 28 DAYS LATER, 12 YEARS A SLAVE and 9 (2009) are real titles.
      .replace(/^\s*(?:HBO\s+MAX|Paramount\s*\+)\s*#\d{1,2}\s*Movie\s+/i,'')
      .replace(/^\s*#\d{1,2}(?=\s|(?:19|20)\d{2}\b)\s*/i,'')
      .replace(/^\s*(?:NEW|NOW PLAYING|ENDING SOON|SPOILER COMING|CHECK BACK LATER)\s+(?=[A-Z])/i,'')
      .replace(/^\s*\d{4}\s+Re-Release\s+/i,'')
      .replace(/\s*[|–—-]\s*The Movie Spoiler\s*$/i,'').trim();
    if(!title)return null;
    const m=title.match(/\(((?:19|20)\d{2})\)/);
    // Do not infer availability from a listing link, even if the title has a year.
    return {
      sourceId:'the-movie-spoiler',
      resourceType:'plot-synopsis',
      workType:'film',
      articleTitle:title,
      canonicalUrl:url,
      releaseYear:m?Number(m[1]):null,
      seriesTitle:null,seriesIndexUrl:null,
      seasonNumber:null,episodeNumber:null,episodeTitle:null,
      // A link alone cannot prove that the page contains a full plot.
      reviewStatus:'needs-plot-review', // All linked plots require explicit content verification.
      foundOn:spoilerCanonicalUrl(pageUrl,pageUrl),
      adapterVersion:SCRIPT_VERSION
    };
  }
  function extractSpoilerCandidates(links,pageType,pageUrl){
    const items=[],seen=new Set();let invalidOrUnrelated=0,duplicates=0;
    for(const link of links.slice(0,LIMIT_PER_PAGE)){
      const item=spoilerCandidateFromLink(link,pageType,pageUrl);
      if(!item){invalidOrUnrelated++;continue;}
      if(seen.has(item.canonicalUrl)){duplicates++;continue;}
      seen.add(item.canonicalUrl);items.push(item);
    }
    return {items,invalidOrUnrelated,duplicates,truncated:links.length>LIMIT_PER_PAGE};
  }

  // Migrate existing alpha.1 local staging without losing the user's discoveries.
  // The URL, not the display title, is the durable deduplication identifier.
  function migrateStage(previous) {
    if (!previous || !Array.isArray(previous.items)) return { version: 2, items: [], pages: [] };
    if (previous.version === 2) return previous;
    return {
      version: 2,
      pages: Array.isArray(previous.pages) ? previous.pages : [],
      items: previous.items.map(item => {
        if (item.workType !== 'episode' || resourceKind(item.canonicalUrl) !== 'series') return item;
        return {
          ...item, resourceType: 'transcript-index', workType: 'series',
          seriesTitle: item.articleTitle, seriesIndexUrl: item.canonicalUrl,
          seasonNumber: null, episodeNumber: null, episodeTitle: null,
          reviewStatus: 'candidate', adapterVersion: SCRIPT_VERSION
        };
      })
    };
  }

  function mergeStage(previous, incoming, pageUrl) {
    const prior = migrateStage(previous);
    const byUrl = new Map(prior.items.map(x => [x.canonicalUrl, x]));
    let added = 0;
    for (const entry of incoming) {
      if (byUrl.has(entry.canonicalUrl)) continue;
      if (byUrl.size >= LIMIT_TOTAL) break;
      byUrl.set(entry.canonicalUrl, { ...entry, firstSeenAt: new Date().toISOString() });
      added += 1;
    }
    const pages = Array.isArray(prior.pages) ? prior.pages.slice(0, 500) : [];
    const page = canonicalUrl(pageUrl, pageUrl) || spoilerCanonicalUrl(pageUrl, pageUrl);
    if (page && !pages.includes(page)) pages.push(page);
    return { stage: { version: 2, items: Array.from(byUrl.values()), pages }, added };
  }

  // These are discovery diagnostics, NOT publication judgments. Missing links
  // may mean incomplete indexing or unavailable source material, not a missing
  // or nonexistent episode. Never invent or remove an episode from this report.
  function seriesCoverage(items, indexUrl) {
    const episodeLinks = (Array.isArray(items) ? items : []).filter(item =>
      item.workType === 'episode' && item.seriesIndexUrl === indexUrl);
    const seasons = new Map();
    let unnumbered = 0;
    for (const item of episodeLinks) {
      const season = item.seasonNumber;
      const episode = item.episodeNumber;
      if (!Number.isInteger(season) || !Number.isInteger(episode) ||
        season < 0 || episode < 0) {
        unnumbered += 1;
        continue;
      }
      if (!seasons.has(season)) seasons.set(season, new Set());
      seasons.get(season).add(episode);
    }
    const observedSeasons = Array.from(seasons.keys()).sort((a,b) => a-b);
    const missingSeasons = [];
    for (let i = 1; i < observedSeasons.length; i++) {
      for (let k = observedSeasons[i-1]+1; k < observedSeasons[i] && missingSeasons.length < 100; k++) {
        missingSeasons.push(k);
      }
    }
    const episodeZeroSeasons = observedSeasons.filter(k => seasons.get(k).has(0));
    const missingWithinSeasons = [];
    for (const season of observedSeasons) {
      const episodes = seasons.get(season);
      const max = Math.min(Math.max(...episodes), 999);
      const missing = [];
      for (let n = 1; n <= max && missing.length < 100; n++) {
        if (!episodes.has(n)) missing.push(n);
      }
      if (missing.length) missingWithinSeasons.push({ season, episodes: missing });
    }
    return {
      observedLinks: episodeLinks.length,
      observedSeasons,
      missingSeasons,
      episodeZeroSeasons,
      missingWithinSeasons,
      unnumbered,
      completenessVerified: false
    };
  }

  // Scraps movie archive: the unfiltered "All" page displays only the first 60
  // entries with NO pagination. Complete enumeration uses A-Z letter filters.
  // # may behave as an empty filter, so scan "All" for numeric-leading titles.
  // No hidden HTTP fetches: a user click visits each subsequent listing page.
  const FILM_LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function filmArchiveLocation(raw) {
    try {
      const u=new URL(raw);
      if(!VALID_HOSTS.has(u.hostname.toLowerCase()) || u.protocol!=='https:' ||
         u.pathname!=='/movie-transcripts/')return null;
      const keys=[...u.searchParams.keys()];
      if(keys.some(k=>!['mt_letter','mt_page'].includes(k)) ||
        new Set(keys).size!==keys.length)return null;
      const letter=u.searchParams.get('mt_letter');
      const page=u.searchParams.has('mt_page')?Number(u.searchParams.get('mt_page')):1;
      if(letter!==null && !/^[A-Z]$/.test(letter))return null;
      if(!Number.isInteger(page)||page<1||page>100)return null;
      if(letter===null && page!==1)return null;
      return {letter,page,root:letter===null};
    }catch{return null}
  }
  function filmArchivePageUrl(letter,page=1) {
    if(!/^[A-Z]$/.test(letter)||!Number.isInteger(page)||page<1||page>100)return null;
    return 'https://scrapsfromtheloft.com/movie-transcripts/?mt_letter='+letter+
      (page>1?'&mt_page='+page:'');
  }
  function filmArchiveNextUrl(raw,nextHref) {
    const state=filmArchiveLocation(raw);
    if(!state)return null;
    if(state.root)return filmArchivePageUrl('A');
    if(nextHref) {
      const next=filmArchiveLocation(nextHref);
      if(next && next.letter===state.letter && next.page===state.page+1)
        return filmArchivePageUrl(next.letter,next.page);
      return null; // malformed pagination: stop rather than silently skip
    }
    const i=FILM_LETTERS.indexOf(state.letter);
    return i>=0 && i<25?filmArchivePageUrl(FILM_LETTERS[i+1]):null;
  }
  // Only headings inside site-provided movie archive cards are trusted as
  // movie transcript entries, even when the article's slug lacks "transcript".
  function filmArchiveListedLinks(doc) {
    return Array.from(doc.querySelectorAll('.catalog-list .catalog-item h3 a[href]')).map(a=>({
      href:a.href,text:collapse(a.textContent),contextTitle:collapse(a.textContent),archiveListed:true
    }));
  }

  // Explain every card rejected by the same extractor used for staging.
  // These are source-index labels/URLs only. Never fetch article bodies.
  function filmArchiveExtractionAudit(links,pageUrl){
    const result=extractCandidates(links,'film',pageUrl);
    const issues=[],accepted=new Map();
    for(const link of links){
      const entry=candidateFromLink(link,'film',pageUrl);
      if(entry){
        if(accepted.has(entry.canonicalUrl)){
          issues.push({kind:'duplicate-url',title:collapse(link.text),
            url:entry.canonicalUrl,previousTitle:accepted.get(entry.canonicalUrl),
            reason:'Two archive cards point to the same canonical URL'});
        }else accepted.set(entry.canonicalUrl,entry.articleTitle);
        continue;
      }
      const canonical=canonicalUrl(link.href,pageUrl);
      const kind=canonical?resourceKind(canonical):null;
      const reason=!canonical?'External, non-HTTPS, or invalid destination URL'
        :kind!=='film'?'Article path not recognized as a movie URL'
        :!cleanTitle(link.text||link.contextTitle)?'No usable article title'
        :'Archive card did not meet the source-extraction rules';
      issues.push({kind:'rejected-card',title:collapse(link.text||link.contextTitle)||'(no title)',
        url:String(link.href||'').slice(0,350),reason});
    }
    return {listed:links.length,accepted:result.items.length,
      duplicateUrls:result.duplicates,rejected:result.invalidOrUnrelated,
      truncated:result.truncated,issues,items:result.items};
  }

  // A conservative robots.txt rule reader for this specific archive path.
  // If rules are unavailable, malformed or ambiguous, DO NOT auto-navigate.
  function robotsMovieArchivePolicy(body,targetPath='/movie-transcripts/?mt_letter=A&mt_page=2',minimumDelayMs=15000) {
    if(typeof body!=='string'||body.length>100000||!/(?:^|\n)\s*User-agent\s*:/i.test(body))
      return {allowed:false,reason:'Missing or unrecognized robots.txt rules.'};
    const groups=[];
    let agents=[],rules=[],seenDirective=false;
    function flush(){if(agents.length)groups.push({agents,rules});agents=[];rules=[];seenDirective=false;}
    for(const line of body.split(/\r?\n/)){
      const clean=line.replace(/#.*$/,'').trim();
      if(!clean)continue;
      const m=clean.match(/^([\w-]+)\s*:\s*(.*)$/);
      if(!m)continue;
      const key=m[1].toLowerCase(),value=m[2].trim();
      if(key==='user-agent'){
        if(seenDirective)flush();
        agents.push(value.toLowerCase());
      }else if(agents.length){
        seenDirective=true;
        if(['allow','disallow','crawl-delay'].includes(key))rules.push({key,value});
      }
    }
    flush();
    const generic=groups.filter(g=>g.agents.includes('*'));
    if(!generic.length)return {allowed:false,reason:'No general User-agent: * rule could be confirmed.'};
    const path=targetPath;
    let match=null,delaySeconds=0;
    for(const group of generic)for(const r of group.rules){
      if(r.key==='crawl-delay'){
        if(!/^\d+(?:\.\d+)?$/.test(r.value))return {allowed:false,reason:'Unrecognized robots.txt Crawl-delay.'};
        delaySeconds=Math.max(delaySeconds,Number(r.value));continue;
      }
      if(!r.value)continue;
      if(!r.value.startsWith('/'))return {allowed:false,reason:'Unrecognized robots.txt path pattern.'};
      const anchored=r.value.endsWith('$');
      const pattern=anchored?r.value.slice(0,-1):r.value;
      const reserved='\\.^$+?()[]{}|';
      const source=pattern.split('*').map(part=>[...part].map(ch=>reserved.includes(ch)?'\\'+ch:ch).join('')).join('.*')+(anchored?'$':'');
      const regex=new RegExp('^'+source);
      if(regex.test(path)){
        const weight=r.value.replace(/\*/g,'').length;
        if(!match||weight>match.weight||(weight===match.weight&&r.key==='disallow'))
          match={allowed:r.key==='allow',weight,pattern:r.value};
      }
    }
    if(match&&!match.allowed)return {allowed:false,reason:'robots.txt disallows movie archive ('+match.pattern+').' };
    if(!Number.isFinite(delaySeconds)||delaySeconds>120)return {allowed:false,reason:'robots.txt crawling delay exceeds pilot safety limit.'};
    return {allowed:true,delayMs:Math.max(minimumDelayMs,Math.ceil(delaySeconds*1000)),
      reason:'The archive is not disallowed in the general robots rules.'};
  }
  function movieArchiveCoverage(visited) {
    const rows=Array.isArray(visited)?visited:[];
    const observed=new Set(rows.flatMap(v=>v.urls||[]));
    const baseline=rows.find(v=>v.letter==='ALL'&&Number.isInteger(v.expected))?.expected??null;
    const scannedLetters=new Set(rows.filter(v=>/^[A-Z]$/.test(v.letter)).map(v=>v.letter));
    return {unique:observed.size,expected:baseline,lettersSeen:scannedLetters.size,
      complete:scannedLetters.size===26&&baseline!==null&&observed.size===baseline};
  }

  // TV pilot. The source's unfiltered directory lists all 328 series and
  // their counts; each series page contains an ordinary per-season episode list.
  // Keep the TV pilot separate from the completed movie archive local data.
  const TV_PILOT_SLUGS=['3-body-problem-tv-series','american-gods-tv-series','the-bear-tv-series'];
  function tvDirectorySnapshot(doc){
    const summary=collapse(doc.querySelector('.kubrick-hero .site-shell > p:last-of-type')?.textContent);
    const m=summary.replace(/,/g,'').match(/\bBrowse\s+(\d+)\s+series\s+and\s+(\d+)\s+complete\s+television episode transcripts\b/i);
    const entries=Array.from(doc.querySelectorAll('.series-list .series-item')).map(card=>{
      const a=card.querySelector('h3 a[href]');
      const countText=collapse(card.querySelector('.series-item__count')?.textContent);
      const num=countText.match(/^(\d+)\s+episodes?$/i);
      return {title:collapse(a?.textContent),url:a?.href||'',count:num?Number(num[1]):null};
    });
    return tvDirectoryAudit(entries,m?Number(m[1]):null,m?Number(m[2]):null);
  }
  function tvDirectoryAudit(entries,expectedSeries,expectedEpisodes){
    const issues=[],urls=new Set(),items=[],normalized=[];
    for(const entry of entries||[]){
      const url=canonicalUrl(entry.url,'https://scrapsfromtheloft.com/tv-series-transcripts/');
      const parsed=url?new URL(url):null;
      const valid=url&&parsed.search==='' &&
        /^\/tv-series-transcripts\/[a-z0-9][a-z0-9_-]*\/$/i.test(parsed.pathname);
      if(!entry.title||!Number.isInteger(entry.count)||entry.count<1||!valid||urls.has(url)){
        issues.push({title:entry.title,url:entry.url,reason:urls.has(url)?'Duplicate series URL':'Invalid directory title, count or series URL'});
        continue;
      }
      urls.add(url);normalized.push({title:entry.title,url,count:entry.count});
      const item=candidateFromLink({href:url,text:entry.title},'tv-archive',
        'https://scrapsfromtheloft.com/tv-series-transcripts/');
      if(!item || item.workType!=='series')issues.push({title:entry.title,url,reason:'Series-index extraction failed'});
      else items.push(item);
    }
    const sum=normalized.reduce((n,x)=>n+x.count,0);
    if(expectedSeries===null || expectedEpisodes===null)
      issues.push({reason:'Source directory totals missing or invalid'});
    if(expectedSeries!==normalized.length)issues.push({reason:'Series count mismatch',expected:expectedSeries,observed:normalized.length});
    if(expectedEpisodes!==sum)issues.push({reason:'Episode count mismatch',expected:expectedEpisodes,observed:sum});
    return {entries:normalized,items,expectedSeries,expectedEpisodes,sum,issues,
      valid:issues.length===0&&items.length===expectedSeries};
  }
  function tvSeriesSnapshot(doc,indexUrl,entry){
    const name=collapse(doc.querySelector('.library__header h1.library__title')?.textContent);
    const intro=collapse(doc.querySelector('.library__header .library__intro')?.textContent);
    const count=intro.match(/^(\d+)\s+episodes?\s+currently available\b/i);
    const sections=Array.from(doc.querySelectorAll('.season-groups section.season')).map(section=>{
      const text=collapse(section.querySelector('.season__heading span')?.textContent);
      const m=text.match(/^(\d+)\s+episodes?$/i);
      const rows=Array.from(section.querySelectorAll('ol.episode-list li'));
      return {id:section.id,count:m?Number(m[1]):null,
        domRows:rows.length,
        unlinkedRows:rows.filter(li=>!li.querySelector('a[href]'))
          .map(li=>collapse(li.textContent)).slice(0,10),
        links:Array.from(section.querySelectorAll('ol.episode-list li a[href]')).map(a=>({
          href:a.href,text:collapse(a.textContent),contextTitle:'',
          indexEpisodeListed:true
        }))};
    });
    return tvSeriesAudit({indexUrl,entry,pageTitle:name,reportedCount:count?Number(count[1]):null,sections});
  }
  function tvSeriesAudit({indexUrl,entry,pageTitle,reportedCount,sections}){
    const issues=[],links=[],seen=new Set(),sourceGaps=[],seasonMismatches=[];
    const expected=entry?.count;
    if(!entry||entry.url!==indexUrl || collapse(pageTitle)!==entry.title)
      issues.push({reason:'Series page identity does not match queued directory URL and title',pageTitle,indexUrl});
    if(!Number.isInteger(reportedCount)||reportedCount!==expected)
      issues.push({reason:'Series page total disagrees with directory',reportedCount,expected});
    for(const section of sections||[]){
      const count=section.links?.length??0;
      if(!Number.isInteger(section.count)||section.count<count)
        seasonMismatches.push({reason:'Season count mismatch',section:section.id,reported:section.count,observed:count});
      else if(section.count>count)
        sourceGaps.push({section:section.id,reported:section.count,observed:count,
          missing:section.count-count,domRows:section.domRows??null,
          unlinkedRows:section.unlinkedRows||[]});
      for(const link of section.links||[])links.push(link);
    }
    if(!sections?.length)issues.push({reason:'No source season groups present'});
    const candidates=[],reviewable=[];
    for(const link of links){
      const parsed=candidateFromLink({...link,contextTitle:''},'tv-series-page',indexUrl,entry?.title);
      if(!parsed || parsed.workType!=='episode'){
        issues.push({reason:'Episode index link not recognized',title:link.text,url:link.href});continue;
      }
      if(seen.has(parsed.canonicalUrl)){
        issues.push({reason:'Duplicate episode URL on index page',title:link.text,url:parsed.canonicalUrl});continue;
      }
      seen.add(parsed.canonicalUrl);candidates.push(parsed);
      if(parsed.reviewStatus!=='candidate')reviewable.push({
        title:parsed.articleTitle,url:parsed.canonicalUrl,
        reason:!/^\/tv-series\//.test(new URL(parsed.canonicalUrl).pathname)
          ? 'Series-index-listed cross-category article; episode identity and numbering unverified'
          : !/transcript/i.test(new URL(parsed.canonicalUrl).pathname)
            ? 'Series-index-listed article without transcript URL marker; article type and episode identity unverified'
            : 'Episode identity or numbering requires review'
      });
    }
    // Defer only one internally consistent, explicitly logged source-list
    // shortfall. No fabricated URL, relaxed identity checks or duplicate links.
    const canDeferSingleGap=issues.length===0&&seasonMismatches.length===0 &&
      sourceGaps.length===1&&sourceGaps[0].missing===1 &&
      Number.isInteger(expected)&&reportedCount===expected &&
      links.length===expected-1&&candidates.length===links.length;
    if(!canDeferSingleGap)
      issues.push(...seasonMismatches,...sourceGaps.map(g=>({
        reason:'Season count mismatch',section:g.section,reported:g.reported,observed:g.observed
      })));
    if((links.length!==expected||candidates.length!==expected)&&!canDeferSingleGap)
      issues.push({reason:'Extracted links do not match source directory count',
        displayed:links.length,extracted:candidates.length,expected});
    return {indexUrl,title:entry?.title,expected,reportedCount,items:candidates,
      observed:links.length,coverage:seriesCoverage(candidates,indexUrl),
      reviewable,sourceGaps:canDeferSingleGap?sourceGaps:[],
      deferred:canDeferSingleGap,issues,valid:issues.length===0};
  }

  // TV stage identity is a source listing, not a globally unique article URL.
  // A single article can be listed under two series. Preserve BOTH relationships,
  // and flag them for identity review. Duplicate links within one series still fail.
  function tvStageItemKey(item){
    if(!item?.canonicalUrl)return null;
    if(item.workType==='series')return 'series|'+item.canonicalUrl;
    if(item.workType==='episode' && item.seriesIndexUrl)
      return 'episode|'+item.seriesIndexUrl+'|'+item.canonicalUrl;
    return null;
  }
  function tvSharedArticleGroups(items){
    const groups=new Map();
    for(const item of items){
      if(item.workType!=='episode')continue;
      const current=groups.get(item.canonicalUrl)||[];
      current.push(item);groups.set(item.canonicalUrl,current);
    }
    return groups;
  }
  // A separate source-only TV stage deliberately exceeds the legacy 1,500-item
  // import cap: 328 series indexes and 3,332 source-listed episode references.
  function mergeTvStage(previous,incoming,pageUrl){
    const prior=migrateStage(previous);
    const items=(prior.items||[]).slice();
    const keys=new Set();
    for(const item of items){
      const key=tvStageItemKey(item);
      if(!key||keys.has(key))return {stage:prior,added:0,error:'Existing TV stage has an invalid or repeated source-list identity'};
      keys.add(key);
    }
    const seenArticles=tvSharedArticleGroups(items);
    const newSharedArticleUrls=new Set();
    let added=0;
    for(const item of incoming||[]){
      const key=tvStageItemKey(item);
      if(!key||keys.has(key))return {stage:prior,added:0,error:'Duplicate or invalid TV source-list identity: '+(item?.canonicalUrl||'unknown')};
      if(items.length>=4200)return {stage:prior,added:0,error:'TV source collection exceeded 4,200-link safety cap'};
      if(item.workType==='episode'){
        const previouslyListed=seenArticles.get(item.canonicalUrl)||[];
        if(previouslyListed.some(old=>old.seriesIndexUrl!==item.seriesIndexUrl))
          newSharedArticleUrls.add(item.canonicalUrl);
        seenArticles.set(item.canonicalUrl,[...previouslyListed,item]);
      }
      items.push({...item,firstSeenAt:new Date().toISOString()});
      keys.add(key);added++;
    }
    const pages=[...(prior.pages||[])];
    const page=canonicalUrl(pageUrl,pageUrl);
    if(page&&!pages.includes(page))pages.push(page);
    if(pages.length>370)return {stage:prior,added:0,error:'TV index page count exceeded safety cap'};
    let sharedArticleUrls=0,sharedReferences=0;
    const sharedByKey=new Map();
    for(const [canonical,group] of tvSharedArticleGroups(items)){
      const parents=new Set(group.map(item=>item.seriesIndexUrl));
      if(parents.size<2)continue;
      sharedArticleUrls++;
      sharedReferences+=group.length;
      for(const item of group){
        sharedByKey.set(tvStageItemKey(item),{
          ...item,reviewStatus:'needs-episode-review',sharedAcrossSeries:true,
          sharedWithSeriesIndexUrls:[...parents].filter(url=>url!==item.seriesIndexUrl).sort()
        });
      }
    }
    // Previously accepted source listings are preserved, but a newly discovered
    // cross-series collision also upgrades their provisional review status.
    return {stage:{version:2,items:items.map(item=>sharedByKey.get(tvStageItemKey(item))||item),pages},
      added,sharedArticleUrls,sharedReferences,
      newSharedArticleUrls:[...newSharedArticleUrls],error:null};
  }
  // Alpha.7 pilot saves predate the 'mode' property introduced in alpha.8.
  // Recover only after verifying the complete three-index/47-episode receipt set.
  // Never reinterpret a partial pilot or an already-expanded full scan.
  function tvPilotExpansionAudit(state,stage){
    const entries=Array.isArray(state?.entries)?state.entries:[];
    const queue=Array.isArray(state?.queue)?state.queue:[];
    const visited=Array.isArray(state?.visited)?state.visited:[];
    const items=Array.isArray(stage?.items)?stage.items:[];
    const series=items.filter(x=>x.workType==='series');
    const episodes=items.filter(x=>x.workType==='episode');
    const issues=[];
    if(state?.mode!==undefined && state.mode!=='pilot')issues.push('State mode is '+String(state.mode)+', not a pilot');
    if(queue.length!==3||new Set(queue).size!==3)issues.push('Expected 3 distinct queued pilot series; found '+queue.length);
    if(visited.length!==3||new Set(visited.map(x=>x.url)).size!==3)issues.push('Expected 3 distinct visited pilot series; found '+visited.length);
    if(entries.length!==328||new Set(entries.map(x=>x.url)).size!==328)issues.push('Expected 328 distinct source directory entries; found '+entries.length);
    if(state?.directoryTotal!==3332)issues.push('Source directory expected 3332 episode links; recorded '+state?.directoryTotal);
    if(series.length!==328||new Set(series.map(x=>x.canonicalUrl)).size!==328)issues.push('Expected 328 distinct series index records; found '+series.length);
    if(episodes.length!==47||new Set(episodes.map(x=>x.canonicalUrl)).size!==47)issues.push('Expected 47 distinct pilot episode URLs; found '+episodes.length);
    for(const expected of [
      ['3-body-problem-tv-series',8],
      ['american-gods-tv-series',2],
      ['the-bear-tv-series',37]
    ]){
      const found=entries.find(x=>x.url.endsWith('/'+expected[0]+'/'));
      if(!found||found.count!==expected[1]||!queue.includes(found.url))
        issues.push('Pilot source '+expected[0]+' missing or has an unexpected count');
      else{
        const v=visited.find(x=>x.url===found.url);
        const linked=episodes.filter(x=>x.seriesIndexUrl===found.url);
        if(!v||v.accepted!==expected[1]||v.expected!==expected[1]||
          linked.length!==expected[1])
          issues.push('Pilot '+expected[0]+' has incomplete visit or episode records');
      }
    }
    if(visited.some(v=>!queue.includes(v.url)))issues.push('A visited index was not in the original pilot queue');
    if(series.some(x=>!entries.some(e=>e.url===x.canonicalUrl)))issues.push('A staged series index is not in the directory');
    if(episodes.some(x=>!queue.includes(x.seriesIndexUrl)))issues.push('An episode belongs to an index outside the three-series pilot');
    return {valid:issues.length===0,legacyMode:state?.mode===undefined,
      issues,series:series.length,episodes:episodes.length,visited:visited.length,
      directoryEntries:entries.length,sourceTotal:state?.directoryTotal??null};
  }

  function tvFullCoverage(state,stage){
    const entries=Array.isArray(state?.entries)?state.entries:[];
    const queue=Array.isArray(state?.queue)?state.queue:[];
    const visited=Array.isArray(state?.visited)?state.visited:[];
    const items=Array.isArray(stage?.items)?stage.items:[];
    const expected=Number(state?.directoryTotal);
    const sourceEntries=entries.length===328&&queue.length===328 &&
      new Set(queue).size===328&&queue.every(u=>entries.some(x=>x.url===u));
    const episodeItems=items.filter(x=>x.workType==='episode');
    const seriesItems=items.filter(x=>x.workType==='series');
    const countsByIndex=new Map();
    for(const item of episodeItems)
      countsByIndex.set(item.seriesIndexUrl,(countsByIndex.get(item.seriesIndexUrl)||0)+1);
    const missingSourceLinks=visited.reduce((n,v)=>n+Math.max(0,v.expected-v.accepted),0);
    const sourceGaps=visited.flatMap(v=>(v.sourceGaps||[]).map(g=>({
      indexUrl:v.url,title:v.title,...g
    })));
    const visitsValid=new Set(visited.map(v=>v.url)).size===visited.length &&
      visited.length===328&&visited.every(v=>{
        const missing=v.expected-v.accepted;
        const gaps=v.sourceGaps||[];
        const recordedGap=gaps.reduce((n,g)=>n+g.missing,0);
        return queue.includes(v.url) &&
          Number.isInteger(v.expected)&&Number.isInteger(v.accepted) &&
          v.accepted>=0&&missing>=0&&missing<=1 &&
          (missing===0?gaps.length===0:gaps.length===1&&recordedGap===missing) &&
          countsByIndex.get(v.url)===v.accepted &&
          entries.some(e=>e.url===v.url&&e.count===v.expected);
      });
    const sumVisits=visited.reduce((n,v)=>n+v.accepted,0);
    const uniqueEpisodes=new Set(episodeItems.map(x=>x.canonicalUrl)).size;
    const identityKeys=items.map(tvStageItemKey);
    const listingKeysValid=identityKeys.every(Boolean)&&new Set(identityKeys).size===items.length;
    const linkedEpisodes=episodeItems.every(item=>visited.some(v=>v.url===item.seriesIndexUrl) &&
      item.foundOn===item.seriesIndexUrl);
    let sharedArticleUrls=0,sharedReferences=0,sharedFlagsValid=true;
    for(const group of tvSharedArticleGroups(episodeItems).values()){
      const parents=[...new Set(group.map(item=>item.seriesIndexUrl))];
      if(parents.length<2)continue;
      sharedArticleUrls++;sharedReferences+=group.length;
      if(group.some(item=>item.sharedAcrossSeries!==true||
        item.reviewStatus!=='needs-episode-review' ||
        !Array.isArray(item.sharedWithSeriesIndexUrls) ||
        !parents.filter(u=>u!==item.seriesIndexUrl).every(u=>item.sharedWithSeriesIndexUrls.includes(u))))
        sharedFlagsValid=false;
    }
    const readyForReview=sourceEntries&&visitsValid&&expected===3332 &&
      sumVisits+missingSourceLinks===expected&&episodeItems.length===sumVisits &&
      listingKeysValid&&sharedFlagsValid&&seriesItems.length===328 &&
      new Set(seriesItems.map(x=>x.canonicalUrl)).size===328&&linkedEpisodes;
    return {complete:readyForReview&&missingSourceLinks===0,
      readyForReview,series:seriesItems.length,episodes:episodeItems.length,expected,
      visited:visited.length,sumVisits,uniqueEpisodes,sharedArticleUrls,
      sharedReferences,listingKeysValid,sharedFlagsValid,linkedEpisodes,
      missingSourceLinks,sourceGaps};
  }
  function tvImportBatches(items,size=600){
    if(!Number.isInteger(size)||size<1||size>750)throw Error('Invalid TV export batch size');
    const source=Array.isArray(items)?items:[];
    const keys=new Set();
    for(const item of source){
      const key=tvStageItemKey(item);
      if(!key||keys.has(key))throw Error('Missing or duplicate TV source-list identity');
      keys.add(key);
      if(!item.foundOn)throw Error('Missing TV source-page provenance');
      if(item.workType==='episode'&&item.foundOn!==item.seriesIndexUrl)
        throw Error('Episode provenance does not match its series index');
    }
    for(const group of tvSharedArticleGroups(source).values()){
      if(new Set(group.map(x=>x.seriesIndexUrl)).size<2)continue;
      if(group.some(x=>x.reviewStatus!=='needs-episode-review'||x.sharedAcrossSeries!==true))
        throw Error('Cross-series shared source URL needs identity review markers before export');
    }
    return Array.from({length:Math.ceil(source.length/size)},(_,index)=>{
      const rows=source.slice(index*size,(index+1)*size);
      return {index:index+1,total:Math.ceil(source.length/size),items:rows,
        pages:Array.from(new Set(rows.map(x=>x.foundOn)))};
    });
  }

  // Make the data-only functions testable without mounting UI or requiring Tampermonkey.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { archiveKind, canonicalUrl, resourceKind, cleanTitle, episodeParts, candidateFromLink, extractCandidates, migrateStage, mergeStage, seriesCoverage, filmArchiveLocation, filmArchivePageUrl, filmArchiveNextUrl, filmArchiveListedLinks, filmArchiveExtractionAudit, robotsMovieArchivePolicy, movieArchiveCoverage, tvDirectoryAudit, tvDirectorySnapshot, tvSeriesAudit, tvSeriesSnapshot, mergeTvStage, tvPilotExpansionAudit, tvFullCoverage, tvImportBatches, spoilerPageKind, spoilerCanonicalUrl, spoilerCandidateFromLink, extractSpoilerCandidates };
    return;
  }

  if (!VALID_HOSTS.has(location.hostname.toLowerCase()) && !IS_SPOILER) return;
  const type = IS_SPOILER ? spoilerPageKind(location.pathname) : archiveKind(location.pathname);
  if (!type) return;

  const panel = document.createElement('section');
  panel.id = 'cd-source-discovery-phase0';
  Object.assign(panel.style, {
    position: 'fixed', right: '14px', bottom: '14px', width: 'min(410px, calc(100vw - 28px))',
    maxHeight: '75vh', overflowY: 'auto', padding: '15px', zIndex: '2147483646',
    background: '#f9fafb', color: '#17202a', border: '2px solid #26415a',
    borderRadius: '11px', boxShadow: '0 8px 26px rgba(0,0,0,.35)',
    font: '14px/1.45 system-ui, sans-serif'
  });
  const heading = document.createElement('div');
  heading.textContent = 'Cinema Decoder · Source Discovery';
  Object.assign(heading.style, { fontSize: '17px', fontWeight: '700' });
  const subtitle = document.createElement('div');
  subtitle.textContent = (IS_SPOILER ? 'The Movie Spoiler · plot links' : type === 'film' ? 'Movie archive' : type === 'tv-archive' ? 'TV series & episodes directory' : 'TV series episode index') + ' · research build ' + SCRIPT_VERSION;
  subtitle.style.marginBottom = '9px';
  const info = document.createElement('div');
  info.textContent = IS_SPOILER ? 'Manually captures visible movie-page links only. Coming-soon pages may have no plot; review each candidate. No article fetching or publication.' : 'Read-only: examines article links on this page. No article downloads and no cloud publication.';
  info.style.fontSize = '12px';
  const status = document.createElement('div');
  Object.assign(status.style, { margin: '12px 0', whiteSpace: 'pre-wrap', fontSize: '13px' });
  const actions = document.createElement('div');
  Object.assign(actions.style, { display: 'flex', flexWrap: 'wrap', gap: '6px' });
  const preview = document.createElement('ol');
  Object.assign(preview.style, { paddingLeft: '21px', maxHeight: '170px', overflowY: 'auto', fontSize: '12px' });

  function button(label, handler) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label;
    Object.assign(b.style, {
      borderRadius: '6px', background: '#213f59', color: '#fff', border: 0,
      padding: '7px 9px', cursor: 'pointer', font: 'inherit'
    });
    b.addEventListener('click', handler);
    actions.append(b);
    return b;
  }

  function staged() {
    const raw = GM_getValue(STORAGE_KEY, { version: 2, items: [], pages: [] });
    const migrated = migrateStage(raw);
    if (raw.version !== 2) GM_setValue(STORAGE_KEY, migrated);
    return migrated;
  }

  function show(message) {
    const saved = staged();
    const items = Array.isArray(saved.items) ? saved.items : [];
    const film = items.filter(x => x.workType === 'film').length;
    const episodes = items.filter(x => x.workType === 'episode').length;
    const series = items.filter(x => x.workType === 'series').length;
    const uncertain = items.filter(x => x.reviewStatus !== 'candidate').length;
    const tvSaved=isTvPilot?tvStage():null;
    const tvProgress=isTvPilot?tvState():null;
    const tvStatus=isTvPilot?'\nSeparate TV scan: '+tvSaved.items.filter(x=>x.workType==='series').length+
      ' series indexes, '+tvSaved.items.filter(x=>x.workType==='episode').length+
      ' source-listed episodes, '+tvSaved.items.filter(x=>x.reviewStatus!=='candidate').length+
      ' TV identity review flags; '+(tvProgress.visited?.length||0)+' of '+(tvProgress.queue?.length||0)+
      ' series indexes scanned.':'';
    status.textContent = message + tvStatus + '\nLegacy staged: ' + items.length + ' links (' + film + ' movies, ' + series +
      ' series indexes, ' + episodes + ' TV episodes). Review flags: ' + uncertain +
      '. Pages inspected: ' + (saved.pages || []).length + '.';
    preview.replaceChildren();
    for (const item of (tvSaved?tvSaved.items:items).slice(-15).reverse()) {
      const li = document.createElement('li');
      li.textContent = item.articleTitle + ' · ' + item.workType +
        (item.reviewStatus !== 'candidate' ? ' · needs review' : '');
      li.title = item.canonicalUrl;
      preview.append(li);
    }
  }

  function pageLinks() {
    const root = document.querySelector('main, #main, .site-main, .archive-content, .content-area') || document;
    const elements = Array.from(root.querySelectorAll('a[href]'));
    return elements.map(a => {
      const wrapper = a.closest('article, .post, .entry, .post-card, .archive-item, .listing-item');
      const titleElement = wrapper && wrapper.querySelector('h1, h2, h3, .entry-title, .post-title');
      return { href: a.href, text: collapse(a.textContent), imageAlt: collapse(a.querySelector('img')?.alt), titleAttr: collapse(a.getAttribute('title')), contextTitle: titleElement ? collapse(titleElement.textContent) : '', surroundingText: IS_SPOILER && wrapper ? collapse(wrapper.textContent).slice(0,260) : '' };
    });
  }

  const isGuidedFilm=!IS_SPOILER && type==='film' && filmArchiveLocation(location.href)!==null;
  const filmGuideButtons=[];
  const AUTO_MAX_PAGES=90;
  let autoTimeout=null;
  function cancelAutoTimer(){if(autoTimeout!==null){clearTimeout(autoTimeout);autoTimeout=null;}}
  function guideState(){
    return GM_getValue(MOVIE_GUIDE_KEY,{active:false,auto:false,visited:[],entries:[],failed:null});
  }
  function scanGuidedMoviePage(){
    const state=guideState();
    if(!state.active || !isGuidedFilm)return;
    const loc=filmArchiveLocation(location.href);
    const current=canonicalUrl(location.href,location.href);
    if(state.visited.some(v=>v.url===current)){
      show('Guided movie scan: page already recorded. Continue when ready.');
      return;
    }
    const links=filmArchiveListedLinks(document);
    const audit=filmArchiveExtractionAudit(links,location.href);
    const result={items:audit.items,truncated:audit.truncated};
    // Keep the strict stop but identify the precise missing card(s).
    const listed=audit.listed;
    if(!listed||audit.accepted!==listed||audit.truncated){
      const first=audit.issues[0];
      const detail=first?' First exception: "'+first.title+'" — '+first.reason+
        ' — '+first.url+'.':' No individual card exception detected.';
      const why='Expected '+listed+' movie cards, extracted '+audit.accepted+
        ' ('+audit.rejected+' rejected, '+audit.duplicateUrls+' duplicate URLs). '+
        'Paused without saving this page.'+detail;
      GM_setValue(MOVIE_GUIDE_KEY,{...state,active:false,auto:false,
        failed:{url:current,reason:why,issues:audit.issues.slice(0,20)}});
      show(why+' Use Copy scan diagnostics if the details are hard to read.');return;
    }
    const expectedText=document.querySelector('.results-summary')?.textContent||'';
    const expectedMatch=expectedText.replace(/,/g,'').match(/(\d+)\s+movie transcripts?/i);
    const summary=expectedMatch?Number(expectedMatch[1]):null;
    if(!Number.isInteger(summary)||summary<0){
      const reason='Movie index count is missing or invalid on '+(loc.letter||'ALL')+
        ' page '+loc.page+'. Paused before saving this page.';
      GM_setValue(MOVIE_GUIDE_KEY,{...state,active:false,auto:false,failed:{url:current,reason}});
      show(reason);return;
    }
    if(loc.letter){
      const previous=state.visited.find(v=>v.letter===loc.letter);
      if(previous && previous.expected!==summary){
        const reason='Movie count changed across '+loc.letter+' pages ('+previous.expected+
          ' versus '+summary+'). Paused for review.';
        GM_setValue(MOVIE_GUIDE_KEY,{...state,active:false,auto:false,failed:{url:current,reason}});
        show(reason);return;
      }
    }
    const visited=[...state.visited,{url:current,letter:loc.letter||'ALL',page:loc.page,
      listed,expected:summary,urls:result.items.map(x=>x.canonicalUrl)}];
    if(loc.letter && !document.querySelector('nav.pagination a.next[href]') &&
      Number.isInteger(summary)){
      const distinct=new Set(visited.filter(v=>v.letter===loc.letter).flatMap(v=>v.urls||[]));
      if(distinct.size!==summary){
        const reason='Letter '+loc.letter+' appears to end with '+distinct.size+
          ' distinct listed URLs, but the site reports '+summary+
          '. Pause and inspect before continuing to next letter.';
        GM_setValue(MOVIE_GUIDE_KEY,{...state,active:false,auto:false,failed:{url:current,reason}});
        show(reason);return;
      }
    }
    const merged=mergeStage(staged(),result.items,location.href);
    GM_setValue(STORAGE_KEY,merged.stage);
    visited[visited.length-1].newLinks=merged.added;
    GM_setValue(MOVIE_GUIDE_KEY,{...state,visited,failed:null});
    show('Guided archive captured '+listed+' movie links on '+
      (loc.letter||'ALL')+' page '+loc.page+' ('+merged.added+' new). '+
      'Use Continue to visit next listing. No article text was downloaded.');
  }
  function nextFilmPage(){
    const nextLink=document.querySelector('nav.pagination a.next[href]');
    return filmArchiveNextUrl(location.href,nextLink?.href||null);
  }
  function stopAuto(reason,failed=false){
    cancelAutoTimer();
    const state=guideState();
    GM_setValue(MOVIE_GUIDE_KEY,{...state,active:false,auto:false,
      failed:failed?{url:location.href,reason}:null});
    show(reason);
  }
  function scheduleAutoListing(){
    cancelAutoTimer();
    const state=guideState();
    if(!state.auto||!state.active||!isGuidedFilm)return;
    const current=canonicalUrl(location.href,location.href);
    if(!state.visited.some(v=>v.url===current)){
      stopAuto('Automatic scan stopped: current page has not been successfully recorded.',true);return;
    }
    if(state.visited.length>=AUTO_MAX_PAGES){
      stopAuto('Automatic scan stopped at 90-page safety limit. Review coverage.',true);return;
    }
    const next=nextFilmPage();
    if(!next){
      const loc=filmArchiveLocation(location.href);
      if(loc?.letter==='Z'){
        const coverage=movieArchiveCoverage(state.visited);
        if(coverage.complete){
          stopAuto('Automatic movie archive scan finished: '+coverage.unique+' unique index URLs across all 26 letters; matching the source summary of '+coverage.expected+'. No article content was downloaded.');
        }else{
          stopAuto('Automatic scan reached Z, but coverage does not reconcile: '+coverage.unique+
            ' unique links versus '+coverage.expected+' advertised; '+coverage.lettersSeen+
            ' of 26 letters visited. Review before importing.',true);
        }
      }else stopAuto('Automatic scan stopped: unexpected pagination; cannot determine a safe next listing.',true);
      return;
    }
    if(state.visited.some(v=>v.url===next)){
      stopAuto('Automatic scan stopped: next listing is already visited (possible navigation loop).',true);return;
    }
    const timing=Math.max(15000,Number(state.autoDelayMs)||15000);
    if(timing>120000){stopAuto('Automatic scan stopped: unsafe delay setting.',true);return;}
    const coverage=movieArchiveCoverage(state.visited);
    show('Auto scan active: '+state.visited.length+' pages; '+coverage.unique+
      ' distinct archive URLs so far. Next listing in '+Math.ceil(timing/1000)+
      ' seconds. Click Pause movie scan to stop.');
    autoTimeout=setTimeout(()=>{
      autoTimeout=null;
      const fresh=guideState();
      if(!fresh.active||!fresh.auto)return;
      if(!fresh.visited.some(v=>v.url===current)||fresh.visited.some(v=>v.url===next))return;
      // Full visible browser navigation only, no background HTTP requests.
      window.location.assign(next);
    },timing);
  }
  async function startAutomaticMovieScan(){
    if(!isGuidedFilm)return;
    const state=guideState();
    const current=canonicalUrl(location.href,location.href);
    if(!state.visited.some(v=>v.url===current)){
      show('First capture this listing with Start / resume movie scan, then enable automation.');return;
    }
    if(!state.visited.some(v=>v.letter==='ALL')){
      show('The first unfiltered All page must be recorded before starting automated A-Z navigation.');return;
    }
    if(!window.confirm('Before enabling repeated browsing, please check the Scraps website terms and confirm this metadata-only archive scan is permitted. This scans listing pages only, with at least 15 seconds between navigations, and stops on errors. Have you checked and do you want to proceed?'))return;
    show('Checking Scraps robots.txt from your browser before activating the automatic scan...');
    let policy;
    try{
      const response=await fetch('/robots.txt',{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)throw new Error('robots.txt returned HTTP '+response.status);
      policy=robotsMovieArchivePolicy(await response.text());
    }catch(e){
      stopAuto('Automation not enabled: cannot verify robots.txt from this browser ('+e.message+'). Continue with guided manual Next or provide the robots.txt text for review.',true);return;
    }
    if(!policy.allowed){
      stopAuto('Automation not enabled: '+policy.reason,true);return;
    }
    const updated=guideState();
    if(updated.visited.length>=AUTO_MAX_PAGES){
      stopAuto('Automatic scan not enabled: page visit limit already reached.',true);return;
    }
    GM_setValue(MOVIE_GUIDE_KEY,{...updated,active:true,auto:true,
      autoDelayMs:policy.delayMs,robotsCheckedAt:new Date().toISOString(),failed:null});
    scheduleAutoListing();
  }

  if(isGuidedFilm){
    const guideStart=button('Start / resume movie scan',()=>{
      const state=guideState(),loc=filmArchiveLocation(location.href);
      if(!state.visited.length && loc.letter){
        show('For full coverage begin at the unfiltered All page to capture numeric-leading movie titles, then proceed A-Z.');return;
      }
      GM_setValue(MOVIE_GUIDE_KEY,{...state,active:true,auto:false,failed:null});
      scanGuidedMoviePage();
    });
    const guideNext=button('Scan next listing ↗',()=>{
      const state=guideState();
      const current=canonicalUrl(location.href,location.href);
      if(!state.active||!state.visited.some(v=>v.url===current)){
        show('Start/resume and successfully record this page before continuing.');return;
      }
      const next=nextFilmPage();
      if(!next){show('End of A-Z guide, or unexpected pagination. Review counts before declaring complete.');return;}
      cancelAutoTimer();
      GM_setValue(MOVIE_GUIDE_KEY,{...state,auto:false});
      window.location.assign(next);
    });
    const autoButton=button('Auto scan remaining A–Z',()=>{void startAutomaticMovieScan();});
    autoButton.style.background='#425626';
    const guidePause=button('Pause movie scan',()=>{
      const state=guideState();
      cancelAutoTimer();
      GM_setValue(MOVIE_GUIDE_KEY,{...state,active:false,auto:false});
      show('Guided scan paused. Captured pages and staged URLs are preserved.');
    });
    guideStart.style.background='#48633a';
    guidePause.style.background='#56616e';
    filmGuideButtons.push(guideStart,guideNext,autoButton,guidePause);
  }

  const isTvPilot=!IS_SPOILER&&(type==='tv-archive'||type==='tv-series-page');
  const tvStage=()=>migrateStage(GM_getValue(TV_STAGE_KEY,{version:2,items:[],pages:[]}));
  const tvState=()=>GM_getValue(TV_GUIDE_KEY,{active:false,auto:false,queue:[],entries:[],visited:[],failed:null});
  let tvTimer=null;
  function tvPause(reason,failed=false){
    if(tvTimer!==null){clearTimeout(tvTimer);tvTimer=null;}
    const state=tvState();
    GM_setValue(TV_GUIDE_KEY,{...state,active:false,auto:false,
      failed:failed?{url:location.href,reason}:null});
    show(reason);
  }
  function tvCounts(){const s=tvStage();return {
    series:s.items.filter(x=>x.workType==='series').length,
    episodes:s.items.filter(x=>x.workType==='episode').length
  };}
  function tvNext(){
    const state=tvState();
    return (state.queue||[]).find(url=>!state.visited?.some(v=>v.url===url))||null;
  }
  function tvScanCurrent(){
    if(!isTvPilot||type!=='tv-series-page')return false;
    const state=tvState(),url=canonicalUrl(location.href,location.href);
    if(!state.active||!state.queue?.includes(url))return false;
    if(state.visited.some(v=>v.url===url)){show('TV pilot: already captured this series.');return true;}
    const entry=state.entries.find(x=>x.url===url);
    const audit=tvSeriesSnapshot(document,url,entry);
    if(!audit.valid){
      tvPause('TV pilot paused before saving '+(entry?.title||url)+': '+
        JSON.stringify(audit.issues.slice(0,3)),true);return false;
    }
    const stagedTv=tvStage();
    const merged=mergeTvStage(stagedTv,audit.items,url);
    if(merged.error){tvPause('TV scan paused: '+merged.error,true);return false;}
    if(merged.added!==audit.items.length){
      tvPause('TV scan paused: '+entry.title+' source-list accounting mismatch; saved TV progress preserved.',true);return false;
    }
    GM_setValue(TV_STAGE_KEY,merged.stage);
    const visited=[...state.visited,{url,title:entry.title,expected:entry.count,
      accepted:audit.items.length,coverage:audit.coverage}];
    GM_setValue(TV_GUIDE_KEY,{...state,visited,failed:null});
    const counts=tvCounts();
    const coverage=audit.coverage;
    const diagnostics=[];
    if(coverage.missingSeasons.length)diagnostics.push('unrepresented season numbers '+coverage.missingSeasons.join(','));
    if(coverage.episodeZeroSeasons.length)diagnostics.push('episode 00 in season '+coverage.episodeZeroSeasons.join(','));
    if(coverage.missingWithinSeasons.length)diagnostics.push('gaps within listed seasons');
    if(merged.newSharedArticleUrls.length)diagnostics.push(merged.newSharedArticleUrls.length+
      ' article URL(s) also listed by earlier series (e.g. '+
      merged.newSharedArticleUrls[0]+'); both series references flagged for review');
    if(audit.reviewable.length)diagnostics.push(audit.reviewable.length+
      ' source-listed episode article(s) need identity review (e.g. cross-category article URLs)');
    show('TV '+(state.mode==='full'?'archive':'pilot')+' captured '+entry.title+': '+audit.items.length+'/'+entry.count+
      ' source-listed episode URLs. Progress '+visited.length+'/'+state.queue.length+
      ' series; TV stage '+counts.series+' series and '+counts.episodes+
      ' episodes.'+(diagnostics.length?' Numbering observations only: '+diagnostics.join('; '):'')+
      '. No transcript text downloaded.');
    return true;
  }
  function tvSchedule(){
    if(tvTimer!==null){clearTimeout(tvTimer);tvTimer=null;}
    const state=tvState();
    if(!state.active||!state.auto||!isTvPilot)return;
    const here=canonicalUrl(location.href,location.href);
    if(type==='tv-series-page'&&!state.visited.some(v=>v.url===here)){
      tvPause('TV auto pilot stopped: current index has not been validated.',true);return;
    }
    const next=tvNext();
    if(!next){
      if(state.mode==='full'){
        const coverage=tvFullCoverage(state,tvStage());
        if(coverage.complete)tvPause('Full TV archive index scan complete: 328 series pages, 3,332 source-listed episode references ('+
          coverage.uniqueEpisodes+' distinct article URLs; '+coverage.sharedArticleUrls+
          ' shared across series). No transcript bodies or cloud writes. Download the batch files and manifest for review.');
        else tvPause('Full TV scan reached the end, but reconciliation failed: '+
          JSON.stringify(coverage)+'. Retain all data for diagnosis.',true);
      }else if(state.visited.length===3 && state.visited.reduce((n,v)=>n+v.accepted,0)===47){
        tvPause('TV pilot complete: 3 validated series indexes, 47 linked episode URLs, and the 328-series directory snapshot. No cloud import. Download TV pilot JSON for audit.');
      }else tvPause('TV pilot ended without exact 3-series / 47-episode reconciliation.',true);
      return;
    }
    const delay=Math.max(TV_MIN_DELAY_MS,Number(state.delayMs)||TV_MIN_DELAY_MS);
    if(delay>120000){tvPause('TV pilot stopped: invalid pacing.',true);return;}
    show('TV '+(state.mode==='full'?'archive':'pilot')+' auto-navigation: '+state.visited.length+'/'+state.queue.length+' series done. Next: '+
      (state.entries.find(x=>x.url===next)?.title||next)+
      ' after '+Math.ceil(delay/1000)+' seconds. Pause TV pilot to stop.');
    tvTimer=setTimeout(()=>{
      tvTimer=null;
      const fresh=tvState();
      if(!fresh.active||!fresh.auto||tvNext()!==next)return;
      window.location.assign(next);
    },delay);
  }
  async function tvAutoStart(){
    const state=tvState();
    if(!state.entries?.length || !state.active){show('Prepare or resume the TV pilot first.');return;}
    if(type==='tv-series-page'&&!state.visited.some(v=>v.url===canonicalUrl(location.href,location.href))){
      show('Capture the current series index successfully before starting auto-navigation.');return;
    }
    if(!window.confirm('Enable paced automatic navigation through '+state.queue.length+' TV series indexes? Confirm you have checked Scraps terms. No transcript articles or bodies are fetched. The scan may require keeping this tab open for more than an hour.'))return;
    show('TV pilot: verifying robots.txt from your browser...');
    let policy;
    try{
      const r=await fetch('/robots.txt',{credentials:'same-origin',cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const robotsText=await r.text();
      const targets=[...new Set((state.queue||[]).map(url=>new URL(url).pathname))];
      const checks=targets.map(path=>({path,policy:robotsMovieArchivePolicy(robotsText,path,TV_MIN_DELAY_MS)}));
      const blocked=checks.find(c=>!c.policy.allowed);
      if(blocked){
        tvPause('TV archive automation blocked by robots.txt for '+blocked.path+
          ': '+blocked.policy.reason,true);return;
      }
      const delay=Math.max(TV_MIN_DELAY_MS,...checks.map(c=>c.policy.delayMs||TV_MIN_DELAY_MS));
      policy={allowed:true,delayMs:delay};
    }catch(e){tvPause('TV pilot automation blocked: cannot verify robots.txt ('+e.message+').',true);return;}
    if(!policy.allowed){tvPause('TV pilot automation blocked: '+policy.reason,true);return;}
    GM_setValue(TV_GUIDE_KEY,{...tvState(),active:true,auto:true,delayMs:policy.delayMs,failed:null});
    tvSchedule();
  }
  if(isTvPilot){
    if(type==='tv-archive')button('Prepare 3-series TV pilot',()=>{
      const audit=tvDirectorySnapshot(document);
      if(!audit.valid){show('TV directory validation failed. No data saved: '+JSON.stringify(audit.issues.slice(0,3)));return;}
      const picked=TV_PILOT_SLUGS.map(slug=>audit.entries.find(x=>x.url.endsWith('/'+slug+'/')));
      if(picked.some(x=>!x)||picked.reduce((n,x)=>n+x.count,0)!==47){
        show('TV pilot source series counts/URLs changed. Do not start: '+JSON.stringify(picked));return;
      }
      if(tvState().queue?.length && !window.confirm('Restart ONLY the independent TV pilot data? Existing movie capture and catalog are not touched.'))return;
      const stage=mergeTvStage(null,audit.items,location.href).stage;
      GM_setValue(TV_STAGE_KEY,stage);
      GM_setValue(TV_GUIDE_KEY,{active:true,auto:false,mode:'pilot',queue:picked.map(x=>x.url),
        entries:audit.entries,visited:[],directoryTotal:audit.expectedEpisodes,failed:null});
      show('TV pilot prepared: all 328 source series-index URLs recorded, with 3,332 advertised episodes. Three pilot targets: 3 Body Problem (8), American Gods (2), The Bear (37). Choose Scan next TV series or Auto scan TV pilot.');
    });
    button('Resume TV scan',()=>{
      const state=tvState();
      if(!state.queue?.length){show('Prepare the TV pilot on the main TV directory first.');return;}
      GM_setValue(TV_GUIDE_KEY,{...state,active:true,auto:false,failed:null});
      if(type==='tv-series-page')tvScanCurrent();
      else show('TV '+(state.mode==='full'?'archive':'pilot')+' resumed. Choose Scan next TV series or automatic navigation.');
    });
    button('Scan next TV series ↗',()=>{
      const state=tvState();
      if(!state.active){show('Prepare or resume TV pilot first.');return;}
      const here=canonicalUrl(location.href,location.href);
      if(type==='tv-series-page'&&!state.visited.some(v=>v.url===here)){
        show('Validate this index before advancing.');return;
      }
      const next=tvNext();
      if(!next){show('No pilot series remain. Download the TV pilot JSON.');return;}
      window.location.assign(next);
    });
    button('Auto scan TV pilot / archive',()=>{void tvAutoStart();});
    button('Expand pilot to all 328 series',()=>{
      const state=tvState(),stage=tvStage();
      const audit=tvPilotExpansionAudit(state,stage);
      if(!audit.valid){
        show('TV scan expansion paused for data safety: '+audit.issues.join('; ')+
          '. No saved metadata was cleared.');return;
      }
      if(!window.confirm('Expand the validated TV pilot to all 328 series? The original 3 series, 47 episodes and complete movie scan will be preserved. No transcript bodies or catalog imports.'))return;
      const queue=state.entries.map(entry=>entry.url);
      GM_setValue(TV_GUIDE_KEY,{...state,mode:'full',queue,active:true,auto:false,
        exportCursor:0,failed:null});
      show('TV archive queue expanded to 328 index pages. Three verified pilot pages and 47 episodes retained.'+
        (audit.legacyMode?' Successfully migrated the alpha.7 pilot state.':'')+
        ' Choose Auto scan TV pilot / archive to continue through the remaining 325 indexes.');
    });
    button('Pause TV scan',()=>tvPause('TV scan paused; all inspected series and discovered URLs preserved.'));

    button('Download next TV archive batch',()=>{
      const state=tvState(),stage=tvStage();
      const coverage=tvFullCoverage(state,stage);
      if(state.mode!=='full'||!coverage.complete){
        show('TV archive batch export requires all 328 indexes and 3,332 episode URLs to reconcile. Current: '+
          coverage.visited+'/328 indexes and '+coverage.episodes+'/3,332 episodes.');return;
      }
      let batches;
      try{batches=tvImportBatches(stage.items,600)}
      catch(e){show('TV archive export blocked: '+e.message);return;}
      const cursor=Number(state.exportCursor)||0;
      if(cursor>=batches.length){
        show('All '+batches.length+' TV archive batches already downloaded in this browser. Retain the originals, or reset the batch cursor to download again.');return;
      }
      const batch=batches[cursor];
      const documentData={format:'cinema-decoder-source-discovery-preview-v1',
        version:2,sourceId:SOURCE_ID,exportedAt:new Date().toISOString(),
        publicationApproved:false,pages:batch.pages,items:batch.items};
      const json=JSON.stringify(documentData,null,2),bytes=new TextEncoder().encode(json).length;
      if(bytes>2*1024*1024||batch.items.length>750){
        show('TV batch '+batch.index+' exceeds the 2 MB / 750-item safety cap. No data exported.');return;
      }
      const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;
      a.download='cinema-scraps-tv-archive-batch-'+
        String(batch.index).padStart(2,'0')+'-of-'+
        String(batch.total).padStart(2,'0')+'.json';
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
      GM_setValue(TV_GUIDE_KEY,{...state,exportCursor:cursor+1});
      show('Downloaded TV archive batch '+batch.index+'/'+batch.total+
        ': '+batch.items.length+' index/episode source URLs ('+bytes+
        ' bytes). Click Download next TV archive batch again for the next file. Not imported.');
    });
    button('Copy TV archive manifest',()=>{
      const state=tvState(),stage=tvStage(),coverage=tvFullCoverage(state,stage);
      if(state.mode!=='full'||!coverage.complete){
        show('TV manifest requires fully reconciled index scan, not a partial capture.');return;
      }
      let batches;
      try{batches=tvImportBatches(stage.items,600)}
      catch(e){show('TV manifest blocked: '+e.message);return;}
      const manifest={sourceId:SOURCE_ID,sourceDirectory:'https://scrapsfromtheloft.com/tv-series-transcripts/',
        scanStatus:'source-index-reconciled-content-not-verified',at:new Date().toISOString(),
        series:coverage.series,episodes:coverage.episodes,uniqueEpisodeArticleUrls:coverage.uniqueEpisodes,
        crossSeriesSharedArticleUrls:coverage.sharedArticleUrls,
        visitedIndexes:coverage.visited,
        total:batches.length,imported:false,
        batches:batches.map(batch=>({part:batch.index,of:batch.total,items:batch.items.length,
          file:'cinema-scraps-tv-archive-batch-'+String(batch.index).padStart(2,'0')+
            '-of-'+String(batch.total).padStart(2,'0')+'.json',
          series:batch.items.filter(x=>x.workType==='series').length,
          episodes:batch.items.filter(x=>x.workType==='episode').length}))};
      try{
        GM_setClipboard(JSON.stringify(manifest,null,2),'text');
        show('Copied complete TV archive manifest: '+batches.length+
          ' batches, 328 series, 3,332 episodes. Source metadata only. Paste it into Cinema Decoder chat with the batch files.');
      }catch(e){show('Unable to copy TV manifest: '+e.message);}
    });
    button('Restart TV batch downloads',()=>{
      const state=tvState();
      if(state.mode!=='full')return;
      if(!window.confirm('Reset only the TV export batch cursor to batch 1? No scans or staged links will be deleted.'))return;
      GM_setValue(TV_GUIDE_KEY,{...state,exportCursor:0});
      show('TV export batch cursor reset to 1. All saved source and movie metadata preserved.');
    });

    button('Download TV pilot JSON',()=>{
      const state=tvState(),stage=tvStage();
      if(!state.queue?.length||!stage.items.length){show('Nothing to export. Prepare TV pilot first.');return;}
      const json=JSON.stringify({format:'cinema-decoder-source-discovery-preview-v1',
        version:2,sourceId:SOURCE_ID,exportedAt:new Date().toISOString(),
        publicationApproved:false,pages:stage.pages,items:stage.items},null,2);
      if(stage.items.length>1500||new TextEncoder().encode(json).length>2*1024*1024){
        show('TV pilot JSON exceeds staging import limits. Do not import; request split export.');return;
      }
      const blob=new Blob([json],{type:'application/json'}),url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='cinema-scraps-tv-3-series-pilot.json';
      document.body.append(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),2000);
      show('TV pilot metadata exported ('+stage.items.length+' links). Not approved or imported.');
    });
  }

  const manualDiscovery=button('Discover visible titles', () => {
    const links = type === 'film' && filmArchiveLocation(location.href) ? filmArchiveListedLinks(document) : type === 'spoiler-article' ? [{
      href:location.href,
      text:collapse(document.querySelector('main h1, h1.entry-title, h1')?.textContent),
      contextTitle:collapse(document.title)
    }] : pageLinks();
    const currentPage = IS_SPOILER ? spoilerCanonicalUrl(location.href, location.href) : canonicalUrl(location.href, location.href);
    const matchingSeries = type === 'tv-series-page'
      ? staged().items.find(x => x.workType === 'series' && x.canonicalUrl === currentPage)
      : null;
    const heading = document.querySelector('main h1, h1.entry-title, .entry-header h1');
    const fallbackSeries = heading ? cleanTitle(heading.textContent).replace(/\s*[-–—|:]\s*(?:TV\s+)?(?:Series\s+)?Transcripts?\s*$/i, '').trim() : null;
    const parentSeriesTitle = type === 'tv-series-page'
      ? (matchingSeries ? matchingSeries.articleTitle : fallbackSeries || null) : null;
    const result = IS_SPOILER ? extractSpoilerCandidates(links,type,location.href) : extractCandidates(links, type, location.href, parentSeriesTitle);
    if (result.truncated || result.items.length === 0) {
      show('WARNING: ' + (result.truncated ? 'Page link safety cap reached. ' : '') +
        (result.items.length ? '' : (IS_SPOILER ? 'No qualifying linked movie plots found on this page. Check the actual listing markup. ' : 'No qualifying transcript article links found. Layout may be unsupported. ')) +
        'Nothing staged.');
      return;
    }
    const merged = mergeStage(staged(), result.items, location.href);
    GM_setValue(STORAGE_KEY, merged.stage);
    let diagnostic = '';
    if (type === 'tv-series-page') {
      const coverage = seriesCoverage(merged.stage.items, currentPage);
      const notices = [];
      if (coverage.missingSeasons.length) {
        notices.push('unrepresented season(s): ' + coverage.missingSeasons.map(n => 'S' + String(n).padStart(2,'0')).join(', '));
      }
      if (coverage.episodeZeroSeasons.length) {
        notices.push('episode 00 notation in: ' + coverage.episodeZeroSeasons.map(n => 'S' + String(n).padStart(2,'0')).join(', '));
      }
      if (coverage.missingWithinSeasons.length) {
        notices.push('other gaps in observed season sequences');
      }
      if (coverage.unnumbered) notices.push(coverage.unnumbered + ' unnumbered episode link(s)');
      if (notices.length) diagnostic = '\nCoverage hints (not proof of missing material): ' + notices.join('; ') + '.';
    }
    show('Page discovered: ' + result.items.length + ' distinct source links; ' + merged.added +
      ' newly staged; ' + result.duplicates + ' duplicate links. Preview is not a completeness check.' + diagnostic);
  });

  if(isTvPilot)manualDiscovery.textContent='Discover titles (legacy stage)';
  if(isGuidedFilm)button('Copy scan diagnostics',()=>{
    const state=guideState(),failed=state.failed;
    const current=canonicalUrl(location.href,location.href);
    const links=filmArchiveListedLinks(document);
    const audit=filmArchiveExtractionAudit(links,location.href);
    const summary=document.querySelector('.results-summary')?.textContent||'';
    const details={source:'Scraps movie archive',page:current,
      reportedSummary:summary,listed:audit.listed,accepted:audit.accepted,
      rejected:audit.rejected,duplicateUrls:audit.duplicateUrls,
      exceptions:audit.issues,pausedReason:failed?.reason||null,
      pageWasSaved:state.visited.some(v=>v.url===current)};
    try{
      GM_setClipboard(JSON.stringify(details,null,2),'text');
      show('Copied current-page extraction diagnostics (titles and URLs only). No article text or cookies included.');
    }catch{
      show('Could not copy diagnostics. Try reloading and click Start / resume movie scan for the first rejected title.');
    }
  });

  if(isGuidedFilm)button('Download movie archive JSON',()=>{
    const saved=staged();
    const films=saved.items.filter(item=>item.workType==='film');
    const pages=(saved.pages||[]).filter(url=>filmArchiveLocation(url));
    if(!films.length){show('No movie catalog links staged yet.');return;}
    const json=JSON.stringify({
      format:'cinema-decoder-source-discovery-preview-v1',
      version:2,sourceId:SOURCE_ID,exportedAt:new Date().toISOString(),
      publicationApproved:false,pages,items:films
    },null,2);
    if(new TextEncoder().encode(json).length>2*1024*1024||films.length>1500){
      show('Movie export exceeds staging import limits. Split by letters before uploading.');return;
    }
    const blob=new Blob([json],{type:'application/json'});
    const u=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=u;
    a.download='cinema-scraps-movie-archive-discovery.json';
    document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),2000);
    show('Exported '+films.length+' staged film links only. Existing TV links untouched. No cloud changes.');
  });

  const legacyCopy=button('Copy staged JSON', () => {
    const items = staged().items || [];
    if (!items.length) { show('Nothing staged to copy.'); return; }
    try {
      GM_setClipboard(JSON.stringify({
        format: 'cinema-decoder-source-discovery-preview-v1', sourceId: SOURCE_ID,
        exportedAt: new Date().toISOString(), publicationApproved: false, ...staged()
      }, null, 2), 'text');
      show('Staged metadata JSON copied. It is NOT an approved import.');
    } catch {
      show('Clipboard failed. Try Download JSON.');
    }
  });

  const legacyExport=button('Download JSON', () => {
    const saved = staged();
    if (!saved.items || !saved.items.length) { show('Nothing staged to download.'); return; }
    const json = JSON.stringify({
      format: 'cinema-decoder-source-discovery-preview-v1', sourceId: SOURCE_ID,
      exportedAt: new Date().toISOString(), publicationApproved: false, ...saved
    }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = IS_SPOILER ? 'cinema-movie-spoiler-preview.json' : 'cinema-source-discovery-preview.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    show('Exported local preview JSON. No cloud changes were made.');
  });

  const legacyClear=button('Clear staged', () => {
    if (!window.confirm('Clear locally staged '+(IS_SPOILER?'The Movie Spoiler plot links':'Scraps movie and TV source links')+(IS_SPOILER?'?':' and reset the saved guided movie scan progress?') )) return;
    cancelAutoTimer();
    if(!IS_SPOILER)GM_deleteValue(MOVIE_GUIDE_KEY);
    GM_deleteValue(STORAGE_KEY);
    show('Local staging cleared.');
  });

  if(isTvPilot){
    legacyCopy.textContent='Copy legacy JSON';
    legacyExport.textContent='Download legacy JSON';
    legacyClear.textContent='Clear legacy staged (movies too)';
    button('Reset TV pilot only',()=>{
      if(!window.confirm('Reset ONLY the TV pilot series indexes and its episode progress? Movie data and cloud catalog stay unchanged.'))return;
      if(tvTimer!==null){clearTimeout(tvTimer);tvTimer=null;}
      GM_deleteValue(TV_GUIDE_KEY);GM_deleteValue(TV_STAGE_KEY);
      show('Separate TV pilot cleared; legacy movie stage and catalog untouched.');
    });
  }
  const close = button('Hide', () => panel.remove());
  close.style.background = '#57606a';
  panel.append(heading, subtitle, info, actions, status, preview);
  document.body.append(panel);
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Source Discovery: show panel', () => {
      if (!panel.isConnected) document.body.append(panel);
    });
  }
  show(IS_SPOILER ? 'Ready for manual scans of The Movie Spoiler home, search, genre and movie pages. Plot availability remains unverified until reviewed.' : isTvPilot ? 'TV pilot ready. Open the unfiltered TV directory and click Prepare 3-series TV pilot; existing movie capture is separate.' : 'Ready. For movies use Start / resume movie scan, then Scan next listing.');
  if(isTvPilot && type==='tv-series-page' && tvState().active){
    const valid=tvScanCurrent();
    if(valid && tvState().auto)tvSchedule();
  }
  if(isTvPilot && type==='tv-archive' && tvState().active && tvState().auto)tvSchedule();
  if(isGuidedFilm && guideState().active){
    scanGuidedMoviePage();
    if(guideState().auto)scheduleAutoListing();
  }else if(isGuidedFilm && guideState().failed?.url===canonicalUrl(location.href,location.href)){
    show('Previous scan paused on this page. Click Start / resume movie scan to retry and identify the rejected card, or Copy scan diagnostics for the full exception report.');
  }
})();