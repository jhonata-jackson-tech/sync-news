#!/usr/bin/env node
// Espera a coleta do dia chegar à branch inbox. Sai com 0 quando chegou e 5 se ainda não chegou.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { inboxIsFresh } from '../lib/validate.mjs';
import { todayBRT } from '../lib/taxonomy.mjs';

const path = `data/inbox/${todayBRT()}.json`;
const ready = () => {
  try { execFileSync('bash', ['scripts/fetch-inbox.sh'], { stdio: 'ignore' }); } catch { return false; }
  return existsSync(path) && inboxIsFresh(JSON.parse(readFileSync(path, 'utf8')));
};

const end = Date.now() + 100_000;
while (Date.now() < end) {
  if (ready()) { console.log(`Inbox ${path} disponível.`); process.exit(0); }
  await new Promise((r) => setTimeout(r, 10_000));
}
console.error('A coleta ainda não chegou.');
process.exit(5);
