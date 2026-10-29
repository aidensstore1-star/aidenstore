// Turns the original photos in images/ into web-sized WebP files in
// public/photos/ and writes their dimensions to src/photo-manifest.json.
// Runs before `npm run dev` and `npm run build`; unchanged photos are skipped.
import { readdir, mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const srcDir = path.join(root, 'images')
const outDir = path.join(root, 'public', 'photos')
const manifestPath = path.join(root, 'src', 'photo-manifest.json')

const WIDTHS = [640, 1280]

// Photos with a "SHOT ON REDMI K20" watermark in the bottom-left corner.
// Cropping the bottom 13% removes it.
const WATERMARKED = new Set([
  'tall-candle-ombre-wire-flowers',
  'hair-vine-gold-leaves-pearls',
  'cake-blue-piped-flowers-lace',
  'cake-lilac-ombre-babys-breath',
  'cake-jungle-dinosaur',
])
const WATERMARK_CROP = 0.13

const isNewer = async (a, b) => {
  try {
    return (await stat(a)).mtimeMs > (await stat(b)).mtimeMs
  } catch {
    return true
  }
}

await mkdir(outDir, { recursive: true })
const files = (await readdir(srcDir)).filter((f) => /\.jpe?g$/i.test(f)).sort()
const manifest = {}
let written = 0

for (const file of files) {
  const name = file.replace(/\.jpe?g$/i, '')
  const input = path.join(srcDir, file)
  const meta = await sharp(input).rotate().metadata()
  let { width, height } = meta
  if (meta.orientation >= 5) [width, height] = [height, width]

  const crop = WATERMARKED.has(name)
    ? { left: 0, top: 0, width, height: Math.round(height * (1 - WATERMARK_CROP)) }
    : null
  if (crop) height = crop.height
  manifest[name] = { w: width, h: height }

  for (const w of WIDTHS) {
    const output = path.join(outDir, `${name}-${w}.webp`)
    if (!(await isNewer(input, output))) continue
    let img = sharp(input).rotate()
    if (crop) img = img.extract(crop)
    await img
      .resize({ width: Math.min(w, width), withoutEnlargement: true })
      .webp({ quality: 80, effort: 5 })
      .toFile(output)
    written++
  }
}

await mkdir(path.dirname(manifestPath), { recursive: true })
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`photos: ${files.length} originals, ${written} files written`)
