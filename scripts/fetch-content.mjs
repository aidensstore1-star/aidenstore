// Fetches the site's content and photos from Supabase before a build, so the
// published site is plain, fast HTML built from what is in the admin panel.
//
// With VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY set (in the
// environment or .env.local): writes src/content.generated.js, downloads any
// new photos into public/photos/ and adds their sizes to
// src/photo-manifest.json. Without them (or with CONTENT_SOURCE=local): uses
// src/content.js, as before.
//
// It reads with the publishable key, so it only ever sees what visitors may
// see: published products and their photos.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { loadEnv } from 'vite'
import { contentFromRows, toModule } from './content-from-db.mjs'
import { generatedPath } from './content-source.mjs'

const root = path.resolve(import.meta.dirname, '..')
const env = { ...loadEnv('production', root, ''), ...process.env }
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key || env.CONTENT_SOURCE === 'local') {
  rmSync(generatedPath, { force: true })
  console.log('Content: src/content.js (Supabase not configured).')
  process.exit(0)
}

async function get(what, query) {
  const res = await fetch(`${url}/rest/v1/${what}?${query}`, {
    headers: { apikey: key, Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`Couldn't read ${what} from Supabase (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

const [settingsRows, sections, blocks, products, gallery, cakeOptions] = await Promise.all([
  get('site_settings', 'select=*'),
  get('sections', 'select=*&order=sort'),
  get('content_blocks', 'select=key,value'),
  get(
    'products',
    'select=slug,title,category,description,price_from,section_key,tags,sort,product_images(path,width,height,alt,focus,sort)&is_published=eq.true&order=section_key,sort',
  ),
  get('gallery_items', 'select=sort,product_images(path)&is_visible=eq.true&order=sort'),
  get('cake_options', 'select=id,kind,label,description,price_delta,sort&is_active=eq.true&order=kind,sort'),
])
if (!settingsRows.length) throw new Error('The database has no site settings yet: run supabase/seed.sql first.')

const { content, sizes, warnings } = contentFromRows({ settings: settingsRows[0], sections, blocks, products, gallery, cakeOptions })
for (const w of warnings) console.warn(`  warning: ${w}`)

// Photos: the admin panel uploads each one in two sizes. Download those not
// here yet (a changed photo gets a new name, so existing files never go stale).
const photoDir = path.join(root, 'public', 'photos')
await mkdir(photoDir, { recursive: true })
const queue = Object.entries(sizes).flatMap(([id, s]) =>
  [640, 1280].map((w) => ({ file: path.join(photoDir, `${id}-${w}.webp`), src: `${url}/storage/v1/object/public/public-media/${s.path}-${w}.webp` })),
).filter((p) => !existsSync(p.file))
let downloaded = 0
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const res = await fetch(job.src, { signal: AbortSignal.timeout(30000) })
    if (!res.ok) throw new Error(`Couldn't download ${job.src} (${res.status}). Was the photo uploaded?`)
    await writeFile(job.file, Buffer.from(await res.arrayBuffer()))
    downloaded++
  }
}
await Promise.all([worker(), worker(), worker(), worker()])

// A small 320px copy of each, made here from the 640 one (for cards,
// thumbnails and phones), so pages don't download more than they show.
const { default: sharp } = await import('sharp')
let made = 0
for (const id of Object.keys(sizes)) {
  const out = path.join(photoDir, `${id}-320.webp`)
  if (existsSync(out)) continue
  await sharp(path.join(photoDir, `${id}-640.webp`)).resize({ width: 320, withoutEnlargement: true }).webp({ quality: 80, effort: 5 }).toFile(out)
  made++
}

const manifestPath = path.join(root, 'src', 'photo-manifest.json')
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
for (const [id, s] of Object.entries(sizes)) manifest[id] = { w: s.w, h: s.h }
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

writeFileSync(generatedPath, toModule(content))
console.log(`Content: Supabase, ${content.catalog.length} products, ${downloaded} photo files downloaded, ${made} small copies made.`)
