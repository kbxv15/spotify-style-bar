// Immersive video mode for YouTube Music's player page.
// - Song/Video switch moves to the top bar
// - videos fill the whole player page (songs keep YouTube Music's album-art layout)
// - the Up next / Lyrics sidebar folds away to the right, floating over the video or beside it
// Runs in the page (MAIN world). Settings arrive as attributes on <html> from settings.js.
(() => {
  'use strict';
  if (window.__spotbarImmersive) return;
  window.__spotbarImmersive = true;

  const html = document.documentElement;
  const NS = 'http://www.w3.org/2000/svg';
  const STORE = 'spotbar.immersive.sidebar';
  const on = (attr) => html.getAttribute(attr) !== 'off';

  let sidebar = 'open';
  try { if (localStorage.getItem(STORE) === 'closed') sidebar = 'closed'; } catch {}
  html.setAttribute('data-sbi-sidebar', sidebar);

  const appLayout = () => document.querySelector('ytmusic-app-layout');
  const playerPage = () => document.querySelector('ytmusic-player-page');
  const pageOpen = () => { const l = appLayout(); return !!l && l.hasAttribute('player-page-open'); };
  const videoMode = () => { const p = playerPage(); return !!p && p.hasAttribute('video-mode'); };

  // YouTube's player refits the picture to its box on a window resize.
  let resizeQueued = false;
  function refitVideo() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => { resizeQueued = false; window.dispatchEvent(new Event('resize')); });
  }

  // ───────── sidebar handle ─────────
  let handle = null;
  function makeHandle() {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sbi-handle';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', 'M6 3.5 10.5 8 6 12.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    b.appendChild(svg);
    b.addEventListener('click', (e) => { e.stopPropagation(); toggleSidebar(); });
    return b;
  }
  function labelHandle() {
    if (!handle) return;
    const t = sidebar === 'open' ? 'Hide sidebar' : 'Show sidebar';
    handle.title = t;
    handle.setAttribute('aria-label', t);
    handle.setAttribute('aria-expanded', String(sidebar === 'open'));
  }
  function ensureHandle() {
    const content = document.querySelector('ytmusic-player-page .content');
    if (!content) return;
    if (!handle) handle = makeHandle();
    if (handle.parentNode !== content) content.appendChild(handle);
    labelHandle();
  }
  function toggleSidebar(force) {
    sidebar = force || (sidebar === 'open' ? 'closed' : 'open');
    html.setAttribute('data-sbi-sidebar', sidebar);
    try { localStorage.setItem(STORE, sidebar); } catch {}
    labelHandle();
    setTimeout(refitVideo, 280);
  }

  // ───────── Song/Video switch in the top bar ─────────
  let avHome = null;
  function placeAvToggle(toTop) {
    const av = document.getElementById('av-id');
    const navCenter = document.querySelector('ytmusic-nav-bar .center-content');
    if (!av) return;
    if (toTop && navCenter) {
      if (av.parentNode === navCenter) return;
      avHome = { parent: av.parentNode, next: av.nextSibling };
      const search = navCenter.querySelector('ytmusic-search-box');
      navCenter.insertBefore(av, search ? search.nextSibling : navCenter.firstChild);
    } else if (!toTop && avHome && av.parentNode === navCenter && avHome.parent.isConnected) {
      const next = avHome.next && avHome.next.parentNode === avHome.parent ? avHome.next : avHome.parent.firstChild;
      avHome.parent.insertBefore(av, next);
      avHome = null;
    }
  }

  // ───────── main loop ─────────
  let observed = null;
  const ro = new ResizeObserver(() => { if (html.getAttribute('data-sbi') === 'on') refitVideo(); });

  function sync() {
    const enabled = on('data-spotbar-immersive');
    const open = pageOpen();
    const page = playerPage();
    const active = enabled && open && videoMode() && !document.fullscreenElement;

    html.setAttribute('data-sbi-page', enabled && open ? 'on' : 'off');
    html.setAttribute('data-sbi-av', page && page.hasAttribute('has-av-switcher') ? 'on' : 'off');
    placeAvToggle(enabled);

    const want = active ? 'on' : 'off';
    const was = html.getAttribute('data-sbi');
    if (was !== want) {
      html.setAttribute('data-sbi', want);
      if (was !== null || active) {
        setTimeout(refitVideo, 30);
        setTimeout(refitVideo, 350);
      }
    }
    if (active) {
      ensureHandle();
      const player = document.querySelector('ytmusic-player-page ytmusic-player');
      if (player && player !== observed) { if (observed) ro.unobserve(observed); ro.observe(player); observed = player; }
    }
  }

  new MutationObserver((records) => {
    sync();
    if (records.some((r) => r.attributeName === 'data-sbi-overlay')) setTimeout(refitVideo, 300);
  }).observe(html, { attributes: true, attributeFilter: ['data-spotbar-immersive', 'data-sbi-overlay'] });
  html.addEventListener('transitionend', (e) => {
    const id = e.target && e.target.id;
    if (id === 'side-panel' || id === 'main-panel') refitVideo();
  }, true);
  document.addEventListener('fullscreenchange', sync);
  setInterval(sync, 300);
  sync();

  window.__spotbarImmersiveApi = { sync, toggleSidebar };
})();
