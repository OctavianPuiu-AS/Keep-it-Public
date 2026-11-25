/* Keep it — "Try it" playground on a real scene (a courtyard café exported from Blender).
   Not the add-on: a browser sketch of captures, views and render sheets, drawn with three.js. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const root = document.getElementById('play');
if (root) start();

function start() {
  const $ = (s) => root.querySelector(s);
  const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MODEL = 'assets/media/courtyard.glb?v=1';

  /* ---------- what you can change ---------- */
  const ELEMENTS = [
    { k: 'chairs', name: 'Chairs' },
    { k: 'tables', name: 'Tables' },
    { k: 'stools', name: 'Bar stools' },
    { k: 'tree', name: 'Tree' }
  ];
  const MATS = [['Clay', '#9E5330'], ['Cocoa', '#6B3529'], ['Apricot', '#DDA46F'], ['Sand', '#E1C4AE'], ['Sage', '#7F8C6A'], ['Ink', '#4E4B48']];
  const LIGHTS = [
    { k: 'lamps', name: 'Table lamps' },
    { k: 'railing', name: 'Railing spots' },
    { k: 'bar', name: 'Bar lights' }
  ];
  const TONES = [['Warm', '#FFB46B'], ['Soft', '#FFD9A8'], ['White', '#FFF4E6'], ['Cool', '#CFE0FF']];
  const WORLDS = [['Day', 'day'], ['Dusk', 'dusk'], ['Night', 'night']];
  const CATS = [{ k: 'vis', label: 'Visibility' }, { k: 'col', label: 'Materials' }, { k: 'light', label: 'Lights' }, { k: 'world', label: 'Time of day' }];

  // Time of day. sun: [elevation°, rotation°] as Blender's sky texture has them
  const SKY = {
    day:   { sun: 3.4, sunCol: '#FFF3E2', el: 58, rot: 124.1, hemi: 0.45, sky: '#BFD6EA', ground: '#D9C2AE', bg: '#CFE0EE', exp: 1.0 },
    dusk:  { sun: 1.6, sunCol: '#FF9A5A', el: 24, rot: 110, hemi: 0.35, sky: '#C9A3B4', ground: '#8E5A44', bg: '#E7B597', exp: 1.25 },
    night: { sun: 0, sunCol: '#7F98D6', el: 30, rot: 124.1, hemi: 0.06, sky: '#2B3550', ground: '#1E1B1A', bg: '#20263A', exp: 1.6 }
  };
  const LIGHT_K = 0.02;     // glTF candela → this scene's exposure
  const EMIT_K = 2.2;       // bulb glow at full power

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const pick = (st, cats) => { const o = {}; cats.forEach((k) => { o[k] = clone(st[k]); }); return o; };
  const merge = (st, data) => { const o = clone(st); Object.keys(data).forEach((k) => { o[k] = clone(data[k]); }); return o; };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

  const BASE = {
    vis: { chairs: 1, tables: 1, stools: 1, tree: 1 },
    col: { chairs: '#9E5330', tables: '#9E5330', stools: '#9E5330', tree: '#4E4B48' },
    light: {
      lamps: { on: 1, dim: 1, tone: '#FFD9A8' },
      railing: { on: 1, dim: 1, tone: '#FFF4E6' },
      bar: { on: 1, dim: 1, tone: '#FFF4E6' }
    },
    world: 'day'
  };
  let state = clone(BASE);

  let caps = [
    { id: 1, name: 'Sunny lunch', data: pick(BASE, ['vis', 'col', 'light', 'world']) },
    { id: 2, name: 'Evening bar', data: {
      vis: { chairs: 1, tables: 1, stools: 1, tree: 1 },
      col: { chairs: '#6B3529', tables: '#DDA46F', stools: '#6B3529', tree: '#4E4B48' },
      light: { lamps: { on: 1, dim: 0.8, tone: '#FFB46B' }, railing: { on: 1, dim: 0.45, tone: '#FFB46B' }, bar: { on: 1, dim: 1, tone: '#FFD9A8' } },
      world: 'dusk' } },
    { id: 3, name: 'Late night', data: {
      vis: { chairs: 1, tables: 1, stools: 1, tree: 0 },
      light: { lamps: { on: 1, dim: 1, tone: '#FFB46B' }, railing: { on: 0, dim: 1, tone: '#FFF4E6' }, bar: { on: 1, dim: 0.6, tone: '#CFE0FF' } },
      world: 'night' } },
    { id: 4, name: 'Sand furniture', data: {
      col: { chairs: '#E1C4AE', tables: '#E1C4AE', stools: '#E1C4AE', tree: '#4E4B48' } } }
  ];
  let nextId = 5, capCount = caps.length;
  let active = 1, latest = null;

  /* ---------- three.js ---------- */
  const canvas = $('#vp-canvas');
  const vp = $('#vp');
  vp.classList.add('loading');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 200);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 1;
  controls.maxDistance = 30;

  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 70 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);

  // per group: { meshes, mats (cloned, ours to recolour), lights, emit (bulb materials) }
  const groups = {};
  let views = [];
  let curView = 0, viewCount = 0, ready = false;

  /* ---------- numeric scene, so changes can glide ---------- */
  function toNum(st) {
    const w = SKY[st.world];
    const n = { w: [w.sun, ...lin(w.sunCol), w.el, w.rot, w.hemi, ...lin(w.sky), ...lin(w.ground), ...lin(w.bg), w.exp] };
    ELEMENTS.forEach((e) => { n['v_' + e.k] = st.vis[e.k]; n['c_' + e.k] = lin(st.col[e.k]); });
    LIGHTS.forEach((l) => { const s = st.light[l.k]; n['l_' + l.k] = [s.on * s.dim, ...lin(s.tone)]; });
    return n;
  }
  function lerpNum(a, b, k) {
    const o = {};
    for (const key in b) o[key] = Array.isArray(b[key]) ? b[key].map((x, i) => a[key][i] + (x - a[key][i]) * k) : a[key] + (b[key] - a[key]) * k;
    return o;
  }
  function apply(n) {
    const w = n.w;
    const el = w[4] * Math.PI / 180, rot = w[5] * Math.PI / 180;
    // Blender sky: x = cos(el)·sin(rot), y = −cos(el)·cos(rot), z = sin(el); three is Y-up (x, z, −y)
    sun.position.set(Math.cos(el) * Math.sin(rot), Math.sin(el), Math.cos(el) * Math.cos(rot)).multiplyScalar(30);
    sun.target.position.set(0, 0, 0);
    sun.intensity = w[0];
    sun.visible = w[0] > 0.01;
    sun.color.setRGB(w[1], w[2], w[3]);
    hemi.intensity = w[6];
    hemi.color.setRGB(w[7], w[8], w[9]);
    hemi.groundColor.setRGB(w[10], w[11], w[12]);
    scene.background.setRGB(w[13], w[14], w[15]);
    renderer.toneMappingExposure = w[16];
    ELEMENTS.forEach((e) => {
      const g = groups[e.k];
      if (!g) return;
      const s = Math.max(0.0001, n['v_' + e.k]);
      g.roots.forEach((r) => { r.obj.scale.copy(r.scale).multiplyScalar(s); r.obj.visible = n['v_' + e.k] > 0.01; });
      const c = n['c_' + e.k];
      g.mats.forEach((m) => { m.color.setRGB(c[0] * m.userData.k, c[1] * m.userData.k, c[2] * m.userData.k); });
    });
    LIGHTS.forEach((l) => {
      const g = groups[l.k];
      if (!g) return;
      const v = n['l_' + l.k];
      g.lights.forEach((L) => { L.intensity = L.userData.base * v[0]; L.visible = v[0] > 0.001; L.color.setRGB(v[1], v[2], v[3]); });
      g.emit.forEach((m) => { m.emissive.setRGB(v[1], v[2], v[3]); m.emissiveIntensity = EMIT_K * v[0]; });
    });
  }

  let disp = toNum(state), anim = null, pending = false;
  function frame(now) {
    pending = false;
    if (!ready) return;
    if (anim) {
      const k = Math.min(1, (now - anim.t0) / anim.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      if (anim.from) disp = lerpNum(anim.from, anim.to, e);
      if (anim.cam) {
        camera.position.lerpVectors(anim.cam.p0, anim.cam.p1, e);
        controls.target.lerpVectors(anim.cam.t0, anim.cam.t1, e);
        camera.fov = anim.cam.f0 + (anim.cam.f1 - anim.cam.f0) * e;
        camera.updateProjectionMatrix();
        camera.lookAt(controls.target);
      }
      if (k >= 1) anim = null;
    }
    apply(disp);
    renderer.render(scene, camera);
    if (anim) request();
  }
  function request() { if (!pending) { pending = true; requestAnimationFrame(frame); } }
  function go(dur) {
    const to = toNum(state);
    const camAnim = anim && anim.cam;
    if (REDUCED || !dur) { disp = to; anim = camAnim ? anim : null; if (anim) anim.from = null; }
    else anim = { from: disp, to, t0: performance.now(), dur, cam: camAnim || null };
    request();
  }
  function flyTo(v, dur) {
    const p1 = new THREE.Vector3().fromArray(v.pos), t1 = new THREE.Vector3().fromArray(v.target);
    if (REDUCED || !dur) {
      camera.position.copy(p1); controls.target.copy(t1); camera.fov = v.fov; camera.updateProjectionMatrix(); camera.lookAt(t1);
      request(); return;
    }
    const camA = { p0: camera.position.clone(), p1, t0: controls.target.clone(), t1, f0: camera.fov, f1: v.fov };
    if (anim) { anim.cam = camA; anim.t0 = performance.now(); anim.dur = Math.max(anim.dur, dur); }
    else anim = { from: null, to: disp, t0: performance.now(), dur, cam: camA };
    request();
  }

  // a still for cards and the sheet: render one frame with the given state and view, copy it, put the live frame back
  const off = document.createElement('canvas');
  off.width = 480; off.height = 270;
  const offCtx = off.getContext('2d');
  const shotCam = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 200);
  function shot(st, v) {
    shotCam.position.fromArray(v.pos);
    shotCam.fov = v.fov; shotCam.aspect = canvas.width / canvas.height; shotCam.updateProjectionMatrix();
    shotCam.lookAt(new THREE.Vector3().fromArray(v.target));
    apply(toNum(st));
    renderer.render(scene, shotCam);
    // the canvas may not be 16:9 to the pixel; crop the middle
    const cw = canvas.width, ch = canvas.height, want = 16 / 9;
    let sw = cw, sh = ch;
    if (cw / ch > want) sw = ch * want; else sh = cw / want;
    offCtx.drawImage(canvas, (cw - sw) / 2, (ch - sh) / 2, sw, sh, 0, 0, off.width, off.height);
    apply(disp);
    renderer.render(scene, camera);
    return off.toDataURL('image/jpeg', 0.86);
  }

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    request();
  }
  if (window.ResizeObserver) new ResizeObserver(size).observe(canvas); else window.addEventListener('resize', size);

  /* ---------- feedback ---------- */
  const toastEl = $('#vp-toast');
  let toastT = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 1800);
  }

  /* ---------- scene panel ---------- */
  const sceneEl = $('#scene');
  function swatches(group, list, cur, label) {
    return '<div class="sw" role="group" aria-label="' + label + '">' + list.map((m) =>
      '<button type="button" data-g="' + group + '" data-v="' + m[1] + '" aria-label="' + m[0] + '" title="' + m[0] + '" aria-pressed="' + (m[1] === cur) + '" style="background:' + m[1] + '"></button>'
    ).join('') + '</div>';
  }
  const EYE_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12s3.4 5.5 9 5.5 9-5.5 9-5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M6 15.5l-1.8 2M12 17.5v2.4M18 15.5l1.8 2" stroke="currentColor" stroke-width="1.6"/></svg>';
  const BULB_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17h6M10 20h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="currentColor" fill-opacity=".25" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const BULB_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17h6M10 20h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';

  function drawScene() {
    let h = '<h3>Scene</h3><p class="sub">The things you’d change in Blender.</p><div class="objs">';
    ELEMENTS.forEach((o) => {
      const on = state.vis[o.k] > 0.5;
      h += '<div class="obj' + (on ? '' : ' off') + '"><button type="button" class="eye" data-eye="' + o.k + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Hide ' : 'Show ') + o.name + '">' + (on ? EYE_ON : EYE_OFF) + '</button>' +
        '<span class="oname">' + o.name + '</span>' + swatches('c:' + o.k, MATS, state.col[o.k], o.name + ' colour') + '</div>';
    });
    h += '</div><div class="grp"><span class="glab">Light groups</span><div class="objs">';
    LIGHTS.forEach((l) => {
      const s = state.light[l.k], on = s.on > 0.5;
      h += '<div class="lgt' + (on ? '' : ' off') + '"><button type="button" class="eye" data-lon="' + l.k + '" aria-pressed="' + on + '" aria-label="' + (on ? 'Turn off ' : 'Turn on ') + l.name + '">' + (on ? BULB_ON : BULB_OFF) + '</button>' +
        '<span class="oname">' + l.name + '</span>' +
        '<label class="sl"><span>Power</span><input type="range" data-dim="' + l.k + '" min="0.1" max="2" step="0.01" value="' + s.dim + '"></label>' +
        swatches('t:' + l.k, TONES, s.tone, l.name + ' colour') + '</div>';
    });
    h += '</div></div><div class="grp"><span class="glab">Time of day</span><div class="chips" role="group" aria-label="Time of day">' +
      WORLDS.map((w) => '<button type="button" class="chip" data-world="' + w[1] + '" aria-pressed="' + (state.world === w[1]) + '">' + w[0] + '</button>').join('') + '</div></div>';
    sceneEl.innerHTML = h;
  }
  const edited = () => drawCaps();

  sceneEl.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.eye) {
      const k = b.dataset.eye;
      state.vis[k] = state.vis[k] > 0.5 ? 0 : 1;
      drawScene(); go(420); edited();
    } else if (b.dataset.lon) {
      const s = state.light[b.dataset.lon];
      s.on = s.on > 0.5 ? 0 : 1;
      drawScene(); go(380); edited();
    } else if (b.dataset.world) {
      state.world = b.dataset.world;
      drawScene(); go(900); edited();
    } else if (b.dataset.g) {
      const [kind, k] = b.dataset.g.split(':');
      if (kind === 'c') state.col[k] = b.dataset.v; else state.light[k].tone = b.dataset.v;
      drawScene(); go(300); edited();
    }
  });
  sceneEl.addEventListener('input', (e) => {
    const k = e.target.dataset.dim;
    if (!k) return;
    state.light[k].dim = parseFloat(e.target.value);
    go(0);
  });
  sceneEl.addEventListener('change', (e) => { if (e.target.dataset.dim) edited(); });

  /* ---------- Keep it panel: captures ---------- */
  const scope = { vis: true, col: true, light: true, world: true };
  const nameIn = $('#cap-name');
  function drawScope() {
    $('#scope').innerHTML = CATS.map((c) => '<button type="button" class="chip" data-cat="' + c.k + '" aria-pressed="' + scope[c.k] + '">' + c.label + '</button>').join('');
    nameIn.placeholder = 'Setup ' + (capCount + 1);
  }
  $('#scope').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    scope[b.dataset.cat] = !scope[b.dataset.cat];
    drawScope();
  });
  const catLabels = (data) => CATS.filter((c) => c.k in data).map((c) => c.label).join(' · ');
  const isEdited = (c) => !same(pick(state, Object.keys(c.data)), c.data);
  const curViewObj = () => ({ pos: camera.position.toArray(), target: controls.target.toArray(), fov: camera.fov });

  function drawCaps() {
    const list = $('#caps');
    if (!caps.length) list.innerHTML = '<li class="empty">No captures yet. Set the scene up, then press Capture.</li>';
    else list.innerHTML = caps.map((c) => {
      const on = c.id === active, ed = on && isEdited(c);
      return '<li class="cap' + (on ? ' on' : '') + (ed ? ' edited' : '') + '">' +
        '<button type="button" class="cap-main" data-restore="' + c.id + '" aria-label="Restore ' + esc(c.name) + '"' + (on ? ' aria-current="true"' : '') + '>' +
        (c.thumb ? '<img src="' + c.thumb + '" alt="" width="96" height="54">' : '<img alt="" width="96" height="54">') +
        '<span class="cap-name">' + esc(c.name) + '</span>' +
        '<span class="cap-cats">' + catLabels(c.data) + '</span></button>' +
        '<span class="cap-acts">' + (ed ? '<button type="button" class="mini" data-update="' + c.id + '">Update</button>' : '') +
        '<button type="button" class="mini x" data-del="' + c.id + '" aria-label="Delete ' + esc(c.name) + '">×</button></span></li>';
    }).join('');
    $('#latest').disabled = !latest;
  }
  const byId = (id) => caps.find((c) => c.id === id) || null;

  $('#capture').addEventListener('click', () => {
    if (!ready) return;
    const cats = CATS.map((c) => c.k).filter((k) => scope[k]);
    if (!cats.length) { toast('Pick at least one thing to capture'); return; }
    capCount++;
    const name = nameIn.value.trim() || ('Setup ' + capCount);
    const c = { id: nextId++, name: name.slice(0, 40), data: pick(state, cats), thumb: shot(state, curViewObj()) };
    caps.push(c);
    active = c.id;
    nameIn.value = '';
    drawScope(); drawCaps(); drawSheetTable();
    toast('Captured “' + c.name + '”');
  });
  nameIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#capture').click(); });

  $('#caps').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !ready) return;
    let c;
    if (b.dataset.restore) {
      c = byId(+b.dataset.restore);
      latest = pick(state, ['vis', 'col', 'light', 'world']);
      state = merge(state, c.data);
      active = c.id;
      drawScene(); drawCaps(); go(800);
      toast('Restored “' + c.name + '”');
    } else if (b.dataset.update) {
      c = byId(+b.dataset.update);
      c.data = pick(state, Object.keys(c.data));
      c.thumb = shot(state, curViewObj());
      drawCaps();
      toast('Updated “' + c.name + '”');
    } else if (b.dataset.del) {
      c = byId(+b.dataset.del);
      caps = caps.filter((x) => x !== c);
      if (active === c.id) active = null;
      drawCaps(); drawSheetTable();
      toast('Deleted “' + c.name + '”');
    }
  });

  $('#latest').addEventListener('click', () => {
    if (!latest) return;
    state = merge(state, latest);
    latest = null; active = null;
    drawScene(); drawCaps(); go(800);
    toast('Back to Latest');
  });

  /* ---------- views ---------- */
  const viewLab = $('#vp-view');
  function drawViews() {
    $('#views').innerHTML = views.map((v, i) =>
      '<span class="vchip"><button type="button" class="chip" data-view="' + i + '" aria-pressed="' + (i === curView) + '">' + esc(v.name) + '</button>' +
      (views.length > 1 ? '<button type="button" class="mini x" data-vdel="' + i + '" aria-label="Delete view ' + esc(v.name) + '">×</button>' : '') + '</span>'
    ).join('');
    viewLab.textContent = !ready ? 'Loading scene…' : curView >= 0 && views[curView] ? views[curView].name : 'Free view';
    $('#saveview').classList.toggle('nudge', curView < 0);
  }
  $('#views').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.view) {
      curView = +b.dataset.view;
      flyTo(views[curView], 900);
      drawViews();
    } else if (b.dataset.vdel) {
      const i = +b.dataset.vdel;
      views.splice(i, 1);
      if (curView === i) curView = -1; else if (curView > i) curView--;
      drawViews(); drawSheetTable();
    }
  });
  $('#saveview').addEventListener('click', () => {
    if (!ready) return;
    viewCount++;
    const v = Object.assign({ name: 'View ' + viewCount }, curViewObj());
    views.push(v);
    curView = views.length - 1;
    drawViews(); drawSheetTable();
    toast('Saved “' + v.name + '”');
  });

  controls.addEventListener('start', () => { if (anim) anim.cam = null; });
  controls.addEventListener('change', () => {
    if (anim && anim.cam) return;  // our own fly-to, not the user
    if (curView >= 0) { curView = -1; drawViews(); }
    request();
  });
  canvas.addEventListener('keydown', (e) => {
    const m = { ArrowLeft: [-0.06, 0], ArrowRight: [0.06, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key];
    if (!m) return;
    e.preventDefault();
    const off3 = camera.position.clone().sub(controls.target);
    const sph = new THREE.Spherical().setFromVector3(off3);
    sph.theta += m[0];
    sph.phi = Math.max(0.15, Math.min(controls.maxPolarAngle, sph.phi + m[1]));
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sph));
    controls.update();
  });

  /* ---------- render sheet ---------- */
  const sheetEl = $('#sheet'), progEl = $('#prog'), renderBtn = $('#render'), saveBtn = $('#savepng');
  let sheet = null, rendering = false;
  function drawSheetTable() {
    // the sheet on screen is a past render; a changed list of captures or views makes it stale
    if (sheet) $('#sheet-wrap').classList.add('stale');
    progEl.textContent = sheet ? 'Captures or views changed — render again to update.' : '';
  }
  function renderSheet() {
    if (rendering || !ready) return;
    const rows = caps.slice(), cols = views.slice();
    if (!rows.length) { toast('Capture something first'); return; }
    if (!cols.length) { toast('Save a view first'); return; }
    rendering = true; renderBtn.disabled = true; saveBtn.disabled = true;
    const total = rows.length * cols.length;
    let n = 0;
    const out = rows.map(() => []);
    sheetEl.style.setProperty('--cols', cols.length);
    let h = '<span></span>' + cols.map((v) => '<span class="lab col">' + esc(v.name) + '</span>').join('');
    rows.forEach((r, ri) => {
      h += '<span class="lab row">' + esc(r.name) + '</span>';
      cols.forEach((v, ci) => { h += '<span class="cell" id="cell-' + ri + '-' + ci + '"></span>'; });
    });
    sheetEl.innerHTML = h;
    $('#sheet-wrap').classList.remove('stale');
    $('#sheet-wrap').hidden = false;
    const base = clone(state);
    (function step() {
      const ri = Math.floor(n / cols.length), ci = n % cols.length;
      const img = new Image();
      img.src = shot(merge(base, rows[ri].data), cols[ci]);
      img.alt = rows[ri].name + ', ' + cols[ci].name;
      out[ri][ci] = img;
      sheetEl.querySelector('#cell-' + ri + '-' + ci).appendChild(img);
      n++;
      progEl.textContent = n < total ? 'Rendering ' + n + ' / ' + total + '…' : total + ' images · ' + rows.length + ' captures × ' + cols.length + ' views';
      if (n < total) setTimeout(step, REDUCED ? 0 : 60);
      else { rendering = false; renderBtn.disabled = false; saveBtn.disabled = false; sheet = { rows, cols, imgs: out }; }
    })();
  }
  renderBtn.addEventListener('click', renderSheet);

  saveBtn.addEventListener('click', () => {
    if (!sheet) return;
    const cw = 320, chh = 180, gap = 10, lw = 170, th = 44, pad = 28;
    const W = pad * 2 + lw + sheet.cols.length * (cw + gap) - gap;
    const H = pad * 2 + th + sheet.rows.length * (chh + gap) - gap + 30;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#F9F4F0'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'middle';
    g.fillStyle = '#9E5330'; g.font = '700 16px Jost, Futura, sans-serif';
    sheet.cols.forEach((v, ci) => { g.fillText(v.name, pad + lw + ci * (cw + gap), pad + th / 2); });
    sheet.rows.forEach((r, ri) => {
      const y = pad + th + ri * (chh + gap);
      g.fillStyle = '#4E4B48'; g.font = '700 16px Jost, Futura, sans-serif';
      g.fillText(r.name.length > 18 ? r.name.slice(0, 17) + '…' : r.name, pad, y + chh / 2);
      sheet.cols.forEach((v, ci) => { g.drawImage(sheet.imgs[ri][ci], pad + lw + ci * (cw + gap), y, cw, chh); });
    });
    g.fillStyle = '#7A716B'; g.font = '400 13px Jost, Futura, sans-serif';
    g.fillText('Keep it — try-it sheet', pad, H - pad / 2 - 6);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png'); a.download = 'keep-it-sheet.png';
    document.body.appendChild(a); a.click(); a.remove();
  });

  if (window.matchMedia && matchMedia('(hover: none)').matches) $('#vp .hint').textContent = 'Swipe to turn';

  /* ---------- load the scene ---------- */
  drawScene(); drawScope(); drawCaps(); drawViews();
  scene.background = new THREE.Color();
  const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  new GLTFLoader().setDRACOLoader(draco).load(MODEL, (gltf) => {
    const model = gltf.scene;
    scene.add(model);
    // three.js drops the dots from node names: Camera.003 arrives as Camera003
    const VIEW_NAMES = { Camera003: 'Balcony', Camera: 'Courtyard', Camera001: 'Side door', Camera002: 'Corner' };
    const ORDER = ['Camera003', 'Camera', 'Camera001', 'Camera002'];
    const found = {};
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (o.isCamera) {
        const p = new THREE.Vector3(), q = new THREE.Quaternion();
        o.getWorldPosition(p); o.getWorldQuaternion(q);
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
        // aim at the courtyard floor-ish, so orbiting from here turns around what the camera looks at
        const t = fwd.y < -0.05 ? p.clone().add(fwd.clone().multiplyScalar(Math.min(12, (p.y - 0.8) / -fwd.y))) : p.clone().add(fwd.multiplyScalar(5));
        const key = o.name.replace(/_\d+$/, '').replace(/[._]/g, '');
        found[key] = { name: VIEW_NAMES[key] || o.name, pos: p.toArray(), target: t.toArray(), fov: o.fov };
      }
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      if (o.isLight) { o.userData.base = o.intensity * LIGHT_K; o.castShadow = false; if (o.isPointLight || o.isSpotLight) o.decay = 2; }
    });
    views = ORDER.filter((k) => found[k]).map((k) => found[k]);
    if (!views.length) views = [{ name: 'Overview', pos: [8, 9, 12], target: [1, 0.5, 0], fov: 40 }];
    viewCount = views.length;

    // groups come from the Blender collections, tagged on export as the "ki" custom property
    const recolourable = new Set(ELEMENTS.map((e) => e.k));
    const matCache = {};
    model.traverse((o) => {
      const k = o.userData && o.userData.ki;
      if (!k) return;
      const g = groups[k] || (groups[k] = { roots: [], mats: [], lights: [], emit: [] });
      if (!o.parent || !(o.parent.userData && o.parent.userData.ki === k)) g.roots.push({ obj: o, scale: o.scale.clone() });
      o.traverse((d) => {
        if (d.isLight && !g.lights.includes(d)) g.lights.push(d);
        if (!d.isMesh) return;
        const own = (m) => {
          const key = k + '|' + m.uuid;
          if (matCache[key]) return matCache[key];
          const c = m.clone();
          const glow = m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.3;
          if (glow) { g.emit.push(c); }
          else if (recolourable.has(k)) {
            // keep the material's own light/dark against the base colour (a textured bark stays textured)
            c.userData.k = m.map ? 1.6 : 1;
            g.mats.push(c);
          }
          return (matCache[key] = c);
        };
        d.material = Array.isArray(d.material) ? d.material.map(own) : own(d.material);
      });
    });

    if (/[?&]debug(=|&|$)/.test(location.search)) window.__try = { THREE, scene, model, camera, renderer, sun, groups, views, found, shot, BASE, merge, caps: () => caps, set: (d) => { state = merge(state, d); drawScene(); go(0); }, view: (i) => { curView = i; flyTo(views[i], 0); drawViews(); } };
    flyTo(views[0], 0);
    curView = 0;
    ready = true;
    vp.classList.remove('loading');
    drawViews();
    size();
    go(0);
    caps.forEach((c) => { c.thumb = shot(merge(BASE, c.data), views[0]); });
    drawCaps();
    setTimeout(renderSheet, 300);
  }, undefined, (err) => {
    viewLab.textContent = 'Couldn’t load the scene';
    console.error(err);
  });
}
