/* Keep it docs: version picker, contents, search across every page of the version.
   Each page:  <body data-version="1.0" data-page="index.html">  with
   <aside class="side" id="side"></aside> and <div id="search"></div> inside <main>.
   Each version folder has nav.json (its pages + the keyword chips);
   the site root has versions.json. No build step: add a page, list it in nav.json. */
(function () {
  'use strict';
  var body = document.body;
  var VERSION = body.dataset.version;
  var PAGE = body.dataset.page || 'index.html';
  var ROOT = '../';

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function getJSON(url) { return fetch(url, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw r; return r.json(); }); }
  // nav.json pages form a tree ({file, title, children}); most things want it flat, in reading order
  function flat(list, depth, parent, out) {
    out = out || [];
    (list || []).forEach(function (p) {
      out.push({ file: p.file, title: p.title, depth: depth || 0, parent: parent || null, children: p.children || [] });
      flat(p.children, (depth || 0) + 1, p, out);
    });
    return out;
  }
  function sectionTitle(s) {
    var h = s.querySelector('h2');
    return s.dataset.title || (h ? h.textContent.trim() : '');
  }

  var sections = Array.prototype.slice.call(document.querySelectorAll('main section[id]'));

  // per-section keyword tags (read before anything else touches the text)
  var localIndex = sections.map(function (s) {
    return { file: PAGE, id: s.id, heading: sectionTitle(s), text: s.textContent.replace(/\s+/g, ' ').trim(), keywords: s.dataset.keywords || '' };
  });

  Promise.all([getJSON(ROOT + 'versions.json'), getJSON('nav.json')]).then(function (r) {
    var versions = r[0], nav = r[1];
    buildSide(versions, nav);
    buildKids(nav);
    buildPager(nav);
    buildSearch(nav);
    oldVersionNote(versions);
  }).catch(function () {
    // offline / opened as a file: the page still reads fine, just without the extras
    buildSearch({ pages: [{ file: PAGE, title: document.title }], keywords: [] });
  });

  /* ---------- contents + version ---------- */
  function buildSide(versions, nav) {
    var side = document.getElementById('side');
    if (!side) return;
    var sel = el('select', { id: 'ver', 'aria-label': 'Documentation version' });
    versions.versions.forEach(function (v) {
      var o = el('option', { value: v.id, text: v.id + (v.id === versions.latest ? ' (latest)' : '') });
      if (v.id === VERSION) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      var to = sel.value;
      getJSON(ROOT + to + '/nav.json').then(function (n) {
        var has = flat(n.pages).some(function (p) { return p.file === PAGE; });
        location.href = ROOT + to + '/' + (has ? PAGE : 'index.html') + (has ? location.hash : '');
      }).catch(function () { location.href = ROOT + to + '/'; });
    });

    function tree(list, depth) {
      var ul = el('ul', depth ? { class: 'sub' } : null);
      list.forEach(function (p) {
        var a = el('a', { href: p.file, text: p.title });
        if (p.file === PAGE) a.setAttribute('aria-current', 'page');
        var li = el('li', null, [a]);
        if (p.children && p.children.length) li.appendChild(tree(p.children, depth + 1));
        ul.appendChild(li);
      });
      return ul;
    }
    var pages = tree(nav.pages, 0);

    var toc = el('ul', { class: 'toc' });
    sections.forEach(function (s) {
      var t = sectionTitle(s);
      if (t) toc.appendChild(el('li', null, [el('a', { href: '#' + s.id, text: t, 'data-id': s.id })]));
    });

    var toggle = el('button', { class: 'side-toggle', type: 'button', 'aria-expanded': 'false' }, [
      el('span', { text: 'Contents' }), el('span', { text: '+', 'aria-hidden': 'true' })]);
    toggle.addEventListener('click', function () {
      var open = side.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.lastChild.textContent = open ? '−' : '+';
    });

    side.appendChild(toggle);
    side.appendChild(el('div', { class: 'body' }, [
      el('div', { class: 'ver' }, [el('label', { for: 'ver', text: 'VERSION' }), sel]),
      el('div', null, [el('h4', { text: 'PAGES' }), pages]),
      toc.children.length ? el('div', null, [el('h4', { text: 'ON THIS PAGE' }), toc]) : null
    ]));

    // highlight the section being read
    if ('IntersectionObserver' in window) {
      var links = toc.querySelectorAll('a');
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle('on', a.dataset.id === e.target.id); });
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      sections.forEach(function (s) { io.observe(s); });
    }
  }

  /* ---------- a group page lists what's inside it ---------- */
  function buildKids(nav) {
    var box = document.getElementById('kids');
    if (!box) return;
    var me = flat(nav.pages).filter(function (p) { return p.file === PAGE; })[0];
    if (!me || !me.children.length) return;
    me.children.forEach(function (c) {
      var inner = (c.children || []).map(function (g) { return g.title; }).join(' · ');
      box.appendChild(el('a', { href: c.file, class: 'kid' }, [
        el('span', { class: 't', text: c.title }),
        inner ? el('span', { class: 'd', text: inner }) : null
      ]));
    });
  }

  /* ---------- previous / next, in the order of the contents ---------- */
  function buildPager(nav) {
    var main = document.querySelector('main');
    var all = flat(nav.pages), i = -1;
    all.forEach(function (p, k) { if (p.file === PAGE) i = k; });
    if (!main || i < 0) return;
    var prev = all[i - 1], next = all[i + 1];
    if (!prev && !next) return;
    var bar = el('nav', { class: 'pager', 'aria-label': 'Previous and next page' });
    bar.appendChild(prev ? el('a', { href: prev.file, class: 'prev' }, [el('span', { class: 'k', text: 'Previous' }), el('span', { class: 't', text: prev.title })]) : el('span'));
    bar.appendChild(next ? el('a', { href: next.file, class: 'next' }, [el('span', { class: 'k', text: 'Next' }), el('span', { class: 't', text: next.title })]) : el('span'));
    main.appendChild(bar);
  }

  function oldVersionNote(versions) {
    if (VERSION === versions.latest) return;
    var box = document.getElementById('oldver');
    if (!box) return;
    box.innerHTML = '';
    box.appendChild(document.createTextNode('These docs are for Keep it ' + VERSION + '. '));
    box.appendChild(el('a', { href: ROOT + versions.latest + '/' + PAGE, text: 'Read the latest (' + versions.latest + ')' }));
  }

  /* ---------- search ---------- */
  function buildSearch(nav) {
    var host = document.getElementById('search');
    if (!host) return;
    var q = el('input', { id: 'q', type: 'search', placeholder: 'Search the docs', autocomplete: 'off', 'aria-label': 'Search the docs' });
    var box = el('label', { class: 'sbox', html: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M13 13l5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' });
    box.appendChild(q);
    box.appendChild(el('kbd', { text: '/' }));
    var chips = el('div', { class: 'kw', 'aria-label': 'Keywords' });
    var count = el('p', { class: 'count soft', 'aria-live': 'polite' });
    var results = el('div', { class: 'results' });
    host.className = 'search';
    host.setAttribute('role', 'search');
    [box, chips, count, results].forEach(function (n) { host.appendChild(n); });

    (nav.keywords || []).forEach(function (w) {
      var b = el('button', { type: 'button', 'aria-pressed': 'false', text: w });
      b.addEventListener('click', function () { set(q.value.trim() === w ? '' : w); });
      chips.appendChild(b);
    });
    sections.forEach(function (s) {
      var words = (s.dataset.keywords || '').split(',').map(function (w) { return w.trim(); }).filter(Boolean);
      if (!words.length) return;
      var row = el('div', { class: 'tags' });
      words.forEach(function (w) {
        var b = el('button', { type: 'button', text: w });
        b.addEventListener('click', function () { set(w); host.scrollIntoView({ block: 'start' }); });
        row.appendChild(b);
      });
      s.appendChild(row);
    });

    // the other pages of this version, fetched once when someone first searches
    var others = null;
    function loadOthers() {
      if (others) return others;
      var list = flat(nav.pages).filter(function (p) { return p.file !== PAGE; });
      others = Promise.all(list.map(function (p) {
        return fetch(p.file).then(function (r) { return r.ok ? r.text() : ''; }).then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          return Array.prototype.map.call(doc.querySelectorAll('main section[id]'), function (s) {
            return { file: p.file, page: p.title, id: s.id, heading: sectionTitle(s), text: s.textContent.replace(/\s+/g, ' ').trim(), keywords: s.dataset.keywords || '' };
          });
        }).catch(function () { return []; });
      })).then(function (all) { return [].concat.apply([], all); });
      return others;
    }

    function set(w) { q.value = w; run(); }

    function clearMarks() {
      document.querySelectorAll('main mark').forEach(function (m) {
        var p = m.parentNode;
        p.replaceChild(document.createTextNode(m.textContent), m);
        p.normalize();
      });
    }
    function highlight(root, term) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          if (!n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          if (n.parentNode.closest('.tags, button, script')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      var nodes = [], n, hits = 0, lower = term.toLowerCase();
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(function (node) {
        var text = node.nodeValue, low = text.toLowerCase(), i = low.indexOf(lower);
        if (i < 0) return;
        var frag = document.createDocumentFragment(), last = 0;
        while (i >= 0) {
          frag.appendChild(document.createTextNode(text.slice(last, i)));
          frag.appendChild(el('mark', { text: text.slice(i, i + term.length) }));
          hits++; last = i + term.length; i = low.indexOf(lower, last);
        }
        frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
      return hits;
    }
    function snippet(text, term) {
      var i = text.toLowerCase().indexOf(term.toLowerCase());
      if (i < 0) return text.slice(0, 120) + (text.length > 120 ? '…' : '');
      var a = Math.max(0, i - 50), b = Math.min(text.length, i + term.length + 70);
      var esc = function (s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
      return (a ? '…' : '') + esc(text.slice(a, i)) + '<mark>' + esc(text.slice(i, i + term.length)) + '</mark>' + esc(text.slice(i + term.length, b)) + (b < text.length ? '…' : '');
    }
    function matches(entry, low) {
      return entry.text.toLowerCase().indexOf(low) >= 0 || entry.keywords.toLowerCase().indexOf(low) >= 0;
    }

    var seq = 0;
    function run() {
      var term = q.value.trim(), low = term.toLowerCase(), mine = ++seq;
      clearMarks();
      chips.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.textContent === term)); });
      var items = document.querySelectorAll('.three li');
      results.innerHTML = '';
      if (term.length < 2) {
        sections.forEach(function (s) { s.classList.remove('miss'); });
        items.forEach(function (li) { li.classList.remove('miss'); });
        count.textContent = '';
        return;
      }
      // this page: hide what doesn't match, highlight what does
      var shown = 0, total = 0;
      localIndex.forEach(function (entry, k) {
        var s = sections[k], hit = matches(entry, low);
        s.classList.toggle('miss', !hit);
        if (hit) { shown++; total += highlight(s, term); }
      });
      items.forEach(function (li) {
        var sec = li.closest('section'), intro = sec.querySelector('p');
        var keep = (intro && intro.textContent.toLowerCase().indexOf(low) >= 0)
          || li.textContent.toLowerCase().indexOf(low) >= 0
          || (sec.dataset.keywords || '').toLowerCase().indexOf(low) >= 0;
        li.classList.toggle('miss', !keep);
      });
      var here = shown ? 'This page: ' + shown + (shown === 1 ? ' section' : ' sections') + (total ? ', ' + total + (total === 1 ? ' match' : ' matches') : '') : 'Nothing on this page.';
      count.textContent = here;

      // the other pages: a list of results to jump to
      loadOthers().then(function (all) {
        if (mine !== seq) return;
        var hits = all.filter(function (e) { return matches(e, low); });
        if (!hits.length) {
          if (!shown) count.textContent = 'Nothing found for "' + term + '". Try one of the keywords.';
          return;
        }
        results.appendChild(el('div', { class: 'head', text: hits.length + (hits.length === 1 ? ' result' : ' results') + ' on other pages' }));
        hits.forEach(function (e) {
          results.appendChild(el('a', { href: e.file + '?q=' + encodeURIComponent(term) + '#' + e.id }, [
            el('div', { class: 'where', text: e.page + (e.heading ? '  ›  ' + e.heading : '') }),
            el('div', { class: 'snip', html: snippet(e.text, term) })
          ]));
        });
      });
    }

    var t;
    q.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 120); });
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var first = document.querySelector('main section:not(.miss) mark') || results.querySelector('a');
        if (first && first.tagName === 'A') location.href = first.href;
        else if (first) first.scrollIntoView({ block: 'center' });
      }
      if (e.key === 'Escape') { set(''); q.blur(); }
    });
    document.addEventListener('keydown', function (e) {
      var tag = (document.activeElement || {}).tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') { e.preventDefault(); q.focus(); }
    });

    var start = new URLSearchParams(location.search).get('q');
    if (start) { q.value = start; run(); }
  }
  // looping videos stay still for people who asked for less motion
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    Array.prototype.forEach.call(document.querySelectorAll('video[autoplay]'), function (v) {
      v.removeAttribute('autoplay'); v.pause(); v.controls = true;
    });
  }
})();
