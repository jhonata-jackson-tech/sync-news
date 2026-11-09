import { editions, shortDate, href, latest } from '../lib/data.js';
import { BADGES } from '../../lib/taxonomy.mjs';

/** Itens da central de notificações: cada matéria e a Pílula das últimas edições. */
export function GET() {
  const items = editions.slice(0, 5).flatMap((ed) => [
    ...ed.articles.map((a) => ({
      id: a.id,
      title: a.title,
      url: a.url,
      label: BADGES[a.badge].label,
      badge: a.badge.toLowerCase(),
      section: a.categoryShort,
      date: shortDate(ed.date),
    })),
    {
      id: `pilula-${ed.date}`,
      title: ed.pill.title,
      url: ed.date === latest.date ? href('/#pilula') : href(`/edicoes/${ed.date}#pilula`),
      label: 'Pílula',
      badge: 'pilula',
      section: 'Pílula do Dia',
      date: shortDate(ed.date),
    },
  ]);
  return new Response(JSON.stringify(items), { headers: { 'content-type': 'application/json' } });
}
