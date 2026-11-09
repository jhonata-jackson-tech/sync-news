// Firebase Analytics: visitas e leitura. O SDK só carrega no site publicado e respeita a opção em Configurações.
const HOST = 'jhonata-jackson-tech.github.io';
const OPT_OUT = 'sn-analytics';
const firebaseConfig = {
  apiKey: 'AIzaSyCNDO3jlzCUv_1U1c579i2gX0bXU2oYMz8',
  authDomain: 'sync-news-f0b2d.firebaseapp.com',
  projectId: 'sync-news-f0b2d',
  storageBucket: 'sync-news-f0b2d.firebasestorage.app',
  messagingSenderId: '134194102919',
  appId: '1:134194102919:web:f1169dbb7c6a42abc82e22',
  measurementId: 'G-GYFZDE5EW7',
};

const enabled = () => { try { return localStorage.getItem(OPT_OUT) !== 'off'; } catch { return true; } };
const onSite = () => location.hostname === HOST;
let sdk = null;

function load() {
  sdk ??= (async () => {
    const [{ initializeApp }, fa] = await Promise.all([import('firebase/app'), import('firebase/analytics')]);
    if (!(await fa.isSupported())) return null;
    // A troca de página é feita sem recarregar, então o page_view é enviado por aqui.
    const analytics = fa.initializeAnalytics(initializeApp(firebaseConfig), { config: { send_page_view: false } });
    fa.setUserProperties(analytics, { app_mode: matchMedia('(display-mode: standalone)').matches ? 'pwa' : 'browser' });
    return { analytics, ...fa };
  })().catch(() => null);
  return sdk;
}

export function track(name, params = {}) {
  if (!onSite() || !enabled()) return;
  load().then((a) => a?.logEvent(a.analytics, name, params));
}

const pageView = (url = location.href, title = document.title) => track('page_view', { page_location: url, page_title: title });

/* ---------- Leitura ---------- */
const seen = new WeakSet();
let observers = [];

function once(el, run) {
  if (seen.has(el)) return;
  seen.add(el);
  run();
}

function articleParams(article) {
  const { id, zone, category, badge, edition } = article.dataset;
  return { article_id: id, zone, category, badge, edition };
}

function watchArticles() {
  let first = true;
  const reading = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target }) => {
    if (!isIntersecting) return;
    once(target, () => {
      // Só a primeira matéria abre uma página; as seguintes chegam rolando e contam como nova visualização.
      if (!first) pageView(new URL(target.dataset.url, location.origin).href, target.dataset.title);
      first = false;
      track('view_article', articleParams(target));
    });
  }), { rootMargin: '-40% 0px -55% 0px' });
  const finished = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target }) => {
    if (isIntersecting) once(target, () => track('read_complete', articleParams(target.closest('[data-article]'))));
  }));
  const observe = () => document.querySelectorAll('[data-article]').forEach((a) => {
    reading.observe(a);
    const end = a.querySelector('.sources');
    if (end) finished.observe(end);
  });
  observe();
  const main = document.querySelector('main');
  const added = new MutationObserver(observe);
  if (main) added.observe(main, { childList: true });
  observers.push(reading, finished, added);
}

function watchSections() {
  const sections = new IntersectionObserver((entries) => entries.forEach(({ isIntersecting, target }) => {
    if (isIntersecting) once(target, () => track('section_view', { section: target.id }));
  }), { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('[data-section]:not(#inicio), #atualizacoes-ia').forEach((s) => sections.observe(s));
  observers.push(sections);
}

/* ---------- Opção em Configurações ---------- */
function paintSwitch() {
  document.querySelectorAll('[data-analytics]').forEach((b) => b.setAttribute('aria-checked', String(enabled())));
}

async function setEnabled(on) {
  try { if (on) localStorage.removeItem(OPT_OUT); else localStorage.setItem(OPT_OUT, 'off'); } catch { /* modo privado */ }
  paintSwitch();
  if (!onSite() || (!on && !sdk)) return;
  const a = await load();
  a?.setAnalyticsCollectionEnabled(a.analytics, on);
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-analytics]')) { setEnabled(!enabled()); return; }
  const notification = e.target.closest('[data-center-open]');
  if (notification) { track('notification_click', { notification_id: notification.dataset.centerOpen }); return; }
  const external = e.target.closest('a[target="_blank"]');
  if (external) track('source_click', { domain: external.hostname, page_path: location.pathname });
});

window.addEventListener('appinstalled', () => track('pwa_install'));

document.addEventListener('astro:page-load', () => {
  observers.forEach((o) => o.disconnect());
  observers = [];
  paintSwitch();
  pageView();
  watchArticles();
  watchSections();
});
