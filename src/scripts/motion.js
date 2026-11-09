import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let cleanups = [];

/* ---------- Globo em canvas ---------- */
const CITIES = [[-23.5, -46.6], [-15.8, -47.9], [38.9, -77], [51.5, -0.1], [55.7, 37.6], [39.9, 116.4], [35.7, 51.4], [31.8, 35.2], [28.6, 77.2], [36.9, 30.7], [-34.6, -58.4], [24.7, 46.7]];
const ARCS = [[0, 2], [0, 3], [2, 5], [2, 4], [4, 5], [6, 7], [6, 2], [8, 5], [1, 9], [10, 0], [11, 6], [3, 9]];

function initGlobe(canvas) {
  const ctx = canvas.getContext('2d');
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue('--ink').trim() || '#0a1620';
  const glow = css.getPropertyValue('--glow').trim() || '#00d4ff';
  const N = 1100;
  const dots = Array.from({ length: N }, (_, i) => {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), t = i * Math.PI * (3 - Math.sqrt(5));
    return [Math.cos(t) * r, y, Math.sin(t) * r];
  });
  const toVec = ([lat, lon]) => {
    const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
    return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
  };
  const cities = CITIES.map(toVec);
  let W = 0, H = 0, R = 0, cx = 0, cy = 0, rot = 2.4, raf = 0, visible = true;
  const tilt = -0.32;

  const project = ([x, y, z]) => {
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const x1 = x * cr - z * sr, z1 = x * sr + z * cr;
    const ct = Math.cos(tilt), st = Math.sin(tilt);
    const y1 = y * ct - z1 * st, z2 = y * st + z1 * ct;
    return [cx + x1 * R, cy - y1 * R, z2];
  };
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.min(W, H) * 0.44; cx = W / 2; cy = H / 2;
  }
  function draw(time) {
    ctx.clearRect(0, 0, W, H);
    for (const d of dots) {
      const [x, y, z] = project(d);
      if (z < 0) continue;
      ctx.globalAlpha = 0.28 + z * 0.62;
      ctx.fillStyle = ink;
      ctx.beginPath(); ctx.arc(x, y, 0.7 + z * 0.9, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = glow; ctx.lineWidth = 1.4;
    ARCS.forEach(([a, b], idx) => {
      const A = cities[a], B = cities[b];
      const steps = 44, pts = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        let v = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
        const len = Math.hypot(...v) || 1, lift = 1 + Math.sin(t * Math.PI) * 0.2;
        v = v.map((c) => (c / len) * lift);
        pts.push(project(v));
      }
      ctx.globalAlpha = 0.4; ctx.beginPath();
      let pen = false;
      for (const [x, y, z] of pts) { if (z < 0) { pen = false; continue; } if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y); pen = true; }
      ctx.stroke();
      const p = pts[Math.floor((((time / 2600 + idx * 0.37) % 1)) * steps)];
      if (p[2] >= 0) { ctx.globalAlpha = 1; ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p[0], p[1], 3, 0, 7); ctx.fill(); }
    });
    ctx.fillStyle = glow;
    for (const c of cities) {
      const [x, y, z] = project(c);
      if (z < 0) continue;
      ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function loop(t) { if (visible) { rot += 0.0016; draw(t); } raf = requestAnimationFrame(loop); }

  size();
  if (reduced()) { draw(0); } else raf = requestAnimationFrame(loop);
  const ro = new ResizeObserver(() => { size(); if (reduced()) draw(0); });
  ro.observe(canvas);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
  io.observe(canvas);
  cleanups.push(() => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); });
}

/* ---------- Revelações ---------- */
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.setAttribute('aria-label', el.textContent.trim());
  el.innerHTML = '';
  for (const w of words) {
    const outer = document.createElement('span'); outer.className = 'w'; outer.setAttribute('aria-hidden', 'true');
    const inner = document.createElement('span'); inner.textContent = w;
    outer.append(inner); el.append(outer, ' ');
  }
  return el.querySelectorAll('.w > span');
}

