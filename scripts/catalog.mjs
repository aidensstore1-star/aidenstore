// Builds the shop's own pages from the content: one page per section
// (/decor/, /cakes/) and one per product (/decor/<slug>/), as plain HTML so
// search engines can read them. Also writes sitemap.xml (when SITE_URL is set)
// and build-info.json, which the admin panel reads to see when a publish has
// gone live.
//
// Every link is relative, so the pages work at the domain's root and in a
// sub-folder (like the GitHub Pages preview).
import { createHash } from 'node:crypto'
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

export function buildPages(content, { siteUrl = '', turnstileSiteKey = '' } = {}) {
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
  <button type="button" class="motion-toggle" data-motion-toggle>Reduce motion</button>
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
    // Named by what the section's sign lists, e.g. "Celebration cakes, Cake toppers".
    const offers = [...new Set((h.sections || []).map((a) => a.label))].slice(0, 3)
    const title = `${h.name}: ${offers.join(', ') || categories.slice(0, 3).join(', ') || 'handmade pieces'} · ${brand.name}`
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
    <div class="cat-cta__buttons">
      ${key === 'cakes' ? `<a class="cat-btn cat-btn--solid" href="${up}order/">Design your cake</a>` : ''}
      <a class="cat-btn${key === 'cakes' ? '' : ' cat-btn--solid'}" href="${enquire || `${up}#contact`}"${enquire ? ' target="_blank" rel="noopener"' : ''}>Ask ${esc(h.name)}</a>
    </div>
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
      ${
        key === 'cakes'
          ? `<div class="product__buttons"><a class="cat-btn cat-btn--solid" href="${up2}order/?like=${encodeURIComponent(p.slug)}">Order a cake like this</a><a class="cat-btn" href="${ask || `${up2}#contact`}"${ask ? ' target="_blank" rel="noopener"' : ''}>Ask a question</a></div>`
          : `<a class="cat-btn cat-btn--solid" href="${ask || `${up2}#contact`}"${ask ? ' target="_blank" rel="noopener"' : ''}>Enquire about this piece</a>`
      }
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

  // ---------- The cake order form ----------
  const cakes = houses.cakes
  if (cakes) {
    const up = '../'
    const options = content.cakeOptions || []
    const LABELS = { occasion: 'What’s the occasion?', size: 'How big?', base: 'Cake flavour', frosting: 'Frosting' }
    const chips = (kind) => {
      const list = options.filter((o) => o.kind === kind)
      if (!list.length) return ''
      return `<div class="order__choice">
        <p class="order__label" id="label-${kind}">${LABELS[kind]}</p>
        <div class="chips" role="radiogroup" aria-labelledby="label-${kind}">
          ${list
            .map(
              (o) =>
                `<label class="chip"><input type="radio" name="${kind}" value="${esc(o.id || o.label)}" data-price="${Number(o.priceDelta) || 0}"><span>${esc(o.label)}${Number(o.priceDelta) ? ` <small>+${money(o.priceDelta)}</small>` : ''}</span></label>`,
            )
            .join('\n          ')}
        </div>
      </div>`
    }
    // The cakes a customer can start from ("Order a cake like this").
    const likes = Object.fromEntries(
      catalog
        .filter((p) => p.section === 'cakes')
        .map((p) => [p.slug, { title: p.title, photo: `${up}photos/${p.images[0]}-640.webp`, price: p.priceFrom }]),
    )
    pages.push({
      file: 'order/index.html',
      up,
      url: abs('order/'),
      head: head({
        title: `Order a cake · ${cakes.name}`,
        description: `Design your cake with ${cakes.name}: choose the occasion, size, flavour and frosting, add inspiration photos, and we’ll reply on WhatsApp.`,
        url: abs('order/'),
        image: catalog.find((p) => p.section === 'cakes') ? abs(`photos/${catalog.find((p) => p.section === 'cakes').images[0]}-1280.webp`) : '',
        extra: turnstileSiteKey ? '<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>' : '',
      }),
      body: `${header(up, 'cakes')}
<main id="main" class="cat-main order">
  <section class="cat-hero order__hero">
    <p class="cat-eyebrow">${esc(cakes.name)} · Order a cake</p>
    <h1 class="cat-hero__title">Design <em>your cake</em></h1>
    <p class="cat-hero__line">Choose what you’d like, add a photo or two for inspiration, and send. We’ll reply on WhatsApp to confirm the price and the date.</p>
  </section>
  <noscript><p class="order__noscript">This form needs JavaScript. You can also ${brand.whatsapp ? `<a href="${esc(wa(`${cakes.enquiry} a cake.`))}">message us on WhatsApp</a>` : 'message us on WhatsApp'}.</p></noscript>
  <form class="order__form" id="order" novalidate>
    <div class="order__liked" hidden></div>
    <input type="hidden" name="like">
    <fieldset class="order__step">
      <legend><span class="order__num">1</span> The cake</legend>
      ${['occasion', 'size', 'base', 'frosting'].map(chips).join('\n      ')}
      <label class="order__field order__field--short"><span>When do you need it?</span><input type="date" name="date"></label>
    </fieldset>
    <fieldset class="order__step">
      <legend><span class="order__num">2</span> Inspiration photos <small>optional, up to 5</small></legend>
      <div class="drop">
        <input type="file" id="order-photos" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple>
        <label for="order-photos" class="drop__label"><strong>Add photos</strong><span>Cakes you love, your colours, or the theme</span></label>
      </div>
      <ul class="drop__list" aria-live="polite"></ul>
    </fieldset>
    <fieldset class="order__step">
      <legend><span class="order__num">3</span> About you</legend>
      <div class="order__row">
        <label class="order__field"><span>Your name</span><input name="name" autocomplete="name" required maxlength="100"></label>
        <label class="order__field"><span>WhatsApp number</span><input name="phone" type="tel" autocomplete="tel" inputmode="tel" required placeholder="+91 98000 00000"></label>
      </div>
      <label class="order__field"><span>Email <small>optional, for a copy of your order</small></span><input name="email" type="email" autocomplete="email"></label>
      <label class="order__field"><span>Anything else? <small>optional</small></span><textarea name="notes" rows="4" maxlength="2000" placeholder="Colours, a name or message on the cake, how many people…"></textarea></label>
      <div class="order__hp" aria-hidden="true"><label>Leave this empty <input name="website" tabindex="-1" autocomplete="off"></label></div>
    </fieldset>
    <div class="order__send">
      <p class="order__estimate" hidden></p>
      ${turnstileSiteKey ? `<div class="cf-turnstile" data-sitekey="${esc(turnstileSiteKey)}" data-theme="light"></div>` : ''}
      <p class="order__error" role="alert"></p>
      <button class="cat-btn cat-btn--solid order__button" type="submit">Send my order</button>
      <p class="order__small">Your details are only used to reply about this order.</p>
    </div>
  </form>
  <section class="order__done" hidden tabindex="-1">
    <p class="cat-eyebrow">Thank you</p>
    <h2>Your order has reached ${esc(cakes.name)}</h2>
    <p class="order__ref"></p>
    <p>We’ll reply on WhatsApp soon to confirm the price and the date.</p>
    <a class="cat-btn cat-btn--solid order__whatsapp" hidden target="_blank" rel="noopener">Send it on WhatsApp too</a>
    <a class="cat-btn" href="${up}cakes/">See more cakes</a>
  </section>
  <script type="application/json" id="order-likes">${JSON.stringify(likes).replace(/</g, '\\u003c')}</script>
</main>
${footer(up)}`,
    })
  }

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
  let turnstileSiteKey = ''
  let supabaseUrl = ''
  return {
    name: 'catalog-pages',
    apply: 'build',
    configResolved(config) {
      const env = { ...loadEnv(config.mode, root, ''), ...process.env }
      siteUrl = env.SITE_URL || ''
      turnstileSiteKey = env.VITE_TURNSTILE_SITE_KEY || ''
      supabaseUrl = (env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
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
    const { pages, sitemap } = buildPages(content, { siteUrl, turnstileSiteKey })
    for (const page of pages) {
      const html = template
        .replace('<!--page:head-->', () => page.head)
        .replace('<!--page:body-->', () => page.body)
        // The template's own files (styles, script) are linked from the root.
        .replace(/(href|src)="\.\/assets\//g, (_, attr) => `${attr}="${page.up}assets/`)
      this.emitFile({ type: 'asset', fileName: page.file, source: html })
    }
    if (sitemap) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
    // Search engines may list the site once it has its own address (not
    // Cloudflare's temporary *.pages.dev one).
    const ownAddress = siteUrl && !new URL(siteUrl).hostname.endsWith('.pages.dev')
    this.emitFile({
      type: 'asset',
      fileName: 'robots.txt',
      source: ownAddress ? `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${new URL('sitemap.xml', siteUrl.replace(/\/?$/, '/')).href}\n` : 'User-agent: *\nDisallow: /\n',
    })
    // Security headers for Cloudflare Pages, allowing exactly the site's own
    // inline scripts (by their fingerprints) and nothing else.
    const htmlFiles = [...Object.values(bundle).filter((f) => f.type === 'asset' && f.fileName.endsWith('.html')).map((f) => String(f.source)), ...pages.map((p) => p.head + p.body + template)]
    this.emitFile({ type: 'asset', fileName: '_headers', source: securityHeaders(htmlFiles, { supabaseUrl, turnstile: Boolean(turnstileSiteKey) }) })
    this.emitFile({
      type: 'asset',
      fileName: 'build-info.json',
      source: JSON.stringify({ builtAt: new Date().toISOString(), contentFrom: content.meta?.source || 'content.js', contentFetchedAt: content.meta?.fetchedAt || null }),
    })
  }
}

// The sha256 fingerprints of every inline <script> (not JSON data blocks).
function inlineScriptHashes(htmlFiles) {
  const hashes = new Set()
  for (const html of htmlFiles)
    for (const [, attrs, body] of html.matchAll(/<script\b([^>]*)>([^]*?)<\/script>/g)) {
      if (/\bsrc=/.test(attrs) || /type="application\/(ld\+)?json"/.test(attrs) || !body.trim()) continue
      hashes.add(`'sha256-${createHash('sha256').update(body).digest('base64')}'`)
    }
  return [...hashes]
}

export function securityHeaders(htmlFiles, { supabaseUrl = '', turnstile = false } = {}) {
  const supabase = supabaseUrl ? ` ${supabaseUrl}` : ''
  const challenge = turnstile ? ' https://challenges.cloudflare.com' : ''
  const insights = ' https://static.cloudflareinsights.com'
  const site = [
    "default-src 'self'",
    // Cloudflare adds its visitor-stats script to pages served on the domain.
    `script-src 'self' ${inlineScriptHashes(htmlFiles).join(' ')}${challenge}${insights}`,
    // The animations set styles directly on elements.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabase}`,
    "font-src 'self' data:",
    `connect-src 'self'${supabase} https://cloudflareinsights.com`,
    `frame-src${challenge || " 'none'"}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
  const admin = [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes(htmlFiles).join(' ')}${insights}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${supabase}`,
    "font-src 'self'",
    `connect-src 'self'${supabase}${supabase.replace(' https://', ' wss://')} https://cloudflareinsights.com`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ')
  return `# Response headers for Cloudflare Pages, written by scripts/catalog.mjs at build time.

/*
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: ${site}

# The admin panel: never cached, never listed by search engines, never shown
# inside another site's frame, and only allowed to talk to Supabase.
/admin/*
  ! Content-Security-Policy
  ! X-Frame-Options
  ! Referrer-Policy
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Content-Security-Policy: ${admin}

/assets/*
  Cache-Control: public, max-age=31536000, immutable
`
}
