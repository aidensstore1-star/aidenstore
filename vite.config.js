import { defineConfig } from 'vite'
import { htmlContent } from './scripts/render.mjs'
import { catalogPages } from './scripts/catalog.mjs'
import { contentSourcePlugin } from './scripts/content-source.mjs'

export default defineConfig({
  // Relative asset paths, so the built site works from any folder or host.
  base: './',
  plugins: [contentSourcePlugin(), htmlContent(), catalogPages()],
  server: { host: true },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    // The story page, the admin panel at /admin/, and the template for the
    // section and product pages (scripts/catalog.mjs).
    rollupOptions: { input: { site: 'index.html', admin: 'admin/index.html', catalog: 'catalog.html' } },
  },
})
