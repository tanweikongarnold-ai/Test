// Boot, main loop, input and wall boards.
import { createScene } from './scene.js';
import { createGame, DAY, DAYS, fmtM } from './game.js';
import { createUI } from './ui.js';
import { loadCountries, drawPlottingMap, drawGoogleMap, buildLandMask } from './geo.js';
import { initAudio, sfx, setMuted, isMuted } from './audio.js';
import { CAMERA_PRESETS } from './data.js';

const $ = id => document.getElementById(id);
let S, G, ui, sel = null, hover = null, ents = [], isLand = null;

const fx = {
  log: (...a) => ui && ui.log(...a),
  sfx,
  launchVisual: m => S.launchVisual(m),
  removeMissile: m => S.removeMissile(m),
  explosion: (...a) => S.explosion(...a),
  burst: (m, c) => { const p = S.missileHead(m); if (p) S.burst(p, c); },
  setDead: e => S.setDead(e),
  onUnitAdded: u => { S.addMarker(u, 'unit'); rebuildEnts(); },
  onTargetAdded: t => { S.addMarker(t, 'target'); rebuildEnts(); },
  onUnitRemoved: u => { S.removeMarker(u); ui.removeLabel(u); if (sel === u) select(null); rebuildEnts(); },
  onWar: () => { ui.renderPanel(true); ui.renderList(true); },
  onEnd: () => { setTimeout(() => ui.showEnd(), 1800); },
  flash: () => $('view').animate([{ filter: 'brightness(2.4) saturate(0.5)' }, { filter: 'none' }], { duration: 600 }),
};

function rebuildEnts() {
  ents = [...G.airbases, ...G.objectives, ...G.cities, ...G.targets, ...G.sites, ...G.units];
}

// ---------- selection & actions ----------
function canMove(e) { return e && ((e.ent === 'unit' && e.side === 'nato' && !e.mustering) || (e.ent === 'site' && e.mobile && e.alive)); }

function select(e, fly) {
  if (sel) S.select(sel, false);
  sel = e;
  if (sel) {
    S.select(sel, true);
    sfx.click();
    if (fly) S.flyTo(e.lat, e.lon, e.ent === 'unit' || e.ent === 'objective' ? 3.5 : Math.min(S.cameraDistance(), 12));
  }
  ui.setMoveHint(canMove(sel) ? `Click the map to move ${sel.name} · Esc to cancel` : null);
  ui.renderPanel(true);
}

const A = {
  sfx,
  selected: () => sel,
  resume: () => { if (!G.over) G.paused = false; },
  selectKey(key, fly) {
    const [ent, id] = key.split(':');
    const e = ents.find(x => x.ent === ent && String(x.id) === id);
    if (e) { select(e, fly); if (window.innerWidth < 860) $('left').classList.remove('open'); }
  },
  action(act) {
    const [a, b, c] = act.split(':');
    let r = null;
    if (a === 'close') return select(null);
    if (a === 'reload') r = G.reload(sel);
    if (a === 'fire') r = G.launch(G.sites.find(s => s.id === b), G.targets.find(t => t.id === c));
    if (a === 'air') r = G.airStrike(sel);
    if (a === 'recall') r = G.recall(G.missiles.find(m => String(m.id) === b));
    if (a === 'city') r = G.cityAction(sel, b);
    if (a === 'hold') { sel.dest = null; r = { ok: true }; }
    if (a === 'newdiv') r = G.newDivision();
    if (a === 'conelrad') r = G.toggleConelrad();
    if (a === 'zeus') r = G.researchZeus();
    if (a === 'hotline') return openHotline();
    if (r && r.msg) ui.toast(r.msg);
    if (r && !r.ok && r.msg) sfx.bad();
  },
};

function openHotline() {
  if (G.over) return;
  G.paused = true;
  ui.showHotline(() => {
    const r = G.hotline();
    if (r.msg) ui.toast(r.msg);
    if (!G.over) G.paused = false;
  });
}

