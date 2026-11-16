import { supabase } from './supabase.js'

// Shared pieces for the admin panel's pages.
//
// Everything shown comes from the database, so text is always set with
// textContent (never as HTML), which keeps anything typed into the site from
// running as code here.

// Builds an element: h('p.note', 'Hello') or h('button', { type: 'submit' }, 'Go').
export function h(tag, ...rest) {
  const [name, ...classes] = tag.split('.')
  const el = document.createElement(name)
  if (classes.length) el.className = classes.join(' ')
  for (const part of rest) {
    if (part == null || part === false) continue
    if (typeof part === 'string' || typeof part === 'number') el.append(String(part))
    else if (part instanceof Node) el.append(part)
    else if (Array.isArray(part)) el.append(...part.flat().filter((p) => p != null && p !== false))
    else
      for (const [k, v] of Object.entries(part)) {
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
        else if (k === 'value') el.value = v ?? ''
        else if (k === 'checked' || k === 'selected') el[k] = Boolean(v)
        else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v)
      }
  }
  return el
}

// Replaces an element's contents, flattening lists and skipping empty parts
// (replaceChildren on its own would print them as text).
export const fill = (el, ...parts) => el.replaceChildren(...parts.flat(Infinity).filter((p) => p != null && p !== false))

// Turns Supabase's error messages into plain words for the owner.
export function friendly(error) {
  const m = (error?.message || String(error || '')).toLowerCase()
  if (m.includes('invalid login')) return 'That email and password don’t match an account.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first: open the link we sent you.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Please wait a few minutes and try again.'
  if (m.includes('password should be')) return 'The password needs to be at least 8 characters.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Can’t reach the server. Check your internet connection.'
  if (m.includes('duplicate key') || m.includes('already exists')) return 'Something with that name already exists. Try a different name.'
  if (m.includes('row-level security') || m.includes('permission denied')) return 'Your account isn’t allowed to do that.'
  if (m.includes('jwt expired')) return 'Your sign-in has expired. Please sign in again.'
  if (m.includes('check constraint') || m.includes('violates check')) return 'One of the values isn’t valid. Please check the form.'
  if (m.includes('payload too large') || m.includes('exceeded the maximum')) return 'That file is too big (5 MB at most).'
  return 'Something went wrong. Please try again.'
}

// Throws the database error so callers can show it with friendly().
export const must = ({ data, error }) => {
  if (error) throw error
  return data
}

export function busy(form, on) {
  for (const el of form.querySelectorAll('input, select, textarea, button')) el.disabled = on
}

// A short message at the bottom of the screen.
let toastTimer = 0
export function toast(message, tone = 'ok') {
  let el = document.querySelector('.toast')
  if (!el) {
    el = h('div.toast', { role: 'status', 'aria-live': 'polite' })
    document.body.append(el)
  }
  el.textContent = message
  el.dataset.tone = tone
  el.classList.add('is-shown')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove('is-shown'), tone === 'bad' ? 6000 : 3000)
}

// Runs an action, reporting how it went; returns true when it worked.
export async function attempt(action, done) {
  try {
    await action()
    if (done) toast(done)
    return true
  } catch (error) {
    console.error(error)
    toast(friendly(error), 'bad')
    return false
  }
}

export const field = (label, control, hint) => h('label.field', h('span.field__label', label), control, hint ? h('span.field__hint', hint) : null)

export const dateTime = (iso) =>
  iso ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—'
export const dateOnly = (iso) => (iso ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso)) : '—')
export const money = (n) =>
  n == null || n === ''
    ? '—'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2, maximumFractionDigits: 2 }).format(Number(n))

export const slugify = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'piece'

// ---------- Photos ----------

export const photoUrl = (path, size = 640) =>
  supabase.storage.from('public-media').getPublicUrl(`${path}-${size}.webp`).data.publicUrl

// The site's warm look, the same as scripts/prepare-images.mjs gives the
// original photos, so new photos sit well beside them.
const GRADE = 'sepia(0.16) saturate(0.88) brightness(1.02) contrast(1.04)'

