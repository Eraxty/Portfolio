// The whole soundscape, synthesized in Web Audio. Always on; browsers still wait for the first click.
export function createSound() {
  let ctx = null;
  let master = null;
  const on = true;
  let servo = null;
  let voice = null;
  const buffers = new Map();

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
  let sfxIndex = new Set();
  let grid = null;
  const samples = new Map();
  // ElevenLabs effects live in /sfx; index.json lists what exists. Anything missing falls back to synthesis.
  const has = (id) => sfxIndex.has(id);
  const play = async (id, { gain = 1, pan = 0, loop = false, to = null, delay = 0 } = {}) => {
    if (!has(id) || !ensure()) return null;
    if (!samples.has(id)) samples.set(id, fetch(`/sfx/${id}.mp3`).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)));
    try {
      const buf = await samples.get(id);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = loop;
      const g = ctx.createGain();
      g.gain.value = gain;
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      src.connect(g).connect(p).connect(to || master);
      src.start(ctx.currentTime + delay);
      return { src, g };
    } catch { return null; }
  };
  let amb = null;
  let servoPan = null;
  let wheatPan = 0;

  const noiseBuffer = (seconds, brown = false) => {
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return buf;
  };
  const loopNoise = (buf) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start();
    return src;
  };
  // per-section mood: room cutoff, mains hum, air handling, GLaDOS undertone
  const MOODS = {
    hero: { lp: 240, hum: 50, air: 0.05, dark: 0 },
    statement: { lp: 320, hum: 55, air: 0.06, dark: 0 },
    work: { lp: 360, hum: 60, air: 0.07, dark: 0 },
    lab: { lp: 280, hum: 55, air: 0.05, dark: 0 },
    subject: { lp: 150, hum: 41, air: 0.025, dark: 1 },
    contact: { lp: 220, hum: 50, air: 0.035, dark: 0 },
  };

  const api = {
    get on() { return on; },
    // Must run inside a click: browsers only allow audio after a gesture.
    async unlock() {
      if (!ensure()) return;
      try { await ctx.resume(); } catch { /* ignore */ }
      if (!sfxIndex.size) {
        try { sfxIndex = new Set(await (await fetch('/sfx/index.json')).json()); } catch { /* synth only */ }
      }
    },
    pitStop() { play('pit-stop', { gain: 3 }); },
    // A small V-shaped engine: two detuned saws and a sub, distorted and low-passed. rpm01 0 idle .. 1 limiter.
    engineStart() {
      if (has('f1-grid')) {
        if (!grid) play('f1-grid', { gain: 2.4 }).then((h) => (grid = h));
        return;
      }
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
      if (has('f1-launch')) {
        if (grid) { grid.g.gain.setTargetAtTime(0, ctx.currentTime, 0.05); grid = null; }
        play('f1-launch', { gain: 2.6 });
        return;
      }
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
    // Facility bed: brown-noise room tone, mains hum, vent air, plus channels the frame loop drives.
    ambienceStart() {
      if (amb || !ensure()) return;
      const bus = ctx.createGain();
      bus.gain.value = 0;
      bus.connect(master);
      const room = loopNoise(noiseBuffer(4, true));
      const roomLp = ctx.createBiquadFilter();
      roomLp.type = 'lowpass';
      roomLp.frequency.value = 240;
      const roomG = ctx.createGain();
      roomG.gain.value = 1.4;
      room.connect(roomLp).connect(roomG).connect(bus);

      const hum = ctx.createOscillator();
      hum.frequency.value = 50;
      const hum2 = ctx.createOscillator();
      hum2.frequency.value = 100;
      const humG = ctx.createGain();
      humG.gain.value = 0.16;
      const hum2G = ctx.createGain();
      hum2G.gain.value = 0.05;
      hum.connect(humG).connect(bus);
      hum2.connect(hum2G).connect(bus);
      hum.start(); hum2.start();

      const white = noiseBuffer(3);
      const air = loopNoise(white);
      const airBp = ctx.createBiquadFilter();
      airBp.type = 'bandpass';
      airBp.frequency.value = 1100;
      airBp.Q.value = 0.6;
      const airG = ctx.createGain();
      airG.gain.value = 0.05;
      air.connect(airBp).connect(airG).connect(bus);

      // GLaDOS undertone: a low triangle with a slow, uneasy tremolo
      const dark = ctx.createOscillator();
      dark.type = 'triangle';
      dark.frequency.value = 61.7;
      const darkG = ctx.createGain();
      darkG.gain.value = 0;
      const trem = ctx.createOscillator();
      trem.frequency.value = 0.21;
      const tremG = ctx.createGain();
      tremG.gain.value = 0;
      trem.connect(tremG).connect(darkG.gain);
      dark.connect(darkG).connect(bus);
      dark.start(); trem.start();

      // scroll wind
      const wind = loopNoise(white);
      const windBp = ctx.createBiquadFilter();
      windBp.type = 'bandpass';
      windBp.Q.value = 0.9;
      windBp.frequency.value = 500;
      const windG = ctx.createGain();
      windG.gain.value = 0;
      wind.connect(windBp).connect(windG).connect(master);

      // the Lab car, far away down the straight
      const car = ctx.createOscillator();
      car.type = 'sawtooth';
      const car2 = ctx.createOscillator();
      car2.type = 'square';
      const carLp = ctx.createBiquadFilter();
      carLp.type = 'lowpass';
      carLp.frequency.value = 900;
      const carG = ctx.createGain();
      carG.gain.value = 0;
      car.connect(carLp); car2.connect(carLp);
      carLp.connect(carG).connect(master);
      car.start(); car2.start();

      // recorded beds layered on top when they exist
      const bedG = ctx.createGain();
      bedG.gain.value = 0.9;
      bedG.connect(bus);
      const gladosG = ctx.createGain();
      gladosG.gain.value = 0;
      gladosG.connect(bus);
      play('facility', { loop: true, to: bedG });
      play('glados-hum', { loop: true, to: gladosG });
      if (has('facility')) roomG.gain.value = 0.6;

      amb = { bus, roomLp, hum, hum2, airG, darkG, tremG, windBp, windG, car, car2, carLp, carG, gladosG };
      bus.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    },
    mood(name) {
      if (!amb) return;
      const m = MOODS[name] || MOODS.hero;
      const t = ctx.currentTime;
      amb.roomLp.frequency.setTargetAtTime(m.lp, t, 0.8);
      amb.hum.frequency.setTargetAtTime(m.hum, t, 0.8);
      amb.hum2.frequency.setTargetAtTime(m.hum * 2, t, 0.8);
      amb.airG.gain.setTargetAtTime(m.air, t, 0.8);
      amb.darkG.gain.setTargetAtTime(m.dark * 0.22, t, 1.5);
      amb.tremG.gain.setTargetAtTime(m.dark * 0.12, t, 1.5);
      amb.gladosG.gain.setTargetAtTime(m.dark * 1.4, t, 1.5);
    },
    // called every frame: scroll speed, the Lab car, and where Wheatley sits left to right
    frame({ scrollVel = 0, carLive = false, carSpeed = 0, pan = 0 }) {
      if (!amb || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const v = Math.min(Math.abs(scrollVel) / 4500, 1);
      amb.windG.gain.setTargetAtTime(v * v * 0.9, t, 0.12);
      amb.windBp.frequency.setTargetAtTime(350 + v * 1500, t, 0.12);
      const f = 55 + carSpeed * 150;
      amb.car.frequency.setTargetAtTime(f, t, 0.08);
      amb.car2.frequency.setTargetAtTime(f * 0.5, t, 0.08);
      amb.carLp.frequency.setTargetAtTime(500 + carSpeed * 1800, t, 0.08);
      amb.carG.gain.setTargetAtTime(carLive ? 0.05 + carSpeed * 0.07 : 0, t, 0.3);
      if (servoPan) servoPan.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)), t, 0.1);
      wheatPan = pan;
    },
    // going through a portal: a pitched-down sweep with a ringing tail
    portal(intensity = 1) {
      if (has('portal-travel')) { play('portal-travel', { gain: 2.2 * intensity }); return; }
      if (!ensure() || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(420, t);
      o.frequency.exponentialRampToValueAtTime(48, t + 0.55);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.9 * intensity, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      const n = ctx.createBufferSource();
      n.buffer = noiseBuffer(0.8);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 8;
      bp.frequency.setValueAtTime(3200, t);
      bp.frequency.exponentialRampToValueAtTime(180, t + 0.6);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(1.4 * intensity, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.09;
      const fb = ctx.createGain();
      fb.gain.value = 0.45;
      delay.connect(fb).connect(delay);
      const out = ctx.createGain();
      out.gain.value = 1;
      o.connect(og).connect(out);
      n.connect(bp).connect(ng).connect(out);
      out.connect(master);
      out.connect(delay).connect(master);
      o.start(t); o.stop(t + 0.8);
      n.start(t);
    },
    // portal gun: a bright zap that drops in pitch, then the portal opening hum (blue a touch higher)
    shoot(kind) {
      if (has(`shoot-${kind}`)) {
        play(`shoot-${kind}`, { gain: 2 });
        play('portal-open', { gain: 1.6, delay: 0.12 });
        return;
      }
      if (!ensure() || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const hi = kind === 'blue' ? 1.15 : 1;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1800 * hi, t);
      o.frequency.exponentialRampToValueAtTime(260 * hi, t + 0.16);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(5000, t);
      f.frequency.exponentialRampToValueAtTime(600, t + 0.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(f).connect(g).connect(master);
      o.start(t); o.stop(t + 0.25);
      // the portal blooming open on the wall
      const hum = ctx.createOscillator();
      hum.type = 'triangle';
      hum.frequency.setValueAtTime(90 * hi, t + 0.12);
      hum.frequency.exponentialRampToValueAtTime(140 * hi, t + 0.5);
      const hg = ctx.createGain();
      hg.gain.setValueAtTime(0.0001, t + 0.12);
      hg.gain.exponentialRampToValueAtTime(0.5, t + 0.2);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      hum.connect(hg).connect(master);
      hum.start(t + 0.12); hum.stop(t + 0.95);
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
        servoPan = ctx.createStereoPanner();
        o.connect(f).connect(g).connect(servoPan).connect(master);
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
    async speak(src, follow = false) {
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
        const pan = ctx.createStereoPanner();
        pan.pan.value = follow ? Math.max(-0.8, Math.min(0.8, wheatPan * 0.7)) : 0;
        voice.connect(g).connect(pan).connect(master);
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
      if (has('cube-land')) {
        play('cube-land', { gain: 2.4 });
        play('button', { gain: 2, delay: 0.08 });
        return;
      }
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
