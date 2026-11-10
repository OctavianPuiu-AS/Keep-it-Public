/* Keep it — "Try it" playground. A browser sketch of captures, views and render sheets.
   Not the add-on: a tiny ray-marched studio scene and a pretend Keep it panel. */
(function () {
  'use strict';
  var root = document.getElementById('play');
  if (!root) return;
  var $ = function (s) { return root.querySelector(s); };
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- the scene renderer ---------- */
  var VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes;uniform vec3 uCam,uTgt,uColS,uColB,uColV,uWorld,uVis,uL,uLc;',
    'float sdBox(vec3 p,vec3 b,float r){vec3 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}',
    'float sdCyl(vec3 p,float r,float h,float rr){vec2 d=vec2(length(p.xz)-r+rr,abs(p.y)-h+rr);return min(max(d.x,d.y),0.)+length(max(d,0.))-rr;}',
    'float room(vec3 p){vec2 c=vec2(1.6,-1.0);if(p.y<c.x&&p.z<c.y)return 1.6-length(vec2(p.y,p.z)-c);return min(p.y,p.z+2.6);}',
    'vec2 map(vec3 p){',
    ' vec2 r=vec2(room(p),0.);float s=uVis.x;',
    ' if(s>.01){float d=length(p-vec3(-.95,.42*s,.25))-.42*s;if(d<r.x)r=vec2(d,1.);}',
    ' s=uVis.y;',
    ' if(s>.01){vec3 q=p-vec3(.1,.46*s,-.5);float c=cos(.55),n=sin(.55);q.xz=mat2(c,-n,n,c)*q.xz;float d=sdBox(q,vec3(.34,.46,.34)*s,.05*s);if(d<r.x)r=vec2(d,2.);}',
    ' s=uVis.z;',
    ' if(s>.01){float d=sdCyl(p-vec3(1.,.62*s,.3),.26*s,.62*s,.07*s);if(d<r.x)r=vec2(d,3.);}',
    ' return r;}',
    'vec3 nrm(vec3 p){vec2 e=vec2(.0015,-.0015);return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}',
    'float shadow(vec3 ro,vec3 rd){float res=1.,t=.02;for(int i=0;i<40;i++){float h=map(ro+rd*t).x;res=min(res,9.*h/t);t+=clamp(h,.02,.3);if(res<.002||t>8.)break;}return clamp(res,0.,1.);}',
    'float occ(vec3 p,vec3 n){float o=0.,s=1.;for(int i=1;i<=5;i++){float h=.03+.11*float(i);o+=(h-map(p+n*h).x)*s;s*=.75;}return clamp(1.-1.6*o,0.,1.);}',
    'void main(){',
    ' vec2 uv=(2.*gl_FragCoord.xy-uRes)/uRes.y;',
    ' vec3 ww=normalize(uTgt-uCam),uu=normalize(cross(ww,vec3(0,1,0))),vv=cross(uu,ww);',
    ' vec3 rd=normalize(uv.x*uu+uv.y*vv+2.4*ww);',
    ' float t=0.;vec2 h=vec2(0.,-1.);',
    ' for(int i=0;i<120;i++){vec2 m=map(uCam+rd*t);if(m.x<.0007*t){h=m;break;}t+=m.x;if(t>25.)break;}',
    ' vec3 col=uWorld;',
    ' if(h.y>-.5){',
    '  vec3 p=uCam+rd*t,n=nrm(p);',
    '  vec3 alb=h.y<.5?uWorld:h.y<1.5?uColS:h.y<2.5?uColB:uColV;',
    '  float dif=clamp(dot(n,uL),0.,1.);',
    '  if(dif>0.)dif*=shadow(p+n*.003,uL);',
    '  float o=occ(p,n);',
    '  float amb=.55+.45*n.y;',
    '  vec3 hv=normalize(uL-rd);',
    '  float obj=step(.5,h.y);',
    '  float sp=pow(clamp(dot(n,hv),0.,1.),mix(8.,60.,obj))*dif*mix(.02,.4,obj);',
    '  float fre=pow(1.-clamp(dot(n,-rd),0.,1.),4.)*obj;',
    '  vec3 lin=uLc*dif*2.0+mix(uWorld,vec3(1.),.45)*amb*o*.5+uWorld*clamp(-n.y,0.,1.)*.25*o;',
    '  col=alb*lin+uLc*sp+mix(uWorld,vec3(1.),.3)*fre*.12*o;',
    ' }',
    ' col*=.85;',
    ' col=col*(2.51*col+.03)/(col*(2.43*col+.59)+.14);',
    ' col=pow(clamp(col,0.,1.),vec3(1./2.2));',
    ' vec2 q=gl_FragCoord.xy/uRes;col*=.86+.14*pow(16.*q.x*q.y*(1.-q.x)*(1.-q.y),.2);',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  var TGT = [0.05, 0.5, -0.1];

  function camPos(d) {
    var a = d.az * Math.PI / 180, e = d.el * Math.PI / 180;
    return [TGT[0] + d.dist * Math.sin(a) * Math.cos(e), TGT[1] + d.dist * Math.sin(e), TGT[2] + d.dist * Math.cos(a) * Math.cos(e)];
  }
  function mix3(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  function lightColor(w) {
    var cool = [0.68, 0.8, 1.0], white = [1, 1, 1], warm = [1.0, 0.72, 0.48];
    return w < 0.5 ? mix3(cool, white, w * 2) : mix3(white, warm, (w - 0.5) * 2);
  }

  function makeRenderer(canvas) {
    var gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, alpha: false });
    if (!gl) return null;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uRes', 'uCam', 'uTgt', 'uColS', 'uColB', 'uColV', 'uWorld', 'uVis', 'uL', 'uLc'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    return function draw(d) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform3fv(U.uCam, camPos(d));
      gl.uniform3fv(U.uTgt, TGT);
      gl.uniform3fv(U.uColS, d.cS); gl.uniform3fv(U.uColB, d.cB); gl.uniform3fv(U.uColV, d.cV);
      gl.uniform3fv(U.uWorld, d.w); gl.uniform3fv(U.uVis, d.vis);
      var a = d.la * Math.PI / 180, e = 38 * Math.PI / 180;
      gl.uniform3f(U.uL, Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
      var lc = lightColor(d.lw);
      gl.uniform3f(U.uLc, lc[0] * d.lp, lc[1] * d.lp, lc[2] * d.lp);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  }

  /* ---------- data ---------- */
  var OBJECTS = [{ k: 'sphere', name: 'Sphere' }, { k: 'box', name: 'Box' }, { k: 'vase', name: 'Vase' }];
  var MATS = [['Clay', '#9E5330'], ['Linen', '#E9DFD3'], ['Sage', '#8A9A7B'], ['Ink', '#3E3B39'], ['Slate', '#5B7A99'], ['Ochre', '#C9A04F']];
  var WORLDS = [['Sand', '#E8D9CC'], ['Fog', '#C9CDD0'], ['Moss', '#B9C2AE'], ['Night', '#3A3634']];
  var CATS = [{ k: 'vis', label: 'Visibility' }, { k: 'col', label: 'Materials' }, { k: 'light', label: 'Lights' }, { k: 'world', label: 'World' }];

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function lin(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) { return Math.pow(c / 255, 2.2); });
  }
  function pick(st, cats) { var o = {}; cats.forEach(function (k) { o[k] = clone(st[k]); }); return o; }
  function merge(st, data) { var o = clone(st); Object.keys(data).forEach(function (k) { o[k] = clone(data[k]); }); return o; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  var BASE = {
    vis: [1, 1, 1],
    col: { sphere: '#9E5330', box: '#E9DFD3', vase: '#8A9A7B' },
    light: { angle: -35, warm: 0.75, power: 1 },
    world: '#E8D9CC'
  };
  var state = clone(BASE);

  var views = [
    { name: 'Front', az: 0, el: 6, dist: 4.7 },
    { name: 'Three-quarter', az: 32, el: 16, dist: 4.5 },
    { name: 'High', az: 10, el: 48, dist: 5.2 },
    { name: 'Close', az: -28, el: 10, dist: 2.9 }
  ];
  var cam = clone(views[1]);
  var curView = 1;
  var viewCount = views.length;

  var caps = [
    { id: 1, name: 'Warm studio', data: pick(BASE, ['vis', 'col', 'light', 'world']) },
    { id: 2, name: 'Cool morning', data: {
      vis: [1, 1, 1], col: { sphere: '#5B7A99', box: '#3E3B39', vase: '#E9DFD3' },
      light: { angle: 55, warm: 0.15, power: 0.9 }, world: '#C9CDD0' } },
    { id: 3, name: 'Hero sphere', data: {
      vis: [1, 0, 0], col: { sphere: '#C9A04F', box: '#E9DFD3', vase: '#8A9A7B' } } }
  ];
  var nextId = 4, capCount = caps.length;
  var active = 1, latest = null;

  /* ---------- drawing ---------- */
  var canvas = $('#vp-canvas');
  var drawMain = null, drawThumb = null, off = document.createElement('canvas');
  off.width = 384; off.height = 216;
  try { drawMain = makeRenderer(canvas); drawThumb = makeRenderer(off); } catch (e) { drawMain = null; }
  if (!drawMain || !drawThumb) {
    $('#vp').classList.add('nogl');
    $('#vp-msg').textContent = 'This browser can’t draw the 3D scene (WebGL is off), so the playground can’t run here.';
    return;
  }

  function toNum(st, v) {
    return { vis: st.vis.slice(), cS: lin(st.col.sphere), cB: lin(st.col.box), cV: lin(st.col.vase), w: lin(st.world),
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
    drawMain(disp);
    if (anim) request();
  }
  function request() { if (!pending) { pending = true; requestAnimationFrame(frame); } }
  function go(dur) {
    var to = toNum(state, cam);
    if (REDUCED || !dur) { anim = null; disp = to; }
    else anim = { from: disp, to: to, t0: performance.now(), dur: dur };
    request();
  }
  function shot(st, v) { drawThumb(toNum(st, v)); return off.toDataURL('image/jpeg', 0.86); }

  function size() {
    var w = canvas.clientWidth, dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.max(2, Math.round(w * dpr));
    canvas.height = Math.max(2, Math.round(w * 9 / 16 * dpr));
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
      cam = clone(views[curView]);
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
    var v = { name: 'View ' + viewCount, az: Math.round(cam.az), el: Math.round(cam.el), dist: cam.dist };
    views.push(v);
    curView = views.length - 1;
    drawViews(); drawSheetTable();
    toast('Saved “' + v.name + '”');
  });

  function orbit(dAz, dEl) {
    cam.az = Math.max(-75, Math.min(75, cam.az + dAz));
    cam.el = Math.max(2, Math.min(70, cam.el + dEl));
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

  /* ---------- start ---------- */
  caps.forEach(function (c) { c.thumb = shot(merge(BASE, c.data), views[1]); });
  drawScene(); drawScope(); drawCaps(); drawViews();
  go(0);
  setTimeout(renderSheet, 250);
})();
