/* Niche Atlas — interactions */
(function () {
  'use strict';
  var d = document, root = d.documentElement, body = d.body;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ROOT = body.getAttribute('data-root') || './';

  /* ---------- image fallback ---------- */
  d.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.dataset.fb && t.getAttribute('src') !== t.dataset.fb) {
      t.src = t.dataset.fb;
    }
  }, true);

  /* ---------- top bar ---------- */
  var tb = $('.topbar');
  function onScroll() { if (tb) tb.classList.toggle('scrolled', window.scrollY > 8); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- drawer / palette ---------- */
  var guide = $('#guide'), scrim = $('#scrim'), pal = $('#palette'), pin = $('#pal-input'), plist = $('#pal-list');
  var lastFocus = null;
  function lock(on) { body.style.overflow = on ? 'hidden' : ''; }
  function openGuide() {
    lastFocus = d.activeElement;
    guide.classList.add('on'); scrim.classList.add('on');
    guide.setAttribute('aria-hidden', 'false'); lock(true);
    var c = $('.guide-head .icon-btn', guide); if (c) c.focus();
  }
  function closeAll() {
    var wasOpen = guide.classList.contains('on') || pal.classList.contains('on');
    guide.classList.remove('on'); scrim.classList.remove('on'); pal.classList.remove('on');
    guide.setAttribute('aria-hidden', 'true'); pal.setAttribute('aria-hidden', 'true'); lock(false);
    if (wasOpen && lastFocus && lastFocus.focus) lastFocus.focus();
  }
  $$('[data-open-guide]').forEach(function (b) { b.addEventListener('click', openGuide); });
  $$('[data-close]').forEach(function (b) { b.addEventListener('click', closeAll); });
  if (scrim) scrim.addEventListener('click', closeAll);
  $$('.guide a').forEach(function (a) { a.addEventListener('click', function () { if (a.getAttribute('href').indexOf('#') > -1) closeAll(); }); });

  var data = [];
  try { data = JSON.parse($('#niche-data').textContent); } catch (e) { data = []; }
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var items = [], sel = 0;
  function renderPal(q) {
    q = (q || '').trim().toLowerCase();
    items = data.filter(function (n) { return !q || n.q.indexOf(q) > -1; });
    sel = 0;
    plist.innerHTML = items.length ? items.map(function (n, i) {
      return '<a class="p-item' + (i === 0 ? ' sel' : '') + '" role="option" href="' + esc(ROOT + n.href) + '">' +
        '<img src="' + esc(n.thumb) + '" alt="" loading="lazy"><div><b>' + esc(n.num + ' · ' + n.name) + '</b><span>' + esc(n.channel + ' · ' + n.meta) + '</span></div></a>';
    }).join('') : '<div class="p-empty">Ничего не нашлось. Попробуйте «хоррор», «история» или «PT».</div>';
  }
  function movePal(dir) {
    var els = $$('.p-item', plist); if (!els.length) return;
    els[sel].classList.remove('sel');
    sel = (sel + dir + els.length) % els.length;
    els[sel].classList.add('sel');
    els[sel].scrollIntoView({ block: 'nearest' });
  }
  function openPal() {
    lastFocus = d.activeElement;
    guide.classList.remove('on');
    pal.classList.add('on'); scrim.classList.add('on'); pal.setAttribute('aria-hidden', 'false'); lock(true);
    pin.value = ''; renderPal('');
    setTimeout(function () { pin.focus(); }, 30);
  }
  $$('[data-open-palette]').forEach(function (b) { b.addEventListener('click', openPal); });
  if (pal) pal.addEventListener('click', function (e) { if (e.target === pal) closeAll(); });
  if (pin) {
    pin.addEventListener('input', function () { renderPal(pin.value); });
    pin.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); movePal(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); movePal(-1); }
      else if (e.key === 'Enter') { var s = $$('.p-item', plist)[sel]; if (s) { e.preventDefault(); location.href = s.href; } }
    });
  }
  d.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    var typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable);
    if (e.key === 'Escape') closeAll();
    else if (!typing && (e.key === '/' || ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')))) { e.preventDefault(); openPal(); }
  });

  /* ---------- number formatting (ru) ---------- */
  function trim(n, dec) { var s = n.toFixed(dec); if (dec > 0) s = s.replace(/\.?0+$/, ''); return s.replace('.', ','); }
  function compact(n) {
    var a = Math.abs(n);
    if (a >= 1e6) { var m = n / 1e6; return trim(m, m >= 100 ? 0 : 1) + ' млн'; }
    if (a >= 1e3) { var k = n / 1e3; return trim(k, k >= 100 ? 0 : 1) + ' тыс.'; }
    return String(Math.round(n));
  }
  function fmt(v, f) {
    switch (f) {
      case 'compact': return compact(v);
      case 'usd2': return '$' + v.toFixed(2).replace('.', ',');
      case 'usdk': return '$' + compact(v);
      case 'int': return Math.round(v).toLocaleString('ru-RU');
      case 'dec1': return trim(v, 1);
      default: return String(Math.round(v));
    }
  }

  /* ---------- reveal + counters ---------- */
  function countUp(el) {
    var to = parseFloat(el.dataset.count), f = el.dataset.fmt || 'int';
    var pre = el.dataset.pre || '', suf = el.dataset.suf || '';
    if (isNaN(to) || reduce) return;
    var dur = 1400, t0 = null;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = pre + fmt(to * e, f) + suf;
      if (p < 1) requestAnimationFrame(step); else el.textContent = pre + fmt(to, f) + suf;
    }
    requestAnimationFrame(step);
  }
  var revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        $$('[data-count]', en.target).forEach(countUp);
        if (en.target.hasAttribute('data-count')) countUp(en.target);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- niche filters (index) ---------- */
  var cards = $$('.grid .vcard');
  var countEl = $('#shown-count');
  $$('[data-filter]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var f = chip.dataset.filter, n = 0;
      $$('[data-filter]').forEach(function (c) { c.classList.toggle('active', c === chip); c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      cards.forEach(function (card) {
        var ok = f === 'all' || (' ' + card.dataset.cats + ' ').indexOf(' ' + f + ' ') > -1;
        card.hidden = !ok; if (ok) { n++; card.classList.add('in'); }
      });
      if (countEl) countEl.textContent = n;
      var g = $('.grid'); if (g) g.classList.toggle('feature', f === 'all');
    });
  });

  /* ---------- sortable table ---------- */
  var table = $('table.rank');
  if (table) {
    var ths = $$('th[data-sort]', table), tbody = $('tbody', table);
    ths.forEach(function (th, idx) {
      th.addEventListener('click', function () {
        var col = parseInt(th.dataset.sort, 10);
        var dir = th.classList.contains('sorted') && th.dataset.dir === 'desc' ? 'asc' : 'desc';
        ths.forEach(function (o) { o.classList.remove('sorted'); o.removeAttribute('aria-sort'); var a = $('.ar', o); if (a) a.textContent = '↓'; });
        th.classList.add('sorted'); th.dataset.dir = dir; th.setAttribute('aria-sort', dir === 'desc' ? 'descending' : 'ascending');
        var ar = $('.ar', th); if (ar) ar.textContent = dir === 'desc' ? '↓' : '↑';
        var rows = $$('tr', tbody);
        rows.sort(function (a, b) {
          var va = parseFloat(a.children[col].dataset.v), vb = parseFloat(b.children[col].dataset.v);
          return dir === 'desc' ? vb - va : va - vb;
        });
        rows.forEach(function (r, i) { tbody.appendChild(r); var p = $('.pos', r); if (p) p.textContent = String(i + 1).padStart(2, '0'); });
      });
      th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); th.click(); } });
    });
  }

  /* ---------- lite YouTube embed ---------- */
  $$('.player[data-yt]').forEach(function (p) {
    function play() {
      if (p.dataset.on) return; p.dataset.on = '1';
      var f = d.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(p.dataset.yt) + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
      f.title = p.getAttribute('aria-label') || 'YouTube video';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin';
      p.innerHTML = ''; p.appendChild(f); p.style.cursor = 'default';
    }
    p.addEventListener('click', play);
    p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
  });

  /* ---------- section nav (niche page) ---------- */
  var snav = $('.snav');
  if (snav && 'IntersectionObserver' in window) {
    var links = $$('a', snav), map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var current = null;
    function setActive(id) {
      if (current === id || !map[id]) return; current = id;
      links.forEach(function (a) { a.classList.toggle('active', a === map[id]); });
      var a = map[id], left = a.offsetLeft - snav.clientWidth / 2 + a.clientWidth / 2;
      snav.scrollTo({ left: Math.max(0, left), behavior: reduce ? 'auto' : 'smooth' });
    }
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    $$('[data-sec]').forEach(function (s) { so.observe(s); });
  }

  /* ---------- pulse chart tooltips (touch) ---------- */
  $$('.pulse .pb').forEach(function (b) {
    b.addEventListener('click', function () {
      var on = b.classList.contains('tip');
      $$('.pulse .pb.tip').forEach(function (x) { x.classList.remove('tip'); });
      if (!on) b.classList.add('tip');
    });
  });
})();
