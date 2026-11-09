// Spotify-style player bar for YouTube Music.
// Runs in the page (MAIN world) so DOM moves go through YouTube Music's own
// ShadyDOM layer. Only rearranges existing controls; YouTube Music keeps
// handling every click itself.
(() => {
  'use strict';
  if (window.__spotbarLayout) return;
  window.__spotbarLayout = true;

  const html = document.documentElement;
  const ACTIVE = 'data-spotbar-active';
  const NS = 'http://www.w3.org/2000/svg';
  const TAB_QUEUE = 0;   // player page tabs: Up next, Lyrics, (Comments), Related
  const TAB_LYRICS = 1;

  let moved = [];        // [{ node, parent, next }] in the order they were moved
  let created = [];      // nodes we added
  let timeObserver = null;
  let refs = null;

  // ───────── helpers ─────────
  function svgIcon(paths) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    for (const d of paths) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', d);
      svg.appendChild(p);
    }
    return svg;
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function move(node, parent, before) {
    if (!node || !parent) return;
    if (node.parentNode === parent && node.nextSibling === (before || null)) return;
    if (!moved.some((m) => m.node === node)) moved.push({ node, parent: node.parentNode, next: node.nextSibling });
    parent.insertBefore(node, before || null);
  }

  function wanted() {
    return html.getAttribute('data-spotbar') !== 'off' && !document.fullscreenElement;
  }

  // ───────── player page (lyrics / queue) ─────────
  function layoutEl() { return document.querySelector('ytmusic-app-layout'); }
  function playerPageOpen() {
    const l = layoutEl();
    if (!l) return false;
    if (l.hasAttribute('player-page-open')) return true;
    if (l.hasAttribute('player-page-open_')) return true;
    return l.playerPageOpen_ === true || l.playerPageOpen === true;
  }
  function pageTabs() { return [...document.querySelectorAll('ytmusic-player-page tp-yt-paper-tab')]; }
  function selectedTab() {
    return pageTabs().findIndex((t) => t.getAttribute('aria-selected') === 'true' || t.classList.contains('iron-selected'));
  }

  async function showTab(index) {
    const toggle = document.querySelector('ytmusic-player-bar .toggle-player-page-button');
    if (playerPageOpen() && selectedTab() === index) { toggle && toggle.click(); return; }
    if (!playerPageOpen() && toggle) toggle.click();
    for (let i = 0; i < 30; i++) {
      const tab = pageTabs()[index];
      if (tab && playerPageOpen()) {
        if (tab.getAttribute('aria-disabled') !== 'true') tab.click();
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    setTimeout(syncExtras, 150);
  }

  function syncExtras() {
    if (!refs) return;
    const open = playerPageOpen();
    const sel = open ? selectedTab() : -1;
    refs.lyrics.classList.toggle('spotbar-on', sel === TAB_LYRICS);
    refs.queue.classList.toggle('spotbar-on', sel === TAB_QUEUE);
    refs.lyrics.setAttribute('aria-pressed', String(sel === TAB_LYRICS));
    refs.queue.setAttribute('aria-pressed', String(sel === TAB_QUEUE));
  }

  function extraButton(label, cls, paths, tab) {
    const b = el('button', 'spotbar-btn ' + cls);
    b.type = 'button';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-pressed', 'false');
    b.appendChild(svgIcon(paths));
    b.addEventListener('click', (e) => { e.stopPropagation(); showTab(tab); });
    return b;
  }

  // ───────── time display ─────────
  function updateTime() {
    if (!refs) return;
    const raw = (refs.timeInfo.textContent || '').replace(/\s+/g, ' ').trim();
    const i = raw.indexOf('/');
    refs.elapsed.textContent = i >= 0 ? raw.slice(0, i).trim() : raw;
    refs.total.textContent = i >= 0 ? raw.slice(i + 1).trim() : '';
  }

  // ───────── apply / undo ─────────
  function apply() {
    const bar = document.querySelector('ytmusic-player-bar');
    if (!bar) return false;
    const leftControls = bar.querySelector('#left-controls');
    const playButtons = bar.querySelector('.left-controls-buttons');
    const rightControls = bar.querySelector('#right-controls');
    const progress = bar.querySelector('#progress-bar');
    const timeInfo = bar.querySelector('.time-info');
    if (!leftControls || !playButtons || !rightControls || !progress || !timeInfo) return false;

    // Shuffle and repeat go either side of previous / play / next.
    move(bar.querySelector('yt-icon-button.shuffle'), playButtons, playButtons.firstElementChild);
    move(bar.querySelector('yt-icon-button.repeat'), playButtons, null);

    // Seek bar row: elapsed | seek bar | total.
    let row = refs && refs.row && refs.row.isConnected ? refs.row : null;
    if (!row) {
      row = el('div', 'spotbar-row');
      const elapsed = el('span', 'spotbar-time spotbar-elapsed');
      const total = el('span', 'spotbar-time spotbar-total');
      row.append(elapsed, total);
      leftControls.insertBefore(row, playButtons.nextSibling);
      created.push(row);
      refs = Object.assign(refs || {}, { row, elapsed, total });
    }
    move(progress, row, refs.total);

    // Lyrics and queue buttons at the start of the right-hand group.
    let extras = refs.extras && refs.extras.isConnected ? refs.extras : null;
    if (!extras) {
      extras = el('div', 'spotbar-extras');
      const lyrics = extraButton('Lyrics', 'spotbar-lyrics', [
        'M8 1.75a2.25 2.25 0 0 0-2.25 2.25v3.5a2.25 2.25 0 0 0 4.5 0V4A2.25 2.25 0 0 0 8 1.75z',
        'M3.75 7.25a4.25 4.25 0 0 0 8.5 0',
        'M8 11.5v2.75',
      ], TAB_LYRICS);
      const queue = extraButton('Queue', 'spotbar-queue', [
        'M2 3.25h12', 'M2 7h12', 'M2 10.75h6', 'M11 9.75v4.5l3-2.25z',
      ], TAB_QUEUE);
      extras.append(lyrics, queue);
      rightControls.insertBefore(extras, rightControls.firstChild);
      created.push(extras);
      Object.assign(refs, { extras, lyrics, queue });
    }

    // Like, dislike, ⋮ and any buttons other extensions add next to them go to the right-hand
    // group, so the left side is just the album art, title and artist line.
    const actions = bar.querySelector('.middle-controls-buttons');
    if (actions && actions.parentNode !== rightControls) move(actions, rightControls, rightControls.firstChild);

    if (refs.timeInfo !== timeInfo) {
      if (timeObserver) timeObserver.disconnect();
      refs.timeInfo = timeInfo;
      timeObserver = new MutationObserver(updateTime);
      timeObserver.observe(timeInfo, { childList: true, subtree: true, characterData: true });
    }
    updateTime();
    syncExtras();
    html.setAttribute(ACTIVE, '');
    fitSides();
    return true;
  }

  // Both sides get the same width (at least 30%, more if the right-hand buttons need it),
  // so the play controls stay centred like Spotify's.
  function fitSides() {
    const bar = document.querySelector('ytmusic-player-bar');
    const rc = bar && bar.querySelector('#right-controls');
    if (!rc) return;
    let w = 0;
    for (const c of rc.children) {
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') continue;
      w += c.getBoundingClientRect().width + (parseFloat(cs.marginLeft) || 0) + (parseFloat(cs.marginRight) || 0);
    }
    const cs = getComputedStyle(rc);
    w += (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
    const value = Math.ceil(w) + 'px';
    if (bar.style.getPropertyValue('--sb-side-min') !== value) bar.style.setProperty('--sb-side-min', value);
  }

  function undo() {
    html.removeAttribute(ACTIVE);
    const bar = document.querySelector('ytmusic-player-bar');
    if (bar) bar.style.removeProperty('--sb-side-min');
    if (timeObserver) { timeObserver.disconnect(); timeObserver = null; }
    for (const m of moved.reverse()) {
      if (!m.parent.isConnected) continue;
      const next = m.next && m.next.parentNode === m.parent ? m.next : null;
      m.parent.insertBefore(m.node, next);
    }
    moved = [];
    for (const n of created) n.remove();
    created = [];
    refs = null;
  }

  function inPlace() {
    if (!refs || !refs.row || !refs.row.isConnected || !refs.extras || !refs.extras.isConnected) return false;
    const bar = document.querySelector('ytmusic-player-bar');
    const pb = bar && bar.querySelector('.left-controls-buttons');
    const prog = bar && bar.querySelector('#progress-bar');
    const shuf = bar && bar.querySelector('yt-icon-button.shuffle');
    const rep = bar && bar.querySelector('yt-icon-button.repeat');
    const acts = bar && bar.querySelector('.middle-controls-buttons');
    const rc = bar && bar.querySelector('#right-controls');
    return !!pb && (!shuf || shuf.parentNode === pb) && (!rep || rep.parentNode === pb) && (!!prog && prog.parentNode === refs.row) && (!acts || acts.parentNode === rc);
  }

  function sync() {
    if (wanted()) {
      if (!html.hasAttribute(ACTIVE) || !inPlace()) apply();
      else { syncExtras(); fitSides(); }
    } else if (html.hasAttribute(ACTIVE) || moved.length) {
      undo();
    }
  }

  // Clicking empty parts of the bar normally opens/closes the player page. Swallow those clicks so
  // only the album art (and the arrow button) does that. Buttons, sliders, links and anything
  // other extensions add keep working because they count as interactive.
  const INTERACTIVE = [
    'button', 'a', 'input', 'select', 'textarea', '[role="button"]', '[role="slider"]', '[contenteditable]',
    'yt-icon-button', 'yt-button-shape', 'tp-yt-paper-icon-button', 'tp-yt-paper-slider',
    'ytmusic-menu-renderer', 'ytmusic-like-button-renderer', 'ytmusic-toggle-button-renderer',
    'ytmusic-player-expanding-menu', 'ytmusic-playback-rate-renderer',
    '#progress-bar', '#volume-slider', '.thumbnail-image-wrapper', '.content-info-wrapper', '.spotbar-btn',
  ].join(',');
  function isBarBackground(target) {
    const bar = document.querySelector('ytmusic-player-bar');
    if (!bar || !(target instanceof Element) || !bar.contains(target)) return false;
    for (let n = target; n && n !== bar; n = n.parentElement) {
      if (n.matches && n.matches(INTERACTIVE)) return false;
    }
    return true;
  }
  function swallowBackground(e) {
    if (!html.hasAttribute(ACTIVE) || html.getAttribute('data-spotbar-artonly') === 'off') return;
    if (!isBarBackground(e.target)) return;
    e.stopPropagation();
    if (e.type === 'click') e.preventDefault();
  }
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'click']) {
    window.addEventListener(type, swallowBackground, true);
  }

  new MutationObserver(sync).observe(html, { attributes: true, attributeFilter: ['data-spotbar'] });
  document.addEventListener('fullscreenchange', sync);
  window.addEventListener('resize', () => { if (html.hasAttribute(ACTIVE)) fitSides(); });
  setInterval(sync, 1000);
  sync();

  window.__spotbar = { apply, undo, sync };
})();
