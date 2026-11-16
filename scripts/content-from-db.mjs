// Turns the rows read from Supabase into the same shape as src/content.js.
// Kept free of network code so it can be tested on its own.

// A photo's id is its file name in the bucket: `products/pearl-comb` → `pearl-comb`.
export const photoId = (storagePath) => String(storagePath).split('/').pop()

export function contentFromRows({ settings, sections, blocks, products, gallery, cakeOptions }) {
  const block = Object.fromEntries(blocks.map((b) => [b.key, b.value]))
  const need = (key) => {
    if (!block[key]) throw new Error(`The site text "${key}" is missing from the database.`)
    return block[key]
  }

  // Products, each with its photos in order. Only published ones arrive here:
  // the database hides the rest from the key the build uses.
  const photos = {}
  const sizes = {}
  const catalog = []
  for (const p of products) {
    const images = [...(p.product_images || [])].sort((a, b) => a.sort - b.sort)
    if (!images.length) continue
    const ids = images.map((img) => photoId(img.path))
    images.forEach((img, i) => {
      const id = ids[i]
      photos[id] = {
        title: p.title,
        type: p.category,
        alt: img.alt || p.title,
        ...(img.focus ? { focus: img.focus } : {}),
        section: p.section_key,
        slug: p.slug,
      }
      sizes[id] = { w: img.width, h: img.height, path: img.path }
    })
    catalog.push({
      slug: p.slug,
      title: p.title,
      category: p.category,
      description: p.description || '',
      priceFrom: p.price_from == null ? null : Number(p.price_from),
      section: p.section_key,
      tags: p.tags || [],
      images: ids,
    })
  }

  // The site's texts and sections name their photos by product (its slug),
  // or by a photo's own id. A product stands for its first photo, so
  // replacing a product's photo updates every place that shows it.
  const firstPhoto = Object.fromEntries(catalog.map((p) => [p.slug, p.images[0]]))
  const resolve = (ref) => (ref in photos ? ref : firstPhoto[ref])
  // A photo that has been hidden or removed is left out of lists; a slot that
  // needs exactly one photo falls back to another photo from the same section
  // rather than breaking the build.
  const warnings = []
  const one = (ref, where, section) => {
    const id = resolve(ref)
    if (id) return id
    const stand = catalog.find((p) => p.section === section)?.images[0] ?? catalog[0]?.images[0]
    warnings.push(`${where}: "${ref}" isn't published, showing "${stand}" instead`)
    return stand
  }
  const list = (refs, where) => {
    const kept = (refs || []).map(resolve).filter(Boolean)
    if (kept.length < (refs || []).length) warnings.push(`${where}: left out ${(refs || []).length - kept.length} unpublished photo(s)`)
    return kept
  }

  const houses = {}
  for (const s of [...sections].sort((a, b) => a.sort - b.sort)) {
    houses[s.key] = {
      name: s.name,
      short: s.short_name,
      namedFor: s.named_for,
      line: s.line,
      sections: s.aisles || [],
      photo: one(photoId(s.cover_path || ''), `section ${s.key}`, s.key),
      sign: list((s.sign_photos || []).map(photoId), `section ${s.key} sign`),
      enquiry: s.enquiry_text,
    }
  }

  const craft = need('craft')
  const statement = need('statement')
  const bride = need('bride')
  const ceremony = need('ceremony')
  const home = need('home')
  const celebration = need('celebration')

  const content = {
    meta: { source: 'supabase', fetchedAt: new Date().toISOString() },
    brand: {
      name: settings.business_name,
      tagline: settings.tagline,
      whatsapp: settings.whatsapp,
      email: settings.email,
      instagram: settings.instagram,
      upiId: settings.upi_id,
      seoTitle: settings.seo_title,
      seoDescription: settings.seo_description,
    },
    houses,
    photos,
    hero: list(need('hero').photos, 'opening'),
    preloader: list(need('preloader').photos, 'loading screen'),
    chapters: need('chapters').map((c) => ({ ...c, photo: one(c.photo, `chapter ${c.id}`, c.house) })),
    craft: { ...craft, beats: craft.beats.map((b, i) => ({ ...b, photo: one(b.photo, `Chapter I beat ${i + 1}`) })) },
    statement: { ...statement, photos: list(statement.photos, 'statement') },
    marquee: need('marquee').items,
    bride: { ...bride, photos: list(bride.photos, 'bride') },
    ceremony: { ...ceremony, photos: list(ceremony.photos, 'ceremony'), finale: one(ceremony.finale, 'ceremony finale', 'decor') },
    celebration: { ...celebration, ring: list(celebration.ring, 'cake ring') },
    home: { ...home, wall: list(home.wall, 'décor wall') },
    gallery: gallery.map((g) => g.product_images && photoId(g.product_images.path)).filter((id) => id in photos),
    process: need('process').steps.map((s, i) => ({ ...s, photo: one(s.photo, `step ${i + 1}`) })),
    catalog,
    cakeOptions: cakeOptions.map((o) => ({
      kind: o.kind,
      label: o.label,
      description: o.description,
      priceDelta: Number(o.price_delta),
    })),
  }
  return { content, sizes, warnings }
}

// Writes the content as an ES module with the same exports as src/content.js.
export function toModule(content) {
  const lines = [
    '// Generated by scripts/fetch-content.mjs from Supabase. Do not edit:',
    '// change the content in the admin panel and press Publish.',
  ]
  for (const [name, value] of Object.entries(content)) lines.push(`export const ${name} = ${JSON.stringify(value, null, 2)}`)
  lines.push(`export const houseOf = (id) => photos[id]?.section ?? ${JSON.stringify(Object.keys(content.houses)[0])}`)
  return lines.join('\n\n') + '\n'
}
