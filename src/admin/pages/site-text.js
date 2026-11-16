import { supabase } from '../supabase.js'
import { attempt, busy, field, fill, h, moveButtons, must, productList, productPicker, toast } from '../ui.js'

// Every text on the site, one part of the page at a time, plus the two
// sections' names and signs. The texts are stored as small documents; this
// page draws a form for whatever shape each one has.

// Parts that hold photos (by product): a single one, or a list.
const PHOTO = new Set(['photo', 'finale'])
const PHOTO_LIST = new Set(['photos', 'ring', 'wall'])
// Fixed by the page's design: shown, but not editable.
const LOCKED = new Set(['id', 'num', 'house'])
// Lists whose length the design depends on (two-part titles, the chapters).
const FIXED_LENGTH = new Set(['title', 'intro', 'line', 'end', 'chapters', 'moments'])

const LABELS = {
  title: 'Title (plain part, then the italic part)',
  text: 'Text',
  photos: 'Photos',
  photo: 'Photo',
  beats: 'Scenes',
  line: 'Words over the photo (two lines)',
  intro: 'Opening words (two lines)',
  end: 'Closing words (plain part, then italic)',
  moments: 'Times shown above some pieces',
  ring: 'Cakes in the turning ring',
  wall: 'Pieces on the wall (the middle one opens the chapter)',
  finale: 'Photo revealed at the end',
  tags: 'Occasions listed',
  items: 'Words in the moving banner',
  steps: 'Steps',
  chapters: 'Chapters',
  id: 'Link name',
  num: 'Number',
  house: 'Section',
}
const label = (key) => LABELS[key] ?? (/^\d+$/.test(key) ? `Above piece ${Number(key) + 1}` : key.replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase()))

