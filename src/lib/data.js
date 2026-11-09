import { CATEGORIES, ZONES } from '../../lib/taxonomy.mjs';
import watchlist from '../../data/watchlist.json';

const editionFiles = import.meta.glob('/data/editions/*/edition.json', { eager: true, import: 'default' });
const sourceFiles = import.meta.glob('/data/editions/*/sources.json', { eager: true, import: 'default' });

export const B = import.meta.env.BASE_URL.replace(/\/$/, '');
export const href = (p = '/') => `${B}${p.startsWith('/') ? p : `/${p}`}`;

const watchName = Object.fromEntries(watchlist.map((w) => [w.id, w.name]));
const zoneOf = (a) => CATEGORIES[a.category].zone;

function hydrate(ed, file) {
  const sources = sourceFiles[file.replace('edition.json', 'sources.json')] ?? {};
  const resolve = (ids = []) => ids.map((id) => sources[id]).filter(Boolean);
  const articles = ed.articles.map((a) => ({
    ...a,
    date: ed.date,
    publishedAt: ed.publishedAt,
    id: `${ed.date}-${a.slug}`,
    zone: zoneOf(a),
    zoneSlug: ZONES[zoneOf(a)].slug,
    categoryName: CATEGORIES[a.category].name,
    categoryShort: CATEGORIES[a.category].short,
    url: href(`/${ZONES[zoneOf(a)].slug}/artigo/${ed.date}-${a.slug}`),
    sourceList: resolve(a.sources),
    anchorSource: a.anchor ? sources[a.anchor] : null,
    photo: a.image ? sources[a.image] : null,
    counterSources: resolve(a.counterpoint?.sources),
    quotes: (a.quotes ?? []).map((q) => ({ ...q, from: sources[q.source] })),
    minutes: Math.ceil(a.body.split(/\s+/).length / 200),
  }));
  const pill = { ...ed.pill, minutes: Math.ceil(ed.pill.body.split(/\s+/).length / 200), photo: sources[ed.pill.wikipediaId]?.image ?? null };
  const updates = (ed.updates ?? []).map((u) => ({ ...u, name: watchName[u.watch] ?? u.watch, sourceList: resolve(u.sources) }));
  return { ...ed, pill, articles, updates };
}

export const editions = Object.entries(editionFiles)
  .map(([file, ed]) => hydrate(ed, file))
  .sort((a, b) => b.date.localeCompare(a.date));

export const latest = editions[0];
export const allArticles = editions.flatMap((e) => e.articles);
export const byZone = (ed, zone) => ed.articles.filter((a) => a.zone === zone);

export const longDate = (d) =>
  new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }).format(new Date(`${d}T12:00:00-03:00`));
export const shortDate = (d) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(`${d}T12:00:00-03:00`));
export const clock = (iso) =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Texto do modelo vira HTML só por aqui: tudo é escapado, e só **negrito** e parágrafos sobrevivem. */
export const prose = (s) =>
  s.split(/\n{2,}/).map((p) => `<p>${esc(p.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, ' ')}</p>`).join('');
