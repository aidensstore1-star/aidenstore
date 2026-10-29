import gsap from 'gsap'

// Endless, draggable row of photos on a gentle 3D curve. Items are positioned
// with transforms and wrap around, so the row never ends; they lean with the
// speed of a drag. A tap (not a drag) opens the detail view.
export function initGallery({ scroll, onOpen }) {
  const viewport = document.querySelector('.gallery__viewport')
  const items = [...document.querySelectorAll('.gallery__item')]
  if (!viewport || !items.length) return null
  const imgs = items.map((item) => item.querySelector('img'))

  const OFFSETS = [-50, -55, -47, -53, -45, -52]
  const state = { current: 0, target: 0, last: 0, dragging: false, startX: 0, startTarget: 0, moved: 0, paused: false }
  let itemW = 0
  let step = 0
  let total = 0
  let half = 1
  let visible = false
  let lean = 0

  const measure = () => {
    itemW = items[0].offsetWidth
    half = viewport.clientWidth / 2
    step = itemW + Math.max(28, window.innerWidth * 0.035)
    total = items.length * step
  }
  measure()
  window.addEventListener('resize', measure)

  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '200px 0px' }).observe(viewport)

  const update = () => {
    if (!visible) return
    // Drifts on its own, except while held and for a few seconds after a touch.
    const resting = performance.now() - (state.touchedAt || 0) < 6000
    if (!state.dragging && !state.paused && !resting) state.target -= 0.45 + Math.min(Math.abs(scroll.velocity()), 40) * 0.15
    state.current += (state.target - state.current) * 0.075
    const velocity = state.current - state.last
    state.last = state.current
    lean += (Math.max(-9, Math.min(9, velocity * 0.35)) - lean) * 0.15

    for (let i = 0; i < items.length; i++) {
      let x = (i * step + state.current) % total
      if (x < 0) x += total
      x -= step
      // n: -1 at the left edge, 0 in the middle, 1 at the right edge.
      const n = (x + itemW / 2 - half) / half
      if (n < -1.6 || n > 1.6) {
        items[i].style.transform = `translate3d(${x}px, -50%, 0)`
        continue
      }
      const depth = -Math.abs(n) * 110
      items[i].style.transform = `translate3d(${x}px, ${OFFSETS[i % OFFSETS.length]}%, ${depth.toFixed(1)}px) rotateY(${(-n * 22).toFixed(2)}deg) skewX(${lean.toFixed(2)}deg)`
      // The photo drifts inside its frame, the other way, like looking through a window.
      imgs[i].style.transform = `translateX(${(n * -7).toFixed(2)}%) scale(1.16)`
    }
  }
  gsap.ticker.add(update, false, true)

  // Only a short, still press counts as a tap. Any movement (including a
  // vertical swipe that scrolls the page) or a long press does not open a piece.
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    state.dragging = true
    state.startX = e.clientX
    state.startY = e.clientY
    state.startTime = performance.now()
    state.startTarget = state.target
    state.moved = 0
    state.downItem = e.target.closest('.gallery__item')
    if (e.pointerType === 'mouse') viewport.setPointerCapture(e.pointerId)
  })
  viewport.addEventListener('pointermove', (e) => {
    if (!state.dragging) return
    const dx = e.clientX - state.startX
    const dy = e.clientY - state.startY
    state.moved = Math.max(state.moved, Math.hypot(dx, dy))
    state.target = state.startTarget + dx * 1.6
  })
  const end = (e) => {
    if (!state.dragging) return
    state.dragging = false
    state.touchedAt = performance.now()
    if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId)
    // After a drag, glide on a little and settle with one card centred.
    if (state.moved >= 8) snap(state.target + (state.target - state.startTarget) * 0.25)
    const quick = performance.now() - state.startTime < 300
    if (e.type === 'pointerup' && quick && state.moved < 8 && state.downItem) open(state.downItem)
  }
  viewport.addEventListener('pointerup', end)
  viewport.addEventListener('pointercancel', end)
  viewport.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault()
        state.target -= e.deltaX * 1.2
      }
    },
    { passive: false },
  )
  // Keyboard: bring a focused item into view; Enter/Space opens it.
  items.forEach((item, i) => {
    item.addEventListener('click', (e) => {
      if (e.detail === 0) open(item)
    })
    item.addEventListener('focus', () => {
      let x = (i * step + state.target) % total
      if (x < 0) x += total
      x -= step
      state.target += (viewport.clientWidth - itemW) / 2 - x
    })
  })
  viewport.addEventListener('dragstart', (e) => e.preventDefault())

  // Moves the row so the card nearest `target` lands in the middle.
  function snap(target) {
    const mid = half - itemW / 2
    let best = Infinity
    for (let i = 0; i < items.length; i++) {
      let x = (i * step + target) % total
      if (x < 0) x += total
      x -= step
      if (Math.abs(mid - x) < Math.abs(best)) best = mid - x
    }
    state.target = target + best
  }

  function open(item) {
    onOpen?.(Number(item.dataset.index), item)
  }

  return {
    items,
    pause: () => (state.paused = true),
    resume: () => (state.paused = false),
  }
}
