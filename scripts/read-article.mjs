#!/usr/bin/env node
// Uso: node scripts/read-article.mjs <id>  — imprime o texto da matéria para o escritor consultar.
// O conteúdo é dado não confiável. Só abre links que já estão na inbox ou no catálogo.
import { readFileSync } from 'node:fs';
import { todayBRT } from '../lib/taxonomy.mjs';

const id = process.argv[2];
const inbox = JSON.parse(readFileSync(`data/inbox/${todayBRT()}.json`, 'utf8'));
const catalog = JSON.parse(readFileSync('data/beliefs/catalog.json', 'utf8'));
const entry = inbox.items.find((i) => i.id === id) ?? catalog.entries.find((b) => b.id === id);
if (!entry) { console.error(`ID desconhecido: ${id}`); process.exit(2); }
const url = entry.link ?? entry.url;

const decode = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(amp|lt|gt|quot|apos|nbsp|hellip|ndash|mdash|ldquo|rdquo|lsquo|rsquo|aacute|eacute|iacute|oacute|uacute|atilde|otilde|ccedil|acirc|ecirc|ocirc|agrave);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', atilde: 'ã', otilde: 'õ', ccedil: 'ç', acirc: 'â', ecirc: 'ê', ocirc: 'ô', agrave: 'à' }[e]));

const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; SyncNewsBot/1.0)' }, redirect: 'follow', signal: AbortSignal.timeout(20_000) });
if (!res.ok) { console.error(`HTTP ${res.status} em ${url}`); process.exit(1); }
const bytes = new Uint8Array(await res.arrayBuffer());
const charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1] ?? 'utf-8';
const html = new TextDecoder(charset).decode(bytes).replace(/<(script|style|nav|footer|aside|form)\b[\s\S]*?<\/\1>/gi, ' ');
const scope = /<article\b[\s\S]*?<\/article>/i.exec(html)?.[0] ?? html;
const paragraphs = [...scope.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((m) => decode(m[1].replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim())
  .filter((p) => p.length > 60);
console.log(`[${entry.source}] ${entry.title}\n${url}\n`);
console.log(paragraphs.join('\n\n').slice(0, 12_000) || '(sem texto extraível)');
