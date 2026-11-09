import { z } from 'zod';
import { CATEGORIES, BADGES, RADAR_CATEGORIES, todayBRT } from './taxonomy.mjs';

const text = (min, max) => z.string().trim().min(min).max(max);
const sourceId = z.string().regex(/^(s|b)_[a-z0-9-]{4,60}$/);

const Article = z.strictObject({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).min(5).max(90),
  category: z.enum(Object.keys(CATEGORIES)),
  badge: z.enum(Object.keys(BADGES)),
  title: text(15, 130),
  dek: text(30, 240),
  body: text(1200, 9000),
  image: sourceId.optional(),
  anchor: sourceId.optional(),
  sources: z.array(sourceId).min(1).max(6),
  quotes: z.array(z.strictObject({ text: text(8, 300), source: sourceId })).max(3).default([]),
  singleSource: z.boolean().optional(),
  isUpdate: z.boolean().optional(),
  correctedAt: z.iso.datetime({ offset: true }).optional(),
  attribution: text(5, 160).optional(),
  counterpoint: z.strictObject({ body: text(80, 900), sources: z.array(sourceId).min(1).max(4) }).optional(),
});

export const Edition = z.strictObject({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  publishedAt: z.iso.datetime({ offset: true }),
  overview: z.strictObject({
    title: text(15, 130),
    body: text(400, 4500),
    highlights: z.array(text(10, 160)).min(3).max(6),
  }),
  articles: z.array(Article).min(10).max(14),
  pill: z.strictObject({
    title: text(5, 120),
    body: text(1200, 3800),
    wikipediaId: sourceId,
    sourceUrl: z.url().startsWith('https://pt.wikipedia.org/'),
    license: z.literal('CC BY-SA 4.0'),
    adapted: z.literal(true),
  }),
});

const PERSONA = /\b(estive em|estive no|estive na|me disseram|me contou|me contaram|entrevistei|conversei com|presenciei|testemunhei|vi com meus pr[oó]prios olhos)\b/i;
const ATTRIBUTION = /(^|[^\p{L}])(segundo|de acordo com|conforme|na vis[aã]o d[eoa]s?|na leitura d[eoa]s?|defende|defendem|sustenta|sustentam|afirma|afirmam|acredita|acreditam|alega|alegam|tradi[cç][aã]o|relato|relatos)([^\p{L}]|$)/iu;

const norm = (s) => s.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter(Boolean);

function longestSharedRun(a, b, limit) {
  const hay = ` ${words(b).join(' ')} `;
  const w = words(a);
  for (let i = 0; i + limit <= w.length; i++) {
    if (hay.includes(` ${w.slice(i, i + limit).join(' ')} `)) return w.slice(i, i + limit).join(' ');
  }
  return null;
}

function strings(obj, path = '') {
  if (typeof obj === 'string') return [[path, obj]];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (obj && typeof obj === 'object') return Object.entries(obj).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k));
  return [];
}

/**
 * Valida uma edição contra a inbox do dia e o catálogo de crenças.
 * Retorna uma lista de erros; lista vazia significa aprovado.
 */
