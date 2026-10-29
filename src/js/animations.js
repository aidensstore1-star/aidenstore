import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]

const THEMES = {
  ivory: { bg: '#f3ece4', ink: '#2a1f22' },
  blush: { bg: '#efd9d3', ink: '#2a1f22' },
  cocoa: { bg: '#221816', ink: '#f3ece4' },
}

export function initAnimations({ scroll, gl }) {
  const isDesktop = matchMedia('(min-width: 901px)').matches
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches

  // ---------- Background colour follows the section in view ----------
  const root = document.documentElement
  const metaTheme = document.querySelector('meta[name="theme-color"]')
  const themed = $$('[data-bg]')
  let theme = 'ivory'
  gsap.set(root, { '--bg': THEMES.ivory.bg, '--ink': THEMES.ivory.ink })
  const syncTheme = () => {
    const line = window.innerHeight * 0.55
    let next = 'ivory'
    for (const sec of themed) {
      const r = sec.getBoundingClientRect()
      if (r.top <= line && r.bottom >= line) next = sec.dataset.bg
    }
    if (next === theme) return
    theme = next
    gsap.to(root, { '--bg': THEMES[next].bg, '--ink': THEMES[next].ink, duration: 0.9, ease: 'power2.out', overwrite: true })
    metaTheme?.setAttribute('content', THEMES[next].bg)
  }
  scroll.onScroll(syncTheme)
  syncTheme()

  // ---------- Hero ----------
  const hero = $('.hero')
  const heroImgs = $$('.hero__img')
  const heroSplit = SplitText.create('.hero__title', { type: 'words,chars', charsClass: 'char', wordsClass: 'word' })
  const depths = [0.7, 1, 0.55, 1.2, 0.4]

  heroImgs.forEach((fig, i) => {
    gsap.to(fig, {
      yPercent: -40 * depths[i],
      ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    })
  })
  gsap.to('.hero__title', {
    yPercent: 35,
    ease: 'none',
    scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
  })

  if (canHover) {
    const movers = heroImgs.map((fig, i) => ({
      x: gsap.quickTo(fig, 'x', { duration: 1.4, ease: 'power3.out' }),
      y: gsap.quickTo(fig, 'y', { duration: 1.4, ease: 'power3.out' }),
      d: depths[i],
    }))
    hero.addEventListener('pointermove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5
      const ny = e.clientY / window.innerHeight - 0.5
      movers.forEach((m) => {
        m.x(-nx * 60 * m.d)
        m.y(-ny * 40 * m.d)
      })
    })
  }

  const petals = { intro: 0 }
  if (gl) {
    const cta = $('.cta')
    gl.setPetalOpacity(() => {
      const h = hero.getBoundingClientRect()
      const heroVis = clamp(1 + h.top / (h.height * 0.75), 0, 1) * petals.intro
      const c = cta.getBoundingClientRect()
      const ctaVis = clamp(1.2 - Math.abs(c.top + c.height / 2 - window.innerHeight / 2) / (window.innerHeight * 0.8), 0, 1)
      return Math.max(heroVis, ctaVis)
    })
  }

  function intro() {
    const tl = gsap.timeline()
    tl.to(heroSplit.chars, { y: 0, duration: 1.6, stagger: 0.035, ease: 'expo.out' }, 0)
    heroImgs.forEach((fig, i) => {
      const media = gl?.get(fig)
      if (media) media.reveal({ delay: 0.25 + i * 0.12, duration: 2 })
      else tl.from(fig.querySelector('img'), { clipPath: 'inset(100% 0 0 0)', scale: 1.3, duration: 1.6, ease: 'expo.out' }, 0.25 + i * 0.12)
    })
    tl.to('.header', { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0.6)
    tl.fromTo('.hero__sub, .hero__foot', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out' }, 0.8)
    tl.to(petals, { intro: 1, duration: 2.5, ease: 'power2.out' }, 0.4)
    return tl
  }

  // ---------- Big titles rise line by line ----------
  $$('.title-xl').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 110,
          duration: 1.4,
          stagger: 0.1,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        }),
    })
  })

  // ---------- Small text fades up ----------
  $$('.eyebrow, .communion__text, .cakes__text, .gallery__hint, .cta__text, .cta__buttons, .collections__progress, .communion .link').forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 30,
      duration: 1.2,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    })
  })

  // ---------- Marquee: speeds up and leans with scrolling ----------
  const marquee = $('.marquee')
  let marqueeVisible = false
  new IntersectionObserver(([e]) => (marqueeVisible = e.isIntersecting)).observe(marquee)
  const rows = $$('.marquee__inner').map((el, i) => ({ el, x: 0, dir: i % 2 ? 1 : -1 }))
  let skew = 0
  let direction = 1
  gsap.ticker.add(
    () => {
      if (!marqueeVisible) return
      const v = scroll.velocity()
      if (Math.abs(v) > 0.5) direction = Math.sign(v)
      skew += (clamp(v * 0.35, -10, 10) - skew) * 0.1
      for (const row of rows) {
        const w = row.el.scrollWidth / 3
        row.x += row.dir * direction * (0.8 + Math.abs(v) * 0.35)
        if (row.x <= -w) row.x += w
        if (row.x > 0) row.x -= w
        row.el.style.transform = `translate3d(${row.x}px,0,0) skewX(${-skew}deg)`
      }
    },
    false,
    true,
  )

  // ---------- Statement: words light up as you read ----------
  const statement = SplitText.create('.statement__text', { type: 'words', wordsClass: 'word' })
  gsap.fromTo(
    statement.words,
    { opacity: 0.14 },
    {
      opacity: 1,
      stagger: 0.08,
      ease: 'none',
      scrollTrigger: { trigger: '.statement__text', start: 'top 80%', end: 'bottom 45%', scrub: true },
    },
  )
  $$('.statement__img').forEach((fig, i) => {
    gsap.fromTo(
      fig,
      { yPercent: i ? 30 : 15 },
      {
        yPercent: i ? -30 : -15,
        ease: 'none',
        scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true },
      },
    )
  })

  // ---------- Collections: pinned, scrolls sideways ----------
  const track = $('.collections__track')
  const progressBar = $('.collections__bar i')
  const indexLabel = $('.collections__index')
  const panels = $$('.panel')
  const distance = () => Math.max(0, track.scrollWidth - window.innerWidth)
  const horizontal = gsap.to(track, {
    x: () => -distance(),
    ease: 'none',
    scrollTrigger: {
      trigger: '.collections',
      start: 'top top',
      end: () => `+=${distance()}`,
      pin: true,
      scrub: 0.8,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        progressBar.style.transform = `scaleX(${self.progress})`
        const i = clamp(Math.round(self.progress * (panels.length - 1)), 0, panels.length - 1)
        indexLabel.textContent = String(i + 1).padStart(2, '0')
      },
    },
  })
  panels.forEach((panel) => {
    const info = $('.panel__info', panel)
    gsap.from(info.children, {
      x: isDesktop ? 120 : 60,
      opacity: 0,
      stagger: 0.08,
      ease: 'power2.out',
      scrollTrigger: { trigger: panel, containerAnimation: horizontal, start: 'left 95%', end: 'left 45%', scrub: true },
    })
  })

  // ---------- Occasions ----------
  gsap.from('.occasion', {
    opacity: 0,
    y: 50,
    duration: 1.2,
    stagger: 0.1,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.occasions__list', start: 'top 85%', once: true },
  })

  // ---------- Communion: columns drift at different speeds ----------
  gsap.fromTo('.communion__col--1', { yPercent: 6 }, { yPercent: -8, ease: 'none', scrollTrigger: { trigger: '.communion', start: 'top bottom', end: 'bottom top', scrub: true } })
  gsap.fromTo('.communion__col--2', { yPercent: 2 }, { yPercent: -22, ease: 'none', scrollTrigger: { trigger: '.communion', start: 'top bottom', end: 'bottom top', scrub: true } })

  // ---------- Cakes ----------
  const cakesSplit = SplitText.create('.cakes__title', { type: 'words,chars', charsClass: 'char', wordsClass: 'word' })
  gsap.to(cakesSplit.chars, {
    y: 0,
    duration: 1.4,
    stagger: 0.03,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.cakes__title', start: 'top 80%', once: true },
  })
  gsap.from('.cakes__tags li', {
    opacity: 0,
    y: 20,
    scale: 0.9,
    duration: 0.9,
    stagger: 0.06,
    ease: 'back.out(2)',
    scrollTrigger: { trigger: '.cakes__tags', start: 'top 90%', once: true },
  })

  const cards = $$('.cake-card')
  cards.forEach((card, i) => {
    const inner = $('.cake-card__inner', card)
    const img = $('.cake-card__media img', card)
    gsap.from(img, {
      scale: 1.3,
      clipPath: 'inset(100% 0 0 0)',
      duration: 1.6,
      ease: 'expo.out',
      scrollTrigger: { trigger: card, start: 'top 80%', once: true },
    })
    const next = cards[i + 1]
    if (!next) return
    gsap.to(inner, {
      scale: 0.9,
      filter: 'brightness(0.45)',
      ease: 'none',
      scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true },
    })
  })

  // ---------- Process: lines draw across ----------
  $$('.step').forEach((step, i) => {
    gsap.fromTo(
      step,
      { '--progress': 0 },
      { '--progress': 1, ease: 'none', scrollTrigger: { trigger: step, start: 'top 90%', end: 'top 55%', scrub: true } },
    )
    gsap.from(step.children, {
      opacity: 0,
      y: 40,
      duration: 1.2,
      stagger: 0.08,
      delay: isDesktop ? i * 0.12 : 0,
      ease: 'expo.out',
      scrollTrigger: { trigger: step, start: 'top 85%', once: true },
    })
  })

  // ---------- Call to action ----------
  const ctaSplit = SplitText.create('.cta__title', { type: 'words,chars', charsClass: 'char', wordsClass: 'word' })
  gsap.to(ctaSplit.chars, {
    y: 0,
    duration: 1.5,
    stagger: 0.03,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.cta__title', start: 'top 80%', once: true },
  })

  // ---------- Footer wordmark rises letter by letter ----------
  gsap.fromTo(
    '.footer__brand .char',
    { yPercent: 100 },
    {
      yPercent: 0,
      stagger: 0.05,
      ease: 'none',
      scrollTrigger: { trigger: '.footer', start: 'top 90%', end: 'bottom bottom', scrub: true },
    },
  )

  // ---------- Photos when WebGL is not drawing them ----------
  $$('.media').forEach((fig) => {
    if (gl?.get(fig) || fig.classList.contains('hero__img') || fig.closest('.cake-card')) return
    gsap.from(fig.querySelector('img'), {
      clipPath: 'inset(100% 0 0 0)',
      scale: 1.25,
      duration: 1.6,
      ease: 'expo.out',
      scrollTrigger: { trigger: fig, start: 'top 90%', once: true },
    })
  })

  return { intro }
}
