#!/usr/bin/env node
// Uso: node scripts/validate-edition.mjs [--data <pasta data>] [--changed <arquivo com lista>]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validateEdition } from '../lib/validate.mjs';
import { todayBRT } from '../lib/taxonomy.mjs';

const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const dataDir = arg('--data') ?? 'data';
const changedPath = arg('--changed');
const today = todayBRT();
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const editionPath = join(dataDir, 'editions', today, 'edition.json');
const inboxPath = join(dataDir, 'inbox', `${today}.json`);
const sourcesPath = join(dataDir, 'editions', today, 'sources.json');
for (const p of [editionPath, inboxPath]) {
  if (!existsSync(p)) { console.error(`Faltando: ${p}`); process.exit(1); }
}

const editionsDir = join(dataDir, 'editions');
const previous = readdirSync(editionsDir)
  .filter((d) => d !== today && existsSync(join(editionsDir, d, 'edition.json')))
  .map((d) => readJson(join(editionsDir, d, 'edition.json')));

let edition;
try { edition = readJson(editionPath); } catch (e) { console.error(`JSON inválido: ${e.message}`); process.exit(1); }

const errors = validateEdition(edition, {
  inbox: readJson(inboxPath),
  catalog: readJson(join(dataDir, 'beliefs', 'catalog.json')),
  sourcesFile: existsSync(sourcesPath) ? readJson(sourcesPath) : {},
  previous,
  changedFiles: changedPath ? readFileSync(changedPath, 'utf8').split('\n').filter(Boolean) : null,
});

if (errors.length) {
  console.error(`Edição ${today} REPROVADA:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`Edição ${today} aprovada.`);
