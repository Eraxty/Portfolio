// Tiny Web Audio kit. Off by default; one switch in the header.
export function createSound() {
  let ctx = null;
  let master = null;
  let on = false;
  let servo = null;
  let voice = null;
  const buffers = new Map();
  try { on = localStorage.getItem('eraxty:sound') === '1'; } catch { /* storage blocked */ }

  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  let engine = null;

  const api = {
    get on() { return on; },
    // Must run inside a click: browsers only allow audio after a gesture.
    async unlock() {
      if (!ensure()) return;
      try { await ctx.resume(); } catch { /* ignore */ }
    },
    // A small V-shaped engine: two detuned saws and a sub, distorted and low-passed. rpm01 0 idle .. 1 limiter.
    engineStart() {
      if (!on || !ensure() || engine) return;
      const out = ctx.createGain();
      out.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 3;
      const shaper = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) { const x = (i / 512) - 1; curve[i] = Math.tanh(x * 3.5); }
      shaper.curve = curve;
      const oscs = [['sawtooth', 1, 0.5], ['sawtooth', 1.007, 0.5], ['square', 0.5, 0.35]].map(([type, mul, gain]) => {
        const o = ctx.createOscillator();
        o.type = type;
        const g = ctx.createGain();
        g.gain.value = gain;
        o.connect(g).connect(shaper);
        o.start();
        return { o, mul };
      });
      // the lumpy idle: an LFO wobbling the volume
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 9;
      lfoG.gain.value = 0.25;
      lfo.connect(lfoG).connect(out.gain);
      lfo.start();
      shaper.connect(lp).connect(out).connect(master);
      engine = { out, lp, oscs, lfo, lfoG };
      out.gain.setTargetAtTime(0.55, ctx.currentTime, 0.2);
      api.rpm(0);
    },
    rpm(r, glide = 0.25) {
      if (!engine) return;
      const now = ctx.currentTime;
      const f = 38 + r * 150;
      engine.oscs.forEach(({ o, mul }) => o.frequency.setTargetAtTime(f * mul, now, glide));
      engine.lp.frequency.setTargetAtTime(300 + r * 2600, now, glide);
      engine.lfoG.gain.setTargetAtTime(0.25 * (1 - r), now, glide);
    },
    // Lights out: dump the clutch, two quick upshifts, then fade away down the straight.
    launch() {
      if (!engine) return;
      const e = engine;
      const t = ctx.currentTime;
      const set = (time, f, cut) => {
        e.oscs.forEach(({ o, mul }) => o.frequency.setTargetAtTime(f * mul, t + time, 0.12));
        e.lp.frequency.setTargetAtTime(cut, t + time, 0.12);
      };
      set(0, 175, 3200);
      set(0.55, 120, 2400);  // upshift
      set(0.62, 182, 3300);
      set(1.25, 128, 2500);  // upshift
      set(1.32, 186, 3400);
      e.lfoG.gain.setTargetAtTime(0, t, 0.05);
      e.out.gain.setTargetAtTime(0.75, t, 0.05);
      e.out.gain.setTargetAtTime(0, t + 1.5, 0.45);
      setTimeout(() => {
        e.oscs.forEach(({ o }) => o.stop());
        e.lfo.stop();
        e.out.disconnect();
      }, 4500);
      engine = null;
    },
    set(v) {
      on = v;
      try { localStorage.setItem('eraxty:sound', v ? '1' : '0'); } catch { /* ignore */ }
      if (v) ensure();
      else { voice?.stop(); if (servo) servo.g.gain.value = 0; }
    },
    // Wheatley's eye motor: a filtered buzz whose level and pitch follow how fast the eye turns.
    servo(angVel) {
      if (!on || !ctx || ctx.state !== 'running') return;
      if (!servo) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.Q.value = 6;
        const g = ctx.createGain();
        g.gain.value = 0;
        o.connect(f).connect(g).connect(master);
        o.start();
        servo = { o, f, g };
      }
      const k = Math.min(Math.max(angVel - 0.4, 0) / 6, 1);
      const now = ctx.currentTime;
      servo.g.gain.setTargetAtTime(k * 0.35, now, 0.05);
      servo.o.frequency.setTargetAtTime(70 + k * 60, now, 0.05);
      servo.f.frequency.setTargetAtTime(500 + k * 900, now, 0.05);
    },
    // eyelid shutter
    click() {
      if (!on || !ctx || ctx.state !== 'running') return;
      const len = 0.03;
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = 2500;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(f).connect(g).connect(master);
      src.start();
    },
    // Voice lines are pre-rendered files (tools/render-voices.py), so they play in every browser.
    async speak(src) {
      if (!on || !ensure()) return;
      try {
        if (!buffers.has(src)) buffers.set(src, fetch(src).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)));
        const buf = await buffers.get(src);
        if (!on) return;
        voice?.stop();
        voice = ctx.createBufferSource();
        voice.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = 4.5;   // the master bus is quiet for UI ticks; voices sit on top
        voice.connect(g).connect(master);
        voice.start();
      } catch { /* missing file or decode error: captions still show */ }
    },
    beep(freq = 880, dur = 0.1, type = 'square', gain = 0.5) {
      if (!on || !ensure() || ctx.state !== 'running') return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + dur + 0.02);
    },
    tick() { api.beep(2400, 0.025, 'square', 0.12); },
    thud() {
      if (!on || !ensure()) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(42, ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.9, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.32);
    },
    whoosh(up = true) {
      if (!on || !ensure()) return;
      const len = 0.5;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(up ? 300 : 1800, ctx.currentTime);
      f.frequency.exponentialRampToValueAtTime(up ? 2200 : 260, ctx.currentTime + len);
      const g = ctx.createGain();
      g.gain.value = 0.7;
      src.connect(f).connect(g).connect(master);
      src.start();
    },
  };
  return api;
}
