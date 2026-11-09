import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEdition, inboxIsFresh } from '../lib/validate.mjs';
import { todayBRT } from '../lib/taxonomy.mjs';

const lorem = (seed, n) => Array.from({ length: n }, (_, i) => `${seed}${i}`).join(' ');
const date = '2026-11-09';
const now = new Date('2026-11-09T11:00:00-03:00');

function build() {
  const items = Array.from({ length: 16 }, (_, i) => ({
    id: `s_item${i}`, category: 'ia', title: `Titulo da fonte ${i}`, link: `https://exemplo.com/${i}`, source: 'Exemplo',
    snippet: `alfa beta gama delta epsilon zeta eta teta iota kappa lambda mi nu xi fonte${i}`, seen: false,
  }));
  const radarCats = ['ia', 'ia', 'geopolitica', 'geopolitica', 'brasil', 'brasil', 'mundo'];
  const veuCats = [['teorias', 'TEORIA'], ['profecias', 'PROFECIA'], ['esoterismo', 'ESOTERICO'], ['escatologia', 'ESCATOLOGIA']];
  const articles = [
    ...radarCats.map((category, i) => ({
      slug: `radar-nota-${i}`, category, badge: 'FATO', title: `Manchete do radar numero ${i}`,
      dek: 'Linha de apoio com tamanho suficiente para passar.', body: lorem(`r${i}x`, 400),
      sources: [`s_item${i}`, `s_item${i + 1}`], quotes: [],
    })),
    ...veuCats.map(([category, badge], i) => ({
      slug: `veu-texto-${i}`, category, badge, title: `Tese do veu numero ${i} aqui`,
      dek: 'Linha de apoio com tamanho suficiente para passar.',
      body: `Segundo os autores, ${lorem(`v${i}x`, 520)}`, sources: [`s_item${i + 8}`], anchor: 's_item13', quotes: [],
      attribution: 'Tese atribuída a autores citados',
      counterpoint: { body: 'Até agora as fontes jornalísticas não confirmaram esta tese de forma independente.', sources: ['s_item12'] },
    })),
  ];
  const edition = {
    date, publishedAt: '2026-11-09T08:00:00-03:00',
    overview: { title: 'O dia em cinco minutos de leitura', body: lorem('palavra', 90), highlights: ['Destaque numero um', 'Destaque numero dois', 'Destaque numero tres'] },
    articles,
    pill: { title: 'Curiosidade', body: lorem('palavra', 260), wikipediaId: 's_wiki1', sourceUrl: 'https://pt.wikipedia.org/wiki/Teste', license: 'CC BY-SA 4.0', adapted: true },
  };
  return {
    edition,
    ctx: {
      inbox: { date, collectedAt: '2026-11-09T06:40:00-03:00', items, wikipedia: { dyk: [{ id: 's_wiki1', url: 'https://pt.wikipedia.org/wiki/Teste', text: 't' }], onthisday: [] } },
      catalog: { entries: [{ id: 'b_referencia', title: 'x', summary: 'y' }] },
      previous: [], today: date, now,
    },
  };
}

const expectError = (mutate, re) => {
  const { edition, ctx } = build();
  mutate(edition, ctx);
  const errs = validateEdition(edition, ctx);
  assert.ok(errs.some((e) => re.test(e)), `esperava ${re}, veio: ${errs.join(' | ')}`);
};

