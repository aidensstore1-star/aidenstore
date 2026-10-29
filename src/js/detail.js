import gsap from 'gsap'
import { brand, gallery, photos } from '../content.js'

// Full-screen view of one gallery piece. Opening grows the photo out of the
// gallery card it was tapped from; closing shrinks it back.
export function initDetail({ scroll, gl, galleryApi, reduced }) {
  const root = document.querySelector('.detail')
  const backdrop = root.querySelector('.detail__backdrop')
  const slot = root.querySelector('.detail__media')
  const img = slot.querySelector('img')
  const info = root.querySelector('.detail__info')
  const type = root.querySelector('.detail__type')
  const title = root.querySelector('.detail__title')
  const count = root.querySelector('.detail__count')
  const enquire = root.querySelector('.detail__enquire')
  const closeBtn = root.querySelector('.detail__close')
  const navs = root.querySelectorAll('.detail__nav')
  const chrome = [closeBtn, ...navs]

  let index = 0
  let isOpen = false
  let busy = false
  let source = null
  let lastFocus = null

  const sizeOf = (id) => {
    const el = document.querySelector(`.gallery__item[data-index="${gallery.indexOf(id)}"] img`)
    return { w: Number(el?.getAttribute('width')) || 3, h: Number(el?.getAttribute('height')) || 4 }
  }

  function fill(i) {
    index = (i + gallery.length) % gallery.length
    const id = gallery[index]
    const p = photos[id] || {}
    img.src = `photos/${id}-1280.webp`
    img.alt = p.alt || ''
    type.textContent = p.type || ''
    title.textContent = p.title || ''
    count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(gallery.length).padStart(2, '0')}`
    if (brand.whatsapp) {
      enquire.href = `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent(`Hello! I'd love to ask about the ${p.title}.`)}`
      enquire.target = '_blank'
      enquire.rel = 'noopener'
    } else {
      enquire.href = '#contact'
    }
    layout()
  }

  // Size the <img> to the photo's own shape inside the available space.
  function layout() {
    const { w, h } = sizeOf(gallery[index])
    slot.style.display = 'grid'
    slot.style.placeItems = 'center'
    const r = slot.getBoundingClientRect()
    const scale = Math.min(r.width / w, r.height / h)
    img.style.width = `${Math.round(w * scale)}px`
    img.style.height = `${Math.round(h * scale)}px`
  }

  // Transform that makes the full photo look like the cropped card it came from.
  function fromCard(card) {
    const s = card.querySelector('.media').getBoundingClientRect()
    const f = img.getBoundingClientRect()
    const cardAr = s.width / s.height
    const imgAr = f.width / f.height
    const c = imgAr > cardAr
      ? { w: f.height * cardAr, h: f.height, x: (f.width - f.height * cardAr) / 2, y: 0 }
      : { w: f.width, h: f.width / cardAr, x: 0, y: (f.height - f.width / cardAr) / 2 }
    const k = s.width / c.w
    return {
      x: s.left - (f.left + c.x * k),
      y: s.top - (f.top + c.y * k),
      scale: k,
      clipPath: `inset(${c.y}px ${f.width - c.x - c.w}px ${f.height - c.y - c.h}px ${c.x}px)`,
    }
  }

  let byKeyboard = false
  window.addEventListener('keydown', () => (byKeyboard = true), true)
  window.addEventListener('pointerdown', () => (byKeyboard = false), true)

  async function open(i, card) {
    if (isOpen || busy) return
    busy = true
    isOpen = true
    source = card
    lastFocus = document.activeElement
    galleryApi?.pause()
    scroll.stop()
    document.documentElement.classList.add('detail-open')
    root.classList.add('is-open')
    root.setAttribute('aria-hidden', 'false')
    fill(i)
    await img.decode().catch(() => {})

    const media = gl?.get(card.querySelector('.media'))
    const tl = gsap.timeline({
      onComplete: () => {
        busy = false
        if (media) media.hidden = true
        // Move focus into the dialog; only show the ring when using a keyboard.
        closeBtn.focus({ preventScroll: true, focusVisible: byKeyboard })
      },
    })
    tl.fromTo(backdrop, { opacity: 0 }, { opacity: 0.97, duration: reduced ? 0.2 : 0.9, ease: 'power2.out' }, 0)
    if (!reduced) {
      tl.fromTo(img, { ...fromCard(card), transformOrigin: '0 0' }, { x: 0, y: 0, scale: 1, clipPath: 'inset(0px 0px 0px 0px)', duration: 1.2, ease: 'expo.inOut' }, 0)
    }
    tl.fromTo([...info.children, ...chrome], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.06, ease: 'expo.out' }, reduced ? 0 : 0.7)
  }

  function close() {
    if (!isOpen || busy) return
    busy = true
    const media = gl?.get(source.querySelector('.media'))
    if (media) media.hidden = false
    const tl = gsap.timeline({
      onComplete: () => {
        root.classList.remove('is-open')
        document.documentElement.classList.remove('detail-open')
        root.setAttribute('aria-hidden', 'true')
        gsap.set([img, ...info.children, ...chrome], { clearProps: 'all' })
        img.style.width = ''
        img.style.height = ''
        isOpen = false
        busy = false
        galleryApi?.resume()
        scroll.start()
        lastFocus?.focus?.({ preventScroll: true })
      },
    })
    tl.to([...info.children, ...chrome], { opacity: 0, y: 20, duration: 0.4, stagger: 0.03, ease: 'power2.in' }, 0)
    const r = source.getBoundingClientRect()
    if (!reduced && r.right > 0 && r.left < window.innerWidth) {
      tl.to(img, { ...fromCard(source), duration: 1, ease: 'expo.inOut' }, 0.1)
      tl.to(backdrop, { opacity: 0, duration: 0.6, ease: 'power2.inOut' }, 0.6)
    } else {
      tl.to([img, backdrop], { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, 0.1)
    }
  }

  function go(dir) {
    if (!isOpen || busy) return
    busy = true
    const media = gl?.get(source.querySelector('.media'))
    gsap
      .timeline({ onComplete: () => (busy = false) })
      .to([img, ...info.children], { opacity: 0, x: -40 * dir, duration: 0.35, stagger: 0.03, ease: 'power2.in' })
      .add(async () => {
        if (media) media.hidden = false
        fill(index + dir)
        source = document.querySelector(`.gallery__item[data-index="${index}"]`)
        const next = gl?.get(source.querySelector('.media'))
        if (next) next.hidden = true
      })
      .fromTo([img, ...info.children], { opacity: 0, x: 40 * dir }, { opacity: 1, x: 0, duration: 0.7, stagger: 0.04, ease: 'expo.out' }, '+=0.05')
  }

  // Touch: swipe sideways for the next or previous piece, swipe down to close.
  let touch = null
  root.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return
      touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: performance.now() }
    },
    { passive: true },
  )
  root.addEventListener(
    'touchmove',
    (e) => {
      if (!touch || busy) return
      const dy = e.touches[0].clientY - touch.y
      const dx = e.touches[0].clientX - touch.x
      if (dy > 0 && dy > Math.abs(dx)) gsap.set(img, { y: dy * 0.6, scale: 1 - Math.min(dy / 2000, 0.15) })
    },
    { passive: true },
  )
  root.addEventListener('touchend', (e) => {
    if (!touch) return
    const p = e.changedTouches[0]
    const dx = p.clientX - touch.x
    const dy = p.clientY - touch.y
    touch = null
    if (busy) return
    if (dy > 90 && dy > Math.abs(dx)) return close()
    gsap.to(img, { y: 0, scale: 1, duration: 0.5, ease: 'expo.out' })
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
  })

  closeBtn.addEventListener('click', close)
  backdrop.addEventListener('click', close)
  navs[0].addEventListener('click', () => go(-1))
  navs[1].addEventListener('click', () => go(1))
  enquire.addEventListener('click', (e) => {
    if (enquire.getAttribute('href') !== '#contact') return
    e.preventDefault()
    close()
    setTimeout(() => scroll.scrollTo('#contact'), 1300)
  })
  window.addEventListener('keydown', (e) => {
    if (!isOpen) return
    if (e.key === 'Escape') close()
    if (e.key === 'ArrowRight') go(1)
    if (e.key === 'ArrowLeft') go(-1)
    if (e.key === 'Tab') {
      // Keep focus inside the dialog.
      const focusables = [closeBtn, enquire, ...navs]
      const i = focusables.indexOf(document.activeElement)
      e.preventDefault()
      focusables[(i + (e.shiftKey ? -1 : 1) + focusables.length) % focusables.length].focus()
    }
  })
  window.addEventListener('resize', () => isOpen && !busy && layout())

  return { open }
}
