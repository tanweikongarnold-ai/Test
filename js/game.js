// Simulation: strategic exchange, ground war, civil defense, budget and scoring.
import { US_SITES, SOVIET_TARGETS, HIDDEN_TARGETS, CITIES, UNITS, OBJECTIVES, AIR_BASES, SOVIET_SPAWNS, SOVIET_UNIT_NAMES, FORT_HOOD, COSTS } from './data.js';
import { km, deg, stepToward } from './geo.js';

export const DAY = 72;            // sim seconds per game day
export const DAYS = 13;           // the crisis lasts thirteen days
const WAR_AT = 36;                // Soviet attack at 18:00 on day one unless you move first
const MIN_PER_SEC = 1440 / DAY;
const START = Date.UTC(1962, 9, 22, 11, 0); // 06:00 EST, Mon 22 Oct 1962
const LOSS_CASUALTIES = 25;       // millions
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const weighted = (arr, w) => {
  const tot = arr.reduce((s, x) => s + w(x), 0);
  let r = Math.random() * tot;
  for (const x of arr) { r -= w(x); if (r <= 0) return x; }
  return arr[arr.length - 1];
};
const COASTAL = ['nyc', 'bos', 'phl', 'dc', 'bal', 'mia', 'sf', 'la', 'sea', 'hou', 'nola'];
const ATK = { armor: 1.25, infantry: 1, airborne: 0.95, cavalry: 0.8, marine: 1.05 };
const SPEED = { armor: 0.024, cavalry: 0.028, infantry: 0.017, airborne: 0.017, marine: 0.017 };
const COOL = { icbm: 8, irbm: 6, slbm: 4, bomber: 2 }; // launch crew re-cycle, sim seconds
const ENGAGE = 0.35, OBJ_R = 0.3;