async function decode(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      // Fall back to an <img> below (some formats only decode that way).
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Makes the two sizes the site uses (640 and 1280 wide, WebP), in the browser,
// so no paid image service is needed.
export async function photoSizes(file, { grade = true } = {}) {
  let source
  try {
    source = await decode(file)
  } catch {
    throw new Error('That photo couldn’t be opened. Please use a JPG, PNG or WebP photo.')
  }
  const width = source.width
  const height = source.height
  const sizes = {}
  for (const target of [640, 1280]) {
    const w = Math.min(target, width)
    const hgt = Math.round((height * w) / width)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = hgt
    const ctx = canvas.getContext('2d')
    if (grade) ctx.filter = GRADE
    ctx.drawImage(source, 0, 0, w, hgt)
    sizes[target] = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('That photo couldn’t be converted.'))), 'image/webp', 0.82),
    )
  }
  source.close?.()
  return { width, height, sizes }
}

// Uploads a photo in both sizes under a new name; returns where it went.
export async function uploadPhoto(file, prefix, options) {
  const { width, height, sizes } = await photoSizes(file, options)
  const path = `${prefix}-${Math.random().toString(36).slice(2, 8)}`
  for (const [size, blob] of Object.entries(sizes)) {
    must(
      await supabase.storage
        .from('public-media')
        .upload(`${path}-${size}.webp`, blob, { contentType: 'image/webp', cacheControl: '31536000', upsert: false }),
    )
  }
  return { path, width, height }
}

export async function removePhotoFiles(paths) {
  if (!paths.length) return
  must(await supabase.storage.from('public-media').remove(paths.flatMap((p) => [`${p}-640.webp`, `${p}-1280.webp`])))
}

// ---------- Products, for the photo pickers ----------

let productCache = null
export async function productList({ fresh = false } = {}) {
  if (!productCache || fresh)
    productCache = must(
      await supabase
        .from('products')
        .select('id, slug, title, section_key, is_published, product_images(path, sort)')
        .order('section_key')
        .order('sort'),
    ).map((p) => ({ ...p, cover: [...p.product_images].sort((a, b) => a.sort - b.sort)[0]?.path || null }))
  return productCache
}
export const forgetProducts = () => (productCache = null)

// A product chooser with a thumbnail of the chosen one. `value` is a product's
// slug (or, for older content, a photo's file name).
export function productPicker(products, value, onChange, { allowNone = false } = {}) {
  const known = products.find((p) => p.slug === value) || products.find((p) => p.cover?.split('/').pop() === value)
  const thumb = h('img.picker__thumb', { alt: '' })
  const setThumb = (p) => {
    thumb.hidden = !p?.cover
    if (p?.cover) thumb.src = photoUrl(p.cover)
  }
  const select = h(
    'select',
    { onchange: () => {
      const p = products.find((x) => x.slug === select.value)
      setThumb(p)
      onChange(select.value || null)
    } },
    allowNone || !known ? h('option', { value: '' }, known ? '— none —' : value ? `(${value}: not found)` : '— choose —') : null,
    ['decor', 'cakes'].map((section) =>
      h(
        'optgroup',
        { label: section === 'cakes' ? 'Cakes' : 'Decor' },
        products
          .filter((p) => p.section_key === section)
          .map((p) => h('option', { value: p.slug, selected: p === known }, `${p.title}${p.is_published ? '' : ' (hidden)'}`)),
      ),
    ),
  )
  setThumb(known)
  return h('span.picker', thumb, select)
}

// Small up/down buttons for reordering a list.
export const moveButtons = (onUp, onDown, { first, last }) =>
  h(
    'span.move',
    h('button.icon', { type: 'button', 'aria-label': 'Move up', title: 'Move up', disabled: first, onclick: onUp }, '↑'),
    h('button.icon', { type: 'button', 'aria-label': 'Move down', title: 'Move down', disabled: last, onclick: onDown }, '↓'),
  )

export const switchInput = (checked, onChange, label) =>
  h(
    'label.switch',
    h('input', { type: 'checkbox', checked, onchange: (e) => onChange(e.target.checked) }),
    h('span.switch__track', { 'aria-hidden': 'true' }),
    h('span.switch__label', label),
  )
