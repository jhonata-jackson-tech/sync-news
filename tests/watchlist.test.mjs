import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileWatchlist, matchWatch } from '../lib/watchlist.mjs';

const watch = compileWatchlist(JSON.parse(readFileSync('data/watchlist.json', 'utf8')));
const m = (title, source = 'TechCrunch', category = 'ia') => matchWatch({ title, source, category }, watch);

test('identifica empresas e produtos pelo título', () => {
  assert.deepEqual(m('OpenAI valued at $1.25 trillion'), ['openai']);
  assert.deepEqual(m('Como criar GIFs animados no ChatGPT?'), ['chatgpt']);
  assert.deepEqual(m('Claude Code ganha novo modo'), ['claude', 'claude-code']);
  assert.deepEqual(m('Meta introduces Spaces with your Muse agent'), ['meta-ai']);
});
test('o feed oficial conta mesmo sem o nome no título', () => {
  assert.deepEqual(m('v2.1.319', 'Claude Code'), ['claude-code']);
  assert.deepEqual(m('Partnering with Hacktron', 'OpenAI'), ['openai']);
});
test('não confunde nomes e palavras comuns', () => {
  assert.deepEqual(m('Jean-Claude Juncker fala sobre tecnologia'), []);
  assert.deepEqual(m('A meta de investimento em chips subiu'), []);
  assert.deepEqual(m('Expanding Teen Account Protections', 'Meta'), []);
});
test('fora da editoria de IA não marca', () => assert.deepEqual(m('Claude Monet em leilão', 'BBC', 'mundo'), []));
