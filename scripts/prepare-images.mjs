// Turns the original photos in images/ into web-sized WebP files in
// public/photos/ and writes their dimensions to src/photo-manifest.json.
// Runs before `npm run dev` and `npm run build`; unchanged photos are skipped.
import { readdir, mkdir, stat, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '..')
const srcDir = path.join(root, 'images')
const outDir = path.join(root, 'public', 'photos')
const manifestPath = path.join(root, 'src', 'photo-manifest.json')

// 320 is for small places (cards, thumbnails, phones); 640 and 1280 for the rest.
const WIDTHS = [320, 640, 1280]

// One shared grade, baked into the files so phones don't pay for CSS filters:
// a touch of warmth (16% sepia), slightly less saturation, a little contrast.
// Change GRADE_VERSION when changing the grade, to rebuild every photo.
const GRADE_VERSION = '1'
const SEPIA = [
  [0.393, 0.769, 0.189],
  [0.349, 0.686, 0.168],
  [0.272, 0.534, 0.131],
]
const WARMTH = 0.16
const GRADE = SEPIA.map((row, r) => row.map((v, c) => (r === c ? 1 - WARMTH : 0) + WARMTH * v))
const grade = (img) => img.recomb(GRADE).modulate({ saturation: 0.88, brightness: 1.02 }).linear(1.04, -128 * 0.04)

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
// Kept outside public/ so it isn't published with the site.
const stampPath = path.join(root, 'node_modules', '.cache', 'photo-grade')
const stamp = await readFile(stampPath, 'utf8').catch(() => '')
const regrade = stamp.trim() !== GRADE_VERSION
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
    if (!regrade && !(await isNewer(input, output))) continue
    let img = sharp(input).rotate()
    if (crop) img = img.extract(crop)
    await grade(img)
      .resize({ width: Math.min(w, width), withoutEnlargement: true })
      .webp({ quality: 80, effort: 5 })
      .toFile(output)
    written++
  }
}

await mkdir(path.dirname(stampPath), { recursive: true })
await writeFile(stampPath, GRADE_VERSION)
await mkdir(path.dirname(manifestPath), { recursive: true })
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`photos: ${files.length} originals, ${written} files written`)
