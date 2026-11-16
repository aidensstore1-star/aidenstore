// Where the site's content comes from at build time.
//
// `npm run content` (scripts/fetch-content.mjs) fetches the content from
// Supabase into src/content.generated.js. When that file exists, the build
// uses it; otherwise it uses the hand-written src/content.js. Both export the
// same names, so the rest of the site doesn't care which one it gets.
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '..')
export const contentPath = path.join(root, 'src', 'content.js')
export const generatedPath = path.join(root, 'src', 'content.generated.js')

export const contentFile = () => (existsSync(generatedPath) ? generatedPath : contentPath)

export async function loadContent() {
  const file = contentFile()
  // A fresh copy each time, so a re-fetch during `npm run dev` is picked up.
  const url = pathToFileURL(file)
  url.search = `v=${statSync(file).mtimeMs}`
  return import(url.href)
}

// Every photo the story page shows somewhere.
export function usedPhotoIds(content) {
  return new Set([
    ...content.hero,
    ...content.preloader,
    ...content.chapters.map((c) => c.photo),
    ...content.craft.beats.map((b) => b.photo),
    ...content.statement.photos,
    ...content.bride.photos,
    ...content.ceremony.photos,
    content.ceremony.finale,
    ...content.celebration.ring,
    ...content.home.wall,
    ...content.gallery,
    ...content.process.map((p) => p.photo),
    ...Object.values(content.houses).flatMap((h) => [h.photo, ...h.sign]),
  ])
}

// The products for the section and product pages. Content from Supabase
// lists them; for src/content.js each photo the site shows is one product.
export function catalogOf(content) {
  if (content.catalog) return content.catalog
  const used = usedPhotoIds(content)
  return Object.entries(content.photos)
    .filter(([id]) => used.has(id))
    .map(([id, p]) => ({
      slug: id,
      title: p.title,
      category: p.type,
      description: '',
      priceFrom: null,
      section: content.houseOf(id),
      images: [id],
    }))
}

// For the browser code: makes `import … from '../content.js'` load the fetched
// content when there is some.
export function contentSourcePlugin() {
  return {
    name: 'content-source',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.endsWith('content.js')) return null
      if (path.resolve(path.dirname(importer.split('?')[0]), source) !== contentPath) return null
      return contentFile()
    },
  }
}
