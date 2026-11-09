import { editions, shortDate, href, latest } from '../lib/data.js';

/** A central só avisa que uma edição foi publicada. Guarda as últimas, e o clique abre a edição. */
export function GET() {
  const items = editions.slice(0, 5).map((ed) => ({
    id: `edicao-${ed.date}`,
    title: ed.overview.title,
    url: ed.date === latest.date ? href('/') : href(`/edicoes/${ed.date}`),
    label: 'Nova edição',
    badge: 'fato',
    section: 'Edição do dia publicada',
    date: shortDate(ed.date),
  }));
  return new Response(JSON.stringify(items), { headers: { 'content-type': 'application/json' } });
}
