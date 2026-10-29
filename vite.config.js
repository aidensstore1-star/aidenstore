import { defineConfig } from 'vite'
import { htmlContent } from './scripts/render.mjs'

export default defineConfig({
  // Relative asset paths, so the built site works from any folder or host.
  base: './',
  plugins: [htmlContent()],
  server: { host: true },
  build: { target: 'es2022', assetsInlineLimit: 0 },
})
