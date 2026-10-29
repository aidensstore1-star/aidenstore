import gsap from 'gsap'

const decode = (img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve())

// Counts up while fonts and the first photos load, flicks through a stack of
// photos, then blows the last one up to full screen and lifts the curtain.
// Resolves as the curtain starts to lift, so the hero can animate in under it.
export function runPreloader({ reduced }) {
  const root = document.querySelector('.preloader')
  if (reduced || !root) {
    root?.remove()
    return Promise.resolve()
  }

  const stack = root.querySelector('.preloader__stack')
  const imgs = [...root.querySelectorAll('.preloader__img')]
  const num = root.querySelector('.preloader__num')
  const bar = root.querySelector('.preloader__bar span')
  const letters = root.querySelectorAll('.preloader__brand .char')
  const fade = root.querySelectorAll('.preloader__caption, .preloader__count, .preloader__bar')

  const tasks = [
    document.fonts ? document.fonts.ready : Promise.resolve(),
    ...imgs.map(decode),
    ...[...document.querySelectorAll('.hero__img img')].map(decode),
  ]
  let done = 0
  tasks.forEach((p) => p.then(() => done++))

  const MIN_DURATION = 2.6
  const MAX_DURATION = 9
  const start = performance.now()
  let shown = 0

  const intro = gsap.timeline()
  intro.to(letters, { y: 0, duration: 1.3, stagger: 0.06, ease: 'expo.out' }, 0.1)
  imgs.forEach((img, i) => {
    intro.to(img, { clipPath: 'inset(0% 0 0 0)', duration: 0.7, ease: 'power4.inOut' }, 0.25 + i * 0.36)
  })

  return new Promise((resolve) => {
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000
      const real = (done / tasks.length) * 100
      const cap = Math.min(100, (elapsed / MIN_DURATION) * 100)
      const target = elapsed > MAX_DURATION ? 100 : Math.min(cap, real)
      shown += (target - shown) * 0.08
      if (target === 100 && shown > 99.4) shown = 100
      num.textContent = Math.round(shown)
      bar.style.transform = `scaleX(${shown / 100})`
      if (shown === 100 && !intro.isActive()) {
        gsap.ticker.remove(tick)
        leave()
      }
    }
    gsap.ticker.add(tick)

    function leave() {
      const r = stack.getBoundingClientRect()
      const cover = Math.max(window.innerWidth / r.width, window.innerHeight / r.height) * 1.05
      gsap
        .timeline({ onComplete: () => root.remove() })
        .to(letters, { yPercent: -110, duration: 0.9, stagger: 0.04, ease: 'expo.in' }, 0)
        .to(fade, { opacity: 0, duration: 0.5 }, 0)
        .to(stack, { scale: cover, duration: 1.3, ease: 'expo.inOut' }, 0.35)
        .add(resolve, 1.25)
        .to(root, { yPercent: -100, duration: 1.2, ease: 'expo.inOut' }, 1.25)
    }
  })
}
