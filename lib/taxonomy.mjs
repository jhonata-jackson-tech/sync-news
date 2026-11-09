// Fonte única das zonas, editorias e selos. Usada pelo validador, pelo coletor e pelo site.
export const ZONES = {
  radar: { slug: 'radar', name: 'Radar', tagline: 'O que aconteceu, com fonte e data.', kind: 'Notícias e análises' },
  veu: { slug: 'arcanum', name: 'Arcanum', tagline: 'O que os fatos de hoje guardam de não dito.', kind: 'Teorias e conexões — não é notícia verificada' },
};

export const CATEGORIES = {
  ia: { zone: 'radar', name: 'Inteligência Artificial', short: 'IA', badges: ['FATO', 'ANALISE'] },
  geopolitica: { zone: 'radar', name: 'Geopolítica', short: 'Geopolítica', badges: ['FATO', 'ANALISE'] },
  brasil: { zone: 'radar', name: 'Brasil', short: 'Brasil', badges: ['FATO', 'ANALISE'] },
  mundo: { zone: 'radar', name: 'Mundo', short: 'Mundo', badges: ['FATO', 'ANALISE'] },
  teorias: { zone: 'veu', name: 'Teorias', short: 'Teorias', badges: ['TEORIA'] },
  profecias: { zone: 'veu', name: 'Profecias e Previsões', short: 'Profecias', badges: ['PROFECIA'] },
  esoterismo: { zone: 'veu', name: 'Esoterismo', short: 'Esoterismo', badges: ['ESOTERICO'] },
  escatologia: { zone: 'veu', name: 'Escatologia', short: 'Escatologia', badges: ['ESCATOLOGIA'] },
};

export const BADGES = {
  FATO: { label: 'Fato', hint: 'Fato relatado por veículo citado' },
  ANALISE: { label: 'Análise', hint: 'Interpretação sobre fatos citados' },
  TEORIA: { label: 'Teoria', hint: 'Tese não comprovada' },
  PROFECIA: { label: 'Profecia', hint: 'Previsão ou leitura profética, não um fato' },
  ESOTERICO: { label: 'Esotérico', hint: 'Tradição ou crença esotérica' },
  ESCATOLOGIA: { label: 'Escatologia', hint: 'Leitura religiosa sobre o fim dos tempos' },
};

export const BELIEF_CATEGORIES = Object.keys(CATEGORIES).filter((c) => CATEGORIES[c].zone === 'veu');
export const RADAR_CATEGORIES = Object.keys(CATEGORIES).filter((c) => CATEGORIES[c].zone === 'radar');

/** Data de hoje (AAAA-MM-DD) em Brasília. Nunca deixar o modelo inferir isso. */
export function todayBRT(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
