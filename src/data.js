// Curated copy for the timing tower. Stars, language and push dates come live from GitHub;
// these are the fallbacks (snapshot 2026-10-29) and the human-written one-liners.
export const GITHUB_USER = 'Eraxty';

export const projects = {
  Atlas: { blurb: 'A self-hosted Usenet indexer that lives in your terminal. Newznab API for the *arr apps, local AI search through Ollama, and a Rust port that is a lot faster.', lang: 'Python', stars: 110, pushed: '2026-10-06' },
  TouchTrack: { blurb: 'Watched the F1 movie in 4DX and wanted that on a phone. It listens to a film with CLAP, turns the hits into a haptic subtitle track, and plays it through a modded VLC.', lang: 'Kotlin', stars: 1, pushed: '2026-07-11' },
  Claudina: { blurb: 'A local AI girlfriend that lives in your browser. Runs on Ollama, no cloud, and remembers the chat after you close the tab.', lang: 'Python', stars: 3, pushed: '2026-10-25' },
  Parallax: { blurb: 'Saw a glasses-free 3D laptop and wanted one. Interlaces images for lenticular sheets, with LPI, DPI and slant tuning.', lang: 'Python', stars: 0, pushed: '2026-10-25' },
  Strubot: { blurb: 'Turns Hooktheory song JSON into Strudel live-code, so cover songs take minutes instead of an evening.', lang: 'C#', stars: 0, pushed: '2026-10-20' },
  'Ascii-Shaders': { blurb: 'I wanted to play Minecraft in a terminal, so I wrote a shader. Coloured ASCII with a generated glyph atlas.', lang: 'GLSL', stars: 1, pushed: '2026-06-26' },
  Shoggy: { blurb: 'A Minecraft shader for low-end PCs. Custom fog, shadow mapping, deferred lighting, coloured lights.', lang: 'GLSL', stars: 1, pushed: '2026-06-17' },
  'Mouse-Portal': { blurb: 'Portal, for your cursor. Enter orange, exit blue. Built for Hyprland on Arch.', lang: 'Python', stars: 1, pushed: '2026-07-23' },
  Cracklab: { blurb: 'A friend sent me a cipher, so I built one app that cracks most of them. Substitution, Vigenère, Caesar and every encoding I kept googling.', lang: 'Python', stars: 1, pushed: '2026-09-30' },
  '404-Light-not-found-': { name: '404 Light Not Found', blurb: 'A website that really does not want you to turn on dark mode. The button runs away from you.', lang: 'HTML', stars: 0, pushed: '2026-10-24' },
  'Stock-Market-Simulator': { name: 'Stock Market Sim', blurb: 'Virtual trading with live prices, hashed accounts, SQLite history and graphs in the terminal.', lang: 'Python', stars: 1, pushed: '2026-07-10' },
  'Long-Distance-Contact-': { name: 'Long Distance Contact', blurb: 'Two coordinates in, two compass bearings out, so you and a friend can face each other across the planet.', lang: 'Python', stars: 2, pushed: '2026-01-02' },
};

// tyre compound colours per language family (F1 broadcast colours)
export const tyres = {
  Python: { code: 'PY', color: '#f4f4ef' },
  Kotlin: { code: 'KT', color: '#ff2a2a' },
  Java: { code: 'JV', color: '#ff2a2a' },
  GLSL: { code: 'GL', color: '#f2d21b' },
  'C#': { code: 'C#', color: '#22d16b' },
  HTML: { code: 'WB', color: '#2f9bff' },
  CSS: { code: 'WB', color: '#2f9bff' },
  TypeScript: { code: 'TS', color: '#2f9bff' },
  JavaScript: { code: 'JS', color: '#2f9bff' },
  Rust: { code: 'RS', color: '#ff7a1a' },
};

export const teamColors = ['#ff7a1a', '#2f9bff', '#b44cff', '#22d16b', '#f2d21b', '#ecece6'];

export async function loadRepos() {
  const cacheKey = 'eraxty:repos:v1';
  try {
    const hit = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
    if (hit && Date.now() - hit.t < 10 * 60 * 1000) return hit.repos;
  } catch { /* storage blocked */ }

  let live = [];
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`https://api.github.com/users/${GITHUB_USER}/repos?per_page=100&sort=pushed`, { signal: ctl.signal });
    clearTimeout(timer);
    if (res.ok) live = await res.json();
  } catch { /* offline or rate limited: fall back */ }

  const byName = new Map(live.filter((r) => !r.fork).map((r) => [r.name, r]));
  const repos = Object.entries(projects).map(([id, p]) => {
    const r = byName.get(id);
    return {
      id,
      name: p.name || id.replace(/-/g, ' ').trim(),
      blurb: p.blurb,
      lang: r?.language || p.lang,
      stars: r?.stargazers_count ?? p.stars,
      pushed: r?.pushed_at || p.pushed,
      url: r?.html_url || `https://github.com/${GITHUB_USER}/${id}`,
    };
  });
  repos.sort((a, b) => b.stars - a.stars || new Date(b.pushed) - new Date(a.pushed));
  const total = live.length ? live.filter((r) => !r.fork).length : 24;
  const out = { repos, total };
  try { sessionStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), repos: out })); } catch { /* ignore */ }
  return out;
}
