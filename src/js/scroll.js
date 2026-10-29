import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

// Smooth scrolling. Touch scrolling is driven by Lenis too (syncTouch), so the
// WebGL photos stay locked to the page on phones as well.
export function createScroll({ reduced }) {
  if (reduced) {
    return {
      lenis: null,
      velocity: () => 0,
      stop() {},
      start() {},
      scrollTo(target) {
        const el = typeof target === 'string' ? document.querySelector(target) : target
        if (el?.scrollIntoView) el.scrollIntoView()
        else window.scrollTo(0, Number(target) || 0)
      },
      onScroll(fn) {
        window.addEventListener('scroll', fn, { passive: true })
      },
    }
  }

  const lenis = new Lenis({
    lerp: 0.085,
    syncTouch: true,
    syncTouchLerp: 0.085,
    touchInertiaExponent: 1.6,
    anchors: { offset: 0 },
  })

  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)

  return {
    lenis,
    velocity: () => lenis.velocity || 0,
    stop: () => lenis.stop(),
    start: () => lenis.start(),
    scrollTo: (target, opts) => lenis.scrollTo(target, { duration: 1.6, ...opts }),
    onScroll: (fn) => lenis.on('scroll', fn),
  }
}
