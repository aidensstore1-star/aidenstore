import { supabase } from '../supabase.js'
import { attempt, fill, h, moveButtons, must, photoUrl, switchInput } from '../ui.js'

// The gallery on the story page: which pieces it shows, in what order.

export async function gallery(content) {
  fill(content, h('h1', 'Gallery'), h('p.muted', 'Loading…'))
  let items = []
  let images = []
  const ok = await attempt(async () => {
    ;[items, images] = await Promise.all([
      supabase.from('gallery_items').select('id, sort, is_visible, image_id').order('sort').then(must),
      supabase.from('product_images').select('id, path, sort, products(title, is_published)').order('sort').then(must),
    ])
  })
  if (!ok) return

  const imageOf = (item) => images.find((i) => i.id === item.image_id)
  const list = h('ul.rows')
  const adder = h('div.toolbar')

  const draw = () => {
    fill(list,
      ...items.map((item, i) => {
        const img = imageOf(item)
        return h(
          'li.row',
          img ? h('img.row__thumb', { src: photoUrl(img.path), alt: '', loading: 'lazy' }) : h('span.row__thumb.row__thumb--empty'),
          h(
            'div.row__main',
            h('span.row__title', img?.products?.title || 'Removed piece'),
            img && !img.products?.is_published ? h('span.muted', 'Its product is hidden, so it isn’t shown') : null,
          ),
          switchInput(item.is_visible, (on) => setVisible(item, on), 'Shown'),
          moveButtons(() => move(i, -1), () => move(i, 1), { first: i === 0, last: i === items.length - 1 }),
          h('button.link.link--danger', { type: 'button', onclick: () => remove(item) }, 'Remove'),
        )
      }),
    )
    // Only photos that aren't in the gallery yet can be added.
    const used = new Set(items.map((i) => i.image_id))
    const choices = images.filter((i) => !used.has(i.id))
    const select = h(
      'select',
      { 'aria-label': 'Piece to add' },
      h('option', { value: '' }, '— choose a piece —'),
      choices.map((i) => h('option', { value: i.id }, `${i.products?.title || 'Untitled'}${i.sort ? ` (photo ${i.sort + 1})` : ''}`)),
    )
    fill(adder, select, h('button.btn', { type: 'button', onclick: () => select.value && add(select.value) }, 'Add to the gallery'))
  }

  async function setVisible(item, on) {
    if (await attempt(async () => must(await supabase.from('gallery_items').update({ is_visible: on }).eq('id', item.id)), on ? 'Shown in the gallery' : 'Hidden from the gallery')) item.is_visible = on
    draw()
  }

  // Saves everyone's position, so the order is always clean.
  async function saveOrder() {
    const changed = items.map((item, n) => [item, n]).filter(([item, n]) => item.sort !== n)
    ;(await Promise.all(changed.map(([item, n]) => supabase.from('gallery_items').update({ sort: n }).eq('id', item.id)))).forEach(must)
    for (const [item, n] of changed) item.sort = n
  }

  // The list moves at once; the new positions are saved behind it.
  async function move(i, dir) {
    ;[items[i], items[i + dir]] = [items[i + dir], items[i]]
    draw()
    if (!(await attempt(saveOrder))) gallery(content)
  }

  async function remove(item) {
    if (await attempt(async () => must(await supabase.from('gallery_items').delete().eq('id', item.id)), 'Removed from the gallery')) {
      items = items.filter((i) => i !== item)
      await attempt(saveOrder)
    }
    draw()
  }

  async function add(imageId) {
    const row = await attempt(async () => {
      const created = must(await supabase.from('gallery_items').insert({ image_id: imageId, sort: items.length }).select('id, sort, is_visible, image_id').single())
      items.push(created)
    }, 'Added to the end of the gallery')
    if (row) draw()
  }

  fill(content,
    h('h1', 'Gallery'),
    h('p', 'The curved gallery on the story page. Visitors can filter it by section, so mix both.'),
    list,
    h('h2', 'Add a piece'),
    adder,
    h('p.muted.small', 'Changes show on the website after you publish.'),
  )
  draw()
}
