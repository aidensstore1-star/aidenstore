import gsap from 'gsap'

// Custom cursor and magnetic buttons, only for a mouse or trackpad.
export function initCursor() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
  document.documentElement.classList.add('has-cursor')

  const cursor = document.querySelector('.cursor')
  const dot = cursor.querySelector('.cursor__dot')
  const ring = cursor.querySelector('.cursor__ring')
  const label = cursor.querySelector('.cursor__label')

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.15, ease: 'power3.out' })
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.15, ease: 'power3.out' })
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.6, ease: 'power3.out' })
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.6, ease: 'power3.out' })

  let seen = false
  window.addEventListener('pointermove', (e) => {
    if (!seen) {
      // Start where the pointer is instead of flying in from the corner.
      seen = true
      gsap.set([dot, ring], { x: e.clientX, y: e.clientY })
      gsap.to(cursor, { opacity: 1, duration: 0.4 })
    }
    dotX(e.clientX)
    dotY(e.clientY)
    ringX(e.clientX)
    ringY(e.clientY)
  })

  let state = ''
  const set = (next, text = '') => {
    if (next === state && label.textContent === text) return
    state = next
    label.textContent = text
    cursor.classList.toggle('is-label', next === 'label')
    const scale = next === 'label' ? 1 : next === 'link' ? 0.65 : 0.4
    gsap.to(ring, { scale, duration: 0.6, ease: 'expo.out', overwrite: 'auto' })
    gsap.to(dot, { scale: next === 'label' ? 0 : 1, duration: 0.3, overwrite: 'auto' })
  }

  document.addEventListener('pointerover', (e) => {
    const labelled = e.target.closest('[data-cursor]')
    if (labelled) return set('label', labelled.dataset.cursor)
    if (e.target.closest('a, button')) return set('link')
    set('')
  })
  document.documentElement.addEventListener('pointerleave', () => gsap.to(cursor, { opacity: 0, duration: 0.3 }))
  document.documentElement.addEventListener('pointerenter', () => seen && gsap.to(cursor, { opacity: 1, duration: 0.3 }))

  // Buttons lean towards the pointer and spring back.
  document.querySelectorAll('.magnetic').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' })
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' })
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      x((e.clientX - r.left - r.width / 2) * 0.35)
      y((e.clientY - r.top - r.height / 2) * 0.45)
    })
    el.addEventListener('pointerleave', () => {
      gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, 0.35)' })
    })
  })
}
