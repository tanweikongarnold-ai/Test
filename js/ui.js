// HUD: top bar, force lists, selection panel, labels, teletype and dossiers.
import { COSTS } from './data.js';
import { km, deg } from './geo.js';
import { DAY, DAYS, fmtM } from './game.js';
import { googleUsage } from './geo.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DAYS_W = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const KIND = { icbm: 'ICBM', irbm: 'IRBM', slbm: 'Polaris SLBM', bomber: 'B-52 bombers', radar: 'Radar', mrbm: 'MRBM', sub: 'Missile subs', command: 'Command', supply: 'Logistics' };
const ROLE = {
  icbm: 'Launches ICBMs at American cities and missile bases.',
  bomber: 'Sends bomber formations over the pole. Nike batteries shoot bombers down well.',
  sub: 'Sends submarines to fire short-warning missiles at coastal cities.',
  mrbm: 'Missiles 90 miles from Florida. Reaches the Southeast and Washington in seconds.',
  irbm: 'Fires at NATO missile bases and US divisions in Germany.',
  command: 'Destroying it slows every Soviet launch site.',
  supply: 'Feeds fresh divisions into East Germany. Each one destroyed slows reinforcements.',
};

export function createUI(G, S, A) {
  let tab = 'strategic', panelKey = '', listKey = '', pointerDown = false, toastT = 0;
  const labels = new Map();

  // ---------- teletype ----------
  const tt = $('teletype');
  function log(time, msg, cls = '') {
    const d = document.createElement('div');
    d.className = 'line ' + cls;
    d.innerHTML = `<span class="t">${time}</span>${esc(msg)}`;
    tt.appendChild(d);
    while (tt.children.length > 30) tt.removeChild(tt.firstChild);
    A.sfx.teletype();
  }

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // ---------- top bar ----------
  function updateTop() {
    const d = G.date();
    $('date').textContent = `${DAYS_W[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} 1962`;
    $('time').textContent = G.clock();
    $('day').textContent = `DAY ${G.day()}/${DAYS}`;
    const dc = $('defcon');
    dc.textContent = `DEFCON ${G.defcon}`;
    dc.className = 'd' + G.defcon;
    $('budget').textContent = `$${G.budget.toFixed(1)}B`;
    $('budget').className = G.budget < 3 ? 'bad' : '';
    const cas = G.casualties();
    $('cas').textContent = cas < 0.001 ? '0' : fmtM(cas);
    $('cas').className = cas > 12 ? 'bad' : cas > 4 ? 'warn' : '';
    const cap = G.capability();
    $('cap').textContent = `${Math.round(cap * 100)}%`;
    $('cap').className = cap < 0.4 ? 'good' : '';
    const held = G.held();
    $('held').textContent = `${held}/6`;
    $('held').className = held <= 3 ? 'bad' : held < 6 ? 'warn' : '';
    document.querySelectorAll('[data-speed]').forEach(b => b.setAttribute('aria-pressed', String(G.paused ? b.dataset.speed === '0' : +b.dataset.speed === G.speed)));
    const inbound = G.missiles.filter(m => m.side === 'su' && (G.t - m.t0) / m.dur >= m.detectAt).length;
    const bn = $('banner');
    bn.hidden = !inbound;
    if (inbound) bn.textContent = `▲ ${inbound} INBOUND`;
    S.setAlert(inbound ? 1 : 0);
  }

  // ---------- lists ----------
  const row = (e, dotCls, name, sub, val) =>
    `<button class="row" data-sel="${e.ent}:${e.id}"><i class="dot ${dotCls}"></i><span><span class="n">${esc(name)}</span><br><span class="s">${esc(sub)}</span></span><span class="v">${esc(val)}</span></button>`;

  function listHTML() {
    if (tab === 'strategic') {
      let h = `<div class="list-actions"><button class="btn" data-act="hotline"><span>Pick up the red telephone<small>Negotiate with Moscow · ${Math.round(G.hotlineOdds() * 100)}% odds${G.hotlineReady() ? '' : ' · line busy'}</small></span><em>CALL</em></button></div>`;
      h += '<div class="eyebrow list-h">US strategic forces</div>';
      for (const s of G.sites) h += row(s, s.alive ? '' : 'dead', s.name, s.sub,
        !s.alive ? 'LOST' : s.kind === 'radar' ? 'ON AIR' : `${s.missiles}/${s.max}${s.queue.length ? ' +' + s.queue.length : ''}`);
      h += '<div class="eyebrow list-h">Soviet targets</div>';
      for (const t of G.targets) h += row(t, t.alive ? 'su' : 'dead', t.name, t.sub, t.alive ? (t.salvo ? `${t.left} rdy` : `${Math.round(t.hp)}%`) : 'KILLED');
      return h;
    }
    if (tab === 'ground') {
      let h = `<div class="list-actions"><button class="btn" data-act="newdiv" ${G.newDivisions >= 3 ? 'disabled' : ''}><span>Federalize a National Guard division<small>Musters at Fort Hood in 30s · ${3 - G.newDivisions} left</small></span><em>$${COSTS.newDivision}B</em></button></div>`;
      h += '<div class="eyebrow list-h">NATO objectives, West Germany</div>';
      for (const o of G.objectives) h += row(o, o.owner === 'nato' ? '' : 'su', o.name, o.owner === 'nato' ? 'Held by NATO' : 'Occupied', o.capture > 0.02 ? `${Math.round(o.capture * 100)}% lost` : '');
      const nato = G.units.filter(u => u.side === 'nato'), su = G.units.filter(u => u.side === 'ussr');
      h += '<div class="eyebrow list-h">US & NATO formations</div>';
      for (const u of nato) h += row(u, '', u.name, unitStatus(u), `${Math.round(u.str)}%`);
      h += '<div class="eyebrow list-h">Warsaw Pact formations</div>';
      for (const u of su) h += row(u, 'su', u.name, unitStatus(u), `${Math.round(u.str)}%`);
      return h;
    }
    let h = '<div class="list-actions">';
    h += `<button class="btn" data-act="conelrad" ${G.conelrad ? 'disabled' : ''}><span>${G.conelrad ? 'CONELRAD alert broadcasting' : 'Activate CONELRAD national alert'}<small>Every city 10% safer · income −15%</small></span><em>FREE</em></button>`;
    h += `<button class="btn" data-act="zeus" ${G.zeus ? 'disabled' : ''}><span>${G.zeus === 2 ? 'Nike Zeus operational' : G.zeus ? 'Nike Zeus fielding…' : 'Fund Nike Zeus anti-missile'}<small>Nike batteries engage warheads (6% → 16% each)</small></span><em>$${COSTS.zeus}B</em></button>`;
    h += '</div><div class="eyebrow list-h">Cities · 1960 metro population</div>';
    for (const c of [...G.cities].sort((a, b) => b.pop - a.pop)) {
      const tags = [c.shelters && 'Shelters', c.evac > 0 && `Evac ${Math.round(c.evac * 100)}%`, c.nike && `Nike×${c.nike}`].filter(Boolean).join(' · ') || 'No protection';
      h += row(c, c.dead > 0.001 ? 'su' : 'city', c.name, tags, c.dead > 0.001 ? `−${fmtM(c.dead)}` : `${c.pop.toFixed(1)}M`);
    }
    return h;
  }

  function unitStatus(u) {
    if (u.mustering) return 'Mustering';
    if (u.lifting) return 'In airlift';
    if (u.engaged) return 'Engaged';
    if (u.dest) return 'Moving';
    if (u.still > 8) return 'Dug in';
    return 'Holding';
  }

  function renderList(force) {
    const h = listHTML();
    if (!force && (h === listKey || pointerDown)) return;
    listKey = h;
    const el = $('list'), top = el.scrollTop;
    el.innerHTML = h;
    el.scrollTop = top;
  }

  // ---------- selection panel ----------
  const btn = (act, label, sub, price, opts = {}) =>
    `<button class="btn ${opts.cls || ''}" data-act="${act}" ${opts.dis ? 'disabled' : ''}><span>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><em>${esc(price)}</em></button>`;
  const kv = pairs => `<div class="kv">${pairs.filter(Boolean).map(([k, v]) => `<span>${esc(k)}</span><b>${esc(v)}</b>`).join('')}</div>`;
  const meter = (f, color) => `<div class="meter"><i style="width:${Math.max(0, Math.min(100, f * 100))}%;background:${color}"></i></div>`;

  function panelHTML(e) {
    if (!e) return '';
    const head = `<button class="close" data-act="close" aria-label="Close">✕</button><div class="eyebrow">${esc(eyebrowFor(e))}</div><h2>${esc(e.name)}</h2>`;
    if (e.ent === 'site') return head + sitePanel(e);
    if (e.ent === 'target') return head + targetPanel(e);
    if (e.ent === 'city') return head + cityPanel(e);
    if (e.ent === 'unit') return head + unitPanel(e);
    if (e.ent === 'objective') return head + objectivePanel(e);
    if (e.ent === 'airbase') return head + `<div class="sub">Tactical fighter-bombers</div>${kv([['Strike radius', `${e.range} km`], ['Status', e.ready > G.t ? `Rearming ${Math.ceil(e.ready - G.t)}s` : 'Ready']])}<div class="hint">Select a Soviet site or division within range to order a conventional air strike.</div>`;
    return head;
  }
  function eyebrowFor(e) {
    return { site: 'US strategic asset', target: 'Soviet target', city: 'Civil defense', unit: e.side === 'nato' ? 'US / NATO formation' : 'Warsaw Pact formation', objective: 'NATO objective', airbase: 'Tactical air base' }[e.ent];
  }

  function sitePanel(s) {
    let h = `<div class="sub">${esc(s.sub)}</div>`;
    if (s.kind === 'radar') {
      return h + kv([['Status', s.alive ? 'On the air' : 'Destroyed']]) +
        `<div class="hint">The Ballistic Missile Early Warning System sees Soviet ICBMs and bombers at launch. Lose it and you get about half the warning time.</div>`;
    }
    h += kv([
      ['Status', s.alive ? (s.hp < 100 ? `Damaged ${Math.round(s.hp)}%` : 'Operational') : 'Destroyed'],
      [s.kind === 'bomber' ? 'Aircraft ready' : 'Missiles ready', `${s.missiles} / ${s.max}`],
      s.queue.length && ['Reloading', `${s.queue.length} · next ${Math.ceil(s.queue[0] - G.t)}s`],
      ['Range', s.kind === 'bomber' ? 'Global (tanker support)' : `${s.range.toLocaleString()} km`],
      ['Reliability', `${Math.round(s.rel * 100)}%`],
      s.readyAt > G.t && ['Crew re-cycling', `${Math.ceil(s.readyAt - G.t)}s`],
    ]);
    if (!s.alive) return h;
    h += `<div class="act">${btn('reload', s.kind === 'bomber' ? 'Ready another B-52' : 'Reload one missile', `${s.reload}s to ready`, `$${s.cost}B`, { dis: s.missiles + s.queue.length >= s.max })}</div>`;
    if (s.mobile) h += '<div class="hint">Click open ocean on the map to move this submarine closer to its targets.</div>';
    if (s.kind === 'bomber') {
      const air = G.missiles.filter(m => m.src === s && m.side === 'us');
      if (air.length) h += '<div class="eyebrow list-h">Airborne</div><div class="act">' + air.map(m =>
        btn('recall:' + m.id, `Recall flight → ${m.target.name}`, `${Math.ceil(m.dur - (G.t - m.t0))}s to target`, 'RECALL')).join('') + '</div>';
    }
    const targets = G.targets.filter(t => t.alive && G.inRange(s, t)).sort((a, b) => km(s, a) - km(s, b));
    h += `<div class="eyebrow list-h">Targets in range (${targets.length})</div>`;
    if (!G.war) h += '<div class="hint">Weapons are locked until DEFCON 1.</div>';
    h += '<div class="act">' + targets.map(t => btn(`fire:${s.id}:${t.id}`, `${t.name}`, `${KIND[t.kind]} · ETA ${Math.round(G.flightTime(s, t))}s`, 'FIRE', { cls: 'fire', dis: !G.war || s.missiles <= 0 || s.readyAt > G.t })).join('') + '</div>';
    if (!targets.length) h += '<div class="hint">Nothing in range from here.</div>';
    return h;
  }

  function targetPanel(t) {
    let h = `<div class="sub">${esc(t.sub)}</div>`;
    h += kv([
      ['Status', t.alive ? (t.hp < 100 ? `Damaged · ${Math.round(t.hp)}% operational` : 'Active') : 'Destroyed'],
      t.salvo && ['Weapons ready', `${t.left} of ${t.salvo}`],
      t.alive && t.salvo && G.war && ['Next launch', `~${Math.max(0, Math.ceil(t.next - G.t))}s`],
      ['Hardening', t.hard >= 0.5 ? 'Heavy' : t.hard >= 0.2 ? 'Moderate' : 'Soft'],
    ]);
    if (t.alive) h += meter(t.hp / 100, '#e5513f');
    if (ROLE[t.kind]) h += `<div class="hint">${esc(ROLE[t.kind])}</div>`;
    if (!t.alive) return h;
    if (!G.war) h += '<div class="hint">Weapons are locked until DEFCON 1. Raise DEFCON from the top bar to strike first.</div>';
    const ls = G.launchersFor(t).sort((a, b) => G.flightTime(a, t) - G.flightTime(b, t));
    h += `<div class="eyebrow list-h">Strike with</div><div class="act">`;
    h += ls.map(s => btn(`fire:${s.id}:${t.id}`, s.name, `${KIND[s.kind]} · ${s.missiles} ready${s.readyAt > G.t ? ` · crew ${Math.ceil(s.readyAt - G.t)}s` : ''} · ETA ${Math.round(G.flightTime(s, t))}s · ${Math.round(s.rel * 100)}% reliable`, 'FIRE', { cls: 'fire', dis: !G.war || s.missiles <= 0 || s.readyAt > G.t })).join('');
    const ab = G.airbaseFor(t);
    if (ab) h += btn('air', `Conventional air strike`, `${ab.name} · ${ab.ready > G.t ? `rearming ${Math.ceil(ab.ready - G.t)}s` : 'ready'} · ~30% damage`, `$${COSTS.airstrike}B`, { dis: !G.war });
    h += '</div>';
    if (!ls.length && !ab) h += '<div class="hint">No launcher can reach this target. Move a Polaris submarine closer.</div>';
    if (t.cuba) h += `<div class="hint">Or land troops within 30 km and keep Soviet units away for 6 seconds to seize the site intact.${t.cap > 0 ? ` Securing: ${Math.round(t.cap / 6 * 100)}%` : ''}</div>`;
    return h;
  }

  function cityPanel(c) {
    const alive = c.pop - c.dead;
    const vsBomb = 1 - (1 - 0.35) ** c.nike * 0.75, vsMsl = 1 - (1 - (G.zeus === 2 ? 0.16 : 0.06)) ** c.nike;
    const prot = Math.min(0.8, (G.conelrad ? 0.1 : 0) + (c.shelters ? 0.3 : 0) + c.evac * 0.5);
    let h = `<div class="sub">1960 metro population ${c.pop.toFixed(1)} million</div>`;
    h += kv([
      ['Casualties', c.dead > 0.001 ? fmtM(c.dead) : 'None'],
      c.fallout > 0.001 && ['Fallout deaths pending', fmtM(c.fallout)],
      ['Fallout shelters', c.shelters ? 'Open' : 'Closed'],
      ['Evacuation', c.evac > 0 ? `${Math.round(c.evac * 100)}%${c.evacuating ? ' under way' : ''}` : 'None'],
      ['Nike Hercules batteries', `${c.nike} / 3`],
      ['Intercept odds', `Bombers ${Math.round(vsBomb * 100)}% · Missiles ${Math.round(vsMsl * 100)}%`],
      ['Blast protection', `${Math.round(prot * 100)}%`],
    ]);
    h += meter(alive / c.pop, '#86e08f');
    const inc = G.missiles.filter(m => m.side === 'su' && m.target === c && (G.t - m.t0) / m.dur >= m.detectAt);
    if (inc.length) h += `<div class="hint" style="border-color:#e5513f">${inc.length} inbound · first impact in ${Math.ceil(Math.min(...inc.map(m => m.dur - (G.t - m.t0))))}s</div>`;
    h += '<div class="act">';
    h += btn('city:shelters', 'Open fallout shelters', 'Blast deaths −30%, fallout deaths −60%', `$${COSTS.shelters}B`, { dis: c.shelters });
    h += btn('city:evacuate', 'Evacuate the city', 'Up to −50% over ~1 day · slows the economy', `$${COSTS.evacuate}B`, { dis: c.evacuating || c.evac > 0 });
    h += btn('city:nike', 'Deploy Nike Hercules battery', 'Army air defense around the city', `$${COSTS.nike}B`, { dis: c.nike >= 3 });
    h += btn('city:relief', 'Send relief teams', 'National Guard & Corps of Engineers cut fallout deaths', `$${COSTS.relief}B`, { dis: c.dead <= 0 || c.relief > G.t });
    return h + '</div>';
  }

  function unitPanel(u) {
    let h = `<div class="sub">${esc({ armor: 'Armored', infantry: 'Infantry', airborne: 'Airborne', cavalry: 'Armored cavalry', marine: 'Marine' }[u.type])} · ${unitStatus(u)}</div>`;
    h += kv([['Strength', `${Math.round(u.str)}%`], ['Position', `${u.lat.toFixed(1)}°N ${Math.abs(u.lon).toFixed(1)}°${u.lon < 0 ? 'W' : 'E'}`]]);
    h += meter(u.str / 100, u.str > 60 ? '#86e08f' : u.str > 30 ? '#f0c040' : '#e5513f');
    if (u.side === 'nato') {
      h += '<div class="hint">Click the map to send this formation. Short moves go overland. Moves longer than about 350 km use a strategic airlift ($1.5B).</div>';
      if (u.dest && !u.lifting) h += `<div class="act">${btn('hold', 'Halt and dig in', 'Dug-in units defend 80% better', '')}</div>`;
    } else {
      const ab = G.airbaseFor(u);
      h += '<div class="act">' + (ab ? btn('air', 'Conventional air strike', `${ab.name} · −~28% strength`, `$${COSTS.airstrike}B`, { dis: !G.war }) : '') + '</div>';
      if (!ab) h += '<div class="hint">Out of range of tactical air bases.</div>';
    }
    return h;
  }

  function objectivePanel(o) {
    const near = G.units.filter(u => deg(u, o) <= 0.6);
    return `<div class="sub">${o.owner === 'nato' ? 'Held by NATO' : 'Occupied by the Warsaw Pact'}</div>` +
      kv([['Units nearby', near.map(u => u.short).join(', ') || 'None'], ['Capture', o.capture > 0.02 ? `${Math.round(o.capture * 100)}% to Pact` : o.capture < -0.02 ? `${Math.round(-o.capture * 100)}% to NATO` : '—']]) +
      '<div class="hint">A city falls when only Warsaw Pact units stand within 30 km for 10 seconds. Lose five of the six and NATO collapses.</div>';
  }

  function renderPanel(force) {
    const e = A.selected();
    const p = $('right');
    if (!e) { p.hidden = true; panelKey = ''; return; }
    const h = panelHTML(e);
    if (!force && (h === panelKey || pointerDown)) return;
    panelKey = h;
    p.hidden = false;
    const top = p.scrollTop;
    p.innerHTML = h;
    p.scrollTop = top;
  }

  // ---------- events ----------
  for (const el of [$('right'), $('list')]) {
    el.addEventListener('pointerdown', () => { pointerDown = true; });
    el.addEventListener('pointerleave', () => { pointerDown = false; });
    el.addEventListener('click', ev => {
      pointerDown = false;
      const b = ev.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.sel) { A.selectKey(b.dataset.sel, true); return; }
      if (b.dataset.act) A.action(b.dataset.act);
      renderPanel(true); renderList(true);
    });
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    renderList(true);
  }));

  // ---------- labels ----------
  function labelFor(e) {
    let l = labels.get(e);
    if (!l) {
      l = document.createElement('div');
      $('labels').appendChild(l);
      labels.set(e, l);
    }
    return l;
  }
  function removeLabel(e) { const l = labels.get(e); if (l) { l.remove(); labels.delete(e); } }

  function updateLabels(ents, sel, hover) {
    const dist = S.cameraDistance();
    for (const e of ents) {
      let show, cls, text;
      if (e.ent === 'unit') { show = dist < 5; cls = 'unit ' + (e.side === 'nato' ? 'us' : 'su'); text = e.short; }
      else if (e.ent === 'objective') { show = dist < 6; cls = 'obj'; text = e.name; }
      else if (e.ent === 'city') { show = dist < 13; cls = 'city'; text = e.dead > 0.001 ? `${e.name} −${fmtM(e.dead)}` : e.name; }
      else if (e.ent === 'airbase') { show = dist < 6; cls = ''; text = e.name; }
      else { show = dist < 13 && (e.ent === 'site' || e.alive || dist < 8); cls = e.ent === 'site' ? 'us' : 'su'; text = e.name; if (!e.alive) cls += ' dead'; }
      if (e === sel || e === hover) show = true;
      const l = labelFor(e);
      if (!show) { if (!l.hidden) l.hidden = true; continue; }
      const p = S.project(e.lat, e.lon, 0.2 * S.markerScale);
      if (!p.vis) { l.hidden = true; continue; }
      l.hidden = false;
      const c = 'lbl ' + cls + (e === sel ? ' sel' : '');
      if (l.className !== c) l.className = c;
      if (l.textContent !== text) l.textContent = text;
      l.style.transform = `translate(${Math.round(p.x + 8)}px, ${Math.round(p.y - 18)}px)`;
    }
  }

  // ---------- dossiers ----------
  const modal = $('modal');
  function showTitle(onStart) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('bb.map') || '{}'); } catch { /* no storage */ }
    modal.innerHTML = `<div class="dossier" role="dialog" aria-labelledby="ttl">
      <span class="stamp">Top Secret · Eyes Only</span>
      <h1 id="ttl">The Big Board</h1>
      <p><b>Monday, 22 October 1962. The Pentagon, Joint War Room.</b></p>
      <p>You are Chief of Staff of the United States Army, holding joint command for the duration of the crisis. Soviet missiles stand in Cuba. Twenty divisions of the Warsaw Pact are massing in East Germany. The President has given you the board. Hold it for thirteen days.</p>
      <div class="cols">
        <div><h3>Strike</h3>Hit Soviet launch sites before they fire. Click a red marker, pick an ICBM, IRBM, Polaris or B-52 in range, and fire. Satellites will find more sites as the days pass. Once the last is found, knock Soviet strike power under 20% and Moscow sues for peace.</div>
        <div><h3>Ground</h3>Hold the six NATO cities in West Germany. Send the 82nd Airborne and the Marines into Cuba to seize the missile sites intact. Click a formation, then click the map.</div>
        <div><h3>Home Front</h3>Open fallout shelters, evacuate, ring cities with Nike Hercules batteries, and send relief after a strike. Twenty-five million dead and the nation cannot go on.</div>
      </div>
      <div class="mapopt">
        <b>Plotting table map</b>
        <label><input type="radio" name="mapsrc" id="mapPlot" value="plot" ${saved.src !== 'google' ? 'checked' : ''}> War Room plotting map (free, works anywhere)</label>
        <label><input type="radio" name="mapsrc" id="mapGoogle" value="google" ${saved.src === 'google' ? 'checked' : ''}> Google satellite map (uses your Google Maps Platform key with the Map Tiles API enabled)</label>
        <input type="password" id="gkey" placeholder="Google Maps API key" autocomplete="off" value="${esc(saved.key || '')}">
        <small>Credit saver: the Google map is fetched once per visit (24 tiles plus 1 session request) and then reused by your browser cache. Nothing is requested while you play. The budget in the game never runs dry either: Congress sends an emergency supplemental once a day if you go broke.</small>
      </div>
      <p class="keys">Drag to pan · right-drag to tilt and turn · scroll or pinch to zoom · Space to pause · 1–4 change speed · Esc to deselect</p>
      <button class="go" id="start">Take command</button>
    </div>`;
    modal.hidden = false;
    $('start').addEventListener('click', () => {
      const src = $('mapGoogle').checked ? 'google' : 'plot', key = $('gkey').value.trim();
      try { localStorage.setItem('bb.map', JSON.stringify({ src, key })); } catch { /* no storage */ }
      modal.hidden = true;
      onStart({ src, key });
    });
  }

  function showHotline(onCall) {
    const odds = Math.round(G.hotlineOdds() * 100);
    const ready = G.hotlineReady();
    modal.innerHTML = `<div class="dossier" role="dialog" aria-labelledby="hl">
      <span class="stamp">Washington — Moscow</span>
      <h1 id="hl" style="font-size:clamp(36px,7vw,64px)">The Red Telephone</h1>
      <p>${G.war ? 'The State Department can put a ceasefire proposal to the Kremlin. Moscow listens when its missile force is broken and NATO still holds Germany.' : 'You can press Khrushchev to withdraw the missiles from Cuba before the shooting starts. If he refuses, the Soviets will attack at once.'}</p>
      <p><b>Analysts give it ${odds}%.</b> ${ready ? '' : 'Moscow will not take another call until tomorrow.'}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="go" id="call" ${ready ? '' : 'disabled'}>Place the call</button><button class="go alt" id="hang">Hang up</button></div>
    </div>`;
    modal.hidden = false;
    $('hang').addEventListener('click', () => { modal.hidden = true; A.resume(); });
    $('call').addEventListener('click', () => { modal.hidden = true; onCall(); });
  }

  function showEnd() {
    const s = G.score;
    const T = {
      victory: ['Moscow Sues for Peace', 'With its missile force in ruins, the Kremlin asks for a ceasefire.'],
      diplomacy: ['Ceasefire Agreed', 'Moscow accepts terms over the red telephone.'],
      peace: ['The Missiles Go Home', 'Khrushchev agrees to remove the missiles from Cuba. Not a shot is fired.'],
      timeout: ['Thirteen Days', 'A UN-brokered ceasefire takes effect at 0600 on 4 November.'],
      casualties: ['The Nation Cannot Go On', 'American losses pass twenty-five million. The President relieves you of command.'],
      europe: ['NATO Collapses', 'Five of six West German cities have fallen. The alliance asks for terms.'],
    }[G.over];
    modal.innerHTML = `<div class="dossier" role="dialog" aria-labelledby="end">
      <span class="stamp">After-action report</span>
      <h1 id="end" style="font-size:clamp(38px,7vw,70px)">${T[0]}</h1>
      <p>${T[1]}</p>
      <div class="score">
        <span>American lives protected (${fmtM(Math.max(0, G.totalPop - s.cas))} of ${G.totalPop.toFixed(1)}M)</span><b>${s.pop}</b>
        <span>Soviet strike power destroyed (${Math.round((1 - G.capability()) * 100)}%)</span><b>${s.strat}</b>
        <span>West German cities held (${G.held()}/6)</span><b>${s.europe}</b>
        <span>Cuban sites neutralized (${3 - G.cubaLeft()}/3, ${G.stats.groundCaptures} seized intact)</span><b>${s.cuba}</b>
        <span>Outcome</span><b>${s.bonus > 0 ? '+' : ''}${s.bonus}</b>
        <span class="tot">Total</span><b class="tot">${s.total}</b>
      </div>
      <div class="rank">${s.rank}</div>
      <p class="keys">Launches ${G.stats.launched} · air strikes ${G.stats.airStrikes} · Soviet launches ${G.stats.sovietLaunches} · intercepted ${G.stats.intercepts} · day ${G.day()} of ${DAYS}${googleUsage.requests ? ` · Google requests ${googleUsage.requests}` : ''}</p>
      <button class="go" id="again">Play again</button>
    </div>`;
    modal.hidden = false;
    $('again').addEventListener('click', () => location.reload());
  }

  function setMoveHint(t) { const m = $('moveHint'); m.hidden = !t; if (t) m.textContent = t; }

  return { log, toast, updateTop, renderList, renderPanel, updateLabels, removeLabel, showTitle, showHotline, showEnd, setMoveHint, DAY };
}
