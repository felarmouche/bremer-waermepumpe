// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// Astro 6 runs server environments in workerd, so CommonJS dependencies must be prebundled.
function precompileReactServer() {
  return {
    name: 'precompile-react-server',
    configEnvironment(environment) {
      if (environment !== 'client') {
        return {
          optimizeDeps: {
            include: ['react-dom/server'],
          },
        };
      }
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://bremer-waermepumpe.de',

  integrations: [
    sitemap({
      filter: (page) => !/\/auswertung-/.test(page) && !/\/api\//.test(page),
    }),
    react(),
  ],

  vite: {
    plugins: [tailwindcss(), precompileReactServer()],
  },

  adapter: cloudflare({
    imageService: 'compile',
  })
});
