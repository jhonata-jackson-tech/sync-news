// Empresas e produtos que o leitor sempre quer acompanhar. A lista fica em data/watchlist.json.
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function compileWatchlist(list) {
  return list.map((w) => ({
    id: w.id,
    feeds: new Set(w.feeds ?? []),
    // O hífen fica de fora para "Jean-Claude" não contar como Claude.
    rules: [
      ...(w.terms ?? []).map((t) => new RegExp(`(?<![\\p{L}\\p{N}-])${escape(t)}(?![\\p{L}\\p{N}-])`, 'iu')),
      ...(w.patterns ?? []).map((p) => new RegExp(p, 'u')),
    ],
  }));
}

/** IDs acompanhados por este item. Só a editoria de IA conta, e só o título, para evitar menção de passagem. */
export function matchWatch(item, compiled) {
  if (item.category !== 'ia') return [];
  return compiled.filter((w) => w.feeds.has(item.source) || w.rules.some((r) => r.test(item.title))).map((w) => w.id);
}