export function createGame(fx) {
  let uid = 0;
  const G = {
    t: 0, speed: 1, paused: true, defcon: 3, war: false, warAt: null, over: null,
    budget: 40, incomeMult: 1, emergencyDay: 0,
    conelrad: false, zeus: 0, zeusAt: 0, bmews: true, c2: false,
    lastHotline: -999, hotlineTries: 0, newDivisions: 0, warned: false,
    stats: { launched: 0, hits: 0, lostLaunches: 0, intercepts: 0, groundCaptures: 0, airStrikes: 0, sovietLaunches: 0 },
    sites: US_SITES.map(s => ({ ...s, ent: 'site', max: s.missiles, hp: 100, alive: true, queue: [], dest: null, readyAt: 0 })),
    targets: SOVIET_TARGETS.map(s => ({ ...s, ent: 'target', hp: 100, alive: true, left: s.salvo, next: 0, cap: 0 })),
    hidden: HIDDEN_TARGETS.map(s => ({ ...s, ent: 'target', hp: 100, alive: true, left: s.salvo, next: 0, cap: 0 })),
    cities: CITIES.map(c => ({ ...c, ent: 'city', dead: 0, fallout: 0, shelters: false, evac: 0, evacuating: false, nike: 0, relief: 0 })),
    units: UNITS.map(u => ({ ...u, ent: 'unit', id: 'u' + uid++, str: u.str || (u.cuba ? 80 : 100), dest: null, still: 0, lifting: false, engaged: false })),
    objectives: OBJECTIVES.map(o => ({ ...o, ent: 'objective', owner: 'nato', capture: 0 })),
    airbases: AIR_BASES.map(a => ({ ...a, ent: 'airbase', ready: 0 })),
    missiles: [],
    reinforceAt: 0,
  };
  G.totalPop = G.cities.reduce((s, c) => s + c.pop, 0);

  const log = (msg, cls) => fx.log(G.clock(), msg, cls);

  // ---------- derived values ----------
  G.day = () => Math.min(DAYS, Math.floor(G.t / DAY) + 1);
  G.clock = () => {
    const d = new Date(START + G.t * MIN_PER_SEC * 60e3 - 5 * 3600e3);
    return `${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
  };
  G.date = (offsetH = -5) => new Date(START + G.t * MIN_PER_SEC * 60e3 + offsetH * 3600e3);
  G.casualties = () => G.cities.reduce((s, c) => s + c.dead, 0);
  G.capability = () => G.targets.reduce((s, t) => s + (t.alive ? t.salvo : 0), 0) / G.targets.reduce((s, t) => s + t.salvo, 0);
  G.held = () => G.objectives.filter(o => o.owner === 'nato').length;
  G.cubaLeft = () => G.targets.filter(t => t.cuba && t.alive).length;
  G.income = () => (8 / DAY) * G.incomeMult * (1 - 0.02 * G.cities.filter(c => c.evacuating || c.evac > 0).length);
  G.inRange = (site, tg) => site.alive && site.range > 0 && km(site, tg) <= site.range;
  G.launchersFor = tg => G.sites.filter(s => s.kind !== 'radar' && G.inRange(s, tg));
  G.airbaseFor = tg => G.airbases.filter(a => km(a, tg) <= a.range).sort((a, b) => a.ready - b.ready)[0] || null;
  G.flightTime = (site, tg) => {
    const d = km(site, tg);
    if (site.kind === 'bomber') return site.flight * (0.4 + 0.6 * d / 9000);
    const ref = site.kind === 'icbm' ? 9000 : 2600;
    return site.flight * (0.45 + 0.55 * Math.min(1.2, d / ref));
  };

  const spend = (cost, what) => {
    if (G.budget < cost) return { ok: false, msg: `Not enough funds for ${what}: need $${cost}B, have $${G.budget.toFixed(1)}B.` };
    G.budget -= cost;
    return { ok: true };
  };
  const needWar = () => (G.war ? null : { ok: false, msg: 'Weapons release requires DEFCON 1. Authorize it from the top bar.' });

  // ---------- war state ----------
  G.startWar = (byUs) => {
    if (G.war) return;
    G.war = true; G.defcon = 1; G.warAt = G.t;
    G.reinforceAt = G.t + 40;
    for (const tg of G.targets) if (tg.every) tg.next = G.t + rnd(12, tg.every * 0.8);
    const first = { plesetsk: 3, yurya: 6, sancristobal: 4 };
    for (const tg of G.targets) if (first[tg.id]) tg.next = G.t + first[tg.id];
    if (byUs) log('DEFCON 1 AUTHORIZED BY THE PRESIDENT. WEAPONS RELEASE GRANTED TO JOINT COMMAND.', 'warn');
    log('WARSAW PACT ARMOR CROSSING THE INNER GERMAN BORDER AT FULDA AND HELMSTEDT.', 'red');
    log('NORAD: MULTIPLE LAUNCHES DETECTED. ALL COMMANDS DEFCON 1.', 'red');
    fx.sfx.alarm();
    fx.onWar();
  };

  // ---------- missiles ----------
  function addMissile(m) {
    m.id = uid++;
    m.t0 = G.t;
    G.missiles.push(m);
    fx.launchVisual(m);
  }

  G.launch = (site, tg) => {
    const w = needWar(); if (w) return w;
    if (!site.alive) return { ok: false, msg: `${site.name} has been destroyed.` };
    if (site.missiles <= 0) return { ok: false, msg: `${site.name} has nothing left to launch. Order a reload.` };
    if (!G.inRange(site, tg)) return { ok: false, msg: `${tg.name} is out of range of ${site.name}.` };
    if (site.readyAt > G.t) return { ok: false, msg: `${site.name} launch crews are re-cycling (${Math.ceil(site.readyAt - G.t)}s).` };
    site.missiles--;
    site.readyAt = G.t + COOL[site.kind];
    const bomber = site.kind === 'bomber';
    const m = { side: 'us', kind: site.kind, from: { lat: site.lat, lon: site.lon }, to: { lat: tg.lat, lon: tg.lon }, target: tg, src: site, dur: G.flightTime(site, tg), detectAt: 0 };
    if (Math.random() > site.rel) m.failAt = rnd(0.08, 0.45);
    if (bomber && Math.random() < 0.28) m.interceptAt = rnd(0.75, 0.92);
    addMissile(m);
    G.stats.launched++;
    log(`${site.name.toUpperCase()}: ${bomber ? 'B-52 FLIGHT AIRBORNE' : 'LAUNCH'} → ${tg.name.toUpperCase()}. ETA ${Math.round(m.dur)}s.`, 'us');
    fx.sfx.launch();
    return { ok: true };
  };

  G.reload = (site) => {
    if (!site.alive) return { ok: false, msg: 'The site is destroyed.' };
    if (site.missiles + site.queue.length >= site.max) return { ok: false, msg: 'Launchers are already full.' };
    const p = spend(site.cost, 'a reload'); if (!p.ok) return p;
    const last = site.queue.length ? site.queue[site.queue.length - 1] : G.t;
    site.queue.push(Math.max(last, G.t) + site.reload);
    return { ok: true, msg: `Reload ordered at ${site.name}.` };
  };

  G.recall = (m) => {
    if (m.kind !== 'bomber' || m.side !== 'us' || m.done) return { ok: false };
    m.done = true;
    fx.removeMissile(m);
    m.src.missiles = Math.min(m.src.max, m.src.missiles + 1);
    log(`B-52 FLIGHT RECALLED TO ${m.src.name.toUpperCase()} AT FAIL-SAFE POINT.`, 'us');
    return { ok: true };
  };

  G.airStrike = (tg) => {
    const w = needWar(); if (w) return w;
    const base = G.airbaseFor(tg);
    if (!base) return { ok: false, msg: 'No tactical air base within range.' };
    if (base.ready > G.t) return { ok: false, msg: `${base.name} is rearming (${Math.ceil(base.ready - G.t)}s).` };
    const p = spend(COSTS.airstrike, 'an air strike'); if (!p.ok) return p;
    base.ready = G.t + 8;
    const m = { side: 'us', kind: 'air', from: { lat: base.lat, lon: base.lon }, to: { lat: tg.lat, lon: tg.lon }, target: tg, dur: 3 + km(base, tg) / 350, detectAt: 0 };
    if (Math.random() < 0.1) m.interceptAt = rnd(0.6, 0.9);
    addMissile(m);
    G.stats.airStrikes++;
    log(`${base.name.toUpperCase()}: F-105 STRIKE PACKAGE INBOUND ON ${tg.name.toUpperCase()}.`, 'us');
    return { ok: true };
  };

  function sovietLaunch(tg) {
    let dest = null, kind = tg.kind, from = { lat: tg.lat, lon: tg.lon }, dur = 12;
    const aliveSites = G.sites.filter(s => s.alive && !s.mobile && s.kind !== 'irbm');
    const cityW = c => Math.max(0.05, c.pop - c.dead);
    if (kind === 'icbm') {
      dest = Math.random() < 0.65 || !aliveSites.length ? weighted(G.cities, cityW) : pick(aliveSites);
      dur = 11 + km(tg, dest) / 1800;
    } else if (kind === 'mrbm') {
      const pool = G.cities.filter(c => km(tg, c) < 2100);
      dest = weighted(pool, cityW);
      dur = 5 + km(tg, dest) / 700;
    } else if (kind === 'bomber') {
      dest = Math.random() < 0.85 || !aliveSites.length ? weighted(G.cities, cityW) : pick(aliveSites);
      dur = 18 + km(tg, dest) / 450;
    } else if (kind === 'sub') {
      const west = tg.id === 'vladivostok';
      const pool = G.cities.filter(c => COASTAL.includes(c.id) && (west ? c.lon < -110 : c.lon > -100));
      dest = weighted(pool, cityW);
      from = west ? { lat: dest.lat - 1, lon: dest.lon - 7 } : { lat: dest.lat - 2.5, lon: dest.lon + 7 };
      kind = 'slbm';
      dur = 7;
      log('SOSUS: SOVIET GOLF-CLASS SUBMARINE SURFACED OFF THE COAST.', 'red');
    } else if (kind === 'irbm') {
      const pool = [...G.sites.filter(s => s.alive && s.kind === 'irbm'), ...G.units.filter(u => u.side === 'nato' && u.lat > 44 && u.lon > -12 && !u.lifting)];
      if (!pool.length) return;
      dest = pick(pool);
      dur = 7 + km(tg, dest) / 600;
    }
    if (!dest) return;
    const m = { side: 'su', kind, from, to: { lat: dest.lat, lon: dest.lon }, target: dest, src: tg, dur };
    m.detectAt = (kind === 'icbm' || kind === 'bomber') && !G.bmews ? 0.55 : 0;
    // defenses
    if (dest.ent === 'city') {
      const per = kind === 'bomber' ? 0.35 : (G.zeus === 2 ? 0.16 : 0.06);
      let pass = (1 - per) ** dest.nike;
      if (kind === 'bomber') pass *= 0.75; // Air Defense Command interceptors
      if (Math.random() > pass) m.interceptAt = rnd(0.82, 0.95);
    } else if (kind === 'bomber' && Math.random() < 0.25) m.interceptAt = rnd(0.8, 0.95);
    addMissile(m);
    G.stats.sovietLaunches++;
    if (dest.ent === 'city' && !G.warned) { G.warned = true; }
    m.announced = false;
  }

  function impact(m) {
    const tg = m.target;
    if (m.side === 'us') {
      const nuclear = m.kind !== 'air';
      fx.explosion(m.to.lat, m.to.lon, nuclear ? (m.kind === 'bomber' ? 1.2 : 1) : 0.5, nuclear);
      fx.sfx[nuclear ? 'boom' : 'thud'](nuclear ? 0.8 : 0.5);
      if (tg.ent === 'unit') {
        if (G.units.includes(tg)) {
          const d = 28 * rnd(0.8, 1.2);
          tg.str -= d;
          log(`AIR STRIKE ON ${tg.name.toUpperCase()}: −${Math.round(d)}% STRENGTH.`, 'us');
        } else log('AIR STRIKE: TARGET FORMATION NO LONGER AT POSITION.', 'dim');
        return;
      }
      if (!tg.alive) { log(`${tg.name.toUpperCase()}: TARGET ALREADY DESTROYED. WEAPON WASTED.`, 'dim'); return; }
      const base = { bomber: 90, icbm: 75, irbm: 68, slbm: 62, air: 30 }[m.kind];
      const dmg = base * (1 - tg.hard * 0.5) * rnd(0.8, 1.2);
      tg.hp -= dmg;
      G.stats.hits++;
      if (tg.hp <= 0) destroyTarget(tg, false);
      else log(`BDA ${tg.name.toUpperCase()}: DAMAGED, ${Math.max(0, Math.round(tg.hp))}% OPERATIONAL.`, 'us');
      return;
    }
    // Soviet weapon arriving
    fx.explosion(m.to.lat, m.to.lon, m.kind === 'bomber' ? 1.1 : 1, true);
    fx.sfx.boom(1);
    if (tg.ent === 'city') {
      const remaining = tg.pop - tg.dead;
      const y = { icbm: 0.15, slbm: 0.08, mrbm: 0.1, bomber: 0.16 }[m.kind] || 0.12;
      const prot = Math.min(0.8, (G.conelrad ? 0.1 : 0) + (tg.shelters ? 0.3 : 0) + tg.evac * 0.5);
      const now = remaining * y * (1 - prot);
      tg.dead += now;
      tg.fallout += now * (tg.shelters ? 0.2 : 0.45) * (tg.relief > G.t ? 0.4 : 1);
      log(`NUCLEAR DETONATION OVER ${tg.name.toUpperCase()}. EST. ${fmtM(now)} KILLED.${prot > 0 ? ` CIVIL DEFENSE SAVED ~${fmtM(remaining * y * prot)}.` : ''}`, 'red');
      fx.flash();
    } else if (tg.ent === 'site') {
      if (!tg.alive) return;
      tg.hp -= (m.kind === 'irbm' ? 70 : 85) * (1 - tg.hard * 0.6) * rnd(0.8, 1.2);
      if (tg.hp <= 0) {
        tg.alive = false; tg.missiles = 0; tg.queue = [];
        fx.setDead(tg);
        if (tg.kind === 'radar') { G.bmews = false; log('THULE BMEWS OFF THE AIR. BALLISTIC WARNING TIME REDUCED.', 'red'); }
        else log(`${tg.name.toUpperCase()} DESTROYED.`, 'red');
      } else log(`${tg.name.toUpperCase()} HIT. ${Math.round(tg.hp)}% OPERATIONAL.`, 'warn');
    } else if (tg.ent === 'unit') {
      if (G.units.includes(tg)) {
        const d = 45 * (tg.still > 8 ? 0.75 : 1) * rnd(0.8, 1.2);
        tg.str -= d;
        log(`SOVIET IRBM STRIKE ON ${tg.name.toUpperCase()}: −${Math.round(d)}% STRENGTH.`, 'red');
      }
    }
  }

  function destroyTarget(tg, byGround) {
    tg.alive = false; tg.left = 0; tg.hp = 0;
    fx.setDead(tg);
    fx.sfx.good();
    log(`${tg.name.toUpperCase()} ${byGround ? 'SEIZED BY US GROUND FORCES' : 'DESTROYED'}.`, 'good');
    if (byGround) G.stats.groundCaptures++;
    if (tg.kind === 'command') { G.c2 = true; log('SOVIET STRATEGIC ROCKET FORCES COMMAND DISRUPTED. LAUNCH TEMPO SLOWING.', 'good'); }
    if (tg.kind === 'supply') log('WARSAW PACT REINFORCEMENT FLOW TO THE FRONT REDUCED.', 'good');
    if (tg.cuba && G.cubaLeft() === 0) log('ALL CUBAN MISSILE SITES NEUTRALIZED.', 'good');
  }

  // ---------- ground ----------
  G.moveUnit = (u, lat, lon) => {
    if (u.side !== 'nato') return { ok: false };
    const d = deg(u, { lat, lon });
    if (d > 3.5) {
      const p = spend(COSTS.lift, 'strategic airlift'); if (!p.ok) return p;
      u.lifting = true;
      log(`MATS AIRLIFT: ${u.name.toUpperCase()} EMBARKING.`, 'us');
    }
    u.dest = { lat, lon };
    return { ok: true };
  };
  G.moveSub = (s, lat, lon) => { s.dest = { lat, lon }; return { ok: true }; };

  G.newDivision = () => {
    if (G.newDivisions >= 3) return { ok: false, msg: 'No further reserve divisions can be federalized.' };
    const p = spend(COSTS.newDivision, 'a new division'); if (!p.ok) return p;
    G.newDivisions++;
    const names = ['49th Armored Division (TXARNG)', '32nd Infantry Division (WIARNG)', '26th Infantry Division (MAARNG)'];
    const u = { name: names[G.newDivisions - 1], short: ['49 AD', '32 ID', '26 ID'][G.newDivisions - 1], side: 'nato', type: G.newDivisions === 1 ? 'armor' : 'infantry', lat: FORT_HOOD.lat, lon: FORT_HOOD.lon, ent: 'unit', id: 'u' + uid++, str: 0, dest: null, still: 0, lifting: false, engaged: false, mustering: G.t + 30 };
    G.units.push(u);
    fx.onUnitAdded(u);
    log(`NATIONAL GUARD DIVISION FEDERALIZED AT FORT HOOD. READY IN 30s.`, 'us');
    return { ok: true };
  };

  function spawnSoviet() {
    const sp = pick(SOVIET_SPAWNS);
    const type = Math.random() < 0.5 ? 'armor' : 'infantry';
    const u = { name: pick(SOVIET_UNIT_NAMES), short: type === 'armor' ? 'TD' : 'MRD', side: 'ussr', type, lat: sp.lat + rnd(-0.2, 0.2), lon: sp.lon, ent: 'unit', id: 'u' + uid++, str: 75, dest: null, still: 0, lifting: false, engaged: false };
    G.units.push(u);
    fx.onUnitAdded(u);
    log(`ELINT: FRESH WARSAW PACT ${type === 'armor' ? 'TANK' : 'MOTOR RIFLE'} DIVISION ENTERING EAST GERMANY.`, 'warn');
  }

  function groundTick(dt) {
    const dmg = new Map();
    const live = G.units.filter(u => !u.lifting && !(u.mustering > G.t));
    for (const u of live) {
      const foes = live.filter(e => e.side !== u.side && deg(u, e) <= ENGAGE);
      u.engaged = foes.length > 0;
      if (!G.war) continue;
      for (const e of foes) {
        const nearObj = G.objectives.some(o => o.owner === (e.side === 'nato' ? 'nato' : 'ussr') && deg(o, e) <= OBJ_R);
        const def = 1 + (e.still >= 8 ? (e.side === 'nato' ? 0.8 : 0.4) : 0) + (nearObj ? 0.25 : 0);
        const share = 1 / foes.length;
        dmg.set(e, (dmg.get(e) || 0) + 1.6 * ATK[u.type] * (u.side === 'ussr' ? 0.85 : 1) * (u.str / 100) * dt * share / def);
      }
    }
    for (const [u, d] of dmg) u.str -= d;

    for (const u of G.units) {
      if (u.mustering) {
        if (u.mustering <= G.t) { u.mustering = 0; u.str = 100; log(`${u.name.toUpperCase()} READY FOR DEPLOYMENT.`, 'us'); }
        else { u.str = 100 * (1 - (u.mustering - G.t) / 30); continue; }
      }
      // Soviet orders
      if (u.side === 'ussr' && G.war && !u.cuba && !u.engaged) {
        const goals = G.objectives.filter(o => o.owner !== 'ussr');
        if (goals.length) {
          const g = goals.reduce((a, b) => (deg(u, a) - a.lon * 0.15 < deg(u, b) - b.lon * 0.15 ? a : b));
          u.dest = { lat: g.lat, lon: g.lon };
        } else u.dest = null;
      }
      const before = { lat: u.lat, lon: u.lon };
      if (u.dest && (!u.engaged || u.side === 'nato' || u.lifting)) {
        const sp = u.lifting ? 0.8 : SPEED[u.type] * (u.engaged ? 0.5 : 1) * (u.side === 'ussr' ? 0.6 : 1);
        const n = stepToward(u, u.dest, sp * dt);
        u.lat = n.lat; u.lon = n.lon;
        if (n.arrived) {
          if (u.lifting) log(`${u.name.toUpperCase()} HAS ARRIVED.`, 'us');
          u.dest = null; u.lifting = false;
        }
      }
      u.still = (before.lat === u.lat && before.lon === u.lon) ? u.still + dt : 0;
      if (!u.engaged && u.str < 100 && G.war) u.str = Math.min(100, u.str + (u.side === 'nato' ? 0.2 : 0.07) * dt);
    }
    for (const u of [...G.units]) if (u.str <= 0) {
      G.units.splice(G.units.indexOf(u), 1);
      fx.onUnitRemoved(u);
      log(`${u.name.toUpperCase()} ${u.side === 'nato' ? 'HAS BEEN DESTROYED' : 'DESTROYED BY NATO FORCES'}.`, u.side === 'nato' ? 'red' : 'good');
    }

    if (!G.war) return;
    for (const o of G.objectives) {
      const nato = G.units.some(u => u.side === 'nato' && !u.lifting && !u.mustering && deg(u, o) <= OBJ_R);
      const su = G.units.some(u => u.side === 'ussr' && deg(u, o) <= OBJ_R);
      if (o.owner === 'nato' && su && !nato) o.capture += dt / 16;
      else if (o.owner === 'ussr' && nato && !su) o.capture -= dt / 10;
      else o.capture *= Math.max(0, 1 - dt * 0.2);
      if (o.capture >= 1) { o.owner = 'ussr'; o.capture = 0; log(`${o.name.toUpperCase()} HAS FALLEN TO WARSAW PACT FORCES.`, 'red'); fx.sfx.bad(); }
      if (o.capture <= -1) { o.owner = 'nato'; o.capture = 0; log(`${o.name.toUpperCase()} LIBERATED.`, 'good'); fx.sfx.good(); }
    }
    for (const tg of G.targets) if (tg.cuba && tg.alive) {
      const ours = G.units.some(u => u.side === 'nato' && !u.lifting && deg(u, tg) <= 0.3);
      const theirs = G.units.some(u => u.side === 'ussr' && deg(u, tg) <= 0.45);
      tg.cap = ours && !theirs ? tg.cap + dt : 0;
      if (tg.cap >= 6) destroyTarget(tg, true);
    }
    if (G.t >= G.reinforceAt) {
      const k = G.targets.filter(t => t.kind === 'supply' && !t.alive).length;
      if (G.units.filter(u => u.side === 'ussr' && !u.cuba).length < 11) spawnSoviet();
      G.reinforceAt = G.t + 70 * [1, 1.6, 2.6, 6][k] * rnd(0.85, 1.15);
    }
  }

  // ---------- civil defense ----------
  G.cityAction = (c, action) => {
    if (action === 'shelters') {
      if (c.shelters) return { ok: false, msg: 'Shelters are already open.' };
      const p = spend(COSTS.shelters, 'fallout shelters'); if (!p.ok) return p;
      c.shelters = true;
      log(`${c.name.toUpperCase()}: FALLOUT SHELTERS OPEN AND STOCKED.`, 'us');
    } else if (action === 'evacuate') {
      if (c.evacuating || c.evac > 0) return { ok: false, msg: 'Evacuation already under way.' };
      const p = spend(COSTS.evacuate, 'an evacuation'); if (!p.ok) return p;
      c.evacuating = true;
      log(`${c.name.toUpperCase()}: CIVIL DEFENSE EVACUATION ORDERED. ROUTES OPEN.`, 'us');
    } else if (action === 'nike') {
      if (c.nike >= 3) return { ok: false, msg: 'Three batteries is the most this city can host.' };
      const p = spend(COSTS.nike, 'a Nike battery'); if (!p.ok) return p;
      c.nike++;
      log(`${c.name.toUpperCase()}: NIKE HERCULES BATTERY ${c.nike} ON STATION.`, 'us');
    } else if (action === 'relief') {
      if (c.dead <= 0) return { ok: false, msg: 'Relief teams deploy after a strike.' };
      if (c.relief > G.t) return { ok: false, msg: 'Relief teams are already working.' };
      const p = spend(COSTS.relief, 'relief operations'); if (!p.ok) return p;
      c.relief = G.t + DAY;
      c.fallout *= 0.35;
      log(`${c.name.toUpperCase()}: NATIONAL GUARD AND CORPS OF ENGINEERS RELIEF DEPLOYED.`, 'good');
    }
    fx.sfx.click();
    return { ok: true };
  };

  G.toggleConelrad = () => {
    if (G.conelrad) return { ok: false, msg: 'CONELRAD alert is already broadcasting.' };
    G.conelrad = true;
    G.incomeMult = 0.85;
    log('CONELRAD EMERGENCY BROADCAST ACTIVATED. ALL STATIONS TO 640/1240 KC.', 'warn');
    fx.sfx.siren();
    return { ok: true };
  };

  G.researchZeus = () => {
    if (G.zeus) return { ok: false, msg: 'Nike Zeus is already funded.' };
    const p = spend(COSTS.zeus, 'Nike Zeus'); if (!p.ok) return p;
    G.zeus = 1; G.zeusAt = G.t + DAY * 1.5;
    log('NIKE ZEUS ANTI-MISSILE PROGRAM FUNDED. FIELDING IN 36 HOURS.', 'us');
    return { ok: true };
  };

  // ---------- diplomacy ----------
  G.hotlineOdds = () => {
    if (!G.war) return 0.3;
    return Math.max(0.05, Math.min(0.85, (1 - G.capability()) * 0.75 + (G.held() / 6) * 0.25 - 0.3));
  };
  G.hotlineReady = () => G.t - G.lastHotline >= DAY;
  G.hotline = () => {
    if (!G.hotlineReady()) return { ok: false, msg: 'The Kremlin will not take another call yet.' };
    G.lastHotline = G.t; G.hotlineTries++;
    const success = Math.random() < G.hotlineOdds();
    if (success) {
      log(G.war ? 'MOSCOW ACCEPTS CEASEFIRE TERMS.' : 'KHRUSHCHEV AGREES TO REMOVE THE MISSILES FROM CUBA.', 'good');
      if (!G.war) G.targets.forEach(t => { if (t.cuba) { t.alive = false; t.left = 0; fx.setDead(t); } });
      endGame(G.war ? 'diplomacy' : 'peace');
      return { ok: true, success: true };
    }
    log(G.war ? 'MOSCOW REJECTS CEASEFIRE PROPOSAL.' : 'MOSCOW REJECTS THE ULTIMATUM. ATTACK ORDERS ISSUED.', 'red');
    if (!G.war) G.startWar(false);
    return { ok: true, success: false };
  };

  // ---------- main tick ----------
  G.step = (dt) => {
    if (G.over) return;
    G.t += dt;
    G.budget += G.income() * dt;
    if (G.budget < 3 && G.emergencyDay !== G.day()) {
      G.emergencyDay = G.day();
      G.budget += 12;
      log('CONGRESS PASSES EMERGENCY SUPPLEMENTAL: +$12B.', 'good');
    }
    if (!G.war && G.t >= WAR_AT) G.startWar(false);
    if (!G.war && !G.ann1 && G.t > 12) { G.ann1 = true; log('CIA: SOVIET ARMIES IN EAST GERMANY AT FULL READINESS. ATTACK EXPECTED WITHIN HOURS.', 'warn'); }
    if (G.war) for (const h of [...G.hidden]) if (G.t >= h.reveal * DAY) {
      G.hidden.splice(G.hidden.indexOf(h), 1);
      h.next = G.t + rnd(20, h.every * 0.8);
      G.targets.push(h);
      fx.onTargetAdded(h);
      log(`CORONA SATELLITE FILM RECOVERED: NEW SOVIET ${h.kind === 'icbm' ? 'ICBM SITE' : h.kind === 'sub' ? 'SUBMARINE BASE' : 'BOMBER BASE'} IDENTIFIED AT ${h.name.toUpperCase()}.`, 'warn');
    }
    if (G.zeus === 1 && G.t >= G.zeusAt) { G.zeus = 2; log('NIKE ZEUS OPERATIONAL. NIKE BATTERIES NOW ENGAGE BALLISTIC WARHEADS.', 'good'); }

    for (const s of G.sites) {
      while (s.queue.length && s.queue[0] <= G.t) { s.queue.shift(); if (s.alive) s.missiles = Math.min(s.max, s.missiles + 1); }
      if (s.mobile && s.dest) {
        const n = stepToward(s, s.dest, 0.12 * dt);
        s.lat = n.lat; s.lon = n.lon;
        if (n.arrived) s.dest = null;
      }
    }
    for (const c of G.cities) {
      if (c.evacuating) { c.evac = Math.min(1, c.evac + dt / (DAY * 1.2)); if (c.evac >= 1) { c.evacuating = false; log(`${c.name.toUpperCase()}: EVACUATION COMPLETE.`, 'good'); } }
      if (c.fallout > 0) {
        const d = Math.min(c.fallout, c.fallout * 0.015 * dt + 0.0005 * dt);
        c.fallout -= d;
        c.dead = Math.min(c.pop, c.dead + d * (c.relief > G.t ? 0.5 : 1));
      }
    }

    if (G.war) for (const tg of G.targets) {
      if (!tg.alive || !tg.every) continue;
      if (tg.left < tg.salvo && G.t - tg.lastReload > 150) { tg.left++; tg.lastReload = G.t; }
      tg.lastReload = tg.lastReload || G.t;
      if (tg.left > 0 && G.t >= tg.next) {
        tg.left--;
        tg.next = G.t + tg.every * rnd(0.75, 1.3) * (G.c2 ? 1.7 : 1);
        sovietLaunch(tg);
      }
    }

    for (const m of G.missiles) {
      if (m.done) continue;
      const f = (G.t - m.t0) / m.dur;
      if (m.side === 'su' && !m.announced && f >= m.detectAt) {
        m.announced = true;
        const what = { icbm: 'ICBM', slbm: 'SLBM', mrbm: 'MRBM', bomber: 'BOMBER FORMATION', irbm: 'IRBM' }[m.kind];
        log(`${m.kind === 'bomber' ? 'DEW LINE' : G.bmews ? 'BMEWS' : 'NORAD'}: INBOUND ${what} → ${m.target.name.toUpperCase()}. IMPACT IN ${Math.round(m.dur * (1 - f))}s.`, 'red');
        if (m.target.ent === 'city') fx.sfx.siren(); else fx.sfx.alarm();
      }
      if (m.failAt && f >= m.failAt) {
        m.done = true;
        fx.burst(m, 0xffaa66);
        log(`${m.src ? m.src.name.toUpperCase() + ': ' : ''}TELEMETRY LOST. MISSILE MALFUNCTION.`, 'dim');
        G.stats.lostLaunches++;
        continue;
      }
      if (m.interceptAt && f >= m.interceptAt) {
        m.done = true;
        fx.burst(m, 0xffffff);
        fx.sfx.intercept();
        if (m.side === 'su') { G.stats.intercepts++; log(`${m.target.ent === 'city' && m.target.nike ? 'NIKE HERCULES' : 'AIR DEFENSE'}: INBOUND ${m.kind.toUpperCase()} DESTROYED SHORT OF ${m.target.name.toUpperCase()}.`, 'good'); }
        else log(`${m.kind === 'air' ? 'STRIKE PACKAGE' : 'B-52 FLIGHT'} LOST TO SOVIET AIR DEFENSES.`, 'dim');
        continue;
      }
      if (f >= 1) { m.done = true; impact(m); }
    }
    G.missiles = G.missiles.filter(m => { if (m.done) { fx.removeMissile(m); return false; } return true; });

    groundTick(dt);
    checkEnd();
  };

  function checkEnd() {
    if (G.over) return;
    if (G.casualties() >= LOSS_CASUALTIES) return endGame('casualties');
    if (G.objectives.filter(o => o.owner === 'ussr').length >= 5) return endGame('europe');
    if (G.war && !G.hidden.length && G.capability() <= 0.2) return endGame('victory');
    if (G.t >= DAYS * DAY) return endGame('timeout');
  }

  function endGame(reason) {
    G.over = reason;
    G.paused = true;
    G.score = score(reason);
    fx.onEnd(G);
  }

  function score(reason) {
    const cas = G.casualties();
    const pop = Math.round(400 * Math.max(0, 1 - cas / G.totalPop));
    const strat = Math.round(300 * (1 - G.capability()));
    const europe = Math.round(200 * G.held() / 6);
    const cuba = Math.round(100 * (3 - G.cubaLeft()) / 3 + 15 * G.stats.groundCaptures);
    const bonus = { victory: 75, diplomacy: 60, peace: 100, timeout: 0, casualties: -150, europe: -150 }[reason];
    const total = pop + strat + europe + cuba + bonus;
    const rank = total >= 900 ? 'General of the Army ★★★★★' : total >= 750 ? 'General ★★★★' : total >= 600 ? 'Lieutenant General ★★★' : total >= 450 ? 'Major General ★★' : 'Relieved of Command';
    return { pop, strat, europe, cuba, bonus, total, rank, cas };
  }

  return G;
}

export function fmtM(m) {
  return m >= 1 ? `${m.toFixed(1)}M` : `${Math.round(m * 1000)}K`;
}
