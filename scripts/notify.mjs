#!/usr/bin/env node
// Avisa os inscritos que a edição do dia foi publicada. Uso: node scripts/notify.mjs [--dry-run]
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { todayBRT } from '../lib/taxonomy.mjs';

const dry = process.argv.includes('--dry-run');
const { ONESIGNAL_APP_ID: appId, ONESIGNAL_APP_API_KEY: key } = process.env;
if (!dry && (!appId || !key)) { console.log('OneSignal não configurado. Nada a enviar.'); process.exit(0); }

const today = todayBRT();
const path = `data/editions/${today}/edition.json`;
if (!existsSync(path)) { console.error(`Sem edição de ${today}.`); process.exit(1); }
const edition = JSON.parse(readFileSync(path, 'utf8'));

/** UUID fixo por publicação e segmento: se o envio repetir, o OneSignal descarta a duplicata. */
function uuidFor(text) {
  const h = createHash('sha1').update(text).digest('hex');
  const variant = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const heading = 'Nova edição do Sync News';
const body = edition.overview.title;

// O nome do segmento padrão varia entre contas do OneSignal.
for (const segment of ['Subscribed Users', 'Total Subscriptions']) {
  const payload = {
    app_id: appId,
    target_channel: 'push',
    included_segments: [segment],
    headings: { en: heading, pt: heading },
    contents: { en: body, pt: body },
    url: 'https://jhonata-jackson-tech.github.io/sync-news/',
    idempotency_key: uuidFor(`${edition.publishedAt}:${segment}`),
  };
  if (dry) { console.log(JSON.stringify(payload, null, 2)); process.exit(0); }
  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Key ${key}` },
    body: JSON.stringify(payload),
  });
  const result = await res.json().catch(() => ({}));
  if (res.ok && result.id) { console.log(`Notificação enviada ao segmento "${segment}".`); process.exit(0); }
  console.log(`Segmento "${segment}" sem envio (HTTP ${res.status}): ${JSON.stringify(result.errors ?? result)}`);
}
console.log('Nenhuma notificação enviada.');
