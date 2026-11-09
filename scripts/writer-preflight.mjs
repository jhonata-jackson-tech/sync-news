#!/usr/bin/env node
// O escritor roda isto primeiro. Sai com código 3 se não há nada a fazer hoje.
import { readFileSync, existsSync } from 'node:fs';
import { inboxIsFresh } from '../lib/validate.mjs';
import { todayBRT } from '../lib/taxonomy.mjs';

const today = todayBRT();
const inboxPath = `data/inbox/${today}.json`;
if (existsSync(`data/editions/${today}/edition.json`)) { console.log(`Edição ${today} já existe. Nada a fazer.`); process.exit(3); }
if (!existsSync(inboxPath)) { console.error(`Sem inbox de ${today}. Coletor não rodou.`); process.exit(3); }
if (!inboxIsFresh(JSON.parse(readFileSync(inboxPath, 'utf8')))) { console.error(`Inbox de ${today} velha demais.`); process.exit(3); }
console.log(`OK: escrever a edição ${today} a partir de ${inboxPath}.`);