export async function siteText(content) {
  fill(content, h('h1', 'Site text'), h('p.muted', 'Loading…'))
  let blocks = []
  let sections = []
  let products = []
  const ok = await attempt(async () => {
    ;[blocks, sections, products] = await Promise.all([
      supabase.from('content_blocks').select('key, label, value, sort, updated_at').order('sort').then(must),
      supabase.from('sections').select('*').order('sort').then(must),
      productList({ fresh: true }),
    ])
  })
  if (!ok) return

  const tabs = [
    ...sections.map((s) => ({ id: `section:${s.key}`, label: s.name, draw: (el) => sectionForm(el, s) })),
    ...blocks.map((b) => ({ id: b.key, label: b.label, draw: (el) => blockForm(el, b) })),
  ]
  const panel = h('div.tab-panel')
  const select = h(
    'select.tabs-select',
    { 'aria-label': 'Part of the site', onchange: () => open(select.value) },
    h('optgroup', { label: 'Sections' }, tabs.slice(0, sections.length).map((t) => h('option', { value: t.id }, t.label))),
    h('optgroup', { label: 'The story page' }, tabs.slice(sections.length).map((t) => h('option', { value: t.id }, t.label))),
  )
  const open = (id) => {
    const tab = tabs.find((t) => t.id === id) || tabs[0]
    select.value = tab.id
    fill(panel, )
    tab.draw(panel)
  }
  fill(content,
    h('h1', 'Site text'),
    h('p', 'Choose a part of the site to change its words and photos. Changes show on the website after you publish.'),
    field('Part of the site', select),
    panel,
  )
  open(tabs[0].id)

  // ---------- A text block ----------

  function blockForm(el, block) {
    const draft = structuredClone(block.value)
    const form = h('form.form.form--wide', { novalidate: true }, editor(draft, block.key), h('div.form__actions', h('button.btn', { type: 'submit' }, 'Save'), h('button.btn.btn--quiet', { type: 'button', onclick: () => blockForm(el, block) }, 'Undo changes')))
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      const empty = findEmpty(draft)
      if (empty) return toast(`“${label(empty)}” can’t be empty.`, 'bad')
      busy(form, true)
      if (await attempt(async () => must(await supabase.from('content_blocks').update({ value: draft }).eq('key', block.key)), 'Saved')) block.value = structuredClone(draft)
      busy(form, false)
    })
    fill(el, h('h2', block.label), form)
  }

  // Draws a form for any value, editing it in place.
  function editor(value, key) {
    if (Array.isArray(value)) return listEditor(value, key)
    if (value && typeof value === 'object') {
      return h(
        key && !/^\d+$/.test(key) ? 'fieldset.group' : 'div.group',
        key && !/^\d+$/.test(key) ? h('legend', label(key)) : null,
        Object.keys(value).map((k) => fieldFor(value, k)),
      )
    }
    return null
  }

  function fieldFor(parent, k) {
    const v = parent[k]
    if (PHOTO.has(k)) return field(label(k), productPicker(products, v, (slug) => (parent[k] = slug)))
    if (typeof v === 'string') {
      const long = v.length > 70 || k === 'text' || k === 'body'
      const input = h(long ? 'textarea' : 'input', {
        value: v,
        rows: long ? 4 : undefined,
        disabled: LOCKED.has(k),
        oninput: (e) => (parent[k] = e.target.value),
      })
      return field(label(k), input, LOCKED.has(k) ? 'Set by the page’s design.' : null)
    }
    if (typeof v === 'number') return field(label(k), h('input', { type: 'number', value: v, oninput: (e) => (parent[k] = Number(e.target.value)) }))
    return editor(v, k)
  }

  function listEditor(list, key) {
    const fixed = FIXED_LENGTH.has(key)
    const box = h(PHOTO_LIST.has(key) || list.some((x) => typeof x === 'object') ? 'fieldset.group' : 'fieldset.group.group--inline', h('legend', label(key)))
    const draw = () => {
      fill(box,
        h('legend', label(key)),
        ...list.map((item, i) => {
          const controls = !fixed
            ? [
                moveButtons(
                  () => {
                    ;[list[i - 1], list[i]] = [list[i], list[i - 1]]
                    draw()
                  },
                  () => {
                    ;[list[i + 1], list[i]] = [list[i], list[i + 1]]
                    draw()
                  },
                  { first: i === 0, last: i === list.length - 1 },
                ),
                h('button.icon', { type: 'button', title: 'Remove', 'aria-label': 'Remove', onclick: () => (list.splice(i, 1), draw()) }, '×'),
              ]
            : []
          if (PHOTO_LIST.has(key)) return h('div.list-item', productPicker(products, item, (slug) => (list[i] = slug)), ...controls)
          if (typeof item === 'string')
            return h('div.list-item', h('input', { value: item, 'aria-label': `${label(key)} ${i + 1}`, oninput: (e) => (list[i] = e.target.value) }), ...controls)
          return h('div.list-item.list-item--block', h('p.list-item__num', `${i + 1}`), editor(item, String(i)), ...controls)
        }),
        !fixed
          ? h(
              'button.btn.btn--quiet',
              {
                type: 'button',
                onclick: () => {
                  // A new item shaped like the others, with empty words.
                  const shape = list[list.length - 1]
                  if (PHOTO_LIST.has(key)) list.push(products.find((p) => p.is_published)?.slug)
                  else if (typeof shape === 'object' && shape) list.push(blank(shape))
                  else list.push('')
                  draw()
                },
              },
              PHOTO_LIST.has(key) ? '+ Add a photo' : '+ Add',
            )
          : null,
      )
    }
    draw()
    return box
  }

  // ---------- A section (its name and sign) ----------

  function sectionForm(el, s) {
    const draft = structuredClone(s)
    draft.sign_photos = (draft.sign_photos || []).map((p) => p.split('/').pop())
    draft.cover = (draft.cover_path || '').split('/').pop()
    const text = (name, k, hint, long) =>
      field(name, h(long ? 'textarea' : 'input', { value: draft[k], rows: long ? 3 : undefined, oninput: (e) => (draft[k] = e.target.value) }), hint)
    const form = h(
      'form.form.form--wide',
      { novalidate: true },
      text('Name', 'name', 'Shown on its sign, in the menu, on the buttons and in the page title.'),
      h('div.form__row', text('Short name', 'short_name', 'Used where space is tight, e.g. “Decor”.'), text('Small line on the sign', 'named_for', 'e.g. “Named for our son”.')),
      text('What it offers', 'line', 'One or two sentences, on the doors and its own page.', true),
      text('Start of its WhatsApp message', 'enquiry_text', 'The piece’s name is added after it.'),
      field('Photo on its door', productPicker(products, draft.cover, (slug) => (draft.cover = slug))),
      listEditor(draft.sign_photos, 'photos'),
      aislesEditor(draft),
      h('div.form__actions', h('button.btn', { type: 'submit' }, 'Save'), h('button.btn.btn--quiet', { type: 'button', onclick: () => sectionForm(el, s) }, 'Undo changes')),
    )
    form.addEventListener('submit', async (e) => {
      e.preventDefault()
      if (!draft.name.trim() || !draft.short_name.trim()) return toast('The section needs a name and a short name.', 'bad')
      // Photos are kept exactly as stored unless they were changed.
      const base = (p) => String(p || '').split('/').pop()
      const signPhotos = draft.sign_photos.filter(Boolean)
      const sameSign = signPhotos.length === (s.sign_photos || []).length && signPhotos.every((p, i) => p === base(s.sign_photos[i]))
      const change = {
        name: draft.name.trim(),
        short_name: draft.short_name.trim(),
        named_for: draft.named_for.trim(),
        line: draft.line.trim(),
        enquiry_text: draft.enquiry_text.trim(),
        cover_path: draft.cover === base(s.cover_path) ? s.cover_path : draft.cover,
        sign_photos: sameSign ? s.sign_photos : signPhotos,
        aisles: draft.aisles.filter((a) => a.label.trim()),
      }
      busy(form, true)
      if (await attempt(async () => must(await supabase.from('sections').update(change).eq('key', s.key)), 'Saved')) Object.assign(s, change)
      busy(form, false)
    })
    fill(el, h('h2', `${s.name}: its sign and doors`), form)
  }

  function aislesEditor(draft) {
    const links = [
      ['#bride', 'Chapter: the bride'],
      ['#ceremony', 'Chapter: the ceremony'],
      ['#home', 'Chapter: the décor'],
      ['#celebration', 'Chapter: the cake'],
      ['#gallery', 'The gallery'],
      ['#contact', 'Enquire'],
    ]
    const box = h('fieldset.group')
    const draw = () =>
      fill(box,
        h('legend', 'What the sign lists'),
        ...draft.aisles.map((a, i) =>
          h(
            'div.list-item',
            h('input', { value: a.label, 'aria-label': 'Words', oninput: (e) => (a.label = e.target.value) }),
            h('select', { 'aria-label': 'Goes to', onchange: (e) => (a.href = e.target.value) }, links.map(([v, l]) => h('option', { value: v, selected: a.href === v }, l))),
            h('button.icon', { type: 'button', title: 'Remove', 'aria-label': 'Remove', onclick: () => (draft.aisles.splice(i, 1), draw()) }, '×'),
          ),
        ),
        h('button.btn.btn--quiet', { type: 'button', onclick: () => (draft.aisles.push({ label: '', href: '#gallery' }), draw()) }, '+ Add'),
      )
    draw()
    return box
  }
}

// A copy of an item with its words emptied (photos and fixed parts kept).
function blank(shape) {
  if (Array.isArray(shape)) return shape.map((x) => (typeof x === 'string' ? '' : blank(x)))
  if (shape && typeof shape === 'object') return Object.fromEntries(Object.entries(shape).map(([k, v]) => [k, PHOTO.has(k) || LOCKED.has(k) ? v : typeof v === 'string' ? '' : blank(v)]))
  return shape
}

// The name of the first empty text, if any (empty texts would leave gaps on the page).
function findEmpty(value, key) {
  if (typeof value === 'string') return value.trim() ? null : key || 'text'
  if (Array.isArray(value)) {
    for (const v of value) {
      const found = findEmpty(v, key)
      if (found) return found
    }
  } else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      const found = findEmpty(v, k)
      if (found) return found
    }
  return null
}
