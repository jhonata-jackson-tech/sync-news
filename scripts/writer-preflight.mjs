#!/usr/bin/env node
// O escritor roda isto primeiro. Código 3: a edição já existe. Código 4: falta a coleta do dia.
import { readFileSync, existsSync } from 'node:fs';
import { inboxIsFresh } from '../lib/validate.mjs';
import { todayBRT } from '../lib/taxonomy.mjs';

const today = todayBRT();
const inboxPath = `data/inbox/${today}.json`;
if (existsSync(`data/editions/${today}/edition.json`)) { console.log(`Edição ${today} já existe. Nada a fazer.`); process.exit(3); }
if (!existsSync(inboxPath)) { console.error(`Sem inbox de ${today}. Coletor não rodou.`); process.exit(4); }
const inbox = JSON.parse(readFileSync(inboxPath, 'utf8'));
if (!inboxIsFresh(inbox)) { console.error(`Inbox de ${today} velha demais.`); process.exit(4); }
console.log(`OK: escrever a edição ${today} a partir de ${inboxPath}.`);
const priority = inbox.items.filter((i) => i.priority?.length && !i.seen);
console.log(`\nItens prioritários novos (${priority.length}). Avalie todos para o bloco updates:`);
for (const i of priority) console.log(`- [${i.priority.join(', ')}] ${i.id} · ${i.source} · ${i.title}`);
