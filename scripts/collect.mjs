#!/usr/bin/env node
// Coleta feeds e Wikipédia e grava data/inbox/AAAA-MM-DD.json.
// Só guarda título, link, fonte, data e trecho curto: o conteúdo é dado não confiável.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { todayBRT } from '../lib/taxonomy.mjs';

const UA = 'Mozilla/5.0 (compatible; SyncNewsBot/1.0)';
const MAX_PER_FEED = 12, SNIPPET = 600, MAX_AGE_DAYS = 4, SEEN_DAYS = 14;
const PROMO = /promo[cç][aã]o|black friday|\bofertas?\b|desconto|% mais barato|melhores .* para comprar|^\d+ melhores/i;
const today = todayBRT();
const inboxDir = 'data/inbox';
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', processEntities: false, trimValues: true });

const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp|hellip|ndash|mdash|ldquo|rdquo|lsquo|rsquo);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’' }[e]));
const val = (v) => (v == null ? '' : typeof v === 'object' ? (v['#text'] ?? v.__cdata ?? '') : String(v));
const clean = (v) => decode(decode(String(val(v))).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, ' ')).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const id = (link) => `s_${createHash('sha1').update(link).digest('hex').slice(0, 12)}`;
const arr = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

function entries(doc) {
  const raw = doc.rss?.channel?.item ?? doc['rdf:RDF']?.item ?? doc.RDF?.item ?? doc.feed?.entry;
  return arr(raw).map((e) => {
    let link = val(e.link);
    if (typeof e.link === 'object') {
      const links = arr(e.link);
      link = (links.find((l) => l['@rel'] === 'alternate' || !l['@rel'])?.['@href']) ?? val(links[0]);
    }
    return {
      title: clean(e.title),
      link: decode(String(link || val(e.guid))).trim(),
      publishedAt: val(e.pubDate) || val(e['dc:date']) || val(e.published) || val(e.updated),
      snippet: clean(e.description ?? e.summary ?? e['content:encoded'] ?? e.content).slice(0, SNIPPET),
    };
  });
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: '*/*' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  // Alguns feeds (Folha) vêm em ISO-8859-1; o encoding real está no prólogo XML.
  const bytes = new Uint8Array(await res.arrayBuffer());
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 200));
  const declared = /encoding=["']([\w-]+)["']/i.exec(head)?.[1];
  const header = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1];
  return new TextDecoder(declared ?? header ?? 'utf-8').decode(bytes);
}

async function retry(fn) {
  try { return await fn(); } catch { await new Promise((r) => setTimeout(r, 2000)); return fn(); }
}

function seenLinks() {
  const cutoff = Date.now() - SEEN_DAYS * 86_400_000;
  const seen = new Set();
  for (const f of readdirSync(inboxDir).filter((n) => n.endsWith('.json') && n !== `${today}.json`)) {
    const day = f.replace('.json', '');
    if (new Date(`${day}T12:00:00Z`).getTime() < cutoff) { unlinkSync(join(inboxDir, f)); continue; }
    try { for (const it of JSON.parse(readFileSync(join(inboxDir, f), 'utf8')).items) seen.add(it.link); } catch { /* inbox antiga corrompida não bloqueia a coleta */ }
  }
  return seen;
}

async function collectFeeds() {
  const feeds = JSON.parse(readFileSync('data/feeds.json', 'utf8'));
  const jobs = Object.entries(feeds).flatMap(([category, list]) => list.map(([source, url]) => ({ category, source, url })));
  const seen = seenLinks();
  const cutoff = Date.now() - MAX_AGE_DAYS * 86_400_000;
  const items = new Map();
  const report = [];
  const results = await Promise.allSettled(jobs.map(async (job) => {
    const xml = await retry(() => fetchText(job.url));
    return { job, list: entries(parser.parse(xml)) };
  }));
  results.forEach((r, i) => {
    const job = jobs[i];
    if (r.status === 'rejected') { report.push({ source: job.source, ok: false, error: String(r.reason?.message ?? r.reason) }); return; }
    let kept = 0;
    const list = r.value.list
      .filter((e) => /^https?:\/\//.test(e.link) && e.title)
      .sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0));
    for (const e of list) {
      if (kept >= MAX_PER_FEED) break;
      const t = Date.parse(e.publishedAt);
      if (t && t < cutoff) continue;
      if (items.has(id(e.link)) || PROMO.test(e.title)) continue;
      items.set(id(e.link), { id: id(e.link), category: job.category, source: job.source, title: e.title, link: e.link, publishedAt: t ? new Date(t).toISOString() : null, snippet: e.snippet, seen: seen.has(e.link) });
      kept++;
    }
    report.push({ source: job.source, ok: true, items: kept });
  });
  return { items: [...items.values()], report };
}

async function collectWikipedia() {
  const [y, m, d] = today.split('-');
  const base = 'https://pt.wikipedia.org/api/rest_v1/feed';
  const out = { dyk: [], onthisday: [] };
  const page = (href) => decodeURI(href ?? '').replace(/^\.\//, '');
  try {
    const featured = JSON.parse(await retry(() => fetchText(`${base}/featured/${y}/${m}/${d}`)));
    for (const k of arr(featured.dyk)) {
      const bold = /<b[^>]*>\s*(?:<i[^>]*>)?\s*<a[^>]*href="([^"]+)"/.exec(k.html ?? '') ?? /<a[^>]*href="([^"]+)"/.exec(k.html ?? '');
      if (!bold) continue;
      const url = bold[1].startsWith('http') ? bold[1] : `https://pt.wikipedia.org/wiki/${page(bold[1])}`;
      out.dyk.push({ id: id(url), url: encodeURI(decodeURI(url)), text: clean(k.html ?? k.text) });
    }
  } catch (e) { console.warn('Wikipédia dyk falhou:', e.message); }
  try {
    const otd = JSON.parse(await retry(() => fetchText(`${base}/onthisday/selected/${m}/${d}`)));
    for (const ev of arr(otd.selected).slice(0, 12)) {
      const url = ev.pages?.[0]?.content_urls?.desktop?.page;
      if (url) out.onthisday.push({ id: id(url), url, year: ev.year, text: clean(ev.text) });
    }
  } catch (e) { console.warn('Wikipédia onthisday falhou:', e.message); }
  await Promise.all([...out.dyk, ...out.onthisday].map(async (w) => {
    try {
      const title = w.url.split('/wiki/')[1];
      w.extract = JSON.parse(await fetchText(`https://pt.wikipedia.org/api/rest_v1/page/summary/${title}`)).extract?.slice(0, 900) ?? '';
    } catch { w.extract = ''; }
  }));
  return out;
}

mkdirSync(inboxDir, { recursive: true });
const [{ items, report }, wikipedia] = await Promise.all([collectFeeds(), collectWikipedia()]);
const failed = report.filter((r) => !r.ok);
const inbox = { date: today, collectedAt: new Date().toISOString(), items, wikipedia, report };
writeFileSync(join(inboxDir, `${today}.json`), `${JSON.stringify(inbox, null, 1)}\n`);
console.log(`${items.length} itens de ${report.length - failed.length}/${report.length} feeds; Wikipédia: ${wikipedia.dyk.length} dyk, ${wikipedia.onthisday.length} efemérides.`);
for (const f of failed) console.log(`  falhou: ${f.source} (${f.error})`);
for (const r of report.filter((x) => x.ok && !x.items)) console.log(`  sem itens recentes: ${r.source}`);
if (items.length < 40) { console.error('Coleta insuficiente.'); process.exit(1); }
