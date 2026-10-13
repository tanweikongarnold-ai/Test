// Geography: projection helpers, TopoJSON decoding and the map texture
// (War Room plotting map from world-atlas, or Google satellite tiles).

export const MAP = { W: 36, H: 13.5, yTop: 0.125, yBot: 0.5 }; // Web Mercator band 79.17N..0
export const TEX_W = 4096, TEX_H = 1536;

const D2R = Math.PI / 180;
const mercY = lat => {
  const l = Math.max(-85, Math.min(85, lat)) * D2R;
  return (1 - Math.log(Math.tan(Math.PI / 4 + l / 2)) / Math.PI) / 2;
};

export function ll2uv(lat, lon) {
  return { u: (lon + 180) / 360, v: (mercY(lat) - MAP.yTop) / (MAP.yBot - MAP.yTop) };
}
export function ll2xz(lat, lon) {
  const { u, v } = ll2uv(lat, lon);
  return { x: (u - 0.5) * MAP.W, z: (v - 0.5) * MAP.H };
}
export function xz2ll(x, z) {
  const u = x / MAP.W + 0.5, v = z / MAP.H + 0.5;
  const yN = MAP.yTop + v * (MAP.yBot - MAP.yTop);
  const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * yN))) / D2R;
  return { lat, lon: u * 360 - 180 };
}
// great-circle distance in km
export function km(a, b) {
  const p1 = a.lat * D2R, p2 = b.lat * D2R, dp = p2 - p1, dl = (b.lon - a.lon) * D2R;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
// flat "degree" distance used for ground movement (lon shrunk by latitude)
export function deg(a, b) {
  const dl = (b.lon - a.lon) * Math.cos(((a.lat + b.lat) / 2) * D2R);
  return Math.hypot(b.lat - a.lat, dl);
}
export function stepToward(p, dest, d) {
  const dist = deg(p, dest);
  if (dist <= d || dist === 0) return { lat: dest.lat, lon: dest.lon, arrived: true };
  const f = d / dist;
  return { lat: p.lat + (dest.lat - p.lat) * f, lon: p.lon + (dest.lon - p.lon) * f, arrived: false };
}

// ---------- TopoJSON ----------
export function decodeTopo(topo, name) {
  const t = topo.transform;
  const arcs = topo.arcs.map(arc => {
    let x = 0, y = 0;
    return arc.map(p => {
      x += p[0]; y += p[1];
      return t ? [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]] : [p[0], p[1]];
    });
  });
  const arcPts = i => (i >= 0 ? arcs[i] : arcs[~i].slice().reverse());
  const ring = ids => {
    const pts = [];
    ids.forEach((i, k) => { const a = arcPts(i); for (let j = k ? 1 : 0; j < a.length; j++) pts.push(a[j]); });
    return pts;
  };
  return topo.objects[name].geometries.map(g => ({
    id: g.id,
    name: g.properties && g.properties.name,
    polys: g.type === 'Polygon' ? [g.arcs.map(ring)] : g.type === 'MultiPolygon' ? g.arcs.map(p => p.map(ring)) : [],
  }));
}

// 1962 alignments by ISO numeric code
const USSR = ['643', '804', '112', '398', '860', '795', '417', '762', '268', '051', '031', '498', '440', '428', '233'];
const PACT = ['616', '203', '703', '348', '642', '100', '008'];
const NATO = ['124', '826', '250', '276', '380', '056', '528', '442', '578', '208', '352', '620', '300', '792'];
const sideOf = id => (id === '840' ? 'usa' : id === '192' ? 'cuba' : USSR.includes(id) ? 'ussr'
  : PACT.includes(id) ? 'pact' : NATO.includes(id) ? 'nato' : id === '156' ? 'china' : 'neutral');

// approximate 1962 inner German border, north to south
const IGB = [[53.95, 10.9], [53.7, 10.8], [53.55, 10.9], [53.37, 10.6], [53.1, 11.35], [53.03, 11.57], [52.85, 11.0],
  [52.6, 10.8], [52.42, 10.97], [52.22, 11.0], [51.8, 10.6], [51.55, 10.6], [51.45, 10.3], [51.2, 10.05], [51.0, 10.15],
  [50.73, 10.05], [50.55, 10.05], [50.4, 10.6], [50.25, 10.85], [50.35, 11.3], [50.4, 11.9], [50.32, 12.1]];

