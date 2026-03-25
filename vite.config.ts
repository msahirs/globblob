import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { createMicrobiologyConfigApiMiddleware } from './server/microbiologyConfigApi'

function microbiologyConfigApiPlugin() {
  const middleware = createMicrobiologyConfigApiMiddleware()

  return {
    name: 'microbiology-config-api',
    configureServer(server: { middlewares: { use(handler: typeof middleware): void } }) {
      server.middlewares.use(middleware)
    },
    configurePreviewServer(server: { middlewares: { use(handler: typeof middleware): void } }) {
      server.middlewares.use(middleware)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [microbiologyConfigApiPlugin(), vue(), vueJsx(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
