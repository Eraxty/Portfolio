// Tiny Web Audio kit. Off by default; one switch in the header.
export function createSound() {
  let ctx = null;
  let master = null;
  let on = false;
  let servo = null;
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

  const api = {
    get on() { return on; },
    set(v) {
      on = v;
      try { localStorage.setItem('eraxty:sound', v ? '1' : '0'); } catch { /* ignore */ }
      if (v) ensure();
      else { window.speechSynthesis?.cancel(); if (servo) servo.g.gain.value = 0; }
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
    // Captions read aloud with the browser's own voices. Not a recording of anyone.
    speak(text, who) {
      const synth = window.speechSynthesis;
      if (!on || !synth) return;
      const voices = synth.getVoices();
      const gb = voices.filter((v) => /en[-_]GB/i.test(v.lang));
      const u = new SpeechSynthesisUtterance(text);
      u.voice = (who === 'GLaDOS' ? gb.find((v) => /female|libby|sonia|hazel|kate|serena/i.test(v.name)) : gb.find((v) => /male|ryan|george|daniel|arthur/i.test(v.name))) || gb[0] || voices.find((v) => /^en/i.test(v.lang)) || null;
      u.lang = 'en-GB';
      if (who === 'GLaDOS') { u.rate = 0.92; u.pitch = 1.35; }
      else { u.rate = 1.18; u.pitch = 1.15; }
      u.volume = 0.9;
      synth.cancel();
      synth.speak(u);
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
