// ==UserScript==
// @name         Cinema Decoder — Source Discovery (Research Build)
// @namespace    https://cinemadecoder.com/
// @version      0.1.0-alpha.1
// @description  Read-only metadata discovery on Scraps from the Loft movie and TV archives. No article fetches or publication.
// @author       Cinema Decoder
// @match        https://scrapsfromtheloft.com/movie-transcripts/*
// @match        https://www.scrapsfromtheloft.com/movie-transcripts/*
// @match        https://scrapsfromtheloft.com/tv-series-transcripts/*
// @match        https://www.scrapsfromtheloft.com/tv-series-transcripts/*
// @updateURL    https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/cinema-source-discovery-phase0/cinema-decoder-source-discovery.user.js
// @downloadURL  https://raw.githubusercontent.com/teddshapiro/swift-click-userscripts/cinema-source-discovery-phase0/cinema-decoder-source-discovery.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_setClipboard
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'cinema-source-discovery-staged-v1';
  const SOURCE_ID = 'scraps-from-the-loft';
  const SCRIPT_VERSION = '0.1.0-alpha.1';
  const LIMIT_PER_PAGE = 2000;
  const LIMIT_TOTAL = 15000;
  const VALID_HOSTS = new Set(['scrapsfromtheloft.com', 'www.scrapsfromtheloft.com']);

  function collapse(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 260);
  }

  function archiveKind(path) {
    if (/^\/movie-transcripts(?:\/|$)/i.test(path)) return 'film';
    if (/^\/tv-series-transcripts(?:\/|$)/i.test(path)) return 'episode';
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
      if (/^\/(?:tv-series|tv-series-transcripts)\/[^/]+\/?$/i.test(path)) return 'episode';
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

  function candidateFromLink(link, archiveType, pageUrl) {
    if (archiveType !== 'film' && archiveType !== 'episode') return null;
    const canonical = canonicalUrl(link.href, pageUrl);
    if (!canonical || resourceKind(canonical) !== archiveType) return null;
    const title = cleanTitle(link.contextTitle || link.text);
    const path = new URL(canonical).pathname;
    if (!/transcript/i.test(String(link.contextTitle || '') + ' ' + String(link.text || '') + ' ' + path)) return null;
    if (!title || /^(read more|continue reading|transcript)$/i.test(title)) return null;
    const filmYear = archiveType === 'film' ? title.match(/\(((?:19|20)\d{2})\)/) : null;
    const episode = archiveType === 'episode' ? episodeParts(title) : null;
    return {
      sourceId: SOURCE_ID,
      resourceType: 'dialogue-transcript',
      workType: archiveType,
      articleTitle: title,
      canonicalUrl: canonical,
      releaseYear: filmYear ? Number(filmYear[1]) : null,
      seriesTitle: episode ? episode.seriesTitle : null,
      seasonNumber: episode ? episode.seasonNumber : null,
      episodeNumber: episode ? episode.episodeNumber : null,
      episodeTitle: episode ? episode.episodeTitle : null,
      reviewStatus: archiveType === 'film'
        ? (filmYear ? 'candidate' : 'needs-year-review')
        : (episode.seriesTitle && episode.seasonNumber !== null ? 'candidate' : 'needs-episode-review'),
      foundOn: canonicalUrl(pageUrl, pageUrl),
      adapterVersion: SCRIPT_VERSION
    };
  }

  function extractCandidates(links, archiveType, pageUrl) {
    const items = [];
    const seen = new Set();
    let invalidOrUnrelated = 0;
    let duplicates = 0;
    for (const link of links.slice(0, LIMIT_PER_PAGE)) {
      const candidate = candidateFromLink(link, archiveType, pageUrl);
      if (!candidate) { invalidOrUnrelated += 1; continue; }
      if (seen.has(candidate.canonicalUrl)) { duplicates += 1; continue; }
      seen.add(candidate.canonicalUrl);
      items.push(candidate);
    }
    return { items, invalidOrUnrelated, duplicates, truncated: links.length > LIMIT_PER_PAGE };
  }

  function mergeStage(previous, incoming, pageUrl) {
    const prior = previous && previous.version === 1 && Array.isArray(previous.items)
      ? previous : { version: 1, items: [], pages: [] };
    const byUrl = new Map(prior.items.map(x => [x.canonicalUrl, x]));
    let added = 0;
    for (const entry of incoming) {
      if (byUrl.has(entry.canonicalUrl)) continue;
      if (byUrl.size >= LIMIT_TOTAL) break;
      byUrl.set(entry.canonicalUrl, { ...entry, firstSeenAt: new Date().toISOString() });
      added += 1;
    }
    const pages = Array.isArray(prior.pages) ? prior.pages.slice(0, 500) : [];
    const page = canonicalUrl(pageUrl, pageUrl);
    if (page && !pages.includes(page)) pages.push(page);
    return { stage: { version: 1, items: Array.from(byUrl.values()), pages }, added };
  }

  // Make the data-only functions testable without mounting UI or requiring Tampermonkey.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { archiveKind, canonicalUrl, resourceKind, cleanTitle, episodeParts, candidateFromLink, extractCandidates, mergeStage };
    return;
  }

  if (!VALID_HOSTS.has(location.hostname.toLowerCase())) return;
  const type = archiveKind(location.pathname);
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
  subtitle.textContent = (type === 'film' ? 'Movie' : 'TV episode') + ' archive · research build ' + SCRIPT_VERSION;
  subtitle.style.marginBottom = '9px';
  const info = document.createElement('div');
  info.textContent = 'Read-only: examines article links on this page. No article downloads and no cloud publication.';
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
    return GM_getValue(STORAGE_KEY, { version: 1, items: [], pages: [] });
  }

  function show(message) {
    const saved = staged();
    const items = Array.isArray(saved.items) ? saved.items : [];
    const film = items.filter(x => x.workType === 'film').length;
    const episodes = items.filter(x => x.workType === 'episode').length;
    const uncertain = items.filter(x => x.reviewStatus !== 'candidate').length;
    status.textContent = message + '\nStaged: ' + items.length + ' links (' + film + ' movies, ' + episodes +
      ' TV episodes). Review flags: ' + uncertain + '. Pages inspected: ' + (saved.pages || []).length + '.';
    preview.replaceChildren();
    for (const item of items.slice(-15).reverse()) {
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
      return { href: a.href, text: collapse(a.textContent), contextTitle: titleElement ? collapse(titleElement.textContent) : '' };
    });
  }

  button('Discover visible titles', () => {
    const links = pageLinks();
    const result = extractCandidates(links, type, location.href);
    if (result.truncated || result.items.length === 0) {
      show('WARNING: ' + (result.truncated ? 'Page link safety cap reached. ' : '') +
        (result.items.length ? '' : 'No qualifying transcript article links found. Layout may be unsupported. ') +
        'Nothing staged.');
      return;
    }
    const merged = mergeStage(staged(), result.items, location.href);
    GM_setValue(STORAGE_KEY, merged.stage);
    show('Page discovered: ' + result.items.length + ' distinct articles; ' + merged.added +
      ' newly staged; ' + result.duplicates + ' duplicate links. Preview is not a completeness check.');
  });

  button('Copy staged JSON', () => {
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

  button('Download JSON', () => {
    const saved = staged();
    if (!saved.items || !saved.items.length) { show('Nothing staged to download.'); return; }
    const json = JSON.stringify({
      format: 'cinema-decoder-source-discovery-preview-v1', sourceId: SOURCE_ID,
      exportedAt: new Date().toISOString(), publicationApproved: false, ...saved
    }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cinema-source-discovery-preview.json';
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    show('Exported local preview JSON. No cloud changes were made.');
  });

  button('Clear staged', () => {
    if (!window.confirm('Clear all locally staged movie and TV source links?')) return;
    GM_deleteValue(STORAGE_KEY);
    show('Local staging cleared.');
  });

  const close = button('Hide', () => panel.remove());
  close.style.background = '#57606a';
  panel.append(heading, subtitle, info, actions, status, preview);
  document.body.append(panel);
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Source Discovery: show panel', () => {
      if (!panel.isConnected) document.body.append(panel);
    });
  }
  show('Ready. Open archive pages manually and click Discover on each page.');
})();