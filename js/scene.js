// Three.js war room: the plotting table, the room around it, markers, missiles and effects.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MAP, ll2xz, xz2ll } from './geo.js';

const COL = {
  us: 0x6fb3e8, usGlow: 0x9fd3ff, su: 0xe0473a, suGlow: 0xff7a5c, amber: 0xf0a830, paper: 0xe9e1c8,
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const radial = (stops) => canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  stops.forEach(([o, c]) => gr.addColorStop(o, c));
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});

const glowTex = radial([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]);
const smokeTex = canvasTex(128, 128, (g, w) => {
  for (let i = 0; i < 14; i++) {
    const x = w / 2 + (Math.random() - 0.5) * 50, y = w / 2 + (Math.random() - 0.5) * 50, r = 20 + Math.random() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }
});
const scorchTex = radial([[0, 'rgba(10,6,4,0.95)'], [0.45, 'rgba(30,14,8,0.7)'], [0.8, 'rgba(60,30,10,0.25)'], [1, 'rgba(0,0,0,0)']]);

function unitTex(side, type) {
  return canvasTex(128, 88, (g, w, h) => {
    g.fillStyle = side === 'nato' ? '#8cc4ee' : '#ee7a68';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#111'; g.lineWidth = 7;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.lineWidth = 5;
    const L = 10, T = 10, R = w - 10, B = h - 10;
    if (type === 'infantry' || type === 'airborne' || type === 'marine') {
      g.beginPath(); g.moveTo(L, T); g.lineTo(R, B); g.moveTo(R, T); g.lineTo(L, B); g.stroke();
    }
    if (type === 'armor') {
      g.beginPath(); g.ellipse(w / 2, h / 2, 34, 17, 0, 0, Math.PI * 2); g.stroke();
    }
    if (type === 'cavalry') { g.beginPath(); g.moveTo(L, B); g.lineTo(R, T); g.stroke(); }
    if (type === 'airborne') {
      g.beginPath(); g.arc(w / 2 - 11, B - 4, 11, Math.PI, 0); g.arc(w / 2 + 11, B - 4, 11, Math.PI, 0); g.stroke();
    }
    if (type === 'marine') { g.beginPath(); g.arc(w / 2, h / 2 + 4, 12, 0, Math.PI); g.stroke(); }
  });
}