test('edição válida passa', () => {
  const { edition, ctx } = build();
  assert.deepEqual(validateEdition(edition, ctx), []);
});
test('rejeita URL inventada no texto', () => expectError((e) => { e.articles[0].body += ' veja https://mal.example/x'; }, /URL ou link/));
test('rejeita link markdown', () => expectError((e) => { e.overview.body += ' [clique](mal)'; }, /URL ou link/));
test('rejeita HTML / injeção de script', () => expectError((e) => { e.articles[1].dek = 'Texto com tag <script>alert(1)</script> embutida aqui'; }, /HTML/));
test('rejeita fonte que não está na inbox', () => expectError((e) => { e.articles[0].sources = ['s_inventada']; }, /fonte desconhecida/));
test('rejeita citação falsa', () => expectError((e) => { e.articles[0].quotes = [{ text: 'frase que ninguem disse', source: 's_item0' }]; }, /não é literal/));
test('aceita citação literal', () => {
  const { edition, ctx } = build();
  edition.articles[0].quotes = [{ text: 'Titulo da fonte 0', source: 's_item0' }];
  assert.deepEqual(validateEdition(edition, ctx), []);
});
test('rejeita aspas no corpo', () => expectError((e) => { e.articles[0].body += ' disse "algo" hoje'; }, /aspas/));
test('rejeita selo errado', () => expectError((e) => { e.articles[0].badge = 'TEORIA'; }, /selo/));
test('crença não pode sair como FATO', () => expectError((e) => { e.articles[8].badge = 'FATO'; }, /selo/));
test('crença exige contraponto', () => expectError((e) => { delete e.articles[7].counterpoint; }, /counterpoint/));
test('crença exige atribuição', () => expectError((e) => { e.articles[7].body = e.articles[7].body.replace('Segundo os autores, ', ''); }, /sem atribuição/));
test('rejeita narrador fingindo presença', () => expectError((e) => { e.articles[0].body += ' estive em Brasília ontem'; }, /finge/));
test('rejeita texto copiado', () => expectError((e) => { e.articles[0].body += ' alfa beta gama delta epsilon zeta eta teta iota kappa lambda mi'; }, /copiado/));
test('rejeita fonte repetida sem isUpdate', () => expectError((_, c) => { c.inbox.items[0].seen = true; }, /isUpdate/));
test('rejeita arquivo fora da edição', () => expectError((_, c) => { c.changedFiles = ['.github/workflows/deploy.yml']; }, /fora do permitido/));
test('rejeita inbox de outro dia', () => expectError((_, c) => { c.inbox.date = '2026-11-08'; }, /inbox/));
test('rejeita publicação no futuro', () => expectError((e) => { e.publishedAt = '2026-11-09T23:00:00-03:00'; }, /futuro/));
test('rejeita curiosidade repetida', () => expectError((_, c) => { c.previous = [{ pill: { sourceUrl: 'https://pt.wikipedia.org/wiki/Teste' } }]; }, /já publicada/));
test('rejeita campo extra (injeção de esquema)', () => expectError((e) => { e.articles[0].html = 'x'; }, /esquema/));
test('rejeita menos de 10 artigos', () => expectError((e) => { e.articles = e.articles.slice(0, 5); }, /esquema/));
test('rejeita sources.json adulterado', () => expectError((_, c) => { c.sourcesFile = { s_item0: { title: 'x', source: 'x', url: 'https://mal.example' } }; }, /sources.json/));
test('Entrelinhas exige notícia atual de partida', () => expectError((e) => { delete e.articles[7].anchor; }, /anchor/));
test('anchor não pode ser item de teoria', () => expectError((_, c) => { c.inbox.items[13].category = 'teorias'; }, /notícia do Radar/));
test('anchor não pode ser notícia antiga', () => expectError((_, c) => { c.inbox.items[13].seen = true; }, /notícia atual/));
test('exige foto quando a fonte tem', () => expectError((_, c) => { c.inbox.items[0].image = 'https://x.example/a.jpg'; }, /informe image/));
test('rejeita foto de fonte que não é do artigo', () => expectError((e, c) => { c.inbox.items[15].image = 'https://x.example/a.jpg'; e.articles[0].image = 's_item15'; }, /fontes do artigo/));
test('rejeita texto raso', () => expectError((e) => { e.articles[0].body = lorem('palavra', 200); }, /palavras/));
test('inbox velha não serve', () => {
  assert.equal(inboxIsFresh({ date, collectedAt: '2026-11-09T01:00:00-03:00' }, { today: date, now }), false);
  assert.equal(inboxIsFresh({ date, collectedAt: '2026-11-09T06:40:00-03:00' }, { today: date, now }), true);
});
test('data em Brasília vira depois de 03:00 UTC', () => {
  assert.equal(todayBRT(new Date('2026-11-10T02:59:00Z')), '2026-11-09');
  assert.equal(todayBRT(new Date('2026-11-10T03:01:00Z')), '2026-11-10');
});