export function validateEdition(raw, { inbox, catalog, sourcesFile = null, previous = [], changedFiles = null, today = todayBRT(), now = new Date() }) {
  const parsed = Edition.safeParse(raw);
  if (!parsed.success) return parsed.error.issues.map((i) => `esquema: ${i.path.join('.')}: ${i.message}`);
  const ed = parsed.data;
  const errors = [];
  const fail = (m) => errors.push(m);

  if (ed.date !== today) fail(`date ${ed.date} não é hoje em Brasília (${today})`);
  if (inbox.date !== ed.date) fail(`inbox é de ${inbox.date}, edição é de ${ed.date}`);
  const pub = new Date(ed.publishedAt);
  if (pub.getTime() > now.getTime() + 5 * 60_000) fail('publishedAt está no futuro');
  if (todayBRT(pub) !== ed.date) fail('publishedAt não cai na data da edição');

  if (changedFiles) {
    const allowed = [`data/editions/${ed.date}/edition.json`, `data/editions/${ed.date}/sources.json`];
    for (const f of changedFiles) if (!allowed.includes(f)) fail(`arquivo fora do permitido: ${f}`);
  }

  const known = new Map();
  for (const it of inbox.items) known.set(it.id, it);
  for (const b of catalog.entries) known.set(b.id, b);

  // Nada de HTML, scripts ou URLs digitadas em nenhum campo de texto.
  for (const [path, s] of strings(ed)) {
    if (path.endsWith('sourceUrl') || path.endsWith('publishedAt') || path.endsWith('correctedAt')) continue;
    if (/<\s*\/?[a-z!]/i.test(s)) fail(`${path}: contém HTML`);
    if (/javascript:|data:text|https?:\/\/|www\.|\]\(/i.test(s)) fail(`${path}: contém URL ou link`);
  }

  const slugs = new Set();
  let radar = 0, veu = 0;
  const seenCats = new Set();

  for (const a of ed.articles) {
    const where = `artigo ${a.slug}`;
    const cat = CATEGORIES[a.category];
    if (slugs.has(a.slug)) fail(`${where}: slug repetido`);
    slugs.add(a.slug);
    seenCats.add(a.category);
    if (!cat.badges.includes(a.badge)) fail(`${where}: selo ${a.badge} não pertence a ${a.category}`);

    const count = words(a.body).length;
    const belief = cat.zone === 'veu';
    if (belief) veu++; else radar++;
    if (!belief && (count < 320 || count > 750)) fail(`${where}: ${count} palavras (Radar: 320 a 750)`);
    if (belief && (count < 420 || count > 950)) fail(`${where}: ${count} palavras (Entrelinhas: 420 a 950)`);

    if (/["“”«»]/.test(a.body)) fail(`${where}: aspas no corpo; citações só em quotes[]`);
    if (PERSONA.test(a.body) || PERSONA.test(a.dek)) fail(`${where}: narrador finge experiência própria`);

    const cited = [...a.sources, ...(a.anchor ? [a.anchor] : []), ...(a.counterpoint?.sources ?? [])];
    for (const id of cited) if (!known.has(id)) fail(`${where}: fonte desconhecida ${id}`);

    for (const q of a.quotes) {
      const src = known.get(q.source);
      if (!a.sources.includes(q.source)) fail(`${where}: citação de fonte não listada`);
      else if (!src) continue;
      else {
        const hay = norm([src.title, src.snippet, src.summary, ...(src.quotes ?? [])].filter(Boolean).join(' '));
        if (!hay.includes(norm(q.text))) fail(`${where}: citação não é literal da fonte`);
      }
    }

    for (const id of a.sources) {
      const src = known.get(id);
      if (!src) continue;
      if (src.seen && !a.isUpdate) fail(`${where}: fonte já publicada nos últimos 14 dias sem isUpdate`);
      const allowedQuotes = a.quotes.map((q) => norm(q.text));
      const run = longestSharedRun(a.body, [src.snippet, src.summary].filter(Boolean).join(' '), 12);
      if (run && !allowedQuotes.some((q) => q.includes(run))) fail(`${where}: trecho copiado da fonte: "${run}"`);
    }

    const photoIds = [...a.sources, ...(a.anchor ? [a.anchor] : [])];
    if (a.image) {
      if (!photoIds.includes(a.image)) fail(`${where}: image precisa ser uma das fontes do artigo`);
      else if (known.has(a.image) && !known.get(a.image).image) fail(`${where}: fonte escolhida não tem foto`);
    } else if (photoIds.some((id) => known.get(id)?.image)) fail(`${where}: há foto disponível nas fontes, informe image`);

    if (belief) {
      if (!a.attribution) fail(`${where}: Entrelinhas exige attribution`);
      if (!a.counterpoint) fail(`${where}: Entrelinhas exige counterpoint`);
      if (!a.anchor) fail(`${where}: Entrelinhas exige anchor (notícia atual de partida)`);
      else {
        const anchor = known.get(a.anchor);
        if (anchor && !RADAR_CATEGORIES.includes(anchor.category)) fail(`${where}: anchor precisa ser notícia do Radar`);
        if (anchor?.seen) fail(`${where}: anchor precisa ser notícia atual`);
      }
      if (!ATTRIBUTION.test(a.body)) fail(`${where}: tese sem atribuição no texto`);
    } else {
      if (a.counterpoint || a.anchor) fail(`${where}: contraponto e anchor são exclusivos das Entrelinhas`);
      if (a.sources.length === 1 && !a.singleSource) fail(`${where}: fonte única precisa de singleSource`);
    }
  }

  if (radar < 6) fail(`Radar tem ${radar} artigos (mínimo 6)`);
  if (veu < 4) fail(`Entrelinhas tem ${veu} artigos (mínimo 4)`);
  for (const c of RADAR_CATEGORIES) if (!seenCats.has(c)) fail(`editoria sem artigo: ${c}`);

  const wiki = [...(inbox.wikipedia?.dyk ?? []), ...(inbox.wikipedia?.onthisday ?? [])];
  const pillSrc = wiki.find((w) => w.id === ed.pill.wikipediaId);
  if (!pillSrc) fail('pill: wikipediaId não está na inbox');
  else if (pillSrc.url !== ed.pill.sourceUrl) fail('pill: sourceUrl difere da inbox');
  if (previous.some((p) => p.pill?.sourceUrl === ed.pill.sourceUrl)) fail('pill: curiosidade já publicada');

  if (sourcesFile && JSON.stringify(sortKeys(sourcesFile)) !== JSON.stringify(sortKeys(resolveSources(ed, { inbox, catalog })))) {
    fail('sources.json não corresponde à inbox e ao catálogo');
  }

  return errors;
}

const sortKeys = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

/** Monta id → {title, source, url} só a partir de dados confiáveis, nunca do texto do modelo. */
export function resolveSources(ed, { inbox, catalog }) {
  const known = new Map();
  for (const it of inbox.items) known.set(it.id, { title: it.title, source: it.source, url: it.link, ...(it.image ? { image: it.image } : {}) });
  for (const b of catalog.entries) known.set(b.id, { title: b.title, source: b.source, url: b.url, ...(b.image ? { image: b.image } : {}) });
  const out = {};
  for (const a of ed.articles) {
    for (const id of [...a.sources, ...(a.anchor ? [a.anchor] : []), ...(a.counterpoint?.sources ?? [])]) if (known.has(id)) out[id] = known.get(id);
  }
  const wiki = [...(inbox.wikipedia?.dyk ?? []), ...(inbox.wikipedia?.onthisday ?? [])].find((w) => w.id === ed.pill.wikipediaId);
  if (wiki?.image) out[wiki.id] = { title: ed.pill.title, source: 'Wikipédia', url: wiki.url, image: wiki.image };
  return out;
}

/** Inbox válida para escrever: de hoje e coletada há menos de 6 horas. */
export function inboxIsFresh(inbox, { today = todayBRT(), now = new Date() } = {}) {
  if (!inbox || inbox.date !== today) return false;
  return now.getTime() - new Date(inbox.collectedAt).getTime() < 6 * 3_600_000;
}
