import gsap from 'gsap'
import { brand, gallery, photos } from '../content.js'

// Full-screen view of one gallery piece. Opening grows the photo out of the
// gallery card it was tapped from; closing shrinks it back.
export function initDetail({ scroll, gl, galleryApi, reduced }) {
  const root = document.querySelector('.detail')
  const backdrop = root.querySelector('.detail__backdrop')
  const blur = root.querySelector('.detail__blur')
  const progress = root.querySelector('.detail__progress')
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
  // A gesture made while a transition is still running waits for it to end.
  let queued = null
  const settle = () => {
    busy = false
    const next = queued
    queued = null
    next?.()
  }
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
    blur.style.backgroundImage = `url(photos/${id}-640.webp)`
    progress.style.setProperty('--p', ((index + 1) / gallery.length).toFixed(3))
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
    // Load the pieces either side, so swiping never shows a blank.
    for (const step of [1, -1]) {
      const near = new Image()
      near.src = `photos/${gallery[(index + step + gallery.length) % gallery.length]}-1280.webp`
      near.decode?.().catch(() => {})
    }
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
        settle()
        if (media) media.hidden = true
        // Move focus into the dialog; only show the ring when using a keyboard.
        closeBtn.focus({ preventScroll: true, focusVisible: byKeyboard })
      },
    })
    tl.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: reduced ? 0.2 : 0.9, ease: 'power2.out' }, 0)
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
        gsap.set([img, info, ...info.children, ...chrome], { clearProps: 'all' })
        img.style.width = ''
        img.style.height = ''
        isOpen = false
        settle()
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

  // `swiped`: the photo is already under the finger, so it carries on off
  // the screen from where it is instead of starting over.
  function go(dir, swiped = false) {
    if (!isOpen || busy) return
    busy = true
    const media = gl?.get(source.querySelector('.media'))
    gsap
      .timeline({ onComplete: settle })
      .to(img, { opacity: 0, x: swiped ? -window.innerWidth * dir : -40 * dir, rotation: 0, duration: swiped ? 0.3 : 0.35, ease: 'power2.in' })
      .to(info.children, { opacity: 0, x: -40 * dir, duration: 0.35, stagger: 0.03, ease: 'power2.in' }, 0)
      .add(async () => {
        if (media) media.hidden = false
        fill(index + dir)
        source = document.querySelector(`.gallery__item[data-index="${index}"]`)
        const next = gl?.get(source.querySelector('.media'))
        if (next) next.hidden = true
      })
      .fromTo([img, ...info.children], { opacity: 0, x: 40 * dir }, { opacity: 1, x: 0, duration: 0.7, stagger: 0.04, ease: 'expo.out' }, '+=0.05')
  }

  // Touch: the photo follows the finger. Swipe sideways for the next or
  // previous piece, down to close; a quick flick counts even if it is short.
  let touch = null
  root.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      touch = { x: t.clientX, y: t.clientY, lx: t.clientX, ly: t.clientY, lt: performance.now(), vx: 0, vy: 0, axis: null }
    },
    { passive: true },
  )
  root.addEventListener(
    'touchmove',
    (e) => {
      if (!touch) return
      const t = e.touches[0]
      const now = performance.now()
      const dt = Math.max(1, now - touch.lt)
      touch.vx = (t.clientX - touch.lx) / dt
      touch.vy = (t.clientY - touch.ly) / dt
      touch.lx = t.clientX
      touch.ly = t.clientY
      touch.lt = now
      const dx = t.clientX - touch.x
      const dy = t.clientY - touch.y
      if (!touch.axis && Math.hypot(dx, dy) > 8) touch.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      // Gestures still count during a transition (they run when it ends), but
      // the photo only follows the finger when it is free to.
      if (busy) return
      if (touch.axis === 'x') gsap.set(img, { x: dx, rotation: dx * 0.02, opacity: 1 - Math.min(Math.abs(dx) / 600, 0.4) })
      if (touch.axis === 'y' && dy > 0) {
        // Pulling down shrinks the photo and fades the words and backdrop,
        // showing the page underneath.
        const pull = Math.min(dy / 400, 1)
        gsap.set(img, { y: dy * 0.7, scale: 1 - pull * 0.2 })
        gsap.set([info, ...chrome], { opacity: 1 - pull })
        gsap.set(backdrop, { opacity: 1 - pull * 0.6 })
      }
    },
    { passive: true },
  )
  root.addEventListener('touchend', (e) => {
    if (!touch) return
    const p = e.changedTouches[0]
    const dx = p.clientX - touch.x
    const dy = p.clientY - touch.y
    const { axis, vx, vy } = touch
    touch = null
    let action = null
    if (axis === 'y' && (dy > 110 || (dy > 30 && vy > 0.6))) action = close
    else if (axis === 'x' && (Math.abs(dx) > 90 || (Math.abs(dx) > 25 && Math.abs(vx) > 0.5))) action = () => go(dx < 0 ? 1 : -1, !busy)
    if (busy) {
      queued = action
      return
    }
    if (action) return action()
    gsap.to(img, { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, duration: 0.6, ease: 'expo.out' })
    gsap.to([info, ...chrome], { opacity: 1, duration: 0.4 })
    gsap.to(backdrop, { opacity: 1, duration: 0.4 })
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
