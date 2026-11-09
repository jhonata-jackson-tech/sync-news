#!/usr/bin/env node
// Passo final do escritor: carimba a hora real e resolve as fontes a partir da inbox e do catálogo.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolveSources } from '../lib/validate.mjs';
import { todayBRT } from '../lib/taxonomy.mjs';

const today = todayBRT();
const dir = `data/editions/${today}`;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
if (!existsSync(`${dir}/edition.json`)) { console.error(`Faltando ${dir}/edition.json`); process.exit(1); }

const edition = readJson(`${dir}/edition.json`);
const now = new Date(Date.now() - 3 * 3_600_000).toISOString().replace('Z', '-03:00').replace(/\.\d+/, '');
edition.date = today;
edition.publishedAt = now;
writeFileSync(`${dir}/edition.json`, `${JSON.stringify(edition, null, 2)}\n`);
const sources = resolveSources(edition, { inbox: readJson(`data/inbox/${today}.json`), catalog: readJson('data/beliefs/catalog.json') });
writeFileSync(`${dir}/sources.json`, `${JSON.stringify(sources, null, 2)}\n`);
console.log(`Edição ${today} finalizada às ${now}, ${Object.keys(sources).length} fontes.`);
