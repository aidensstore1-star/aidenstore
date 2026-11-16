import { supabase } from '../supabase.js'
import {
  attempt,
  busy,
  field,
  fill,
  forgetProducts,
  h,
  money,
  moveButtons,
  must,
  photoUrl,
  removePhotoFiles,
  slugify,
  switchInput,
  toast,
  uploadPhoto,
} from '../ui.js'

// Products: everything the shop shows, by section. Each product has its own
// page on the site; its first photo is the one shown in lists.

const FOCUS = [
  ['', 'Centre'],
  ['50% 20%', 'Top'],
  ['50% 80%', 'Bottom'],
  ['25% 50%', 'Left'],
  ['75% 50%', 'Right'],
]

const SELECT = 'id, slug, title, category, description, price_from, section_key, tags, is_published, sort, product_images(id, path, width, height, alt, focus, sort)'

export async function products(content) {
  let filter = { section: '', search: '', hidden: true }
  let list = []
  let sections = []

  async function load() {
    ;[list, sections] = await Promise.all([
      supabase.from('products').select(SELECT).order('section_key').order('sort').then(must),
      supabase.from('sections').select('key, name').order('sort').then(must),
    ])
    for (const p of list) p.product_images.sort((a, b) => a.sort - b.sort)
  }

  async function showList() {
    fill(content, h('h1', 'Products'), h('p.muted', 'Loading…'))
    if (!(await attempt(load))) return
    const rows = h('ul.rows')
    const draw = () => {
      const q = filter.search.trim().toLowerCase()
      const shown = list.filter(
        (p) =>
          (!filter.section || p.section_key === filter.section) &&
          (filter.hidden || p.is_published) &&
          (!q || `${p.title} ${p.category}`.toLowerCase().includes(q)),
      )
      fill(rows,
        ...(shown.length
          ? shown.map((p) => {
              const inSection = list.filter((o) => o.section_key === p.section_key)
              const i = inSection.indexOf(p)
              const cover = p.product_images[0]
              return h(
                'li.row',
                cover ? h('img.row__thumb', { src: photoUrl(cover.path), alt: '', loading: 'lazy' }) : h('span.row__thumb.row__thumb--empty', 'No photo'),
                h(
                  'div.row__main',
                  h('button.row__title', { type: 'button', onclick: () => edit(p) }, p.title),
                  h('span.muted', [sections.find((s) => s.key === p.section_key)?.name, p.category, p.price_from != null ? `from ${money(p.price_from)}` : 'price on request'].filter(Boolean).join(' · ')),
                ),
                switchInput(p.is_published, (on) => togglePublished(p, on), 'On the site'),
                moveButtons(() => move(p, -1), () => move(p, 1), { first: i === 0, last: i === inSection.length - 1 }),
                h('button.btn.btn--quiet', { type: 'button', onclick: () => edit(p) }, 'Edit'),
              )
            })
          : [h('li.muted', 'No products match.')]),
      )
    }
    const search = h('input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search products', value: filter.search, oninput: (e) => ((filter.search = e.target.value), draw()) })
    const sectionSelect = h(
      'select',
      { 'aria-label': 'Section', onchange: (e) => ((filter.section = e.target.value), draw()) },
      h('option', { value: '' }, 'All sections'),
      sections.map((s) => h('option', { value: s.key, selected: filter.section === s.key }, s.name)),
    )
    fill(content,
      h('div.page-head', h('h1', 'Products'), h('button.btn', { type: 'button', onclick: () => edit(null) }, 'Add a product')),
      h(
        'div.toolbar',
        search,
        sectionSelect,
        switchInput(filter.hidden, (on) => ((filter.hidden = on), draw()), 'Show hidden'),
      ),
      rows,
      h('p.muted.small', 'Changes show on the website after you publish.'),
    )
    draw()

    async function togglePublished(p, on) {
      if (on && !p.product_images.length) {
        toast('Add a photo first: products without a photo can’t be shown.', 'bad')
        return draw()
      }
      const ok = await attempt(async () => must(await supabase.from('products').update({ is_published: on }).eq('id', p.id)), on ? 'Shown on the site' : 'Hidden from the site')
      if (ok) {
        p.is_published = on
        forgetProducts()
      }
      draw()
    }

    async function move(p, dir) {
      const inSection = list.filter((o) => o.section_key === p.section_key)
      const i = inSection.indexOf(p)
      const other = inSection[i + dir]
      if (!other) return
      // Give the whole section clean positions, then swap the two.
      // The list moves at once; the new positions are saved behind it.
      const order = inSection.map((o) => o.id)
      ;[order[i], order[i + dir]] = [order[i + dir], order[i]]
      const before = new Map(list.map((o) => [o.id, o.sort]))
      order.forEach((id, n) => (list.find((o) => o.id === id).sort = n))
      list.sort((a, b) => (a.section_key === b.section_key ? a.sort - b.sort : a.section_key.localeCompare(b.section_key)))
      draw()
      const ok = await attempt(async () => {
        for (const [n, id] of order.entries()) if (before.get(id) !== n) must(await supabase.from('products').update({ sort: n }).eq('id', id))
      })
      forgetProducts()
      if (!ok) showList()
    }
  }

  // ---------- One product ----------

  async function edit(product) {
    const isNew = !product
    const p = product
      ? structuredClone(product)
      : { title: '', category: '', description: '', price_from: null, section_key: filter.section || sections[0]?.key, tags: [], is_published: true, product_images: [] }
    // Photos waiting to be uploaded when the product is saved.
    const pending = []
    const removed = []
    const categories = [...new Set(list.map((o) => o.category).filter(Boolean))].sort()

    const photos = h('div.photos')
    const drawPhotos = () => {
      const all = [...p.product_images.map((img) => ({ kind: 'saved', img })), ...pending.map((file) => ({ kind: 'new', file }))]
      fill(photos,
        ...all.map((entry, i) => {
          const src = entry.kind === 'saved' ? photoUrl(entry.img.path) : entry.file.preview
          return h(
            'figure.photo',
            h('img', { src, alt: '' }),
            i === 0 ? h('span.photo__badge', 'Main photo') : null,
            entry.kind === 'new' ? h('span.photo__badge.photo__badge--new', 'Not saved yet') : null,
            entry.kind === 'saved'
              ? [
                  field('Description for screen readers', h('input', { value: entry.img.alt, maxlength: 200, oninput: (e) => (entry.img.alt = e.target.value) })),
                  field(
                    'Keep in view when cropped',
                    h(
                      'select',
                      { onchange: (e) => (entry.img.focus = e.target.value || null) },
                      FOCUS.map(([v, label]) => h('option', { value: v, selected: (entry.img.focus || '') === v }, label)),
                      entry.img.focus && !FOCUS.some(([v]) => v === entry.img.focus) ? h('option', { value: entry.img.focus, selected: true }, entry.img.focus) : null,
                    ),
                  ),
                ]
              : null,
            h(
              'div.photo__actions',
              entry.kind === 'saved' && i > 0
                ? h('button.link', { type: 'button', onclick: () => {
                    p.product_images.splice(p.product_images.indexOf(entry.img), 1)
                    p.product_images.unshift(entry.img)
                    drawPhotos()
                  } }, 'Make main')
                : null,
              h('button.link.link--danger', { type: 'button', onclick: () => {
                if (entry.kind === 'saved') {
                  p.product_images.splice(p.product_images.indexOf(entry.img), 1)
                  removed.push(entry.img)
                } else pending.splice(pending.indexOf(entry.file), 1)
                drawPhotos()
              } }, 'Remove'),
            ),
          )
        }),
        h(
          'label.photo.photo--add',
          h('span', '+ Add photos'),
          h('span.muted.small', 'JPG, PNG or WebP. Resized and colour-matched for you.'),
          h('input', {
            type: 'file',
            accept: 'image/jpeg,image/png,image/webp,image/heic,image/heif',
            multiple: true,
            onchange: (e) => {
              for (const file of e.target.files) {
                if (file.size > 25 * 1024 * 1024) {
                  toast(`${file.name} is too big (25 MB at most).`, 'bad')
                  continue
                }
                file.preview = URL.createObjectURL(file)
                pending.push(file)
              }
              e.target.value = ''
              drawPhotos()
            },
          }),
        ),
      )
    }

    const form = h(
      'form.form.form--wide',
      { novalidate: true },
      field('Name', h('input', { name: 'title', required: true, maxlength: 120, value: p.title })),
      h(
        'div.form__row',
        field(
          'Section',
          h('select', { name: 'section_key' }, sections.map((s) => h('option', { value: s.key, selected: s.key === p.section_key }, s.name))),
        ),
        field(
          'Kind of piece',
          h('input', { name: 'category', list: 'categories', maxlength: 60, value: p.category, placeholder: 'e.g. Bridal accessories' }),
          'Used for the filters on the section page.',
        ),
        field('Price from (₹)', h('input', { name: 'price_from', type: 'number', min: 0, step: 1, inputmode: 'numeric', value: p.price_from ?? '' }), 'Leave empty for “Price on request”.'),
      ),
      h('datalist', { id: 'categories' }, categories.map((c) => h('option', { value: c }))),
      field('Description', h('textarea', { name: 'description', rows: 4, maxlength: 4000, value: p.description }), 'Shown on the product’s page. Leave empty for a short automatic one.'),
      field('Tags', h('input', { name: 'tags', value: (p.tags || []).join(', '), placeholder: 'e.g. wedding, communion' }), 'Separated by commas. Not shown on the site yet.'),
      switchInput(p.is_published, (on) => (p.is_published = on), 'Show on the site'),
      h('h2', 'Photos'),
      photos,
      h(
        'div.form__actions',
        h('button.btn', { type: 'submit' }, isNew ? 'Add the product' : 'Save changes'),
        h('button.btn.btn--quiet', { type: 'button', onclick: () => showList() }, 'Cancel'),
        !isNew ? h('button.btn.btn--danger', { type: 'button', onclick: () => remove() }, 'Delete product') : null,
      ),
    )
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const title = form.elements.title.value.trim()
      if (!title) return toast('Give the product a name.', 'bad')
      const price = form.elements.price_from.value
      const fields = {
        title,
        section_key: form.elements.section_key.value,
        category: form.elements.category.value.trim(),
        description: form.elements.description.value.trim(),
        price_from: price === '' ? null : Number(price),
        tags: form.elements.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
        is_published: p.is_published,
      }
      if (fields.is_published && !p.product_images.length && !pending.length) return toast('Add a photo to show it on the site, or switch “Show on the site” off.', 'bad')
      busy(form, true)
      const ok = await attempt(async () => {
        let id = p.id
        if (isNew) {
          // A readable, unique address for its page: /decor/pearl-comb/.
          const taken = new Set(list.map((o) => o.slug))
          let slug = slugify(title)
          for (let n = 2; taken.has(slug); n++) slug = `${slugify(title)}-${n}`
          const sort = Math.max(-1, ...list.filter((o) => o.section_key === fields.section_key).map((o) => o.sort)) + 1
          id = must(await supabase.from('products').insert({ ...fields, slug, sort }).select('id').single()).id
          p.id = id
          p.slug = slug
        } else {
          must(await supabase.from('products').update(fields).eq('id', id))
        }
        // Photos: remove, then update the kept ones' order and details, then add new ones.
        if (removed.length) {
          must(await supabase.from('product_images').delete().in('id', removed.map((r) => r.id)))
          await removePhotoFiles(removed.map((r) => r.path))
          removed.length = 0
        }
        for (const [n, img] of p.product_images.entries()) {
          must(await supabase.from('product_images').update({ sort: n, alt: img.alt, focus: img.focus || null }).eq('id', img.id))
        }
        let n = p.product_images.length
        while (pending.length) {
          const file = pending[0]
          toast(`Uploading ${file.name}…`)
          const up = await uploadPhoto(file, `products/${p.slug}`)
          const row = must(
            await supabase
              .from('product_images')
              .insert({ product_id: id, path: up.path, width: up.width, height: up.height, alt: title, sort: n++ })
              .select('id, path, width, height, alt, focus, sort')
              .single(),
          )
          p.product_images.push(row)
          pending.shift()
          URL.revokeObjectURL(file.preview)
        }
      }, isNew ? 'Product added' : 'Saved')
      busy(form, false)
      forgetProducts()
      if (ok) showList()
      else drawPhotos()
    })

    async function remove() {
      if (!confirm(`Delete “${p.title}” and its photos? This can’t be undone. (To take it off the site but keep it, switch “Show on the site” off instead.)`)) return
      const ok = await attempt(async () => {
        const paths = product.product_images.map((i) => i.path)
        must(await supabase.from('products').delete().eq('id', p.id))
        await removePhotoFiles(paths)
      }, 'Product deleted')
      forgetProducts()
      if (ok) showList()
    }

    fill(content,
      h('button.link.back', { type: 'button', onclick: () => showList() }, '← All products'),
      h('h1', isNew ? 'New product' : p.title),
      !isNew ? h('p.muted', `Its page: /${p.section_key}/${p.slug}/`) : null,
      form,
    )
    drawPhotos()
  }

  await showList()
}