function confirmDefcon() {
  if (G.war) return;
  G.paused = true;
  const modal = $('modal');
  modal.innerHTML = `<div class="dossier" role="dialog" aria-labelledby="dc1"><span class="stamp">Flash override</span>
    <h1 id="dc1" style="font-size:clamp(36px,7vw,64px)">Go to DEFCON 1?</h1>
    <p>This releases nuclear weapons to joint command and starts the war now, before the Soviet attack. Their launch sites will answer within seconds.</p>
    <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="go" id="dcYes">Authorize</button><button class="go alt" id="dcNo">Stand by</button></div></div>`;
  modal.hidden = false;
  $('dcNo').addEventListener('click', () => { modal.hidden = true; G.paused = false; });
  $('dcYes').addEventListener('click', () => { modal.hidden = true; G.startWar(true); G.paused = false; });
}

// ---------- picking ----------
function pickEntity(cx, cy, radius) {
  let best = null, bd = radius;
  for (const e of ents) {
    const p = S.project(e.lat, e.lon, 0.06 * S.markerScale);
    if (!p.vis) continue;
    const d = Math.hypot(p.x - cx, p.y - cy) - (e.ent === 'objective' ? -4 : 0);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function onBoardClick(cx, cy, touch) {
  if (G.over || !$('modal').hidden) return;
  if (S.pickPhone(cx, cy)) return openHotline();
  const hit = pickEntity(cx, cy, touch ? 30 : 20);
  const pt = S.pickBoard(cx, cy);
  if (canMove(sel) && pt) {
    const friendly = hit && ((hit.ent === 'unit' && hit.side === 'nato') || hit.ent === 'site' || hit.ent === 'city');
    if (!friendly) {
      const dest = hit && (hit.ent === 'unit' || hit.ent === 'target' || hit.ent === 'objective') ? { lat: hit.lat, lon: hit.lon } : pt;
      if (sel.ent === 'site') {
        if (isLand && isLand(dest.lat, dest.lon)) { ui.toast('Submarines need open water.'); return; }
        G.moveSub(sel, dest.lat, dest.lon);
      } else {
        const r = G.moveUnit(sel, dest.lat, dest.lon);
        if (!r.ok && r.msg) { ui.toast(r.msg); return; }
      }
      sfx.click();
      ui.renderPanel(true);
      return;
    }
  }
  select(hit || null);
}

// ---------- wall boards ----------
function drawBoards() {
  const B = S.boards;
  const ink = '#f0a830', paper = '#e9e1c8', red = '#e5513f', bg = '#0b0f0c';
  const font = (w, px, fam = '"Big Shoulders Stencil Display", Impact, sans-serif') => `${w} ${px}px ${fam}`;
  // DEFCON
  {
    const { c, tex } = B.defcon, g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = paper; g.font = font(700, 44); g.textAlign = 'center';
    g.fillText('DEFENSE READINESS CONDITION', c.width / 2, 70);
    const cols = ['#4a7fd0', '#3aa35a', '#e8d35a', '#f0a830', '#e5513f'];
    for (let i = 5; i >= 1; i--) {
      const x = 110 + (5 - i) * 200, lit = G.defcon === i;
      g.fillStyle = lit ? cols[5 - i] : '#1d2420';
      g.beginPath(); g.arc(x, 220, 70, 0, Math.PI * 2); g.fill();
      g.fillStyle = lit ? '#111' : '#56625a'; g.font = font(800, 90);
      g.fillText(String(i), x, 252);
    }
    g.fillStyle = G.defcon === 1 ? red : ink; g.font = font(800, 120);
    g.fillText(G.war ? 'WEAPONS RELEASED' : `DEFCON ${G.defcon}`, c.width / 2, 470);
    tex.needsUpdate = true;
  }
  // clocks
  {
    const { c, tex } = B.clocks, g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    const zones = [['WASHINGTON', -5], ['GREENWICH Z', 0], ['MOSCOW', 3]];
    zones.forEach(([n, off], i) => {
      const d = G.date(off), x = 170 + i * 342;
      g.fillStyle = paper; g.font = font(700, 30); g.textAlign = 'center';
      g.fillText(n, x, 60);
      g.fillStyle = ink; g.font = '700 110px "Courier Prime", monospace';
      g.fillText(`${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`, x, 190);
    });
    g.fillStyle = '#98a18e'; g.font = font(700, 30);
    g.fillText(`DAY ${G.day()} OF ${DAYS}`, c.width / 2, 260);
    tex.needsUpdate = true;
  }
  // tally
  {
    const { c, tex } = B.tally, g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = paper; g.font = font(700, 44); g.textAlign = 'left';
    g.fillText('STRATEGIC SITUATION', 50, 70);
    const rows = [['US LAUNCHES', G.stats.launched, '#86c3ee'], ['SOVIET LAUNCHES', G.stats.sovietLaunches, red], ['INTERCEPTED', G.stats.intercepts, '#86e08f'],
      ['US CASUALTIES', G.casualties() > 0.001 ? fmtM(G.casualties()) : '0', red], ['SOVIET STRIKE POWER', `${Math.round(G.capability() * 100)}%`, ink]];
    rows.forEach(([k, v, col], i) => {
      g.fillStyle = '#98a18e'; g.font = font(700, 40); g.textAlign = 'left';
      g.fillText(k, 50, 150 + i * 82);
      g.fillStyle = col; g.font = '700 54px "Courier Prime", monospace'; g.textAlign = 'right';
      g.fillText(String(v), c.width - 50, 152 + i * 82);
    });
    tex.needsUpdate = true;
  }
  // side: Europe
  {
    const { c, tex } = B.side, g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = paper; g.font = font(700, 50); g.textAlign = 'left';
    g.fillText('CENTRAL FRONT · WEST GERMANY', 50, 80);
    G.objectives.forEach((o, i) => {
      const y = 170 + i * 90;
      g.fillStyle = o.owner === 'nato' ? '#86c3ee' : red;
      g.fillRect(50, y - 40, 26, 50);
      g.fillStyle = paper; g.font = font(700, 50);
      g.fillText(o.name.toUpperCase(), 100, y);
      g.textAlign = 'right'; g.fillStyle = o.owner === 'nato' ? '#86c3ee' : red;
      g.fillText(o.owner === 'nato' ? 'HELD' : 'LOST', c.width - 50, y);
      g.textAlign = 'left';
    });
    tex.needsUpdate = true;
  }
}

// ---------- boot ----------
async function boot() {
  S = createScene($('view'));
  G = createGame(fx);
  ui = createUI(G, S, A);
  rebuildEnts();
  if (location.search.includes('debug')) window.__bb = { G, S, A, select };
  for (const s of G.sites) S.addMarker(s, 'site');
  for (const t of G.targets) S.addMarker(t, 'target');
  for (const c of G.cities) S.addMarker(c, 'city');
  for (const o of G.objectives) S.addMarker(o, 'objective');
  for (const a of G.airbases) S.addMarker(a, 'airbase');
  for (const u of G.units) S.addMarker(u, 'unit');

  const fontWait = Promise.race([
    Promise.all(['800 40px "Big Shoulders Stencil Display"', '700 40px "Big Shoulders Stencil Display"', '600 20px "IBM Plex Sans Condensed"', '700 20px "Courier Prime"'].map(f => document.fonts.load(f))),
    new Promise(r => setTimeout(r, 2500)),
  ]).catch(() => {});
  let countries = null;
  try { countries = await loadCountries('data/countries-50m.json'); } catch (e) { console.warn('Map data unavailable', e); }
  await fontWait;
  if (countries) isLand = buildLandMask(countries);
  S.setMapTexture(drawPlottingMap(countries));
  const p = CAMERA_PRESETS.world;
  S.flyTo(p.lat, p.lon, p.dist);
  drawBoards();
  $('loading').hidden = true;
  requestAnimationFrame(frame);

  ui.showTitle(async ({ src, key }) => {
    initAudio();
    for (const id of ['topbar', 'left', 'teletype', 'theaters']) $(id).hidden = false;
    if (src === 'google') {
      if (!key) ui.toast('No Google key entered, so the plotting map stays on the table.');
      else {
        ui.toast('Fetching Google satellite tiles (one time)…');
        try {
          const g = await drawGoogleMap(key, countries);
          S.setMapTexture(g.canvas);
          const at = document.createElement('div');
          at.textContent = `Map imagery: ${g.attribution} · Google`;
          at.style.cssText = 'position:absolute;right:14px;bottom:62px;font:11px var(--f-ui);color:#e9e1c8;background:#000a;padding:2px 6px;pointer-events:none';
          $('app').appendChild(at);
          ui.toast('Google satellite map loaded. No further map requests this session.');
        } catch (e) {
          ui.toast(`Google map could not load (${e.message}). Check the key has the Map Tiles API enabled. Using the plotting map.`);
        }
      }
    }
    G.defcon = 2;
    G.paused = false;
    ui.log(G.clock(), 'JCS TO ALL COMMANDS: DEFCON 2. SAC ON AIRBORNE ALERT.', 'warn');
    ui.log(G.clock(), 'U-2 RECONNAISSANCE CONFIRMS SOVIET MRBM SITES AT SAN CRISTÓBAL AND SAGUA LA GRANDE.', '');
    ui.log(G.clock(), 'PREPARE CIVIL DEFENSE AND POSITION FORCES. SOVIET ATTACK EXPECTED BY 1800 HOURS.', 'warn');
    ui.renderList(true);
    sfx.alarm();
  });
}

let last = performance.now(), slow = 0, boardT = 0, objT = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!G.paused && !G.over) {
    let sim = dt * G.speed;
    while (sim > 1e-6) { const s = Math.min(0.1, sim); G.step(s); sim -= s; }
  }
  const tsec = now / 1000;
  for (const m of G.missiles) if (m.vis) {
    const f = Math.min(1, (G.t - m.t0) / m.dur);
    S.updateMissile(m, f, m.side === 'us' || f >= m.detectAt, tsec);
  }
  for (const u of G.units) S.updateUnit(u);
  for (const s of G.sites) if (s.mobile) S.placeMarker(s);
  for (const c of G.cities) S.updateCity(c);
  if ((objT += dt) > 0.25) { objT = 0; for (const o of G.objectives) S.updateObjective(o); }
  S.render(dt, ents);
  ui.updateLabels(ents, sel, hover);
  if ((slow += dt) > 0.25) {
    slow = 0;
    ui.updateTop();
    ui.renderPanel();
    ui.renderList();
  }
  if ((boardT += dt) > 1) { boardT = 0; drawBoards(); }
  requestAnimationFrame(frame);
}

