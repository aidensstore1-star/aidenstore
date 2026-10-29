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

  const img = (id, { sizes = '50vw', eager = false, cls = '', box = 0, decorative = false } = {}) => {
    const { w, h } = size(id)
    if (box) sizes = scaleSizes(sizes, w / h / box)
    const small = Math.min(640, w)
    const large = Math.min(1280, w)
    const loading = eager ? 'fetchpriority="high"' : 'loading="lazy"'
    const focus = photos[id]?.focus ? ` style="object-position:${photos[id].focus}"` : ''
    return `<img${cls ? ` class="${cls}"` : ''}${focus} src="photos/${id}-1280.webp" srcset="photos/${id}-640.webp ${small}w, photos/${id}-1280.webp ${large}w" sizes="${sizes}" width="${w}" height="${h}" alt="${decorative ? '' : esc(photos[id]?.alt)}" ${loading} decoding="async">`
  }

  const media = (id, { cls = '', gl = true, attrs = '', ...opts } = {}) => {
    const { w, h } = size(id)
    return `<figure class="media${cls ? ` ${cls}` : ''}"${gl ? ' data-gl' : ''} style="--ar:${(w / h).toFixed(4)}"${attrs ? ` ${attrs}` : ''}>${img(id, opts)}</figure>`
  }

  const letters = (text) =>
    [...text].map((c) => `<span class="char">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')

  // ['For the', 'bride'] -> "For the <em>bride</em>"
  const titled = ([plain, accent]) => `${esc(plain)} <em>${esc(accent)}</em>`

  const s = {}

  s.brand = esc(brand.name)
  s.brandLetters = letters(brand.name)
  s.tagline = esc(brand.tagline)
  s.year = String(new Date().getFullYear())

  s.preloader = content.preloader
    .map((id) => `<img class="preloader__img" src="photos/${id}-640.webp" alt="" decoding="async">`)
    .join('')

  s.hero = content.hero
    .map(
      (id, i) =>
        `<div class="hero__item hero__item--${i + 1}">${media(id, { cls: 'hero__img', sizes: '(max-width: 900px) 40vw, 22vw', eager: i < 3 })}</div>`,
    )
    .join('')

  // ---------- Chapter I: the craft ----------
  s.craftFrames = content.craft.beats
    .map(
      (b, i) =>
        // Frames after the first carry a gold "wire" along their leading edge.
        `<figure class="craft__frame craft__frame--${i + 1}">${img(b.photo, { sizes: '(max-width: 900px) 100vw, 58vw', box: 0.6 })}${i ? '<span class="craft__edge" aria-hidden="true"></span>' : ''}</figure>`,
    )
    .join('')
  s.craftIntro = `<span class="line">${esc(content.craft.intro[0])}</span><span class="line"><em>${esc(content.craft.intro[1])}</em></span>`
  s.craftLines = content.craft.beats
    .map(
      (b, i) =>
        `<li class="craft__line craft__line--${i + 1}"><span class="craft__line-num">${pad(i + 1)}</span><span class="line">${esc(b.line[0])}</span><span class="line"><em>${esc(b.line[1])}</em></span></li>`,
    )
    .join('')
  s.craftTotal = pad(content.craft.beats.length)

  s.statementText = esc(content.statement.text)
  s.statementPhotos = content.statement.photos
    .map((id, i) => media(id, { cls: `statement__img statement__img--${i ? 'b' : 'a'}`, gl: false, sizes: '(max-width: 900px) 45vw, 24vw' }))
    .join('')

  const marqueeChunk = content.marquee.map((w) => `<span>${esc(w)}</span><i>✦</i>`).join('')
  s.marquee = marqueeChunk.repeat(3)

  // ---------- Chapter II: the bride (sideways) ----------
  s.brideTitle = titled(content.bride.title)
  s.brideText = esc(content.bride.text)
  s.brideCards = content.bride.photos
    .map(
      (id, i) => `<article class="bride__card bride__card--${(i % 4) + 1}">
  ${media(id, { cls: 'bride__media', gl: false, sizes: '(max-width: 900px) 70vw, 30vw', box: 0.8 })}
  <p class="bride__cap"><span>${pad(i + 1)}</span>${esc(photos[id]?.title)}</p>
</article>`,
    )
    .join('\n')

  // ---------- Chapter III: the ceremony (counter-scrolling columns) ----------
  s.ceremonyTitle = titled(content.ceremony.title)
  s.ceremonyText = esc(content.ceremony.text)
  // Three columns on wide screens, two on phones; each photo appears once.
  const deal = (list, n) => Array.from({ length: n }, (_, c) => list.filter((_, i) => i % n === c))
  const ceremonyCols = (n, cls) =>
    `<div class="ceremony__cols ceremony__cols--${cls}">${deal(content.ceremony.photos, n)
      .map(
        (col, i) =>
          `<div class="ceremony__col ceremony__col--${i + 1}">${col
            .map((id) => media(id, { cls: 'ceremony__img', gl: false, sizes: n === 2 ? '46vw' : '30vw' }))
            .join('')}</div>`,
      )
      .join('')}</div>`
  s.ceremonyCols = ceremonyCols(3, 'wide') + ceremonyCols(2, 'narrow')
  s.ceremonyFinale = `<figure class="ceremony__finale" aria-hidden="true">${img(content.ceremony.finale, { sizes: '100vw', decorative: true })}</figure>`

  // ---------- Chapter IV: the celebration (cake ring) ----------
  s.celebrationTitle = titled(content.celebration.title)
  s.celebrationText = esc(content.celebration.text)
  s.celebrationTags = content.celebration.tags.map((t) => `<li>${esc(t)}</li>`).join('')
  const ringTotal = content.celebration.ring.length
  s.ringCount = String(ringTotal)
  s.ring = content.celebration.ring
    .map(
      (id, i) => `<figure class="ring__card" style="--i:${i}" data-title="${esc(photos[id]?.title)}">
  <div class="ring__img">${img(id, { sizes: '(max-width: 900px) 42vw, 18vw', box: 0.75 })}</div>
  <figcaption class="ring__cap"><span>${pad(i + 1)} / ${pad(ringTotal)}</span>${esc(photos[id]?.title)}</figcaption>
</figure>`,
    )
    .join('\n')

  // ---------- Chapter V: the home ----------
  s.homeTitle = titled(content.home.title)
  s.homeText = esc(content.home.text)
  s.homeWall = content.home.wall
    .map((id, i) =>
      media(id, {
        cls: `home__cell${i === 4 ? ' home__cell--centre' : ''}`,
        gl: false,
        // The middle photo is seen full-screen first.
        sizes: i === 4 ? '100vw' : '(max-width: 900px) 34vw, 30vw',
        box: 0.8,
      }),
    )
    .join('')

  // ---------- Gallery, process ----------
  s.gallery = content.gallery
    .map(
      (id, i) => `<button class="gallery__item" type="button" data-index="${i}" aria-label="View ${esc(photos[id]?.title)}">
  ${media(id, { cls: 'gallery__media', attrs: 'data-bend', sizes: '(max-width: 900px) 60vw, 24vw', box: 0.75 })}
  <span class="gallery__cap"><span>${pad(i + 1)}</span>${esc(photos[id]?.title)}</span>
</button>`,
    )
    .join('\n')

  s.process = content.process
    .map(
      (st, i) => `<li class="step">
  ${media(st.photo, { cls: 'step__media', gl: false, sizes: '(max-width: 900px) 70vw, 30vw', box: 0.8 })}
  <div class="step__body">
    <span class="step__num">${pad(i + 1)}</span>
    <h3 class="step__title">${esc(st.title)}</h3>
    <p class="step__text">${esc(st.text)}</p>
  </div>
</li>`,
    )
    .join('\n')

  // ---------- Contact ----------
  const contacts = []
  if (brand.whatsapp) contacts.push({ label: 'WhatsApp', href: `https://wa.me/${brand.whatsapp}` })
  if (brand.email) contacts.push({ label: 'Email', href: `mailto:${brand.email}` })
  if (brand.instagram) contacts.push({ label: 'Instagram', href: `https://instagram.com/${brand.instagram}` })
  // Placeholders keep the design visible until real details are filled in.
  if (!contacts.length) contacts.push({ label: 'WhatsApp', href: '#contact' }, { label: 'Email', href: '#contact' }, { label: 'Instagram', href: '#contact' })
  s.ctaButtons = contacts
    .map(
      (c, i) =>
        `<a class="btn${i === 0 ? ' btn--solid' : ''} magnetic" href="${esc(c.href)}"${c.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><span>${esc(c.label)}</span></a>`,
    )
    .join('')
  s.footerLinks = contacts.map((c) => `<a href="${esc(c.href)}">${esc(c.label)}</a>`).join('')

  // ---------- Navigation ----------
  const nav = [
    ...content.chapters.map((c) => {
      const word = c.title.replace(/^The /, '')
      return { href: `#${c.id}`, label: word[0].toUpperCase() + word.slice(1), photo: c.photo }
    }),
    { href: '#gallery', label: 'Gallery', photo: 'bouquet-red-ivory-peonies' },
    { href: '#contact', label: 'Enquire', photo: 'bouquet-white-calla-lily' },
  ]
  s.navLinks = nav
    .filter((n) => n.href !== '#contact')
    .map((n) => `<a href="${n.href}">${esc(n.label)}</a>`)
    .join('')
  s.menuLinks = nav
    .map(
      (n, i) =>
        `<a class="menu__link" href="${n.href}" data-index="${i}"><span class="menu__num">${pad(i + 1)}</span><span class="menu__text">${esc(n.label)}</span></a>`,
    )
    .join('')
  s.menuMedia = nav
    .map((n, i) => `<img class="menu__img" data-index="${i}" src="photos/${n.photo}-640.webp" alt="" loading="lazy" decoding="async">`)
    .join('')
  s.chapterCount = content.chapters.at(-1).num

  // ---------- The wire flower: one petal per chapter ----------
  // A petal pointing up from the centre, drawn as a single wire loop.
  const PETAL = 'M0 -6 C-15 -18 -20 -46 0 -62 C20 -46 15 -18 0 -6'
  const petals = (count, { cls = 'petal', scale = 1, offset = 0 } = {}) =>
    Array.from(
      { length: count },
      (_, i) =>
        `<path class="${cls}" pathLength="1" d="${PETAL}" transform="rotate(${offset + (i * 360) / count})${scale !== 1 ? ` scale(${scale})` : ''}"/>`,
    ).join('')
  const n = content.chapters.length
  // Chapter I: one large petal drawn in wire while "petal by petal" is on screen.
  s.craftWire = `<svg class="craft__wire" viewBox="-40 -70 80 80" aria-hidden="true"><path pathLength="1" d="${PETAL}"/><path pathLength="1" d="M0 -6 C2 2 -3 6 1 10"/></svg>`
  s.chapterFlower = `<svg class="chapter__flower" viewBox="-66 -66 132 132" aria-hidden="true">${petals(n)}<circle class="chapter__heart" r="6"/></svg>`
  s.ctaFlower = `<svg class="cta__flower" viewBox="-200 -200 400 400" aria-hidden="true">
  <g class="cta__flower-head" transform="translate(0 -40)">
    <g transform="scale(2.4)">${petals(n)}</g>
    <g transform="scale(1.35)">${petals(n, { cls: 'petal petal--inner', offset: 36 })}</g>
    ${Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2
      return `<circle class="pearl" cx="${(Math.cos(a) * 11).toFixed(1)}" cy="${(Math.sin(a) * 11).toFixed(1)}" r="4.5"/>`
    }).join('')}
    <circle class="pearl" r="5.5"/>
  </g>
  <path class="stem" pathLength="1" d="M0 112 C8 150 -14 176 -6 200"/>
  <path class="leaf" pathLength="1" d="M-3 150 C-30 140 -52 152 -60 172 C-36 176 -16 168 -3 150"/>
  <path class="leaf" pathLength="1" d="M2 128 C26 116 48 124 58 142 C34 148 14 142 2 128"/>
</svg>`

  return s
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