const PALETTE = {
  ocean: '#0c1f27', usa: '#2d4658', nato: '#2a3c48', ussr: '#5c2a22', pact: '#4c2b25', cuba: '#6b2b20',
  china: '#463d2c', neutral: '#363d30',
};

function px(lon, lat, w, h) {
  const { u, v } = ll2uv(lat, lon);
  return [u * w, v * h];
}

function tracePolys(ctx, polys, w, h) {
  ctx.beginPath();
  for (const poly of polys) for (const ring of poly) {
    let prevLon = null;
    ring.forEach(([lon, lat], i) => {
      const [x, y] = px(lon, lat, w, h);
      if (i === 0 || Math.abs(lon - prevLon) > 180) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      prevLon = lon;
    });
    ctx.closePath();
  }
}

function drawGraticule(ctx, w, h, alpha) {
  ctx.strokeStyle = `rgba(170,200,190,${alpha})`;
  ctx.lineWidth = 1.5;
  for (let lon = -180; lon <= 180; lon += 10) {
    const [x] = px(lon, 0, w, h);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let lat = 0; lat <= 80; lat += 10) {
    const [, y] = px(0, lat, w, h);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.fillStyle = `rgba(190,215,205,${alpha * 3})`;
  ctx.font = '600 22px "IBM Plex Sans Condensed", sans-serif';
  for (let lat = 10; lat <= 70; lat += 10) {
    const [, y] = px(0, lat, w, h);
    ctx.fillText(`${lat}°N`, 8, y - 6);
  }
}

function drawOverlays(ctx, countries, w, h, satellite) {
  for (const c of countries) {
    const side = sideOf(c.id);
    tracePolys(ctx, c.polys, w, h);
    if (satellite) {
      if (side === 'ussr' || side === 'pact' || side === 'cuba') { ctx.fillStyle = 'rgba(200,40,30,0.22)'; ctx.fill(); }
      else if (side === 'usa' || side === 'nato') { ctx.fillStyle = 'rgba(60,130,210,0.12)'; ctx.fill(); }
    } else {
      ctx.fillStyle = PALETTE[side];
      ctx.fill();
    }
    ctx.strokeStyle = satellite ? 'rgba(255,240,200,0.35)' : 'rgba(225,214,180,0.42)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  // inner German border
  ctx.save();
  ctx.setLineDash([10, 7]);
  ctx.strokeStyle = 'rgba(240,90,70,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  IGB.forEach(([lat, lon], i) => { const [x, y] = px(lon, lat, w, h); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.stroke();
  ctx.restore();
}

function drawLabels(ctx, w, h, satellite) {
  const lab = (text, lat, lon, size, alpha, spacing = 0.3) => {
    const [x, y] = px(lon, lat, w, h);
    ctx.font = `700 ${size}px "Big Shoulders Stencil Display", "Arial Narrow", sans-serif`;
    ctx.fillStyle = satellite ? `rgba(255,245,220,${alpha + 0.15})` : `rgba(232,222,190,${alpha})`;
    ctx.textAlign = 'center';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${size * spacing}px`;
    ctx.fillText(text, x, y);
  };
  lab('U.S.S.R.', 60, 85, 150, 0.22, 0.5);
  lab('UNITED STATES', 40, -99, 84, 0.2, 0.35);
  lab('CANADA', 58, -104, 64, 0.16);
  lab('CHINA', 34, 103, 64, 0.15);
  lab('ATLANTIC OCEAN', 33, -42, 50, 0.24);
  lab('PACIFIC OCEAN', 30, -150, 50, 0.24);
  lab('PACIFIC OCEAN', 25, 160, 44, 0.2);
  lab('ARCTIC OCEAN', 77, -20, 40, 0.24);
  lab('NORWEGIAN SEA', 68, 2, 26, 0.24);
  lab('CUBA', 21.2, -78.5, 22, 0.4, 0.2);
  lab('E. GER.', 52.3, 13.8, 14, 0.35, 0.1);
  lab('W. GER.', 50.6, 8.3, 14, 0.35, 0.1);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '0px';
}

export async function loadCountries(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('map data ' + r.status);
  return decodeTopo(await r.json(), 'countries');
}

export function buildLandMask(countries) {
  const w = 1024, h = 384;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  for (const k of countries) { tracePolys(ctx, k.polys, w, h); ctx.fill(); }
  const data = ctx.getImageData(0, 0, w, h).data;
  return (lat, lon) => {
    const { u, v } = ll2uv(lat, lon);
    const x = Math.floor(u * w), y = Math.floor(v * h);
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    return data[(y * w + x) * 4 + 3] > 80;
  };
}

// Plotting-table map drawn from vector data
export function drawPlottingMap(countries) {
  const c = document.createElement('canvas');
  c.width = TEX_W; c.height = TEX_H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, TEX_H);
  g.addColorStop(0, '#10262f'); g.addColorStop(1, '#0a1a21');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  drawGraticule(ctx, TEX_W, TEX_H, 0.07);
  if (countries) drawOverlays(ctx, countries, TEX_W, TEX_H, false);
  drawLabels(ctx, TEX_W, TEX_H, false);
  vignette(ctx);
  return c;
}

function vignette(ctx) {
  const v = ctx.createRadialGradient(TEX_W / 2, TEX_H / 2, TEX_H * 0.4, TEX_W / 2, TEX_H / 2, TEX_W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
}

// ---------- Google Map Tiles API (satellite) ----------
// Fetched once per page load: 24 high-DPI tiles at zoom 3 cover the whole board.
// The session token is reused from localStorage until it expires, and tile
// responses are left to the browser's HTTP cache, so a replay costs nothing extra.
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};
export const googleUsage = { requests: 0 };

async function googleSession(key) {
  const cached = JSON.parse(store.get('bb.gsession') || 'null');
  if (cached && cached.key === key && cached.expiry * 1000 > Date.now() + 3600e3) return cached.session;
  googleUsage.requests++;
  const r = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mapType: 'satellite', language: 'en-US', region: 'US', scale: 'scaleFactor2x', highDpi: true }),
  });
  if (!r.ok) throw new Error(`Google createSession failed (${r.status})`);
  const j = await r.json();
  store.set('bb.gsession', JSON.stringify({ key, session: j.session, expiry: Number(j.expiry) }));
  return j.session;
}

function loadImg(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('tile blocked or failed'));
    im.src = src;
  });
}

export async function drawGoogleMap(key, countries, onProgress) {
  const session = await googleSession(key);
  const z = 3, rows = [1, 2, 3], cols = 8, tw = TEX_W / cols, th = TEX_H / rows.length;
  const c = document.createElement('canvas');
  c.width = TEX_W; c.height = TEX_H;
  const ctx = c.getContext('2d');
  let done = 0;
  const jobs = [];
  for (const y of rows) for (let x = 0; x < cols; x++) {
    googleUsage.requests++;
    const url = `https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}`;
    jobs.push(loadImg(url).then(im => {
      ctx.drawImage(im, x * tw, (y - rows[0]) * th, tw, th);
      onProgress && onProgress(++done, rows.length * cols);
    }));
  }
  await Promise.all(jobs);
  let attribution = 'Google';
  try {
    googleUsage.requests++;
    const r = await fetch(`https://tile.googleapis.com/tile/v1/viewport?session=${encodeURIComponent(session)}&key=${encodeURIComponent(key)}&zoom=3&north=79&south=0&east=180&west=-180`);
    if (r.ok) attribution = (await r.json()).copyright || attribution;
  } catch { /* attribution text falls back to "Google" */ }
  ctx.fillStyle = 'rgba(0,10,20,0.25)';
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  drawGraticule(ctx, TEX_W, TEX_H, 0.06);
  if (countries) drawOverlays(ctx, countries, TEX_W, TEX_H, true);
  drawLabels(ctx, TEX_W, TEX_H, true);
  vignette(ctx);
  return { canvas: c, attribution };
}
