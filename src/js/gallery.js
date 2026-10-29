import gsap from 'gsap'

// Endless, draggable row of photos. Items are positioned with transforms and
// wrap around, so the row never ends. A tap (not a drag) opens the detail view.
export function initGallery({ scroll, gl, onOpen }) {
  const viewport = document.querySelector('.gallery__viewport')
  const items = [...document.querySelectorAll('.gallery__item')]
  if (!viewport || !items.length) return null

  const OFFSETS = [-50, -55, -47, -53, -45, -52]
  const state = { current: 0, target: 0, last: 0, dragging: false, startX: 0, startTarget: 0, moved: 0, paused: false }
  let itemW = 0
  let step = 0
  let total = 0
  let visible = false

  const measure = () => {
    itemW = items[0].offsetWidth
    step = itemW + Math.max(28, window.innerWidth * 0.035)
    total = items.length * step
  }
  measure()
  window.addEventListener('resize', measure)

  new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: '200px 0px' }).observe(viewport)

  const update = () => {
    if (!visible) return
    if (!state.dragging && !state.paused) state.target -= 0.45 + Math.min(Math.abs(scroll.velocity()), 40) * 0.15
    state.current += (state.target - state.current) * 0.075
    const velocity = state.current - state.last
    state.last = state.current
    gl?.setDrag(velocity * 0.02)

    for (let i = 0; i < items.length; i++) {
      let x = (i * step + state.current) % total
      if (x < 0) x += total
      x -= step
      items[i].style.transform = `translate3d(${x}px, ${OFFSETS[i % OFFSETS.length]}%, 0)`
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
    if (viewport.hasPointerCapture(e.pointerId)) viewport.releasePointerCapture(e.pointerId)
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

  function open(item) {
    onOpen?.(Number(item.dataset.index), item)
  }

  return {
    items,
    pause: () => (state.paused = true),
    resume: () => (state.paused = false),
  }
}
