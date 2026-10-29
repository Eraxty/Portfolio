import gsap from 'gsap';

// F1 start. A thin line shows the real load; once the chamber is ready the visitor starts the car
// (that click is also what lets the browser play sound). Five lights at one-second intervals, a beep
// and a rev on each, a random hold like a real start, then lights out.
export function createLoader(sound) {
  const el = document.getElementById('loader');
  const units = [...el.querySelectorAll('.light-unit')];
  const pct = el.querySelector('.loader-pct');
  const status = el.querySelector('.loader-status');
  const bar = el.querySelector('.loader-bar i');
  const go = el.querySelector('.loader-go');
  let shown = 0;
  let target = 0;
  let raf;

  const tick = () => {
    shown += (target - shown) * 0.12;
    if (target - shown < 0.002) shown = target;
    pct.textContent = String(Math.round(shown * 100)).padStart(3, '0');
    bar.style.transform = `scaleX(${shown})`;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  return {
    progress(p) { target = Math.max(target, Math.min(1, p)); },
    async finish({ reduced }) {
      target = 1;
      await new Promise((r) => {
        const check = () => (shown >= 0.999 ? r() : setTimeout(check, 30));
        check();
      });
      cancelAnimationFrame(raf);

      if (reduced) {
        await gsap.to(el, { autoAlpha: 0, duration: 0.3 });
        el.remove();
        return;
      }

      // grid: wait for the driver
      status.textContent = 'Grid ready';
      el.classList.add('ready');
      const withSound = await new Promise((resolve) => {
        go.querySelector('[data-sound="on"]').addEventListener('click', () => resolve(true), { once: true });
        go.querySelector('[data-sound="off"]').addEventListener('click', () => resolve(false), { once: true });
      });
      sound.set(withSound);
      if (withSound) await sound.unlock();
      el.classList.remove('ready');
      el.classList.add('sequence');
      status.textContent = 'Lights';
      sound.engineStart();
      await wait(500);

      for (let i = 0; i < units.length; i++) {
        units[i].classList.add('on');
        sound.beep(660, 0.16, 'square', 0.45);
        sound.rpm(0.25 + i * 0.16, 0.12);
        // blip the throttle back down a touch between lights, like a driver holding revs
        setTimeout(() => sound.rpm(0.18 + i * 0.15, 0.3), 380);
        await wait(1000);
      }
      status.textContent = 'Hold';
      sound.rpm(0.82, 0.2);
      await wait(400 + Math.random() * 2200);

      units.forEach((u) => u.classList.remove('on'));
      status.textContent = 'Lights out';
      sound.beep(1320, 0.32, 'square', 0.5);
      sound.launch();
      await gsap.to(el, { yPercent: -100, duration: 1.05, ease: 'expo.inOut', delay: 0.3 });
      el.remove();
    },
  };
}
