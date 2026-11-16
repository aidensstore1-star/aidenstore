// Uploads the site's current photos into Supabase's public-media bucket, once,
// after the database has been set up (supabase/README.md). Each product photo
// listed in the database is uploaded in both sizes from public/photos/.
// Later photos are uploaded from the admin panel instead.
//
//   SUPABASE_SERVICE_KEY=... npm run db:upload-photos            (or put it in .env.local)
//   npm run db:upload-photos -- --dry-run                        (list what would be uploaded)
//
// The service key can do anything in the project: keep it in .env.local
// (never committed) or type it in for this one command, and never in a
// VITE_ variable.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { loadEnv } from 'vite'
import { photoId } from './content-from-db.mjs'

const root = path.resolve(import.meta.dirname, '..')
const env = { ...loadEnv('production', root, ''), ...process.env }
const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const key = env.SUPABASE_SERVICE_KEY
const dryRun = process.argv.includes('--dry-run')

if (!url || !key) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY (in .env.local or for this command) first.')
  process.exit(1)
}
const auth = { apikey: key, Authorization: `Bearer ${key}` }

const res = await fetch(`${url}/rest/v1/product_images?select=path`, { headers: auth })
if (!res.ok) throw new Error(`Couldn't read the product photos (${res.status}): ${await res.text()}`)
const paths = (await res.json()).map((r) => r.path)

let uploaded = 0
const missing = []
for (const p of paths) {
  for (const size of [640, 1280]) {
    const file = path.join(root, 'public', 'photos', `${photoId(p)}-${size}.webp`)
    if (!existsSync(file)) {
      missing.push(path.relative(root, file))
      continue
    }
    const target = `${p}-${size}.webp`
    if (dryRun) {
      console.log(`would upload ${path.relative(root, file)} → public-media/${target}`)
      continue
    }
    const up = await fetch(`${url}/storage/v1/object/public-media/${target}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'image/webp', 'x-upsert': 'true', 'Cache-Control': 'max-age=31536000' },
      body: readFileSync(file),
    })
    if (!up.ok) throw new Error(`Uploading ${target} failed (${up.status}): ${await up.text()}`)
    uploaded++
  }
}
if (missing.length) console.warn(`Not found locally (run \`npm run images\` first?):\n  ${missing.join('\n  ')}`)
console.log(dryRun ? `${paths.length} photos listed.` : `Uploaded ${uploaded} files for ${paths.length} photos.`)
