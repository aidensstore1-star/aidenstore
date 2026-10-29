// Builds the repeated parts of index.html from src/content.js at build time,
// so the page ships as plain HTML (readable without JavaScript).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as content from '../src/content.js'

const root = path.resolve(import.meta.dirname, '..')
const loadManifest = () => JSON.parse(readFileSync(path.join(root, 'src', 'photo-manifest.json'), 'utf8'))

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const pad = (n) => String(n).padStart(2, '0')

export function renderSections() {
  const manifest = loadManifest()
  const { brand, photos } = content

  const size = (id) => {
    const m = manifest[id]
    if (!m) throw new Error(`Photo "${id}" is listed in content.js but missing from images/`)
    return m
  }

  // A wide photo cropped into a narrower box is shown taller than its width
  // suggests; scale up `sizes` so the browser fetches a sharp enough file.
  const scaleSizes = (sizes, factor) =>
    factor <= 1 ? sizes : sizes.replace(/(\d+(?:\.\d+)?)vw/g, (_, n) => `${Math.round(n * factor)}vw`)

  const img = (id, { sizes = '50vw', eager = false, cls = '', box = 0 } = {}) => {
    const { w, h } = size(id)
    if (box) sizes = scaleSizes(sizes, w / h / box)
    const small = Math.min(640, w)
    const large = Math.min(1280, w)
    const loading = eager ? 'fetchpriority="high"' : 'loading="lazy"'
    return `<img${cls ? ` class="${cls}"` : ''} src="photos/${id}-1280.webp" srcset="photos/${id}-640.webp ${small}w, photos/${id}-1280.webp ${large}w" sizes="${sizes}" width="${w}" height="${h}" alt="${esc(photos[id]?.alt)}" ${loading} decoding="async">`
  }

  const media = (id, { cls = '', gl = true, attrs = '', ...opts } = {}) => {
    const { w, h } = size(id)
    return `<figure class="media${cls ? ` ${cls}` : ''}"${gl ? ' data-gl' : ''} style="--ar:${(w / h).toFixed(4)}"${attrs ? ` ${attrs}` : ''}>${img(id, opts)}</figure>`
  }

  const letters = (text) =>
    [...text].map((c) => `<span class="char">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')

  const sections = {}

  sections.brand = esc(brand.name)
  sections.brandLetters = letters(brand.name)
  sections.tagline = esc(brand.tagline)
  sections.year = String(new Date().getFullYear())

  sections.preloader = content.preloader
    .map((id) => `<img class="preloader__img" src="photos/${id}-640.webp" alt="" decoding="async">`)
    .join('')

  sections.hero = content.hero
    .map((id, i) =>
      media(id, { cls: `hero__img hero__img--${i + 1}`, sizes: '(max-width: 768px) 40vw, 22vw', eager: i < 3 }),
    )
    .join('')

  const marqueeWords = content.collections.map((c) => esc(c.title))
  const marqueeChunk = marqueeWords.map((w) => `<span>${w}</span><i>✦</i>`).join('')
  sections.marquee = marqueeChunk.repeat(3)

  sections.statementText = esc(content.statement.text)
  sections.statementPhotos = content.statement.photos
    .map((id, i) => media(id, { cls: `statement__img statement__img--${i ? 'b' : 'a'}`, sizes: '(max-width: 768px) 45vw, 24vw' }))
    .join('')

  sections.collections = content.collections
    .map((c, i) => {
      const [first, ...rest] = c.title.split(' ')
      return `<article class="panel">
  ${media(c.photo, { cls: 'panel__media', sizes: '(max-width: 768px) 80vw, 45vw', eager: true })}
  <div class="panel__info">
    <span class="panel__num">${pad(i + 1)}</span>
    <h3 class="panel__title">${esc(first)}${rest.length ? `<br><em>${esc(rest.join(' '))}</em>` : ''}</h3>
    <p class="panel__text">${esc(c.text)}</p>
  </div>
</article>`
    })
    .join('\n')
  sections.collectionsCount = pad(content.collections.length)

  sections.occasions = content.occasions
    .map(
      (o, i) => `<li class="occasion" data-photo="photos/${o.photo}-640.webp">
  <a class="occasion__link" href="#contact">
    <span class="occasion__num">${pad(i + 1)}</span>
    <span class="occasion__title">${esc(o.title)}</span>
    <span class="occasion__thumb">${img(o.photo, { sizes: '30vw' })}</span>
    <span class="occasion__arrow" aria-hidden="true">↗</span>
  </a>
</li>`,
    )
    .join('\n')

  sections.communionTitle = `${esc(content.communion.title[0])}<br><em>${esc(content.communion.title[1])}</em>`
  sections.communionText = esc(content.communion.text)
  sections.communionCols = content.communion.columns
    .map(
      (col, i) =>
        `<div class="communion__col communion__col--${i + 1}">${col
          .map((id) => media(id, { cls: 'communion__img', sizes: '(max-width: 768px) 45vw, 25vw' }))
          .join('')}</div>`,
    )
    .join('')

  sections.cakesText = esc(content.cakes.text)
  sections.cakesTags = content.cakes.tags.map((t) => `<li>${esc(t)}</li>`).join('')
  const stackTotal = pad(content.cakes.stack.length)
  sections.cakesStack = content.cakes.stack
    .map(
      (c, i) => `<article class="cake-card" style="--i:${i}">
  <div class="cake-card__inner">
    ${media(c.photo, { cls: 'cake-card__media', gl: false, sizes: '(max-width: 768px) 90vw, 50vw', box: 0.9 })}
    <div class="cake-card__info">
      <span class="cake-card__num">${pad(i + 1)} / ${stackTotal}</span>
      <h3 class="cake-card__title">${esc(photos[c.photo]?.title)}</h3>
      <p class="cake-card__note">${esc(c.note)}</p>
    </div>
  </div>
</article>`,
    )
    .join('\n')

  sections.gallery = content.gallery
    .map(
      (id, i) => `<button class="gallery__item" type="button" data-index="${i}" aria-label="View ${esc(photos[id]?.title)}">
  ${media(id, { cls: 'gallery__media', attrs: 'data-bend', sizes: '(max-width: 768px) 60vw, 24vw', box: 0.75 })}
  <span class="gallery__cap"><span>${pad(i + 1)}</span>${esc(photos[id]?.title)}</span>
</button>`,
    )
    .join('\n')

  sections.process = content.process
    .map(
      (s, i) => `<li class="step">
  <span class="step__num">${pad(i + 1)}</span>
  <h3 class="step__title">${esc(s.title)}</h3>
  <p class="step__text">${esc(s.text)}</p>
</li>`,
    )
    .join('\n')

  const contacts = []
  if (brand.whatsapp) contacts.push({ label: 'WhatsApp', href: `https://wa.me/${brand.whatsapp}` })
  if (brand.email) contacts.push({ label: 'Email', href: `mailto:${brand.email}` })
  if (brand.instagram) contacts.push({ label: 'Instagram', href: `https://instagram.com/${brand.instagram}` })
  // Placeholders keep the design visible until real details are filled in.
  if (!contacts.length) contacts.push({ label: 'WhatsApp', href: '#contact' }, { label: 'Email', href: '#contact' }, { label: 'Instagram', href: '#contact' })
  sections.ctaButtons = contacts
    .map(
      (c, i) =>
        `<a class="btn${i === 0 ? ' btn--solid' : ''} magnetic" href="${esc(c.href)}"${c.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><span>${esc(c.label)}</span></a>`,
    )
    .join('')
  sections.footerLinks = contacts.map((c) => `<a href="${esc(c.href)}">${esc(c.label)}</a>`).join('')

  sections.menuMedia = content.collections
    .map((c, i) => `<img class="menu__img" data-index="${i}" src="photos/${c.photo}-640.webp" alt="" loading="lazy" decoding="async">`)
    .join('')

  return sections
}

export function htmlContent() {
  return {
    name: 'html-content',
    transformIndexHtml(html) {
      const sections = renderSections()
      return html.replace(/<!--@(\w+)-->/g, (match, key) => {
        if (!(key in sections)) throw new Error(`index.html uses unknown section "${key}"`)
        return sections[key]
      })
    },
  }
}
