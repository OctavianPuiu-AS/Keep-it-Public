/* Keep it — "Try it" playground. A browser sketch of captures, views and render sheets.
   Not the add-on: three outlined cubes drawn in the Keep it illustration style, and a pretend panel. */
(function () {
  'use strict';
  var root = document.getElementById('play');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the scene: flat cubes, clay outlines, flat shadows ---------- */
  var TGT = [0.05, 0.45, -0.1], FOCAL = 2.4, ELEV = 38;
  var CUBES = [
    { x: -0.95, z: 0.3, h: [0.36, 0.36, 0.36], rot: 0.35 },
    { x: 0.12, z: -0.45, h: [0.3, 0.6, 0.3], rot: 0.7, seam: true },
    { x: 1.0, z: 0.35, h: [0.24, 0.24, 0.24], rot: -0.45 }
  ];
  // the five drawn faces of a box: corner signs, normal, and which two edges are vertical
  var FACES = [
    { n: [0, 1, 0], v: [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]] },
    { n: [1, 0, 0], v: [[1, -1, -1], [1, -1, 1], [1, 1, 1], [1, 1, -1]], side: true },
    { n: [-1, 0, 0], v: [[-1, -1, 1], [-1, -1, -1], [-1, 1, -1], [-1, 1, 1]], side: true },
    { n: [0, 0, 1], v: [[1, -1, 1], [-1, -1, 1], [-1, 1, 1], [1, 1, 1]], side: true },
    { n: [0, 0, -1], v: [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]], side: true }
  ];
  var OUTLINE = '#9E5330';  // brand 1
  var SHADE = [158 / 255, 83 / 255, 48 / 255], SHADE_DEEP = [107 / 255, 53 / 255, 41 / 255], TOPLIGHT = [249 / 255, 244 / 255, 240 / 255];

  function camPos(d) {
    var a = d.az * Math.PI / 180, e = d.el * Math.PI / 180;
    return [TGT[0] + d.dist * Math.sin(a) * Math.cos(e), TGT[1] + d.dist * Math.sin(e), TGT[2] + d.dist * Math.cos(a) * Math.cos(e)];
  }
  function lightDir(angle) {
    var a = angle * Math.PI / 180, e = ELEV * Math.PI / 180;
    return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)];
  }
  function mix3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function lightColor(w) {
    var cool = [0.82, 0.9, 1.0], white = [1, 1, 1], warm = [1.0, 0.86, 0.7];
    return w < 0.5 ? mix3(cool, white, w * 2) : mix3(white, warm, (w - 0.5) * 2);
  }
  function css(c) { return 'rgb(' + c.map(function (x) { return Math.round(Math.max(0, Math.min(1, x)) * 255); }).join(',') + ')'; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(dot(a, a)); return [a[0] / l, a[1] / l, a[2] / l]; }
  function hull(pts) {
    pts = pts.slice().sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    function cr(o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }
    var lo = [], up = [], i;
    for (i = 0; i < pts.length; i++) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], pts[i]) <= 0) lo.pop(); lo.push(pts[i]); }
    for (i = pts.length - 1; i >= 0; i--) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], pts[i]) <= 0) up.pop(); up.push(pts[i]); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  // d = numeric scene; overlays = draw the viewport extras (axis line, sun gizmo) that a render leaves out
  function paint(g, W, H, d, overlays) {
    var cp = camPos(d);
    var ww = norm(sub(TGT, cp)), uu = norm(cross(ww, [0, 1, 0])), vv = cross(uu, ww);
    var lw = Math.max(1, H / 300);
    function cam(P) { var r = sub(P, cp); return [dot(r, uu), dot(r, vv), dot(r, ww)]; }
    function scr(c) { var s = FOCAL * H / 2 / c[2]; return [W / 2 + c[0] * s, H / 2 - c[1] * s]; }
    function proj(P) { return scr(cam(P)); }
    function poly(pts) { g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath(); }

    g.fillStyle = css(d.w); g.fillRect(0, 0, W, H);
    var dark = dot(d.w, [0.3, 0.5, 0.2]) < 0.35;
    var L = lightDir(d.la), lc = lightColor(d.lw);

    if (overlays) { // Blender's floor axes: X red, Y green; clipped at the camera
      var axis = function (P0, P1, colour) {
        var a = cam(P0), b = cam(P1), near = 0.15;
        if (a[2] < near && b[2] < near) return;
        if (a[2] < near || b[2] < near) {
          var t = (near - a[2]) / (b[2] - a[2]);
          var c = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, near];
          if (a[2] < near) a = c; else b = c;
        }
        var A = scr(a), B = scr(b);
        g.strokeStyle = colour; g.lineWidth = lw;
        g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
      };
      axis([-30, 0, 0], [30, 0, 0], 'rgba(176, 82, 63, 0.55)');
      axis([0, 0, -30], [0, 0, 30], 'rgba(122, 138, 92, 0.6)');
    }

    var boxes = CUBES.map(function (cb, i) {
      var s = d.vis[i];
      if (s < 0.01) return null;
      var co = Math.cos(cb.rot), si = Math.sin(cb.rot);
      var hx = cb.h[0] * s, hy = cb.h[1] * s, hz = cb.h[2] * s;
      var P = function (sg) {
        var x = sg[0] * hx, z = sg[2] * hz;
        return [cb.x + x * co + z * si, hy + sg[1] * hy, cb.z - x * si + z * co];
      };
      var R = function (n) { return [n[0] * co + n[2] * si, n[1], -n[0] * si + n[2] * co]; };
      return { i: i, cb: cb, P: P, R: R, c: [cb.x, hy, cb.z] };
    }).filter(Boolean);

    // flat shadows first, all one colour so overlaps never double up
    g.fillStyle = css(mix3(d.w, dark ? [0, 0, 0] : [225 / 255, 196 / 255, 174 / 255], dark ? 0.35 : 0.45 + 0.2 * d.lp));
    boxes.forEach(function (bx) {
      var pts = [];
      [-1, 1].forEach(function (x) { [-1, 1].forEach(function (y) { [-1, 1].forEach(function (z) {
        var p = bx.P([x, y, z]), k = p[1] / L[1];
        pts.push([p[0] - L[0] * k, p[2] - L[2] * k]);
      }); }); });
      poly(hull(pts).map(function (q) { return proj([q[0], 0, q[1]]); }));
      g.fill();
    });

    // boxes far to near; a box's own visible faces never overlap each other
    boxes.sort(function (p, q) { return dot(sub(q.c, cp), sub(q.c, cp)) - dot(sub(p.c, cp), sub(p.c, cp)); });
    var tint = mix3([1, 1, 1], lc, 0.35);
    g.lineJoin = 'round'; g.lineCap = 'round';
    boxes.forEach(function (bx) {
      var base = [d.cS, d.cB, d.cV][bx.i];
      FACES.forEach(function (f) {
        var n = bx.R(f.n), v = f.v.map(bx.P);
        var mid = [(v[0][0] + v[2][0]) / 2, (v[0][1] + v[2][1]) / 2, (v[0][2] + v[2][2]) / 2];
        if (dot(n, sub(cp, mid)) <= 0) return;
        var lam = dot(n, L);
        var lum = dot(base, [0.3, 0.55, 0.15]);
        var toward = lum > 0.5 ? SHADE : SHADE_DEEP;
        var amt = (lam > 0.55 ? 0 : lam > 0.2 ? 0.42 : 0.85) * (0.75 + 0.25 * d.lp) * (lum > 0.5 ? 1 : 0.55);
        var col = mix3(base, toward, amt);
        if (f.n[1] === 1) col = mix3(base, TOPLIGHT, (lum > 0.5 ? 0.55 : 0.25) * (0.6 + 0.4 * d.lp));
        col = [col[0] * tint[0], col[1] * tint[1], col[2] * tint[2]];
        var pts = v.map(proj);
        poly(pts); g.fillStyle = css(col); g.fill();
        g.strokeStyle = dark ? '#E1C4AE' : OUTLINE; g.lineWidth = lw; g.stroke();
        if (bx.cb.seam && f.side) { // the tower is two stacked cubes
          var m0 = proj(mix3(v[0], v[3], 0.5)), m1 = proj(mix3(v[1], v[2], 0.5));
          g.beginPath(); g.moveTo(m0[0], m0[1]); g.lineTo(m1[0], m1[1]); g.stroke();
        }
      });
    });

    if (overlays) { // the sun lamp gizmo, dashed like Blender's
      var sp = [TGT[0] + L[0] * 1.8, TGT[1] + L[1] * 1.8, TGT[2] + L[2] * 1.8];
      var sc = cam(sp);
      if (sc[2] > 0.3) {
        var S = scr(sc), E = proj([sp[0] - L[0] * 1.1, sp[1] - L[1] * 1.1, sp[2] - L[2] * 1.1]);
        var r = 5 * lw;
        g.strokeStyle = dark ? 'rgba(225, 196, 174, 0.8)' : 'rgba(158, 83, 48, 0.6)'; g.lineWidth = lw;
        g.setLineDash([3 * lw, 3 * lw]);
        g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(E[0], E[1]); g.stroke();
        g.setLineDash([]);
        g.beginPath(); g.arc(S[0], S[1], r, 0, Math.PI * 2); g.stroke();
        for (var j = 0; j < 8; j++) {
          var an = j * Math.PI / 4;
          g.beginPath(); g.moveTo(S[0] + Math.cos(an) * r * 1.6, S[1] + Math.sin(an) * r * 1.6);
          g.lineTo(S[0] + Math.cos(an) * r * 2.3, S[1] + Math.sin(an) * r * 2.3); g.stroke();
        }
      }
    }
  }

  /* ---------- data ---------- */
  var OBJECTS = [{ k: 'cube', name: 'Cube' }, { k: 'tower', name: 'Tower' }, { k: 'block', name: 'Block' }];
  var MATS = [['Paper', '#F9F4F0'], ['Sand', '#E1C4AE'], ['Apricot', '#DDA46F'], ['Clay', '#9E5330'], ['Cocoa', '#6B3529'], ['Stone', '#95866F']];
  var WORLDS = [['Cream', '#F4EEE7'], ['Linen', '#F9F4F0'], ['Stone', '#D7D2CB'], ['Night', '#4E4B48']];
  var CATS = [{ k: 'vis', label: 'Visibility' }, { k: 'col', label: 'Materials' }, { k: 'light', label: 'Lights' }, { k: 'world', label: 'World' }];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function pick(st, cats) { var o = {}; cats.forEach(function (k) { o[k] = clone(st[k]); }); return o; }
  function merge(st, data) { var o = clone(st); Object.keys(data).forEach(function (k) { o[k] = clone(data[k]); }); return o; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  var BASE = {
    vis: [1, 1, 1],
    col: { cube: '#F9F4F0', tower: '#E1C4AE', block: '#DDA46F' },
    light: { angle: -35, warm: 0.6, power: 1 },
    world: '#F4EEE7'
  };
  var state = clone(BASE);

  var views = [
    { name: 'Front', az: 0, el: 8, dist: 4.7 },
    { name: 'Three-quarter', az: 32, el: 20, dist: 4.5 },
    { name: 'High', az: 14, el: 52, dist: 5.2 },
    { name: 'Close', az: -28, el: 12, dist: 2.9 }
  ];
  var cam = clone(views[1]);
  var curView = 1;
  var viewCount = views.length;

  var caps = [
    { id: 1, name: 'Warm paper', data: pick(BASE, ['vis', 'col', 'light', 'world']) },
    { id: 2, name: 'Stone dusk', data: {
      vis: [1, 1, 1], col: { cube: '#95866F', tower: '#F9F4F0', block: '#6B3529' },
      light: { angle: 55, warm: 0.3, power: 0.85 }, world: '#D7D2CB' } },
    { id: 3, name: 'Just the tower', data: {
      vis: [0, 1, 0], col: { cube: '#F9F4F0', tower: '#9E5330', block: '#9E5330' } } }
  ];
  var nextId = 4, capCount = caps.length;
  var active = 1, latest = null;

  /* ---------- drawing ---------- */
  var canvas = $('#vp-canvas');
  var ctx = canvas.getContext('2d');
  var vp = $('#vp');
  var off = document.createElement('canvas');
  off.width = 480; off.height = 270;
  var offCtx = off.getContext('2d');

  function toNum(st, v) {
    return { vis: st.vis.slice(), cS: rgb(st.col.cube), cB: rgb(st.col.tower), cV: rgb(st.col.block), w: rgb(st.world),
      la: st.light.angle, lw: st.light.warm, lp: st.light.power, az: v.az, el: v.el, dist: v.dist };
  }
  function lerpNum(a, b, k) {
    var o = {};
    Object.keys(b).forEach(function (key) {
      o[key] = Array.isArray(b[key]) ? b[key].map(function (x, i) { return a[key][i] + (x - a[key][i]) * k; }) : a[key] + (b[key] - a[key]) * k;
    });
    return o;
  }

  var disp = toNum(state, cam), anim = null, pending = false;
  function frame(now) {
    pending = false;
    if (anim) {
      var k = Math.min(1, (now - anim.t0) / anim.dur);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      disp = lerpNum(anim.from, anim.to, e);
      if (k >= 1) anim = null;
    }
    paint(ctx, canvas.width, canvas.height, disp, true);
    vp.style.backgroundColor = css(disp.w);
    if (anim) request();
  }
  function request() { if (!pending) { pending = true; requestAnimationFrame(frame); } }
  function go(dur) {
    var to = toNum(state, cam);
    if (REDUCED || !dur) { anim = null; disp = to; }
    else anim = { from: disp, to: to, t0: performance.now(), dur: dur };
    request();
  }
  function shot(st, v) { paint(offCtx, off.width, off.height, toNum(st, v), false); return off.toDataURL('image/png'); }

  function size() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(2, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(2, Math.round(canvas.clientHeight * dpr));
    request();
  }
  if (window.ResizeObserver) new ResizeObserver(size).observe(canvas); else window.addEventListener('resize', size);
  size();

  /* ---------- feedback ---------- */
  var toastEl = $('#vp-toast'), toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- scene panel ---------- */
  var scene = $('#scene');
  function swatches(group, list, cur) {
    return '<div class="sw" role="group">' + list.map(function (m) {
      return '<button type="button" data-g="' + group + '" data-v="' + m[1] + '" aria-label="' + m[0] + '" title="' + m[0] + '" aria-pressed="' + (m[1] === cur) + '" style="background:' + m[1] + '"></button>';
    }).join('') + '</div>';
  }
  function slider(id, label, min, max, step, val) {
    return '<label class="sl"><span>' + label + '</span><input type="range" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '"></label>';
  }
  var EYE_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4 5.5 9 5.5 9-5.5 9-5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 15.5l-1.8 2M12 17.5v2.4M18 15.5l1.8 2" stroke="currentColor" stroke-width="1.6"/></svg>';

  function drawScene() {
    var h = '<h3>Scene</h3><p class="sub">The things you’d change in Blender.</p><div class="objs">';
    OBJECTS.forEach(function (o, i) {
      var on = state.vis[i] > 0.5;
      h += '<div class="obj' + (on ? '' : ' off') + '"><button type="button" class="eye" data-eye="' + i + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Hide ' : 'Show ') + o.name + '">' + (on ? EYE_ON : EYE_OFF) + '</button>' +
        '<span class="oname">' + o.name + '</span>' + swatches(o.k, MATS, state.col[o.k]) + '</div>';
    });
    h += '</div><div class="grp"><span class="glab">Light</span>' +
      slider('l-angle', 'Angle', -85, 85, 1, state.light.angle) +
      slider('l-warm', 'Warmth', 0, 1, 0.01, state.light.warm) +
      slider('l-power', 'Power', 0.4, 1.6, 0.01, state.light.power) +
      '</div><div class="grp"><span class="glab">Backdrop</span>' + swatches('world', WORLDS, state.world) + '</div>';
    scene.innerHTML = h;
  }
  function edited() { drawCaps(); }

  scene.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.eye !== undefined) {
      var i = +b.dataset.eye;
      state.vis[i] = state.vis[i] > 0.5 ? 0 : 1;
      drawScene(); go(380); edited();
      return;
    }
    if (b.dataset.g) {
      if (b.dataset.g === 'world') state.world = b.dataset.v; else state.col[b.dataset.g] = b.dataset.v;
      drawScene(); go(260); edited();
    }
  });
  scene.addEventListener('input', function (e) {
    var t = e.target, v = parseFloat(t.value);
    if (t.id === 'l-angle') state.light.angle = v;
    else if (t.id === 'l-warm') state.light.warm = v;
    else if (t.id === 'l-power') state.light.power = v;
    else return;
    go(0);
  });
  scene.addEventListener('change', function (e) { if (e.target.type === 'range') edited(); });

  /* ---------- Keep it panel: captures ---------- */
  var scope = { vis: true, col: true, light: true, world: true };
  var nameIn = $('#cap-name');
  function drawScope() {
    $('#scope').innerHTML = CATS.map(function (c) {
      return '<button type="button" class="chip" data-cat="' + c.k + '" aria-pressed="' + scope[c.k] + '">' + c.label + '</button>';
    }).join('');
    nameIn.placeholder = 'Setup ' + (capCount + 1);
  }
  $('#scope').addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (!b) return;
    scope[b.dataset.cat] = !scope[b.dataset.cat];
    drawScope();
  });

  function catLabels(data) {
    return CATS.filter(function (c) { return c.k in data; }).map(function (c) { return c.label; }).join(' · ');
  }
  function isEdited(c) { return !same(pick(state, Object.keys(c.data)), c.data); }

  function drawCaps() {
    var list = $('#caps');
    if (!caps.length) { list.innerHTML = '<li class="empty">No captures yet. Set the scene up, then press Capture.</li>'; }
    else list.innerHTML = caps.map(function (c) {
      var on = c.id === active, ed = on && isEdited(c);
      return '<li class="cap' + (on ? ' on' : '') + (ed ? ' edited' : '') + '">' +
        '<button type="button" class="cap-main" data-restore="' + c.id + '" aria-label="Restore ' + esc(c.name) + '"' + (on ? ' aria-current="true"' : '') + '>' +
        '<img src="' + c.thumb + '" alt="" width="96" height="54"><span class="cap-name">' + esc(c.name) + '</span>' +
        '<span class="cap-cats">' + catLabels(c.data) + '</span></button>' +
        '<span class="cap-acts">' + (ed ? '<button type="button" class="mini" data-update="' + c.id + '">Update</button>' : '') +
        '<button type="button" class="mini x" data-del="' + c.id + '" aria-label="Delete ' + esc(c.name) + '">×</button></span></li>';
    }).join('');
    $('#latest').disabled = !latest;
  }
  function byId(id) { for (var i = 0; i < caps.length; i++) if (caps[i].id === id) return caps[i]; return null; }

  $('#capture').addEventListener('click', function () {
    var cats = CATS.map(function (c) { return c.k; }).filter(function (k) { return scope[k]; });
    if (!cats.length) { toast('Pick at least one thing to capture'); return; }
    capCount++;
    var name = nameIn.value.trim() || ('Setup ' + capCount);
    var c = { id: nextId++, name: name.slice(0, 40), data: pick(state, cats), thumb: shot(state, cam) };
    caps.push(c);
    active = c.id;
    nameIn.value = '';
    drawScope(); drawCaps(); drawSheetTable();
    toast('Captured “' + c.name + '”');
  });
  nameIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('#capture').click(); });

  $('#caps').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var c;
    if (b.dataset.restore) {
      c = byId(+b.dataset.restore);
      latest = pick(state, ['vis', 'col', 'light', 'world']);
      state = merge(state, c.data);
      active = c.id;
      drawScene(); drawCaps(); go(650);
      toast('Restored “' + c.name + '”');
    } else if (b.dataset.update) {
      c = byId(+b.dataset.update);
      c.data = pick(state, Object.keys(c.data));
      c.thumb = shot(state, cam);
      drawCaps();
      toast('Updated “' + c.name + '”');
    } else if (b.dataset.del) {
      c = byId(+b.dataset.del);
      caps = caps.filter(function (x) { return x !== c; });
      if (active === c.id) active = null;
      drawCaps(); drawSheetTable();
      toast('Deleted “' + c.name + '”');
    }
  });

  $('#latest').addEventListener('click', function () {
    if (!latest) return;
    state = merge(state, latest);
    latest = null; active = null;
    drawScene(); drawCaps(); go(650);
    toast('Back to Latest');
  });

  /* ---------- views ---------- */
  var viewLab = $('#vp-view');
  function drawViews() {
    $('#views').innerHTML = views.map(function (v, i) {
      return '<span class="vchip"><button type="button" class="chip" data-view="' + i + '" aria-pressed="' + (i === curView) + '">' + esc(v.name) + '</button>' +
        (views.length > 1 ? '<button type="button" class="mini x" data-vdel="' + i + '" aria-label="Delete view ' + esc(v.name) + '">×</button>' : '') + '</span>';
    }).join('');
    viewLab.textContent = curView >= 0 ? views[curView].name : 'Free view';
    $('#saveview').classList.toggle('nudge', curView < 0);
  }
  $('#views').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.view) {
      curView = +b.dataset.view;
      var to = clone(views[curView]);
      to.az += 360 * Math.round((cam.az - to.az) / 360);
      cam = to;
      drawViews(); go(650);
    } else if (b.dataset.vdel) {
      var i = +b.dataset.vdel;
      views.splice(i, 1);
      if (curView === i) curView = -1; else if (curView > i) curView--;
      drawViews(); drawSheetTable();
    }
  });
  $('#saveview').addEventListener('click', function () {
    viewCount++;
    var v = { name: 'View ' + viewCount, az: Math.round(((cam.az % 360) + 540) % 360 - 180), el: Math.round(cam.el), dist: cam.dist };
    views.push(v);
    curView = views.length - 1;
    drawViews(); drawSheetTable();
    toast('Saved “' + v.name + '”');
  });

  function orbit(dAz, dEl) {
    cam.az = cam.az + dAz;  // no limit: turn all the way round
    cam.el = Math.max(2, Math.min(85, cam.el + dEl));
    if (curView >= 0) { curView = -1; drawViews(); }
    go(0);
  }
  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    drag = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag = { x: e.clientX, y: e.clientY };
    orbit(-dx * 0.3, e.pointerType === 'touch' ? 0 : dy * 0.25);
  });
  function endDrag() { drag = null; }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('keydown', function (e) {
    var m = { ArrowLeft: [4, 0], ArrowRight: [-4, 0], ArrowUp: [0, 3], ArrowDown: [0, -3] }[e.key];
    if (!m) return;
    e.preventDefault();
    orbit(m[0], m[1]);
  });

  /* ---------- render sheet ---------- */
  var sheetEl = $('#sheet'), progEl = $('#prog'), renderBtn = $('#render'), saveBtn = $('#savepng');
  var sheet = null, rendering = false;
  function drawSheetTable() {
    // the sheet on screen is a past render; a changed list of captures or views makes it stale
    if (sheet) $('#sheet-wrap').classList.add('stale');
    progEl.textContent = sheet ? 'Captures or views changed — render again to update.' : '';
  }
  function renderSheet() {
    if (rendering) return;
    var rows = caps.slice(), cols = views.slice();
    if (!rows.length) { toast('Capture something first'); return; }
    rendering = true; renderBtn.disabled = true; saveBtn.disabled = true;
    var total = rows.length * cols.length, n = 0;
    var out = rows.map(function () { return []; });
    sheetEl.style.setProperty('--cols', cols.length);
    var h = '<span></span>' + cols.map(function (v) { return '<span class="lab col">' + esc(v.name) + '</span>'; }).join('');
    rows.forEach(function (r, ri) {
      h += '<span class="lab row">' + esc(r.name) + '</span>';
      cols.forEach(function (v, ci) { h += '<span class="cell" id="cell-' + ri + '-' + ci + '"></span>'; });
    });
    sheetEl.innerHTML = h;
    $('#sheet-wrap').classList.remove('stale');
    $('#sheet-wrap').hidden = false;
    var base = clone(state);
    (function step() {
      var ri = Math.floor(n / cols.length), ci = n % cols.length;
      var url = shot(merge(base, rows[ri].data), cols[ci]);
      var img = new Image(); img.src = url; img.alt = rows[ri].name + ', ' + cols[ci].name;
      out[ri][ci] = img;
      sheetEl.querySelector('#cell-' + ri + '-' + ci).appendChild(img);
      n++;
      progEl.textContent = n < total ? 'Rendering ' + n + ' / ' + total + '…' : total + ' images · ' + rows.length + ' captures × ' + cols.length + ' views';
      if (n < total) setTimeout(step, REDUCED ? 0 : 40);
      else { rendering = false; renderBtn.disabled = false; saveBtn.disabled = false; sheet = { rows: rows, cols: cols, imgs: out }; }
    })();
  }
  renderBtn.addEventListener('click', renderSheet);

  saveBtn.addEventListener('click', function () {
    if (!sheet) return;
    var cw = 320, chh = 180, gap = 10, lw = 170, th = 44, pad = 28;
    var W = pad * 2 + lw + sheet.cols.length * (cw + gap) - gap;
    var H = pad * 2 + th + sheet.rows.length * (chh + gap) - gap + 30;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var g = c.getContext('2d');
    g.fillStyle = '#F9F4F0'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'middle';
    g.fillStyle = '#9E5330'; g.font = '700 16px Jost, Futura, sans-serif';
    sheet.cols.forEach(function (v, ci) { g.fillText(v.name, pad + lw + ci * (cw + gap), pad + th / 2); });
    sheet.rows.forEach(function (r, ri) {
      var y = pad + th + ri * (chh + gap);
      g.fillStyle = '#4E4B48'; g.font = '700 16px Jost, Futura, sans-serif';
      g.fillText(r.name.length > 18 ? r.name.slice(0, 17) + '…' : r.name, pad, y + chh / 2);
      sheet.cols.forEach(function (v, ci) { g.drawImage(sheet.imgs[ri][ci], pad + lw + ci * (cw + gap), y, cw, chh); });
    });
    g.fillStyle = '#7A716B'; g.font = '400 13px Jost, Futura, sans-serif';
    g.fillText('Keep it — try-it sheet', pad, H - pad / 2 - 6);
    var a = document.createElement('a');
    a.href = c.toDataURL('image/png'); a.download = 'keep-it-sheet.png';
    document.body.appendChild(a); a.click(); a.remove();
  });

  if (window.matchMedia && matchMedia('(hover: none)').matches) $('#vp .hint').textContent = 'Swipe to turn';

  /* ---------- start ---------- */
  caps.forEach(function (c) { c.thumb = shot(merge(BASE, c.data), views[1]); });
  drawScene(); drawScope(); drawCaps(); drawViews();
  go(0);
  setTimeout(renderSheet, 250);
})();
