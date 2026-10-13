// Synthesized sound effects (no audio files). Starts only after a click.
let ctx = null, master = null, muted = false, noiseBuf = null;

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.35; }
export function isMuted() { return muted; }

function env(g, t, a, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function noise(dur, filterType, f0, f1, peak) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  env(g, t, 0.02, peak, dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}
function tone(type, f0, f1, dur, peak, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  env(g, t, 0.01, peak, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  click() { tone('square', 1800, 1800, 0.03, 0.05); },
  teletype() { for (let i = 0; i < 5; i++) tone('square', 900 + Math.random() * 300, 700, 0.025, 0.03, i * 0.045); },
  launch() { noise(2.2, 'lowpass', 300, 1800, 0.5); tone('sawtooth', 60, 110, 1.8, 0.12); },
  boom(scale = 1) { noise(2.8, 'lowpass', 900, 60, 0.9 * scale); tone('sine', 70, 28, 2.2, 0.6 * scale); },
  thud() { noise(0.6, 'lowpass', 500, 80, 0.4); },
  intercept() { tone('triangle', 1200, 300, 0.35, 0.18); noise(0.4, 'bandpass', 2000, 600, 0.25); },
  alarm() { for (let i = 0; i < 4; i++) tone('square', i % 2 ? 620 : 820, i % 2 ? 620 : 820, 0.22, 0.09, i * 0.25); },
  siren() {
    if (!ctx || muted) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t);
    o.frequency.linearRampToValueAtTime(820, t + 1.4);
    o.frequency.linearRampToValueAtTime(380, t + 3.2);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1400;
    o.connect(f).connect(g).connect(master);
    o.start(t); o.stop(t + 3.5);
  },
  good() { tone('triangle', 660, 660, 0.12, 0.12); tone('triangle', 990, 990, 0.2, 0.12, 0.12); },
  bad() { tone('sawtooth', 220, 140, 0.5, 0.12); },
};