export function createScene(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x060807);
  scene.fog = new THREE.FogExp2(0x060807, 0.018);

  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.05, 200);
  camera.position.set(0, 20, 15);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = false;
  controls.minDistance = 1.2;
  controls.maxDistance = 34;
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 1.18;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  controls.zoomSpeed = 1.1;
  controls.target.set(0, 0, 0);

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(0x9fb0a0, 0x1a120c, 0.55));
  const key = new THREE.DirectionalLight(0xffe2b8, 1.1);
  key.position.set(4, 18, 6);
  scene.add(key);
  const fill = new THREE.PointLight(0xffb070, 30, 40, 1.6);
  fill.position.set(0, 9, 0);
  scene.add(fill);
  const alertLight = new THREE.PointLight(0xff2010, 0, 60, 1.4);
  alertLight.position.set(0, 7, -10);
  scene.add(alertLight);

  // ---- board ----
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.32 });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(MAP.W, MAP.H), boardMat);
  board.rotation.x = -Math.PI / 2;
  scene.add(board);

  const wood = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.55, metalness: 0.05 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a48, roughness: 0.35, metalness: 0.85 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x1d2420, roughness: 0.75, metalness: 0.3 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(MAP.W + 1.2, 0.6, MAP.H + 1.2), wood);
  frame.position.y = -0.31;
  scene.add(frame);
  const rimGeo = (w, d) => new THREE.BoxGeometry(w, 0.06, d);
  [[0, -(MAP.H / 2 + 0.03), MAP.W + 0.12, 0.06], [0, MAP.H / 2 + 0.03, MAP.W + 0.12, 0.06],
    [-(MAP.W / 2 + 0.03), 0, 0.06, MAP.H + 0.12], [MAP.W / 2 + 0.03, 0, 0.06, MAP.H + 0.12]].forEach(([x, z, w, d]) => {
    const m = new THREE.Mesh(rimGeo(w, d), brass);
    m.position.set(x, 0.01, z);
    scene.add(m);
  });
  const pedestal = new THREE.Mesh(new THREE.BoxGeometry(MAP.W - 4, 2.6, MAP.H - 4), steel);
  pedestal.position.y = -1.9;
  scene.add(pedestal);

  // ---- room ----
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x0d0f0d, roughness: 0.9 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.2;
  scene.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x18201b, roughness: 0.92 });
  const wall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  };
  wall(70, 22, 0, 7.8, -17, 0);
  wall(50, 22, -30, 7.8, 0, Math.PI / 2);
  wall(50, 22, 30, 7.8, 0, -Math.PI / 2);
  // acoustic panel grid on back wall
  for (let i = -6; i <= 6; i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 22, 0.2), steel);
    p.position.set(i * 5, 7.8, -16.9);
    scene.add(p);
  }
  // the ring lamp over the table
  const ring = new THREE.Mesh(new THREE.TorusGeometry(19, 0.1, 12, 200),
    new THREE.MeshStandardMaterial({ color: 0x332a1e, emissive: 0xffc98a, emissiveIntensity: 0.8 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 15;
  scene.add(ring);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 8), steel);
    cable.position.set(Math.cos(a) * 19, 19, Math.sin(a) * 19);
    scene.add(cable);
  }

  // wall status boards (canvas textures updated by the game)
  const boards = {};
  const makeBoard = (id, w, h, x, y, z, ry = 0) => {
    const c = document.createElement('canvas');
    c.width = 1024; c.height = Math.round(1024 * h / w);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    m.position.set(x, y, z); m.rotation.y = ry;
    const bezel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, h + 0.4, 0.2), steel);
    bezel.position.set(x, y, z - 0.12); bezel.rotation.y = ry;
    scene.add(bezel, m);
    boards[id] = { c, tex };
  };
  makeBoard('defcon', 9, 5, -14, 7.5, -16.6);
  makeBoard('clocks', 14, 4, 0, 9.2, -16.6);
  makeBoard('tally', 9, 5, 14, 7.5, -16.6);
  makeBoard('side', 10, 6, -29.6, 6.5, -2, Math.PI / 2);

  // red telephone console (opens the diplomatic channel)
  const phone = new THREE.Group();
  const console_ = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.9, 1.4), steel);
  console_.position.y = -1.55;
  const red = new THREE.MeshStandardMaterial({ color: 0xb01810, roughness: 0.35, emissive: 0x400000, emissiveIntensity: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.28, 0.5), red);
  body.position.y = 0.14;
  const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.6, 4, 8), red);
  hand.rotation.z = Math.PI / 2;
  hand.position.y = 0.36;
  phone.add(console_, body, hand);
  phone.position.set(MAP.W / 2 - 1.2, 0, MAP.H / 2 + 1.7);
  scene.add(phone);

  // ---- layers ----
  const markerLayer = new THREE.Group();
  const fxLayer = new THREE.Group();
  scene.add(markerLayer, fxLayer);

  const S = { renderer, scene, camera, controls, boards, markerScale: 1, phone };

  S.setMapTexture = (canvas) => {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (boardMat.map) boardMat.map.dispose();
    boardMat.map = t; boardMat.emissiveMap = t;
    boardMat.needsUpdate = true;
  };

  // ---- markers ----
  const mats = {
    us: new THREE.MeshStandardMaterial({ color: COL.us, emissive: COL.us, emissiveIntensity: 0.6, roughness: 0.4 }),
    su: new THREE.MeshStandardMaterial({ color: COL.su, emissive: COL.su, emissiveIntensity: 0.7, roughness: 0.4 }),
    dead: new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 }),
    city: new THREE.MeshStandardMaterial({ color: 0xf0d38a, emissive: 0xf0a830, emissiveIntensity: 0.55, roughness: 0.5 }),
    cityBar: new THREE.MeshBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.35 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf2f2ea, emissive: 0xffffff, emissiveIntensity: 0.3 }),
    grey: new THREE.MeshStandardMaterial({ color: 0x9aa39a, emissive: 0x556055, emissiveIntensity: 0.4 }),
  };
  const ringMat = new THREE.MeshBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false });
  const unitTexCache = {};

  function selRing(r = 0.16) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.03, 40), ringMat);
    m.rotation.x = -Math.PI / 2; m.position.y = 0.006; m.visible = false;
    return m;
  }

  S.addMarker = (e, kind) => {
    const g = new THREE.Group();
    const inner = new THREE.Group();
    g.add(inner);
    e.obj = { g, inner, kind };
    if (kind === 'site') {
      const k = e.kind;
      if (k === 'slbm') {
        const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.22, 4, 8), mats.us);
        hull.rotation.z = Math.PI / 2; hull.position.y = 0.04;
        const sail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.02), mats.us);
        sail.position.set(0.02, 0.1, 0);
        inner.add(hull, sail);
      } else if (k === 'bomber') {
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.04), mats.us);
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.32), mats.us);
        f.position.y = w.position.y = 0.08;
        inner.add(f, w);
      } else if (k === 'radar') {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14), mats.us);
        post.position.y = 0.07;
        const dish = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3), mats.us);
        dish.position.y = 0.06; dish.rotation.x = Math.PI;
        inner.add(post, dish);
        e.obj.spin = dish;
      } else {
        const silo = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.05, 16), mats.us);
        silo.position.y = 0.025;
        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 10), mats.white);
        nose.position.y = 0.13;
        inner.add(silo, nose);
        e.obj.nose = nose;
      }
      e.obj.mat = mats.us;
    } else if (kind === 'target') {
      const oct = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), mats.su);
      oct.position.y = 0.12;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.025, 6), mats.su);
      base.position.y = 0.012;
      inner.add(oct, base);
      e.obj.spin = oct;
      e.obj.parts = [oct, base];
    } else if (kind === 'city') {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 20), mats.city);
      disc.position.y = 0.01;
      const h = 0.08 + e.pop * 0.05;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, h, 8), mats.cityBar.clone());
      bar.position.y = h / 2;
      inner.add(disc, bar);
      e.obj.bar = bar; e.obj.barH = h;
      e.obj.nikes = [];
    } else if (kind === 'unit') {
      const key = e.side + e.type;
      unitTexCache[key] = unitTexCache[key] || unitTex(e.side, e.type);
      const side = e.side === 'nato' ? mats.us : mats.su;
      const top = new THREE.MeshStandardMaterial({ map: unitTexCache[key], emissive: 0xffffff, emissiveMap: unitTexCache[key], emissiveIntensity: 0.45, roughness: 0.6 });
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.14), [side, side, top, side, side, side]);
      box.position.y = 0.03;
      const barBg = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.025), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      barBg.rotation.x = -Math.PI / 2; barBg.position.set(0, 0.056, -0.1);
      const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.025), new THREE.MeshBasicMaterial({ color: 0x7ee08a }));
      bar.rotation.x = -Math.PI / 2; bar.position.set(0, 0.058, -0.1);
      inner.add(box, barBg, bar);
      e.obj.bar = bar;
      const dl = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineDashedMaterial({ color: e.side === 'nato' ? COL.usGlow : COL.suGlow, dashSize: 0.06, gapSize: 0.04, transparent: true, opacity: 0.8 }));
      dl.visible = false;
      markerLayer.add(dl);
      e.obj.destLine = dl;
    } else if (kind === 'objective') {
      const flag = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.012, 6, 32), new THREE.MeshBasicMaterial({ color: COL.us }));
      flag.rotation.x = -Math.PI / 2; flag.position.y = 0.01;
      const prog = new THREE.Mesh(new THREE.RingGeometry(0.125, 0.15, 32, 1, 0, 0.01), new THREE.MeshBasicMaterial({ color: COL.su, side: THREE.DoubleSide }));
      prog.rotation.x = -Math.PI / 2; prog.position.y = 0.012;
      inner.add(flag, prog);
      e.obj.flag = flag; e.obj.prog = prog;
    } else if (kind === 'airbase') {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.02, 3), mats.grey);
      tri.position.y = 0.01;
      inner.add(tri);
    }
    const sr = selRing(kind === 'unit' ? 0.15 : 0.13);
    inner.add(sr);
    e.obj.sel = sr;
    markerLayer.add(g);
    S.placeMarker(e);
    return g;
  };

  S.placeMarker = (e) => {
    const p = ll2xz(e.lat, e.lon);
    e.obj.g.position.set(p.x, 0, p.z);
  };

  S.removeMarker = (e) => {
    if (!e.obj) return;
    markerLayer.remove(e.obj.g);
    if (e.obj.destLine) markerLayer.remove(e.obj.destLine);
  };

  S.setDead = (e) => {
    e.obj.inner.traverse(o => { if (o.isMesh && o !== e.obj.sel) o.material = mats.dead; });
    if (e.obj.spin) e.obj.spin.scale.set(1, 0.35, 1);
  };

  S.updateCity = (c) => {
    const lost = c.dead / c.pop;
    const b = c.obj.bar;
    b.scale.y = Math.max(0.08, 1 - lost);
    b.position.y = (c.obj.barH * b.scale.y) / 2;
    b.material.color.set(lost > 0.01 ? 0xff5a3a : (c.evac >= 1 ? 0x7ee08a : COL.amber));
    b.material.opacity = c.shelters || c.evac > 0 ? 0.6 : 0.35;
    while (c.obj.nikes.length < c.nike) {
      const n = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09, 6), mats.white);
      const a = c.obj.nikes.length * 2.1;
      n.position.set(Math.cos(a) * 0.1, 0.045, Math.sin(a) * 0.1);
      c.obj.inner.add(n);
      c.obj.nikes.push(n);
    }
  };

  S.updateUnit = (u) => {
    S.placeMarker(u);
    const s = Math.max(0.02, u.str / 100);
    u.obj.bar.scale.x = s;
    u.obj.bar.position.x = -0.1 * (1 - s);
    u.obj.bar.material.color.set(u.str > 60 ? 0x7ee08a : u.str > 30 ? 0xf0c040 : 0xff5a3a);
    u.obj.inner.position.y = u.lifting ? 0.35 : 0;
    const dl = u.obj.destLine;
    if (u.dest && u.side === 'nato') {
      const a = ll2xz(u.lat, u.lon), b = ll2xz(u.dest.lat, u.dest.lon);
      dl.geometry.setFromPoints([new THREE.Vector3(a.x, 0.02, a.z), new THREE.Vector3(b.x, 0.02, b.z)]);
      dl.computeLineDistances();
      dl.visible = true;
    } else dl.visible = false;
  };

  S.updateObjective = (o) => {
    o.obj.flag.material.color.set(o.owner === 'nato' ? COL.us : COL.su);
    const p = Math.abs(o.capture);
    o.obj.prog.visible = p > 0.01;
    if (p > 0.01) {
      o.obj.prog.geometry.dispose();
      o.obj.prog.geometry = new THREE.RingGeometry(0.125, 0.15, 32, 1, 0, Math.PI * 2 * p);
      o.obj.prog.material.color.set(o.capture > 0 ? COL.su : COL.us);
    }
  };

  S.select = (e, on) => { if (e && e.obj) e.obj.sel.visible = on; };

  // ---- missiles ----
  S.launchVisual = (m) => {
    const a = ll2xz(m.from.lat, m.from.lon), b = ll2xz(m.to.lat, m.to.lon);
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const bomber = m.kind === 'bomber' || m.kind === 'air';
    const apex = bomber ? Math.min(0.5, 0.15 + len * 0.02) : Math.min(4.5, 0.35 + len * 0.22);
    const N = 90, pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const y = bomber ? apex * Math.min(1, Math.sin(Math.PI * t) * 4) : apex * Math.sin(Math.PI * t);
      pts.push(new THREE.Vector3(a.x + (b.x - a.x) * t, y + 0.02, a.z + (b.z - a.z) * t));
    }
    const us = m.side === 'us';
    const color = us ? COL.usGlow : COL.suGlow;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    geo.setDrawRange(0, 0);
    const trail = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }));
    const ghost = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color, dashSize: 0.12, gapSize: 0.12, transparent: true, opacity: us ? 0.18 : 0.32 }));
    ghost.computeLineDistances();
    const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    let craft = null;
    if (bomber) {
      craft = new THREE.Group();
      const mt = new THREE.MeshBasicMaterial({ color });
      craft.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.015, 0.025), mt), new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.2), mt));
    }
    const tgt = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    tgt.rotation.x = -Math.PI / 2;
    tgt.position.set(b.x, 0.015, b.z);
    const grp = new THREE.Group();
    grp.add(trail, ghost, head, tgt);
    if (craft) grp.add(craft);
    fxLayer.add(grp);
    m.vis = { grp, trail, ghost, head, craft, tgt, pts, N };
  };

  S.updateMissile = (m, f, visible, time) => {
    const v = m.vis;
    v.grp.visible = visible;
    if (!visible) return;
    const k = Math.min(v.N, Math.floor(f * v.N));
    v.trail.geometry.setDrawRange(0, k + 1);
    const i = Math.min(v.N - 1, Math.floor(f * v.N)), fr = f * v.N - i;
    const p = v.pts[i].clone().lerp(v.pts[i + 1], fr);
    v.head.position.copy(p);
    const s = S.markerScale;
    v.head.scale.setScalar((0.28 + 0.06 * Math.sin(time * 20)) * Math.max(0.35, s));
    if (v.craft) {
      v.craft.position.copy(p);
      v.craft.lookAt(v.pts[i + 1].x, p.y, v.pts[i + 1].z);
      v.craft.rotateY(Math.PI / 2);
      v.craft.scale.setScalar(Math.max(0.4, s));
    }
    v.tgt.scale.setScalar((1 + 0.25 * Math.sin(time * 6)) * Math.max(0.5, s));
  };

  S.removeMissile = (m) => {
    if (!m.vis) return;
    fxLayer.remove(m.vis.grp);
    m.vis.grp.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    m.vis = null;
  };

  S.missileHead = (m) => (m.vis ? m.vis.head.position.clone() : null);

  // ---- effects ----
  const effects = [];
  const scorches = [];
  const sprite = (tex, color, additive) => new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  }));

  S.explosion = (lat, lon, size = 1, nuclear = true) => {
    const p = ll2xz(lat, lon);
    const s = size * Math.max(0.45, Math.min(1.4, S.markerScale));
    const flash = sprite(glowTex, nuclear ? 0xfff2d0 : 0xffb060, true);
    flash.position.set(p.x, 0.15, p.z);
    const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    shock.rotation.x = -Math.PI / 2; shock.position.set(p.x, 0.02, p.z);
    const ball = sprite(glowTex, 0xff8a30, true);
    ball.position.set(p.x, 0.1, p.z);
    fxLayer.add(flash, shock, ball);
    const smokes = [];
    if (nuclear) for (let i = 0; i < 9; i++) {
      const sm = sprite(smokeTex, 0x8a8078, false);
      sm.position.set(p.x + (Math.random() - 0.5) * 0.1 * s, 0.1, p.z + (Math.random() - 0.5) * 0.1 * s);
      sm.userData.vy = (0.25 + Math.random() * 0.25) * s;
      sm.userData.delay = i * 0.08;
      smokes.push(sm);
      fxLayer.add(sm);
    }
    effects.push({
      t: 0, dur: nuclear ? 7 : 2.2, s,
      update(dt) {
        this.t += dt;
        const t = this.t;
        const fl = Math.max(0, 1 - t / (nuclear ? 0.9 : 0.5));
        flash.material.opacity = fl;
        flash.scale.setScalar((nuclear ? 2.4 : 0.9) * s * (0.4 + (1 - fl)));
        const sk = Math.min(1, t / 1.6);
        shock.scale.setScalar((nuclear ? 1.3 : 0.4) * s * sk + 0.01);
        shock.material.opacity = Math.max(0, 0.9 - sk);
        const bl = Math.max(0, 1 - t / (nuclear ? 3 : 1.2));
        ball.material.opacity = bl;
        ball.position.y = 0.1 + Math.min(t, 3) * 0.22 * s * (nuclear ? 1 : 0.2);
        ball.scale.setScalar((nuclear ? 0.7 : 0.35) * s * (1 + t * 0.3));
        ball.material.color.setHSL(0.07, 1, 0.35 + bl * 0.25);
        smokes.forEach(sm => {
          const tt = Math.max(0, t - sm.userData.delay);
          sm.position.y = 0.1 + Math.min(tt, 4) * sm.userData.vy;
          sm.scale.setScalar(0.35 * s * (1 + tt * 0.6));
          sm.material.opacity = Math.min(1, tt * 2) * Math.max(0, 1 - tt / 6.5) * 0.9;
        });
        if (t >= this.dur) { fxLayer.remove(flash, shock, ball, ...smokes); return false; }
        return true;
      },
    });
    if (nuclear) {
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: scorchTex, transparent: true, depthWrite: false }));
      sc.rotation.x = -Math.PI / 2;
      sc.position.set(p.x, 0.003 + scorches.length * 0.00002, p.z);
      sc.scale.setScalar(0.32 * size);
      fxLayer.add(sc);
      scorches.push(sc);
      if (scorches.length > 70) fxLayer.remove(scorches.shift());
    }
  };

  S.burst = (pos, color = 0xffffff) => {
    const fl = sprite(glowTex, color, true);
    fl.position.copy(pos);
    fxLayer.add(fl);
    effects.push({
      t: 0, update(dt) {
        this.t += dt;
        fl.material.opacity = Math.max(0, 1 - this.t / 0.7);
        fl.scale.setScalar(0.6 * Math.max(0.4, S.markerScale) * (0.5 + this.t * 2));
        if (this.t > 0.7) { fxLayer.remove(fl); return false; }
        return true;
      },
    });
  };

  // ---- camera ----
  let fly = null;
  S.flyTo = (lat, lon, dist) => {
    const p = ll2xz(lat, lon);
    const dir = camera.position.clone().sub(controls.target);
    const d = dist || dir.length();
    const toTarget = new THREE.Vector3(p.x, 0, p.z);
    const toCam = toTarget.clone().add(new THREE.Vector3(0, d * 0.8, d * 0.6));
    fly = { t: 0, fromT: controls.target.clone(), fromC: camera.position.clone(), toT: toTarget, toC: toCam };
  };

  // ---- picking helpers ----
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const setRay = (cx, cy) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  S.pickBoard = (cx, cy) => {
    setRay(cx, cy);
    const hit = ray.intersectObject(board)[0];
    return hit ? xz2ll(hit.point.x, hit.point.z) : null;
  };
  S.pickPhone = (cx, cy) => { setRay(cx, cy); return ray.intersectObject(phone, true).length > 0; };
  const v3 = new THREE.Vector3();
  S.project = (lat, lon, y = 0.15) => {
    const p = ll2xz(lat, lon);
    v3.set(p.x, y, p.z).project(camera);
    const r = renderer.domElement.getBoundingClientRect();
    return { x: (v3.x + 1) / 2 * r.width + r.left, y: (1 - v3.y) / 2 * r.height + r.top, vis: v3.z < 1 && Math.abs(v3.x) < 1.1 && Math.abs(v3.y) < 1.1 };
  };
  S.cameraDistance = () => camera.position.distanceTo(controls.target);

  S.setAlert = (level) => { alertLight.userData.level = level; };

  S.resize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', S.resize);

  let time = 0;
  S.render = (dt, markers) => {
    time += dt;
    if (fly) {
      fly.t = Math.min(1, fly.t + dt / 0.9);
      const e = fly.t < 0.5 ? 2 * fly.t * fly.t : 1 - Math.pow(-2 * fly.t + 2, 2) / 2;
      controls.target.lerpVectors(fly.fromT, fly.toT, e);
      camera.position.lerpVectors(fly.fromC, fly.toC, e);
      if (fly.t >= 1) fly = null;
    }
    controls.update();
    // keep the view over the table
    const t = controls.target;
    const cx = Math.max(-MAP.W / 2, Math.min(MAP.W / 2, t.x)), cz = Math.max(-MAP.H / 2, Math.min(MAP.H / 2, t.z));
    if (cx !== t.x || cz !== t.z) { camera.position.x += cx - t.x; camera.position.z += cz - t.z; t.x = cx; t.z = cz; }
    t.y = 0;

    const dist = S.cameraDistance();
    S.markerScale = Math.max(0.16, Math.min(1.6, dist / 13));
    for (const e of markers) {
      if (!e.obj) continue;
      e.obj.g.scale.setScalar(S.markerScale);
      if (e.obj.spin) e.obj.spin.rotation.y += dt * 1.2;
      if (e.obj.sel.visible) e.obj.sel.rotation.z += dt;
    }
    for (let i = effects.length - 1; i >= 0; i--) if (!effects[i].update(dt)) effects.splice(i, 1);
    const lvl = alertLight.userData.level || 0;
    alertLight.intensity = lvl ? (0.5 + 0.5 * Math.sin(time * 5)) * 40 * lvl : 0;
    renderer.render(scene, camera);
  };

  return S;
}
