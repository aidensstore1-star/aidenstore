import '@fontsource/cormorant-garamond/latin-300.css'
import '@fontsource/cormorant-garamond/latin-400.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import '@fontsource-variable/manrope'
import './catalog.css'
import { initOrder } from './order.js'

// The section and product pages: cards rise in as they come into view, the
// section's filter shows one kind of piece at a time, and a product's
// thumbnails swap the main photo. Everything still works without this script.

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------- Cards rise in, a few at a time ----------
const cards = [...document.querySelectorAll('.cat-card')]
if (!reduced && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('cat-motion')
  let batch = 0
  let frame = 0
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        // Cards arriving together are staggered; the count resets each frame.
        e.target.style.setProperty('--delay', `${Math.min(batch++, 6) * 70}ms`)
        e.target.classList.add('is-in')
        seen.unobserve(e.target)
      }
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => (batch = 0))
    },
    { rootMargin: '0px 0px -8% 0px' },
  )
  cards.forEach((c) => seen.observe(c))
  // A card's photo leans towards the pointer.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    for (const card of cards) {
      const media = card.querySelector('.cat-media')
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        media.style.transform = `perspective(900px) rotateY(${(x * 8).toFixed(2)}deg) rotateX(${(-y * 8).toFixed(2)}deg) translateY(-6px)`
      })
      card.addEventListener('pointerleave', () => (media.style.transform = ''))
    }
  }
}

// ---------- Filter by kind of piece ----------
const filters = [...document.querySelectorAll('.cat-filter')]
for (const btn of filters) {
  btn.addEventListener('click', () => {
    const want = btn.dataset.filter
    filters.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)))
    for (const card of cards) {
      const show = !want || card.dataset.category === want
      card.hidden = !show
      if (show && !reduced) {
        card.classList.remove('is-in')
        card.style.setProperty('--delay', '0ms')
        requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add('is-in')))
      }
    }
  })
}

// ---------- Product photos ----------
const main = document.querySelector('.product__img')
for (const thumb of document.querySelectorAll('.product__thumb')) {
  thumb.addEventListener('click', () => {
    main.src = thumb.dataset.src
    main.srcset = thumb.dataset.srcset
    for (const t of document.querySelectorAll('.product__thumb')) t.setAttribute('aria-pressed', String(t === thumb))
    if (!reduced) main.animate([{ opacity: 0.2, transform: 'scale(1.04)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' })
  })
}

// ---------- The cake order form ----------
const order = document.getElementById('order')
if (order) initOrder(order)
