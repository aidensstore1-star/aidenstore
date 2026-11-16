// Builds the repeated parts of index.html from the site's content at build
// time (src/content.js, or what scripts/fetch-content.mjs fetched from
// Supabase), so the page ships as plain HTML (readable without JavaScript).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { loadEnv } from 'vite'
import { loadContent } from './content-source.mjs'

const root = path.resolve(import.meta.dirname, '..')
const loadManifest = () => JSON.parse(readFileSync(path.join(root, 'src', 'photo-manifest.json'), 'utf8'))

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const pad = (n) => String(n).padStart(2, '0')

export function renderSections(content, { siteUrl = '' } = {}) {
  const manifest = loadManifest()
  const { brand, photos } = content

  const size = (id) => {
    const m = manifest[id]
    if (!m) throw new Error(`Photo "${id}" is used on the page but has no file in public/photos/`)
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

  // ---------- The two houses (the shop's sections) ----------
  const { houses, houseOf } = content
  s.houseNames = `${esc(houses.decor.name)} &amp; ${esc(houses.cakes.name)}`
  // What search engines and link previews show: the admin panel's Settings
  // when set, otherwise a sensible default.
  const seoTitle = brand.seoTitle || `${houses.decor.name} & ${houses.cakes.name}: handmade bridal accessories, candles, florals & cakes`
  const seoDescription = brand.seoDescription || `${brand.tagline}, made by hand for weddings, Holy Communions, christenings and celebrations.`
  s.seoTitle = esc(seoTitle)
  s.seoDescription = esc(seoDescription)
  const home = siteUrl ? new URL(siteUrl.replace(/\/?$/, '/')).href : ''
  const shareImage = home ? new URL(`photos/${content.hero[0]}-1280.webp`, home).href : ''
  const business = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: brand.name,
    description: seoDescription,
    ...(home ? { url: home, image: shareImage } : {}),
    ...(brand.whatsapp ? { telephone: `+${brand.whatsapp}` } : {}),
    ...(brand.email ? { email: brand.email } : {}),
    ...(brand.instagram ? { sameAs: [`https://instagram.com/${brand.instagram}`] } : {}),
    department: Object.entries(houses).map(([key, h]) => ({
      '@type': key === 'cakes' ? 'Bakery' : 'HomeGoodsStore',
      name: h.name,
      description: h.line,
      ...(home ? { url: new URL(`${key}/`, home).href } : {}),
    })),
  }
  s.seoHead = [
    home ? `<link rel="canonical" href="${esc(home)}" />` : '',
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(seoTitle)}" />`,
    `<meta property="og:description" content="${esc(seoDescription)}" />`,
    home ? `<meta property="og:url" content="${esc(home)}" />` : '',
    shareImage ? `<meta property="og:image" content="${esc(shareImage)}" />` : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<script type="application/ld+json">${JSON.stringify(business).replace(/</g, '\\u003c')}</script>`,
  ]
    .filter(Boolean)
    .join('\n    ')
  s.decorName = esc(houses.decor.name)
  s.cakesName = esc(houses.cakes.name)
  s.heroSub = `<strong>${esc(houses.decor.name)}</strong> for bridal accessories, ceremony candles and décor. <strong>${esc(houses.cakes.name)}</strong> for celebration cakes and toppers. All made by hand, for weddings, Holy Communions and every celebration in between.`
  s.houses = Object.entries(houses)
    .map(
      ([key, h], i) => `<article class="house house--${key}">
  <a class="house__door" href="#${key}" aria-label="${esc(h.name)}">
    ${media(h.photo, { cls: 'house__media', gl: false, sizes: '(max-width: 900px) 80vw, 36vw', box: 0.75 })}
  </a>
  <div class="house__info">
    <p class="house__num">Section ${pad(i + 1)} · ${esc(h.namedFor)}</p>
    <h3 class="house__name">${esc(h.name)}</h3>
    <p class="house__line">${esc(h.line)}</p>
    <ul class="house__sections">${h.sections
      .filter((sec, j, all) => all.findIndex((x) => x.label === sec.label) === j)
      .map((sec) => `<li><a class="link" href="${sec.href}">${esc(sec.label)}</a></li>`)
      .join('')}</ul>
    <a class="btn magnetic house__all" href="${key}/"><span>See everything in ${esc(h.name)}</span></a>
  </div>
</article>`,
    )
    .join('\n')
  // Each section opens with its own shop sign: the name on a board hung on
  // gold chains, what's inside it, and a few of its pieces around it.
  Object.entries(houses).forEach(([key, h], i) => {
    const [first, ...rest] = h.name.split(' ')
    const word = `${esc(h.name)} · `.repeat(3)
    s[`sign${key[0].toUpperCase()}${key.slice(1)}`] = `<div class="sign__pin">
  <p class="sign__word sign__word--a" aria-hidden="true">${word}</p>
  <p class="sign__word sign__word--b" aria-hidden="true">${word}</p>
  ${h.sign.map((id, j) => media(id, { cls: `sign__media sign__media--${j + 1}`, gl: false, sizes: '(max-width: 900px) 34vw, 18vw', box: 0.75, decorative: true })).join('\n  ')}
  <div class="sign__board">
    <i class="sign__chain sign__chain--l" aria-hidden="true"></i><i class="sign__chain sign__chain--r" aria-hidden="true"></i>
    <p class="sign__num">Section ${pad(i + 1)}</p>
    <h2 class="sign__name">${esc(first)} <em>${esc(rest.join(' '))}</em></h2>
    <p class="sign__line">${esc(h.namedFor)}</p>
    <ul class="sign__aisles">${h.sections
      .filter((sec, j, all) => all.findIndex((x) => x.label === sec.label) === j)
      .map((sec) => `<li><a href="${sec.href}">${esc(sec.label)}</a></li>`)
      .join('')}<li><a class="sign__all" href="${key}/">See everything →</a></li></ul>
  </div>
  <div class="sign__scrim" aria-hidden="true"></div>
</div>`
  })

  // A small shop sign above each chapter that belongs to a house.
  for (const c of content.chapters) {
    const key = `houseTag${c.id[0].toUpperCase()}${c.id.slice(1)}`
    s[key] = c.house ? `<p class="house-tag house-tag--${c.house}">${esc(houses[c.house].name)}</p>` : ''
  }

  // ---------- Chapter I: the craft ----------
  s.craftFrames = content.craft.beats
    .map(
      (b, i) =>
        // Frames after the first carry a gold "wire" along their leading edge.
        `<figure class="craft__frame craft__frame--${i + 1}">${img(b.photo, { sizes: '(max-width: 900px) 100vw, 58vw', box: 0.6, eager: i === 0 })}${i ? '<span class="craft__edge" aria-hidden="true"></span>' : ''}</figure>`,
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
  const brideLast = content.bride.photos.length - 1
  s.brideCards = content.bride.photos
    .map(
      (id, i) => `<article class="bride__card bride__card--${(i % 4) + 1}${i === brideLast ? ' bride__card--last' : ''}">
  ${i === brideLast ? `<p class="bride__end">${esc(content.bride.end[0])} <em>${esc(content.bride.end[1])}</em></p>` : ''}
  ${content.bride.moments?.[i] ? `<p class="bride__moment"><span>${esc(content.bride.moments[i][0])}</span>${esc(content.bride.moments[i][1])}</p>` : ''}
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
      (id, i) => `<button class="gallery__item" type="button" data-index="${i}" data-house="${houseOf(id)}" aria-label="View ${esc(photos[id]?.title)}">
  ${media(id, { cls: 'gallery__media', gl: false, sizes: '(max-width: 900px) 60vw, 24vw', box: 0.75 })}
  <span class="gallery__cap"><span>${pad(i + 1)}</span>${esc(photos[id]?.title)}</span>
</button>`,
    )
    .join('\n')

  s.galleryFilters = [['all', 'Everything'], ...Object.entries(houses).map(([k, h]) => [k, h.name])]
    .map(([k, label], i) => `<button class="gallery__filter${i ? '' : ' is-active'}" type="button" data-filter="${k}" aria-pressed="${i ? 'false' : 'true'}">${esc(label)}</button>`)
    .join('')

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
  // One enquiry button per house (a WhatsApp message to that house once the
  // number is set), then the other ways to get in touch.
  const houseHref = (h) => (brand.whatsapp ? `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(h.enquiry + ' ')}` : '#contact')
  s.ctaHouses = Object.values(content.houses)
    .map((h) => {
      const href = houseHref(h)
      return `<a class="btn btn--solid btn--house magnetic" href="${esc(href)}"${href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><span>${esc(h.name)}</span></a>`
    })
    .join('')
  s.ctaButtons = contacts
    .map(
      (c) =>
        `<a class="btn magnetic" href="${esc(c.href)}"${c.href.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><span>${esc(c.label)}</span></a>`,
    )
    .join('')
  s.footerLinks = contacts.map((c) => `<a href="${esc(c.href)}">${esc(c.label)}</a>`).join('')

  // ---------- Navigation ----------
  // The menu lists the story, then each house's chapters under its name.
  const label = (c) => {
    const word = c.title.replace(/^The /, '')
    return word[0].toUpperCase() + word.slice(1)
  }
  const chapter = (id) => content.chapters.find((c) => c.id === id)
  const nav = [
    { href: '#craft', label: 'The story', photo: chapter('craft').photo },
    ...Object.entries(houses).flatMap(([key, h]) =>
      content.chapters
        .filter((c) => c.house === key)
        .map((c, j) => ({ href: `#${c.id}`, label: key === 'cakes' ? 'Cakes & toppers' : label(c), photo: c.photo, group: j ? null : h.name })),
    ),
    { href: '#gallery', label: 'Gallery', photo: 'bouquet-red-ivory-peonies', group: 'Both sections' },
    { href: '#contact', label: 'Enquire', photo: 'bouquet-white-calla-lily' },
  ]
  // The header links to each house's sign, highlighted on the sign and on
  // any of its chapters.
  s.navLinks = [
    `<a href="#craft" data-chapters="craft">The story</a>`,
    ...Object.entries(houses).map(([key, h]) => {
      const ids = content.chapters.filter((c) => c.house === key).map((c) => c.id)
      return `<a href="#${key}" data-chapters="${[key, ...ids].join(' ')}">${esc(h.name)}</a>`
    }),
    `<a href="#gallery" data-chapters="gallery">Gallery</a>`,
  ].join('')
  s.menuLinks = nav
    .map(
      (n, i) =>
        `${n.group ? `<p class="menu__group">${esc(n.group)}</p>` : ''}<a class="menu__link" href="${n.href}" data-index="${i}"><span class="menu__num">${pad(i + 1)}</span><span class="menu__text">${esc(n.label)}</span></a>`,
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
  let siteUrl = ''
  return {
    name: 'html-content',
    configResolved(config) {
      siteUrl = loadEnv(config.mode, root, '').SITE_URL || process.env.SITE_URL || ''
    },
    // Only the story page (index.html) has these placeholders.
    async transformIndexHtml(html, ctx) {
      if (path.basename(ctx.filename) !== 'index.html' || path.dirname(ctx.filename) !== root) return html
      const sections = renderSections(await loadContent(), { siteUrl })
      return html.replace(/<!--@(\w+)-->/g, (match, key) => {
        if (!(key in sections)) throw new Error(`index.html uses unknown section "${key}"`)
        return sections[key]
      })
    },
  }
}