// ---------- input ----------
let down = null;
const view = $('view');
view.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), touch: e.pointerType === 'touch', b: e.button }; });
view.addEventListener('pointerup', e => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  if (moved < 6 && performance.now() - down.t < 600 && down.b === 0) onBoardClick(e.clientX, e.clientY, down.touch);
  down = null;
});
view.addEventListener('contextmenu', e => e.preventDefault());
view.addEventListener('pointermove', e => {
  if (down || !G) return;
  hover = pickEntity(e.clientX, e.clientY, 20);
  view.style.cursor = canMove(sel) ? 'crosshair' : hover ? 'pointer' : 'grab';
});

document.querySelectorAll('[data-speed]').forEach(b => b.addEventListener('click', () => {
  const v = +b.dataset.speed;
  if (G.over) return;
  if (v === 0) G.paused = !G.paused; else { G.speed = v; G.paused = false; }
  ui.updateTop();
}));
document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => {
  const p = CAMERA_PRESETS[b.dataset.cam];
  S.flyTo(p.lat, p.lon, p.dist);
}));
$('defcon').addEventListener('click', confirmDefcon);
$('mute').addEventListener('click', () => { setMuted(!isMuted()); $('mute').textContent = isMuted() ? 'Muted' : 'Sound'; });
$('forcesBtn').addEventListener('click', () => {
  const open = $('left').classList.toggle('open');
  $('forcesBtn').setAttribute('aria-expanded', String(open));
});
window.addEventListener('keydown', e => {
  if (!G || e.target.tagName === 'INPUT' || !$('modal').hidden) return;
  if (e.code === 'Space') { e.preventDefault(); if (!G.over) G.paused = !G.paused; }
  if (e.key === 'Escape') select(null);
  const sp = { 1: 1, 2: 2, 3: 4, 4: 4 }[e.key];
  if (sp && !G.over) { G.speed = sp; G.paused = false; }
});

boot().catch(err => {
  console.error(err);
  $('loading').textContent = `The war room failed to start: ${err.message}. WebGL is required.`;
});
