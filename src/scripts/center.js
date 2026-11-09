// Central de notificações e configurações. As preferências ficam só neste aparelho.
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const KEYS = { read: 'sn-read', deleted: 'sn-deleted', font: 'sn-font' };
const FONT_STEPS = [90, 100, 112, 125, 140];

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado */ } },
};

let feed = [];
let loaded = false;
let read = new Set(store.get(KEYS.read, []));
let deleted = new Set(store.get(KEYS.deleted, []));
let clearArmed = 0;

function save() {
  store.set(KEYS.read, [...read]);
  store.set(KEYS.deleted, [...deleted]);
}

/* ---------- Tamanho do texto ---------- */
const fontNow = () => {
  const value = Number(store.get(KEYS.font, 100));
  return FONT_STEPS.includes(value) ? value : 100;
};
function applyFont() {
  const value = fontNow();
  document.documentElement.style.fontSize = value === 100 ? '' : `${value}%`;
  document.querySelectorAll('[data-font-value]').forEach((el) => { el.textContent = `${value}%`; });
  document.querySelectorAll('[data-font="dec"]').forEach((b) => { b.disabled = value === FONT_STEPS[0]; });
  document.querySelectorAll('[data-font="inc"]').forEach((b) => { b.disabled = value === FONT_STEPS.at(-1); });
}
function changeFont(action) {
  const index = FONT_STEPS.indexOf(fontNow());
  if (action === 'reset') store.set(KEYS.font, 100);
  else store.set(KEYS.font, FONT_STEPS[Math.max(0, Math.min(FONT_STEPS.length - 1, index + (action === 'inc' ? 1 : -1)))]);
  applyFont();
}

/* ---------- Painéis ---------- */
function closePanels() {
  document.querySelectorAll('[data-panel]').forEach((p) => { p.hidden = true; });
  document.querySelectorAll('[data-panel-toggle]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
}
function togglePanel(name) {
  const panel = document.querySelector(`[data-panel="${name}"]`);
  const willOpen = panel.hidden;
  closePanels();
  if (!willOpen) return;
  const burger = document.querySelector('[data-burger]');
  if (burger?.getAttribute('aria-expanded') === 'true') burger.click();
  panel.hidden = false;
  document.querySelector(`[data-panel-toggle="${name}"]`).setAttribute('aria-expanded', 'true');
}

/* ---------- Central ---------- */
const visible = () => feed.filter((n) => !deleted.has(n.id));

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function itemNode(n) {
  const li = element('li', `center-item${read.has(n.id) ? '' : ' unread'}`);
  const link = element('a', 'center-link');
  link.href = n.url;
  link.dataset.centerOpen = n.id;
  const meta = element('span', 'center-meta');
  meta.append(element('span', `badge b-${n.badge}`, n.label), element('span', '', n.section));
  link.append(meta, element('span', 'center-title', n.title));
  const remove = element('button', 'center-remove', '×');
  remove.type = 'button';
  remove.dataset.centerDelete = n.id;
  remove.setAttribute('aria-label', `Apagar notificação: ${n.title}`);
  li.append(link, remove);
  return li;
}

function render() {
  const items = visible();
  const unread = items.filter((n) => !read.has(n.id)).length;
  const toggle = document.querySelector('[data-panel-toggle="notifications"]');
  const count = document.querySelector('[data-center-count]');
  if (count) { count.textContent = unread > 99 ? '99+' : String(unread); count.hidden = unread === 0; }
  toggle?.setAttribute('aria-label', unread ? `Notificações, ${unread} não lidas` : 'Notificações');

  const list = document.querySelector('[data-center-list]');
  if (!list) return;
  list.replaceChildren();
  let lastDate = null;
  for (const n of items) {
    if (n.date !== lastDate) { list.append(element('li', 'center-date', n.date)); lastDate = n.date; }
    list.append(itemNode(n));
  }
  if (!items.length) list.append(element('li', 'center-empty', loaded ? 'Nenhuma notificação por aqui.' : 'Carregando…'));
  const readAll = document.querySelector('[data-center-readall]');
  const clear = document.querySelector('[data-center-clear]');
  if (readAll) readAll.disabled = unread === 0;
  if (clear) { clear.disabled = items.length === 0; clear.textContent = clearArmed ? 'Confirmar: apagar tudo' : 'Apagar tudo'; }
}

async function loadFeed() {
  try {
    feed = await (await fetch(`${BASE}/notificacoes.json`)).json();
    const ids = new Set(feed.map((n) => n.id));
    read = new Set([...read].filter((id) => ids.has(id)));
    deleted = new Set([...deleted].filter((id) => ids.has(id)));
    save();
  } catch { /* sem conexão: mantém o que já havia */ }
  loaded = true;
  render();
}

document.addEventListener('click', (e) => {
  const target = e.target;
  const toggle = target.closest('[data-panel-toggle]');
  const inside = target.closest('[data-panel]');
  if (toggle) { togglePanel(toggle.dataset.panelToggle); return; }
  if (target.closest('[data-burger]') || !inside) { closePanels(); }
  if (!inside) return;

  const font = target.closest('[data-font]');
  if (font) { changeFont(font.dataset.font); return; }

  const open = target.closest('[data-center-open]');
  if (open) { read.add(open.dataset.centerOpen); save(); render(); closePanels(); return; }

  const remove = target.closest('[data-center-delete]');
  if (remove) { deleted.add(remove.dataset.centerDelete); save(); render(); return; }

  if (target.closest('[data-center-readall]')) { visible().forEach((n) => read.add(n.id)); save(); render(); return; }

  if (target.closest('[data-center-clear]')) {
    if (clearArmed) {
      clearTimeout(clearArmed);
      clearArmed = 0;
      visible().forEach((n) => deleted.add(n.id));
      save();
    } else {
      clearArmed = setTimeout(() => { clearArmed = 0; render(); }, 4000);
    }
    render();
  }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanels(); });

document.addEventListener('astro:after-swap', applyFont);
document.addEventListener('astro:page-load', () => {
  applyFont();
  if (loaded) render(); else { render(); loadFeed(); }
});
