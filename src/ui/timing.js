import { tyres, teamColors } from '../data.js';

const DAY = 86400000;

function lastLap(iso) {
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso)) / DAY));
  if (d === 0) return 'Today';
  if (d === 1) return '1 day';
  if (d < 60) return `${d} days`;
  return `${Math.round(d / 30)} months`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function renderTower(list, { sound }) {
  const body = document.querySelector('.tower-body');
  const freshest = list.reduce((a, b) => (new Date(b.pushed) > new Date(a.pushed) ? b : a), list[0]);
  body.innerHTML = list.map((r, i) => {
    const ty = tyres[r.lang] || { code: (r.lang || '··').slice(0, 2).toUpperCase(), color: '#77776f' };
    const purple = r === freshest;
    return `
      <li class="row" role="row" style="--i:${i};--team:${teamColors[i % teamColors.length]};--tyre:${ty.color}">
        <a href="${esc(r.url)}" target="_blank" rel="noopener" aria-label="${esc(r.name)}, ${esc(r.lang || 'unknown language')}, ${r.stars} stars. Opens GitHub.">
          <div class="row-main">
            <span class="row-pos" role="cell">${String(i + 1).padStart(2, '0')}</span>
            <span class="row-name" role="cell"><i class="team"></i><span>${esc(r.name)}</span></span>
            <span class="row-lang" role="cell"><i class="tyre" title="${esc(r.lang || '')}">${esc(ty.code)}</i></span>
            <span class="row-push${purple ? ' purple' : ''}" role="cell">${lastLap(r.pushed)}</span>
            <span class="row-stars" role="cell">${r.stars}</span>
          </div>
          <div class="row-detail"><div><p>${esc(r.blurb)}<span class="open">Open repo ↗</span></p></div></div>
        </a>
      </li>`;
  }).join('');

  const rows = [...body.children];
  rows.forEach((row) => {
    row.addEventListener('pointerenter', () => sound.tick());
  });

  // touch: first tap opens the row, second tap follows the link
  if (!window.matchMedia('(hover: hover)').matches) {
    rows.forEach((row) => {
      row.querySelector('a').addEventListener('click', (e) => {
        if (!row.classList.contains('open')) {
          e.preventDefault();
          rows.forEach((r) => r.classList.remove('open'));
          row.classList.add('open');
        }
      });
    });
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        rows.forEach((r) => r.classList.add('in'));
        io.disconnect();
      }
    });
  }, { threshold: 0.15 });
  io.observe(body);
}
