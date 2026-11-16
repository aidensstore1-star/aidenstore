// Builds the shop's own pages from the content: one page per section
// (/decor/, /cakes/) and one per product (/decor/<slug>/), as plain HTML so
// search engines can read them. Also writes sitemap.xml (when SITE_URL is set)
// and build-info.json, which the admin panel reads to see when a publish has
// gone live.
//
// Every link is relative, so the pages work at the domain's root and in a
// sub-folder (like the GitHub Pages preview).
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { loadEnv } from 'vite'
import { catalogOf, loadContent } from './content-source.mjs'

const root = path.resolve(import.meta.dirname, '..')
const TEMPLATE = 'catalog.html'

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const pad = (n) => String(n).padStart(2, '0')
const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
// Keeps JSON-LD from closing its own <script> tag.
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%232a1f22'/%3E%3Ctext x='32' y='42' font-family='Georgia,serif' font-size='24' font-style='italic' text-anchor='middle' fill='%23f3ece4'%3EA%26amp;A%3C/text%3E%3C/svg%3E"

export function buildPages(content, { siteUrl = '' } = {}) {
  const manifest = JSON.parse(readFileSync(path.join(root, 'src', 'photo-manifest.json'), 'utf8'))
  const { brand, houses, photos } = content
  const catalog = catalogOf(content)
  const abs = (p) => (siteUrl ? new URL(p, siteUrl.replace(/\/?$/, '/')).href : '')
  const houseNames = Object.values(houses).map((h) => h.name).join(' & ')
  const wa = (text) => (brand.whatsapp ? `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(text)}` : '')

  // `up` is the way back to the site's root from the page, e.g. '../../'.
  const img = (id, up, { sizes, eager = false, cls = '' }) => {
    const m = manifest[id]
    if (!m) throw new Error(`Photo "${id}" has no file in public/photos/`)
    const focus = photos[id]?.focus ? ` style="object-position:${photos[id].focus}"` : ''
    return `<img${cls ? ` class="${cls}"` : ''}${focus} src="${up}photos/${id}-1280.webp" srcset="${up}photos/${id}-640.webp ${Math.min(640, m.w)}w, ${up}photos/${id}-1280.webp ${Math.min(1280, m.w)}w" sizes="${sizes}" width="${m.w}" height="${m.h}" alt="${esc(photos[id]?.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`
  }

  const header = (up, current) => `<a class="skip" href="#main">Skip to content</a>
<header class="cat-header">
  <a class="cat-header__logo" href="${up}">${esc(brand.name)}</a>
  <nav class="cat-header__nav" aria-label="Main">
    <a href="${up}#craft">The story</a>
    ${Object.entries(houses)
      .map(([key, h]) => `<a href="${up}${key}/"${key === current ? ' aria-current="page"' : ''}>${esc(h.name)}</a>`)
      .join('\n    ')}
    <a href="${up}#gallery">Gallery</a>
  </nav>
  <a class="cat-btn cat-btn--small" href="${up}#contact">Enquire</a>
</header>`

  const footer = (up) => `<footer class="cat-footer">
  <p class="cat-footer__brand">${esc(brand.name)}</p>
  <p>${esc(brand.tagline)}</p>
  <nav aria-label="Sections">${Object.entries(houses)
    .map(([key, h]) => `<a href="${up}${key}/">${esc(h.name)}</a>`)
    .join('')}<a href="${up}#contact">Enquire</a></nav>
  <p class="cat-footer__small">© ${new Date().getFullYear()} ${esc(houseNames)} · Made by hand, one piece at a time</p>
</footer>`

  const card = (p, up) => {
    const href = `${up}${p.section}/${p.slug}/`
    return `<li class="cat-card" data-category="${esc(p.category)}">
  <a href="${href}">
    <figure class="cat-media">${img(p.images[0], up, { sizes: '(max-width: 700px) 46vw, (max-width: 1100px) 30vw, 22vw' })}</figure>
    <span class="cat-card__cat">${esc(p.category)}</span>
    <span class="cat-card__title">${esc(p.title)}</span>
    <span class="cat-card__price">${p.priceFrom != null ? `From ${money(p.priceFrom)}` : 'Price on request'}</span>
  </a>
</li>`
  }

  const head = ({ title, description, url, image, extra = '' }) => `<title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="icon" href="${FAVICON}" />
    ${url ? `<link rel="canonical" href="${esc(url)}" />` : ''}
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    ${url ? `<meta property="og:url" content="${esc(url)}" />` : ''}
    ${image ? `<meta property="og:image" content="${esc(image)}" />` : ''}
    <meta name="twitter:card" content="summary_large_image" />
    ${extra}`

  const pages = []

  Object.entries(houses).forEach(([key, h], i) => {
    const up = '../'
    const items = catalog.filter((p) => p.section === key)
    const categories = [...new Set(items.map((p) => p.category).filter(Boolean))]
    const [first, ...rest] = h.name.split(' ')
    const title = `${h.name}: ${categories.slice(0, 3).join(', ').toLowerCase() || 'handmade pieces'} · ${brand.name}`
    const enquire = wa(`${h.enquiry} `)
    pages.push({
      file: `${key}/index.html`,
      up,
      url: abs(`${key}/`),
      head: head({
        title,
        description: `${h.line} ${brand.tagline}.`,
        url: abs(`${key}/`),
        image: items[0] ? abs(`photos/${items[0].images[0]}-1280.webp`) : '',
        extra: siteUrl
          ? jsonLd({
              '@context': 'https://schema.org',
              '@type': 'CollectionPage',
              name: h.name,
              description: h.line,
              url: abs(`${key}/`),
              mainEntity: {
                '@type': 'ItemList',
                itemListElement: items.map((p, n) => ({ '@type': 'ListItem', position: n + 1, url: abs(`${key}/${p.slug}/`), name: p.title })),
              },
            })
          : '',
      }),
      body: `${header(up, key)}
<main id="main" class="cat-main cat-main--${key}">
  <section class="cat-hero">
    <p class="cat-eyebrow">Section ${pad(i + 1)} · ${esc(h.namedFor)}</p>
    <h1 class="cat-hero__title">${esc(first)} <em>${esc(rest.join(' '))}</em></h1>
    <p class="cat-hero__line">${esc(h.line)}</p>
    ${
      categories.length > 1
        ? `<div class="cat-filters" role="group" aria-label="Show">
      <button type="button" class="cat-filter" aria-pressed="true" data-filter="">All <span>${items.length}</span></button>
      ${categories
        .map((c) => `<button type="button" class="cat-filter" aria-pressed="false" data-filter="${esc(c)}">${esc(c)} <span>${items.filter((p) => p.category === c).length}</span></button>`)
        .join('\n      ')}
    </div>`
        : ''
    }
  </section>
  <ul class="cat-grid">
${items.map((p) => card(p, up)).join('\n')}
  </ul>
  <section class="cat-cta">
    <p class="cat-eyebrow">Made to order</p>
    <h2>Can’t see quite what you have in mind?</h2>
    <p>Every piece is made by hand, so colours, sizes and details can all be changed to match your day.</p>
    <a class="cat-btn cat-btn--solid" href="${enquire || `${up}#contact`}"${enquire ? ' target="_blank" rel="noopener"' : ''}>Ask ${esc(h.name)}</a>
  </section>
</main>
${footer(up)}`,
    })

    for (const p of items) {
      const up2 = '../../'
      const related = items.filter((o) => o !== p && o.category === p.category).concat(items.filter((o) => o !== p && o.category !== p.category)).slice(0, 4)
      const description =
        p.description || `${p.title}: ${(photos[p.images[0]]?.alt || '').replace(/\.$/, '')}. Handmade to order by ${h.name}, with colours and details to match your day.`
      const ask = wa(`${h.enquiry} the ${p.title}.`)
      pages.push({
        file: `${key}/${p.slug}/index.html`,
        up: up2,
        url: abs(`${key}/${p.slug}/`),
        head: head({
          title: `${p.title} · ${h.name}`,
          description,
          url: abs(`${key}/${p.slug}/`),
          image: abs(`photos/${p.images[0]}-1280.webp`),
          extra: siteUrl
            ? jsonLd({
                '@context': 'https://schema.org',
                '@graph': [
                  {
                    '@type': 'Product',
                    name: p.title,
                    description,
                    category: p.category,
                    image: p.images.map((id) => abs(`photos/${id}-1280.webp`)),
                    brand: { '@type': 'Brand', name: h.name },
                    ...(p.priceFrom != null
                      ? { offers: { '@type': 'Offer', price: p.priceFrom, priceCurrency: 'INR', availability: 'https://schema.org/MadeToOrder', url: abs(`${key}/${p.slug}/`) } }
                      : {}),
                  },
                  {
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                      { '@type': 'ListItem', position: 1, name: brand.name, item: abs('') },
                      { '@type': 'ListItem', position: 2, name: h.name, item: abs(`${key}/`) },
                      { '@type': 'ListItem', position: 3, name: p.title, item: abs(`${key}/${p.slug}/`) },
                    ],
                  },
                ],
              })
            : '',
        }),
        body: `${header(up2, key)}
<main id="main" class="cat-main">
  <nav class="cat-crumbs" aria-label="Breadcrumb"><a href="${up2}">Home</a><span aria-hidden="true">/</span><a href="${up2}${key}/">${esc(h.name)}</a><span aria-hidden="true">/</span><span aria-current="page">${esc(p.title)}</span></nav>
  <article class="product">
    <div class="product__gallery">
      <figure class="cat-media product__media">${img(p.images[0], up2, { sizes: '(max-width: 900px) 92vw, 46vw', eager: true, cls: 'product__img' })}</figure>
      ${
        p.images.length > 1
          ? `<div class="product__thumbs">${p.images
              .map(
                (id, n) =>
                  `<button type="button" class="product__thumb" aria-pressed="${n === 0}" aria-label="Photo ${n + 1}" data-src="${up2}photos/${id}-1280.webp" data-srcset="${up2}photos/${id}-640.webp 640w, ${up2}photos/${id}-1280.webp 1280w">${img(id, up2, { sizes: '6rem' })}</button>`,
              )
              .join('')}</div>`
          : ''
      }
    </div>
    <div class="product__info">
      <p class="cat-eyebrow"><a href="${up2}${key}/">${esc(h.name)}</a> · ${esc(p.category)}</p>
      <h1 class="product__title">${esc(p.title)}</h1>
      <p class="product__price">${p.priceFrom != null ? `From <strong>${money(p.priceFrom)}</strong>` : 'Price on request'}</p>
      <p class="product__text">${esc(description)}</p>
      <a class="cat-btn cat-btn--solid" href="${ask || `${up2}#contact`}"${ask ? ' target="_blank" rel="noopener"' : ''}>Enquire about this piece</a>
      <ul class="product__facts">
        <li>Made by hand, to order</li>
        <li>Colours and details to match your day</li>
        <li>Ask on WhatsApp for prices and dates</li>
      </ul>
    </div>
  </article>
  ${
    related.length
      ? `<section class="cat-related">
    <h2>More from ${esc(h.name)}</h2>
    <ul class="cat-grid">
${related.map((o) => card(o, up2)).join('\n')}
    </ul>
  </section>`
      : ''
  }
</main>
${footer(up2)}`,
      })
    }
  })

  const sitemap = siteUrl
    ? `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[abs(''), ...pages.map((p) => p.url)].map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}
</urlset>
`
    : ''
  return { pages, sitemap }
}

export function catalogPages() {
  let siteUrl = ''
  return {
    name: 'catalog-pages',
    apply: 'build',
    configResolved(config) {
      siteUrl = loadEnv(config.mode, root, '').SITE_URL || process.env.SITE_URL || ''
    },
    // Runs after Vite has written the template page, with its styles and script.
    generateBundle: { order: 'post', handler: generate },
  }

  async function generate(_, bundle) {
    const templateAsset = bundle[TEMPLATE]
    if (!templateAsset) return
    delete bundle[TEMPLATE]
    const template = String(templateAsset.source).replace(/<!--[^]*?-->\n?/, (m) => (m.includes('page:') ? m : ''))
    const content = await loadContent()
    const { pages, sitemap } = buildPages(content, { siteUrl })
    for (const page of pages) {
      const html = template
        .replace('<!--page:head-->', () => page.head)
        .replace('<!--page:body-->', () => page.body)
        // The template's own files (styles, script) are linked from the root.
        .replace(/(href|src)="\.\/assets\//g, (_, attr) => `${attr}="${page.up}assets/`)
      this.emitFile({ type: 'asset', fileName: page.file, source: html })
    }
    if (sitemap) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
    this.emitFile({
      type: 'asset',
      fileName: 'build-info.json',
      source: JSON.stringify({ builtAt: new Date().toISOString(), contentFrom: content.meta?.source || 'content.js', contentFetchedAt: content.meta?.fetchedAt || null }),
    })
  }
}