/* Cifra: o título nasce em símbolos e se decifra letra a letra. */
const GLYPHS = 'ΑΒΓΔΘΛΞΠΣΦΨΩ☉☽☿♃♄⊕⋈∴';
function decipher(el) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  const state = { p: 0 };
  const render = () => {
    const solved = Math.floor(state.p * text.length);
    let out = '';
    for (let i = 0; i < text.length; i++) out += i < solved || text[i] === ' ' ? text[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
    el.textContent = out;
  };
  render();
  gsap.to(state, { p: 1, duration: 1.5, ease: 'power1.inOut', onUpdate: render, onComplete: () => { el.textContent = text; }, scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
}

function initMotion() {
  document.querySelectorAll('[data-cipher]').forEach(decipher);
  document.querySelectorAll('[data-split]:not([data-cipher])').forEach((el) => {
    gsap.from(splitWords(el), { yPercent: 115, duration: 0.85, ease: 'expo.out', stagger: 0.035, delay: 0.1 });
  });
  gsap.utils.toArray('[data-reveal]').forEach((el) => {
    gsap.from(el, { y: 34, autoAlpha: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  const track = document.querySelector('[data-ticker]');
  if (track) {
    const tween = gsap.to(track, { xPercent: -50, duration: 70, ease: 'none', repeat: -1 });
    track.addEventListener('mouseenter', () => tween.pause());
    track.addEventListener('mouseleave', () => tween.play());
  }
  const gate = document.querySelector('[data-gate]');
  if (gate) {
    const iris = gate.querySelector('[data-iris]');
    gsap.fromTo(iris, { clipPath: 'circle(8% at 50% 46%)' }, { clipPath: 'circle(120% at 50% 46%)', ease: 'none', scrollTrigger: { trigger: gate, start: 'top 90%', end: 'center 50%', scrub: 0.6 } });
    gsap.fromTo(iris.querySelector('img'), { scale: 1.28 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: gate, start: 'top bottom', end: 'bottom 60%', scrub: 0.6 } });
  }
  gsap.utils.toArray('[data-thread]').forEach((thread) => {
    gsap.fromTo(thread, { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: thread.parentNode, start: 'top 75%', end: 'bottom 75%', scrub: 0.5 } });
  });
  const art = document.querySelector('.article-art img') ?? document.querySelector('.article-art .art');
  if (art) gsap.to(art, { yPercent: 16, ease: 'none', scrollTrigger: { trigger: '.article-art', start: 'top top', end: 'bottom top', scrub: true } });
}

function initPill() {
  document.querySelectorAll('[data-pill]').forEach((pill) => {
    const ring = pill.querySelector('[data-ring]');
    if (reduced()) { ring.style.strokeDashoffset = 0; return; }
    const tween = gsap.fromTo(ring, { strokeDashoffset: 100 }, { strokeDashoffset: 0, duration: Number(pill.dataset.seconds) || 120, ease: 'none', paused: true });
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? tween.play() : tween.pause()), { threshold: 0.5 });
    io.observe(pill);
    cleanups.push(() => { io.disconnect(); tween.kill(); });
  });
}

function initProgress() {
  const bar = document.querySelector('[data-progress]');
  const article = document.querySelector('[data-article]');
  if (!bar) return;
  bar.style.transform = 'scaleX(0)';
  if (!article) return;
  const update = () => {
    const r = article.getBoundingClientRect();
    const total = r.height - innerHeight;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, total > 0 ? -r.top / total : 1))})`;
  };
  addEventListener('scroll', update, { passive: true });
  update();
  cleanups.push(() => removeEventListener('scroll', update));
}

function initStale() {
  const el = document.querySelector('[data-stale]');
  if (!el) return;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  el.hidden = el.dataset.latest === today;
}

function boot() {
  initStale();
  initProgress();
  initPill();
  const globe = document.querySelector('[data-globe]');
  if (globe) initGlobe(globe);
  if (!reduced()) initMotion();
  ScrollTrigger.refresh();
}

function teardown() {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  ScrollTrigger.getAll().forEach((t) => t.kill());
  gsap.killTweensOf('*');
}

/* ---------- Atravessar o véu ---------- */
const inVeil = (path) => /\/arcanum(\/|$)/.test(path);
let crossing = false;

document.addEventListener('astro:before-preparation', (e) => {
  crossing = !reduced() && inVeil(e.from.pathname) !== inVeil(e.to.pathname);
  document.documentElement.classList.toggle('veil-cross', crossing);
});
document.addEventListener('astro:before-swap', teardown);
document.addEventListener('astro:after-swap', () => {
  if (crossing) document.documentElement.classList.add('veil-cross');
});
document.addEventListener('astro:page-load', () => {
  boot();
  if (crossing) setTimeout(() => { document.documentElement.classList.remove('veil-cross'); crossing = false; }, 1400);
});
