import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://jhonata-jackson-tech.github.io',
  base: '/sync-news',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
});
