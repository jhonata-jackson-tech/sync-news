// Arte generativa: o SVG nasce só de números derivados do slug. Nenhum texto externo entra aqui.
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
function rng(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f = (n) => n.toFixed(1);
const W = 400, H = 240;

function radar(r) {
  let s = '';
  const step = 20;
  for (let x = 10; x < W; x += step) for (let y = 10; y < H; y += step) {
    if (r() < 0.55) s += `<circle cx="${x}" cy="${y}" r="${f(0.6 + r() * 1.3)}" fill="currentColor" opacity="${f(0.12 + r() * 0.3)}"/>`;
  }
  const cx = 60 + r() * 280, cy = 50 + r() * 140;
  for (let i = 1; i <= 5; i++) s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${i * (22 + r() * 8)}" fill="none" stroke="var(--glow)" stroke-width="1" opacity="${f(0.75 - i * 0.12)}"/>`;
  const lines = 2 + Math.floor(r() * 2);
  for (let l = 0; l < lines; l++) {
    let y = 60 + r() * 120, d = `M0 ${f(y)}`;
    for (let x = 16; x <= W; x += 16) { y += (r() - 0.5) * 42; y = Math.max(16, Math.min(H - 16, y)); d += ` L${x} ${f(y)}`; }
    s += `<path d="${d}" fill="none" stroke="${l ? 'currentColor' : 'var(--glow)'}" stroke-width="${l ? 1 : 2.2}" opacity="${l ? 0.4 : 1}"/>`;
  }
  s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="5" fill="var(--glow)"/>`;
  return s;
}

function stars(r, n) {
  let s = '';
  for (let i = 0; i < n; i++) s += `<circle cx="${f(r() * W)}" cy="${f(r() * H)}" r="${f(0.4 + r() * 1.2)}" fill="currentColor" opacity="${f(0.2 + r() * 0.6)}"/>`;
  return s;
}

// Mandala: anéis, raios e estrela de sete pontas ou mais.
function mandala(r) {
  const cx = W / 2 + (r() - 0.5) * 140, cy = H / 2;
  let s = stars(r, 90);
  const rays = 24 + Math.floor(r() * 24);
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2, r2 = 100 + r() * 60;
    s += `<line x1="${f(cx + Math.cos(a) * 84)}" y1="${f(cy + Math.sin(a) * 84)}" x2="${f(cx + Math.cos(a) * r2)}" y2="${f(cy + Math.sin(a) * r2)}" stroke="var(--accent)" stroke-width="0.7" opacity="0.55"/>`;
  }
  [80, 62].forEach((R, i) => { s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${R}" fill="none" stroke="var(--accent)" stroke-width="${i ? 0.8 : 1.4}"/>`; });
  const points = [7, 8, 9, 12][Math.floor(r() * 4)];
  const skip = points === 12 ? 5 : 3;
  const rot = r() * Math.PI;
  const at = (k) => { const a = rot + (k / points) * Math.PI * 2; return [cx + Math.cos(a) * 62, cy + Math.sin(a) * 62]; };
  for (let k = 0; k < points; k++) {
    const [x1, y1] = at(k), [x2, y2] = at(k + skip);
    s += `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="var(--glow)" stroke-width="1.1"/>`;
  }
  return s;
}

// Eclipse: disco escuro com coroa de luz.
function eclipse(r) {
  const cx = 90 + r() * 220, cy = 90 + r() * 60, R = 58 + r() * 26;
  let s = stars(r, 130);
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, len = R + 8 + r() * r() * 110;
    s += `<line x1="${f(cx + Math.cos(a) * R)}" y1="${f(cy + Math.sin(a) * R)}" x2="${f(cx + Math.cos(a) * len)}" y2="${f(cy + Math.sin(a) * len)}" stroke="var(--accent)" stroke-width="0.8" opacity="${f(0.2 + r() * 0.6)}"/>`;
  }
  s += `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R + 3)}" fill="var(--glow)" opacity="0.85"/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="var(--art-bg)"/>`;
  return s;
}

// Constelação: estrelas ligadas sobre uma lua.
function constellation(r) {
  const mx = 50 + r() * 300, my = 50 + r() * 140, phase = 10 + r() * 16;
  let s = stars(r, 120);
  s += `<circle cx="${f(mx)}" cy="${f(my)}" r="30" fill="var(--accent)"/><circle cx="${f(mx + phase)}" cy="${f(my - 4)}" r="27" fill="var(--art-bg)"/>`;
  const nodes = Array.from({ length: 9 }, () => [20 + r() * 360, 20 + r() * 200]).sort((a, b) => a[0] - b[0]);
  nodes.forEach(([x, y], i) => {
    if (i) s += `<line x1="${f(nodes[i - 1][0])}" y1="${f(nodes[i - 1][1])}" x2="${f(x)}" y2="${f(y)}" stroke="var(--glow)" stroke-width="1"/>`;
    s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(2.5 + r() * 2)}" fill="var(--accent)"/>`;
  });
  return s;
}

const veu = (r) => [mandala, eclipse, constellation][Math.floor(r() * 3)](r);

export function art(seed, zone) {
  const r = rng(hash(seed));
  return `<svg class="art" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${zone === 'veu' ? veu(r) : radar(r)}</svg>`;
}
