// Song details popup: click the title/artist area of the player bar to see the full
// title, artists, album, plays/views, likes, length, release date and the artist.
// Runs in the page (MAIN world) to read YouTube Music's player data.
(() => {
  'use strict';
  if (window.__spotbarDetails) return;
  window.__spotbarDetails = true;

  const html = document.documentElement;
  const INFO = 'ytmusic-player-bar .content-info-wrapper';
  const enabled = () => html.hasAttribute('data-spotbar-active') && html.getAttribute('data-spotbar-details') !== 'off';

  // ───────── small helpers ─────────
  const txt = (t) => !t ? '' : typeof t === 'string' ? t : t.simpleText != null ? t.simpleText : t.content != null ? t.content : Array.isArray(t.runs) ? t.runs.map((r) => r.text).join('') : '';
  const pad = (n) => String(n).padStart(2, '0');
  const fmtNum = (n) => Number(n).toLocaleString();
  function fmtLength(s) {
    s = Math.round(Number(s) || 0);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function findAll(obj, key, out = []) {
    if (!obj || typeof obj !== 'object') return out;
    if (Array.isArray(obj)) { for (const x of obj) findAll(x, key, out); return out; }
    for (const k in obj) { if (k === key) out.push(obj[k]); else findAll(obj[k], key, out); }
    return out;
  }
  const findFirst = (obj, key) => findAll(obj, key)[0];
  function bestThumb(list, min) {
    if (!Array.isArray(list) || !list.length) return '';
    const s = [...list].sort((a, b) => (a.width || 0) - (b.width || 0));
    return (s.find((t) => (t.width || 0) >= min) || s[s.length - 1]).url || '';
  }
  function withTimeout(ms) { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; }

  function el(tag, cls, ...kids) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    for (const k of kids.flat()) if (k != null && k !== false && k !== '') e.append(k instanceof Node ? k : String(k));
    return e;
  }
  function img(cls, src) {
    const i = el('img', cls);
    i.alt = '';
    i.referrerPolicy = 'no-referrer';
    if (src) i.src = src;
    return i;
  }

  // ───────── reading the current song ─────────
  function playerResponse() {
    try {
      const mp = document.getElementById('movie_player');
      return mp && typeof mp.getPlayerResponse === 'function' ? mp.getPlayerResponse() : null;
    } catch { return null; }
  }
  function pageType(run) {
    const be = run && run.navigationEndpoint && run.navigationEndpoint.browseEndpoint;
    if (!be) return '';
    const pt = be.browseEndpointContextSupportedConfigs && be.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig && be.browseEndpointContextSupportedConfigs.browseEndpointContextMusicConfig.pageType;
    if (pt) return pt.replace('MUSIC_PAGE_TYPE_', '');
    if (/^UC/.test(be.browseId || '')) return 'ARTIST';
    if (/^MPRE/.test(be.browseId || '')) return 'ALBUM';
    return '';
  }

  function current() {
    const bar = document.querySelector('ytmusic-player-bar');
    const pr = playerResponse();
    const vd = pr && pr.videoDetails;
    if (!bar || !vd || !vd.videoId) return null;
    const mf = (pr.microformat && pr.microformat.microformatDataRenderer) || {};
    const titleEl = bar.querySelector('.content-info-wrapper .title');
    const bylineEl = bar.querySelector('.content-info-wrapper .byline');
    const runs = (bylineEl && bylineEl.text && Array.isArray(bylineEl.text.runs)) ? bylineEl.text.runs
      : (bylineEl ? bylineEl.textContent.split(' • ').flatMap((t, i) => i ? [{ text: ' • ' }, { text: t }] : [{ text: t }]) : []);

    // Byline is "Artists • Album • Year" for songs and "Artists • 38M views • 812K likes" for videos.
    const segments = [[]];
    for (const r of runs) {
      if (/^\s*•\s*$/.test(r.text)) segments.push([]);
      else segments[segments.length - 1].push(r);
    }
    const artists = [];
    for (const r of segments[0] || []) {
      const t = r.text.trim();
      if (!t || /^(,|&|and|x|×)$/i.test(t)) continue;
      const be = r.navigationEndpoint && r.navigationEndpoint.browseEndpoint;
      artists.push({ name: t, id: be ? be.browseId : null, endpoint: be ? r.navigationEndpoint : null });
    }
    let album = null, year = '', likesText = '', viewsText = '';
    for (const seg of segments.slice(1)) {
      const r = seg[0];
      if (!r) continue;
      const t = seg.map((x) => x.text).join('').trim();
      if (/ALBUM|AUDIOBOOK|PODCAST/.test(pageType(r))) album = { name: t, endpoint: r.navigationEndpoint };
      else if (/^\d{4}$/.test(t)) year = t;
      else if (/like/i.test(t)) likesText = t;
      else if (/view|play/i.test(t)) viewsText = t;
    }
    if (!artists.length && vd.author) artists.push({ name: vd.author.replace(/ - Topic$/, ''), id: vd.channelId || null, endpoint: null });

    const kinds = { ATV: 'Song', OMV: 'Music video', UGC: 'Video', PODCAST_EPISODE: 'Episode', OFFICIAL_SOURCE_MUSIC: 'Song' };
    const type = String(vd.musicVideoType || '').replace('MUSIC_VIDEO_TYPE_', '');
    const art = bar.querySelector('.thumbnail-image-wrapper img');
    let artSrc = art && art.src ? art.src : bestThumb(vd.thumbnail && vd.thumbnail.thumbnails, 120);
    artSrc = artSrc.replace(/=w\d+-h\d+/, '=w240-h240');

    return {
      videoId: vd.videoId,
      title: vd.title || (titleEl && (titleEl.getAttribute('title') || titleEl.textContent.trim())) || '',
      kind: kinds[type] || 'Song',
      isSong: type === 'ATV' || type === 'OFFICIAL_SOURCE_MUSIC',
      artists,
      album,
      year,
      views: vd.viewCount != null && vd.viewCount !== '' ? Number(vd.viewCount) : null,
      viewsText,
      likesText,
      length: Number(vd.lengthSeconds) || 0,
      live: !!vd.isLiveContent,
      uploaded: mf.publishDate || mf.uploadDate || '',
      ownerId: vd.channelId || '',
      art: artSrc,
    };
  }

  // ───────── extra data (cached per video / artist) ─────────
  const watchCache = new Map();
  const artistCache = new Map();

  function webClientVersion() {
    const d = new Date(Date.now() - 30 * 864e5);
    return `2.${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.00.00`;
  }

  // YouTube's own watch data has the exact like count and the uploading channel.
  function watchInfo(videoId) {
    if (!watchCache.has(videoId)) {
      watchCache.set(videoId, (async () => {
        const res = await fetch('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', {
          method: 'POST',
          credentials: 'omit',
          signal: withTimeout(10000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion: webClientVersion(), hl: 'en', gl: 'US' } }, videoId }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        let likes = null;
        (function walk(o) {
          if (likes != null || !o || typeof o !== 'object') return;
          for (const k in o) {
            const v = o[k];
            if (typeof v === 'string') {
              const m = v.match(/along with ([\d,]+) other/);
              if (m) { likes = Number(m[1].replace(/,/g, '')); return; }
            } else walk(v);
          }
        })(j);
        const vor = findFirst(j, 'videoOwnerRenderer');
        const owner = vor ? {
          name: txt(vor.title),
          id: (findFirst(vor.navigationEndpoint || vor.title, 'browseEndpoint') || {}).browseId || '',
          avatar: bestThumb(findFirst(vor.thumbnail, 'thumbnails'), 88),
          subs: txt(vor.subscriberCountText),
        } : null;
        return { likes, owner };
      })().catch(() => { watchCache.delete(videoId); return null; }));
    }
    return watchCache.get(videoId);
  }

  // The artist's YouTube Music page: photo, subscribers, monthly audience, bio.
  function artistInfo(id) {
    if (!artistCache.has(id)) {
      artistCache.set(id, (async () => {
        const get = (k) => window.ytcfg && (typeof ytcfg.get === 'function' ? ytcfg.get(k) : ytcfg.data_ && ytcfg.data_[k]);
        const res = await fetch('/youtubei/v1/browse?prettyPrint=false', {
          method: 'POST',
          signal: withTimeout(10000),
          headers: { 'Content-Type': 'application/json', 'X-Youtube-Client-Name': '67', 'X-Youtube-Client-Version': String(get('INNERTUBE_CLIENT_VERSION') || '1.20261101.01.00') },
          body: JSON.stringify({ context: get('INNERTUBE_CONTEXT') || { client: { clientName: 'WEB_REMIX', clientVersion: '1.20261101.01.00' } }, browseId: id }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        const h = j.header ? Object.values(j.header)[0] || {} : {};
        const sub = h.subscriptionButton && h.subscriptionButton.subscribeButtonRenderer;
        return {
          name: txt(h.title),
          banner: bestThumb(findFirst(h.thumbnail, 'thumbnails'), 720),
          avatar: bestThumb(findFirst(h.foregroundThumbnail, 'thumbnails'), 88),
          subs: sub ? txt(sub.subscriberCountText) || txt(sub.shortSubscriberCountText) : '',
          monthly: txt(h.monthlyListenerCount),
          bio: txt(h.description),
        };
      })().catch(() => { artistCache.delete(id); return null; }));
    }
    return artistCache.get(id);
  }

  // ───────── navigation inside YouTube Music (keeps the music playing) ─────────
  function navigate(endpoint) {
    const from = document.querySelector('ytmusic-player-bar') || document.body;
    from.dispatchEvent(new CustomEvent('yt-navigate', { bubbles: true, composed: true, detail: { endpoint } }));
  }

  // ───────── popup ─────────
  const STYLE = `
  #spotbar-details { position: fixed; z-index: 2147483000; left: 0; bottom: 0; width: 0; height: 0; font-family: inherit; }
  #spotbar-details[hidden] { display: none; }
  #spotbar-details .sbd-card {
    position: absolute; left: 0; bottom: 0; zoom: var(--sb-s, 1);
    width: 360px; box-sizing: border-box; max-height: var(--sbd-max, 600px); overflow-y: auto; overscroll-behavior: contain;
    padding: 16px; border-radius: 8px; background: #242424; color: #fff; border: 1px solid #2e2e2e;
    box-shadow: 0 16px 24px rgba(0,0,0,.35), 0 6px 8px rgba(0,0,0,.25);
    font-size: 14px; line-height: 1.4; text-align: left; scrollbar-width: thin; scrollbar-color: #555 transparent;
    animation: sbd-in .14s ease-out;
  }
  @keyframes sbd-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  #spotbar-details * { box-sizing: border-box; }
  #spotbar-details button { font: inherit; color: inherit; cursor: pointer; }
  #spotbar-details a { color: inherit; text-decoration: none; cursor: pointer; }
  #spotbar-details a:hover { text-decoration: underline; }
  #spotbar-details .sbd-close { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: #b3b3b3; font-size: 18px; line-height: 28px; padding: 0; }
  #spotbar-details .sbd-close:hover { background: #333; color: #fff; }
  #spotbar-details .sbd-track { display: flex; gap: 14px; align-items: flex-start; padding-right: 24px; }
  #spotbar-details .sbd-art { width: 72px; height: 72px; flex: none; border-radius: 6px; object-fit: cover; background: #333; box-shadow: 0 4px 12px rgba(0,0,0,.4); }
  #spotbar-details .sbd-meta { min-width: 0; flex: 1; }
  #spotbar-details .sbd-kind { color: #b3b3b3; font-size: 12px; margin-bottom: 2px; }
  #spotbar-details .sbd-title { font-size: 18px; line-height: 23px; font-weight: 700; word-break: break-word; margin: 0 0 4px; user-select: text; }
  #spotbar-details .sbd-artists { font-size: 14px; color: #fff; word-break: break-word; }
  #spotbar-details .sbd-album { font-size: 13px; color: #b3b3b3; margin-top: 2px; word-break: break-word; }
  #spotbar-details .sbd-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 14px 0 12px; border-radius: 8px; overflow: hidden; background: #2e2e2e; }
  #spotbar-details .sbd-stat { background: #1c1c1c; padding: 8px 12px; min-width: 0; }
  #spotbar-details .sbd-stat span { display: block; color: #b3b3b3; font-size: 11px; letter-spacing: .02em; }
  #spotbar-details .sbd-stat b { display: block; font-size: 15px; font-weight: 700; margin-top: 1px; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #spotbar-details .sbd-stat small { display: block; color: #8a8a8a; font-size: 11px; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  #spotbar-details .sbd-muted { color: #8a8a8a; font-weight: 400; }
  #spotbar-details .sbd-artist { border-radius: 8px; overflow: hidden; background: #1c1c1c; }
  #spotbar-details .sbd-banner { position: relative; height: 96px; background: #333; }
  #spotbar-details .sbd-banner img { width: 100%; height: 100%; object-fit: cover; object-position: center 30%; display: block; }
  #spotbar-details .sbd-banner::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,.45), rgba(0,0,0,0) 45%, rgba(28,28,28,.9)); }
  #spotbar-details .sbd-banner span { position: absolute; z-index: 1; top: 10px; left: 12px; font-size: 13px; font-weight: 700; text-shadow: 0 1px 3px rgba(0,0,0,.6); }
  #spotbar-details .sbd-artist-body { padding: 10px 12px 12px; }
  #spotbar-details .sbd-who { display: flex; align-items: center; gap: 10px; }
  #spotbar-details .sbd-avatar { width: 44px; height: 44px; flex: none; border-radius: 50%; object-fit: cover; background: #333; }
  #spotbar-details .sbd-who b { display: block; font-size: 15px; }
  #spotbar-details .sbd-who small { display: block; color: #b3b3b3; font-size: 12px; }
  #spotbar-details .sbd-bio { color: #b3b3b3; font-size: 13px; margin: 8px 0 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-line; }
  #spotbar-details .sbd-bio.open { -webkit-line-clamp: unset; display: block; }
  #spotbar-details .sbd-more { border: 0; background: none; padding: 0; margin-top: 4px; color: #fff; font-size: 12px; font-weight: 700; }
  #spotbar-details .sbd-actions { position: sticky; bottom: -16px; z-index: 2; display: flex; flex-wrap: wrap; gap: 6px; margin: 4px -16px -16px; padding: 12px 16px 16px; background: linear-gradient(to bottom, rgba(36,36,36,0), #242424 12px); }
  #spotbar-details .sbd-btn { height: 32px; padding: 0 12px; border-radius: 16px; border: 1px solid #727272; background: transparent; font-size: 12.5px; font-weight: 700; white-space: nowrap; }
  #spotbar-details .sbd-btn:hover { border-color: #fff; transform: scale(1.03); }
  #spotbar-details .sbd-btn.primary { background: #fff; color: #000; border-color: #fff; }
  #spotbar-details .sbd-skel { display: inline-block; width: 64px; height: 12px; border-radius: 6px; background: linear-gradient(90deg, #2a2a2a, #3a3a3a, #2a2a2a); background-size: 200% 100%; animation: sbd-sh 1.1s linear infinite; vertical-align: middle; }
  @keyframes sbd-sh { from { background-position: 100% 0; } to { background-position: -100% 0; } }
  #spotbar-details .sbd-caret { position: absolute; bottom: -6px; width: 12px; height: 12px; background: #242424; border-right: 1px solid #2e2e2e; border-bottom: 1px solid #2e2e2e; transform: rotate(45deg); zoom: var(--sb-s, 1); }
  #spotbar-details .sbd-empty { color: #b3b3b3; padding: 8px 0; }
  html[data-spotbar-active]:not([data-spotbar-details="off"]) ytmusic-player-bar .content-info-wrapper { cursor: pointer !important; }
  html[data-spotbar-active]:not([data-spotbar-details="off"]) ytmusic-player-bar .content-info-wrapper:hover .title { text-decoration: underline; }
  `;

  let root = null, card = null, caret = null, openFor = null, openKey = '', state = null;

  function ensureRoot() {
    if (root && root.isConnected) return;
    if (!document.getElementById('spotbar-details-style')) {
      const s = document.createElement('style');
      s.id = 'spotbar-details-style';
      s.textContent = STYLE;
      (document.head || html).appendChild(s);
    }
    root = el('div');
    root.id = 'spotbar-details';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Song details');
    card = el('div', 'sbd-card');
    caret = el('div', 'sbd-caret');
    root.append(card, caret);
    document.body.appendChild(root);
  }

  function scale() {
    const v = parseFloat(getComputedStyle(html).getPropertyValue('--sb-s'));
    return v > 0 ? v : 1;
  }

  function place() {
    const info = document.querySelector(INFO);
    const bar = document.querySelector('ytmusic-player-bar');
    if (!info || !bar || !root) return;
    const s = scale();
    const ir = info.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    const art = bar.querySelector('.thumbnail-image-wrapper');
    const ar = art ? art.getBoundingClientRect() : ir;
    const width = 360 * s;
    const left = Math.max(8, Math.min(ar.left, window.innerWidth - width - 8));
    const bottom = window.innerHeight - br.top + 10 * s;
    root.style.left = left + 'px';
    root.style.bottom = bottom + 'px';
    card.style.setProperty('--sbd-max', Math.max(200, (window.innerHeight - bottom - 16) / s) + 'px');
    caret.style.left = (Math.max(ir.left + 24 * s, left + 16 * s) - left) / s + 'px';
  }

  function stat(label, value, sub) {
    return el('div', 'sbd-stat', el('span', '', label), el('b', '', value), sub ? el('small', '', sub) : null);
  }
  const skel = () => el('i', 'sbd-skel');
  function link(text, endpoint) {
    if (!endpoint) return el('span', '', text);
    const a = el('a', '', text);
    a.href = '#';
    a.addEventListener('click', (e) => { e.preventDefault(); close(); navigate(endpoint); });
    return a;
  }

  function render() {
    const info = state && state.info;
    card.replaceChildren();
    const x = el('button', 'sbd-close', '×');
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', close);
    card.append(x);
    if (!info) {
      card.append(el('div', 'sbd-empty', 'Nothing is playing.'));
      return;
    }
    const w = state.watch;
    const a = state.artist;
    const mainArtist = info.artists.find((r) => r.id) || null;

    // Track
    const artistLinks = [];
    info.artists.forEach((r, i) => { if (i) artistLinks.push(i === info.artists.length - 1 ? ' & ' : ', '); artistLinks.push(link(r.name, r.endpoint)); });
    card.append(el('div', 'sbd-track',
      img('sbd-art', info.art),
      el('div', 'sbd-meta',
        el('div', 'sbd-kind', info.kind + (info.year ? ' · ' + info.year : '')),
        el('div', 'sbd-title', info.title),
        el('div', 'sbd-artists', artistLinks),
        info.album ? el('div', 'sbd-album', link(info.album.name, info.album.endpoint)) : null)));

    // Stats
    const likes = w === undefined ? skel() : w && w.likes != null ? fmtNum(w.likes) : (info.likesText ? info.likesText.replace(/\s*likes?$/i, '') : el('span', 'sbd-muted', 'Hidden'));
    const released = info.isSong && info.year ? info.year : info.uploaded ? fmtDate(info.uploaded) : '—';
    const releasedSub = info.isSong && info.year && info.uploaded ? 'On YouTube ' + fmtDate(info.uploaded) : '';
    card.append(el('div', 'sbd-stats',
      stat(info.isSong ? 'Plays' : 'Views', info.views != null ? fmtNum(info.views) : (info.viewsText || '—')),
      stat('Likes', likes),
      stat('Length', info.live ? 'Live' : fmtLength(info.length)),
      stat(info.isSong ? 'Released' : 'Uploaded', released, releasedSub)));

    // About the artist
    if (mainArtist) {
      const owner = w && w.owner;
      const ownerMatches = owner && (owner.id === mainArtist.id || owner.name === mainArtist.name || owner.name === mainArtist.name + ' - Topic');
      const avatar = (a && a.avatar) || (ownerMatches && owner.avatar) || '';
      const line = a ? [a.subs ? a.subs + ' subscribers' : (ownerMatches && owner.subs) || '', a.monthly].filter(Boolean).join(' · ') : '';
      const section = el('div', 'sbd-artist');
      if (a === undefined || (a && a.banner)) {
        const banner = el('div', 'sbd-banner', a && a.banner ? img('', a.banner) : null, el('span', '', 'About the artist'));
        section.append(banner);
      }
      const who = el('div', 'sbd-who',
        avatar ? img('sbd-avatar', avatar) : null,
        el('div', '', el('b', '', (a && a.name) || mainArtist.name), el('small', '', a === undefined ? skel() : line || '')));
      const body = el('div', 'sbd-artist-body', who);
      if (a && a.bio) {
        const bio = el('p', 'sbd-bio', a.bio);
        const more = el('button', 'sbd-more', 'Show more');
        more.addEventListener('click', () => { const open = bio.classList.toggle('open'); more.textContent = open ? 'Show less' : 'Show more'; });
        body.append(bio, more);
      }
      section.append(body);
      card.append(section);
    }

    // Actions
    const actions = el('div', 'sbd-actions');
    if (mainArtist && mainArtist.endpoint) {
      const b = el('button', 'sbd-btn primary', 'View artist');
      b.addEventListener('click', () => { close(); navigate(mainArtist.endpoint); });
      actions.append(b);
    }
    const yt = el('button', 'sbd-btn', 'Open on YouTube');
    yt.addEventListener('click', () => window.open('https://www.youtube.com/watch?v=' + encodeURIComponent(info.videoId), '_blank', 'noopener'));
    const copy = el('button', 'sbd-btn', 'Copy link');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText('https://music.youtube.com/watch?v=' + info.videoId); copy.textContent = 'Copied'; }
      catch { copy.textContent = 'Couldn’t copy'; }
      setTimeout(() => { copy.textContent = 'Copy link'; }, 1500);
    });
    actions.append(yt, copy);
    card.append(actions);
  }

  function songKey() {
    const pr = playerResponse();
    const id = pr && pr.videoDetails && pr.videoDetails.videoId;
    const info = document.querySelector(INFO);
    return (id || '') + '|' + (info ? info.textContent.replace(/\s+/g, ' ').trim() : '');
  }

  function load() {
    openKey = songKey();
    const info = current();
    state = { info, watch: undefined, artist: undefined };
    openFor = info ? info.videoId : null;
    render();
    place();
    if (!info) return;
    const id = info.videoId;
    watchInfo(id).then((w) => { if (state && openFor === id) { state.watch = w; render(); } });
    const main = info.artists.find((r) => r.id);
    if (main) artistInfo(main.id).then((a) => { if (state && openFor === id) { state.artist = a; render(); } });
    else state.artist = null;
  }

  function open() {
    ensureRoot();
    root.hidden = false;
    load();
  }
  function close() {
    if (root) root.hidden = true;
    state = null;
    openFor = null;
    openKey = '';
  }
  const isOpen = () => !!(root && !root.hidden);

  // Clicks on the title/artist area open the popup instead of YouTube Music's default action.
  const BLOCK = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'];
  function inInfo(e) { return e.target && e.target.closest && e.target.closest(INFO); }
  for (const type of BLOCK) {
    window.addEventListener(type, (e) => {
      if (!enabled() || !inInfo(e)) return;
      e.stopPropagation();
    }, true);
  }
  window.addEventListener('click', (e) => {
    if (!enabled()) return;
    if (inInfo(e)) {
      e.preventDefault();
      e.stopPropagation();
      if (isOpen()) close(); else open();
      return;
    }
    if (isOpen() && root && !root.contains(e.target)) close();
  }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isOpen()) { close(); e.stopPropagation(); } }, true);
  window.addEventListener('resize', () => { if (isOpen()) place(); });

  // Follow song changes while open; close if the layout or the feature is switched off.
  setInterval(() => {
    if (!isOpen()) return;
    if (!enabled()) { close(); return; }
    if (songKey() !== openKey) load();
    else place();
  }, 700);

  window.__spotbarDetailsApi = { open, close, current };
})();
