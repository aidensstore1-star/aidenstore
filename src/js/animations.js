import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]
const vw = () => window.innerWidth
const vh = () => window.innerHeight

const THEMES = {
  ivory: { bg: '#f3ece4', ink: '#2a1f22' },
  blush: { bg: '#efd9d3', ink: '#2a1f22' },
  sage: { bg: '#dfe3d5', ink: '#2a1f22' },
  cocoa: { bg: '#221816', ink: '#f3ece4' },
  night: { bg: '#1c1416', ink: '#f3ece4' },
}

const splitChars = (target) => SplitText.create(target, { type: 'words,chars', charsClass: 'char', wordsClass: 'word' })

// A chapter whose scene lasts `scene()` pixels, then stays pinned for one more
// screen while the next chapter slides up over it. The margin makes room for
// the scene, because the pin adds no spacing of its own.
const stacked = (section, scene) => {
  const setGap = () => (section.style.marginBottom = `${scene()}px`)
  setGap()
  ScrollTrigger.addEventListener('refreshInit', setGap)
  return { end: () => `+=${scene() + vh()}`, pinSpacing: false }
}

export function initAnimations({ scroll, gl }) {
  const small = matchMedia('(max-width: 900px)').matches
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches
  const root = document.documentElement

  // ---------- Images load a little before their chapter arrives ----------
  const warm = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        e.target.querySelectorAll('img[loading="lazy"]').forEach((img) => (img.loading = 'eager'))
        warm.unobserve(e.target)
      }),
    { rootMargin: '150% 0px' },
  )
  $$('.craft, .bride, .ceremony, .celebration, .home, .gallery').forEach((s) => warm.observe(s))

  // ---------- Background colour and chapter follow the scroll ----------
  const metaTheme = $('meta[name="theme-color"]')
  const themed = $$('[data-bg]')
  const chapters = $$('[data-chapter]')
  const indicator = $('.chapter')
  const chapterNum = $('.chapter__num')
  const chapterTitle = $('.chapter__title')
  const chapterBar = $('.chapter__bar i')
  const navLinks = $$('.header__nav a')
  let theme = 'ivory'
  let chapter = null
  gsap.set(root, { '--bg': THEMES.ivory.bg, '--ink': THEMES.ivory.ink })

  const sync = () => {
    const line = vh() * 0.5
    let nextTheme = 'ivory'
    for (const sec of themed) {
      const r = sec.getBoundingClientRect()
      if (r.top <= line && r.bottom >= line) nextTheme = sec.dataset.bg
    }
    if (nextTheme !== theme) {
      theme = nextTheme
      gsap.to(root, { '--bg': THEMES[theme].bg, '--ink': THEMES[theme].ink, duration: 0.9, ease: 'power2.out', overwrite: true })
      metaTheme?.setAttribute('content', THEMES[theme].bg)
    }

    let next = null
    for (const sec of chapters) {
      const r = sec.getBoundingClientRect()
      if (r.top <= line && r.bottom >= line) next = sec
    }
    const first = chapters[0].getBoundingClientRect()
    const last = chapters.at(-1).getBoundingClientRect()
    chapterBar.style.transform = `scaleX(${clamp((line - first.top) / (last.bottom - first.top), 0, 1)})`
    if (next === chapter) return
    chapter = next
    navLinks.forEach((a) => a.classList.toggle('is-active', !!next && a.getAttribute('href') === `#${next.id}`))
    if (!next) {
      gsap.to(indicator, { autoAlpha: 0, y: 20, duration: 0.5, ease: 'power2.in', overwrite: true })
      return
    }
    gsap.to(indicator, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out', overwrite: true })
    chapterNum.textContent = next.dataset.chapter
    chapterTitle.innerHTML = `<span>${next.dataset.chapterTitle}</span>`
    gsap.from(chapterTitle.firstChild, { yPercent: 110, duration: 0.7, ease: 'expo.out' })
  }
  scroll.onScroll(sync)
  ScrollTrigger.addEventListener('refresh', sync)

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
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        }),
    })
  })

  $$('.eyebrow:not(.craft__kicker), .bride__text, .ceremony__text, .ceremony .link, .home__body, .gallery__hint, .cta__text, .cta__buttons').forEach((el) => {
    gsap.from(el, { opacity: 0, y: 30, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true } })
  })

  // ---------- Prologue: the hero, then it bursts apart as you scroll ----------
  const hero = $('.hero')
  const heroItems = $$('.hero__item')
  const heroFigs = heroItems.map((item) => $('.hero__img', item))
  const heroSplit = splitChars('.hero__title')
  gsap.set(heroSplit.chars, { yPercent: 115 })

  if (canHover) {
    const depths = [0.7, 1, 0.55, 1.2, 0.4]
    const movers = heroItems.map((item, i) => ({
      x: gsap.quickTo(item, 'x', { duration: 1.4, ease: 'power3.out' }),
      y: gsap.quickTo(item, 'y', { duration: 1.4, ease: 'power3.out' }),
      d: depths[i],
    }))
    hero.addEventListener('pointermove', (e) => {
      const nx = e.clientX / vw() - 0.5
      const ny = e.clientY / vh() - 0.5
      movers.forEach((m) => {
        m.x(-nx * 60 * m.d)
        m.y(-ny * 40 * m.d)
      })
    })
  }

  const fly = [
    [-1, -0.8],
    [1, -0.9],
    [-1, 1],
    [1, 0.9],
    [0, -1.2],
  ]
  const heroScene = () => vh() * 1.1
  const heroExit = gsap.timeline({
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      ...stacked(hero, heroScene),
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => gl?.setBurst(clamp((self.progress * (heroScene() + vh())) / heroScene(), 0, 1)),
    },
  })
  heroExit
    .to(
      heroSplit.chars,
      {
        x: () => gsap.utils.random(-0.55, 0.55) * vw(),
        y: () => gsap.utils.random(-1, -0.25) * vh(),
        rotation: () => gsap.utils.random(-140, 140),
        opacity: 0,
        ease: 'power2.in',
        stagger: { amount: 0.35, from: 'center' },
      },
      0,
    )
    .fromTo('.hero__sub, .hero__foot', { opacity: 1, y: 0 }, { opacity: 0, y: -80, ease: 'power2.in', immediateRender: false }, 0)
  heroFigs.forEach((fig, i) => {
    heroExit.to(fig, { x: () => fly[i][0] * vw() * 0.6, y: () => fly[i][1] * vh() * 0.7, scale: 1.9, ease: 'power2.in' }, 0)
  })
  // While Chapter I slides up over it, what is left of the hero sinks back.
  heroExit.to('.hero__media', { scale: 0.82, ease: 'none', duration: 1.23 }, 1.35)

  const petals = { intro: 0 }
  if (gl) {
    const cta = $('.cta')
    gl.setPetalOpacity(() => {
      const h = hero.getBoundingClientRect()
      const heroVis = clamp(1 + h.top / (h.height * 0.6), 0, 1) * petals.intro
      const c = cta.getBoundingClientRect()
      const ctaVis = clamp(1.2 - Math.abs(c.top + c.height / 2 - vh() / 2) / (vh() * 0.8), 0, 1)
      return Math.max(heroVis, ctaVis)
    })
  }

  function intro() {
    const tl = gsap.timeline()
    tl.to(heroSplit.chars, { yPercent: 0, duration: 1.6, stagger: 0.035, ease: 'expo.out' }, 0)
    heroFigs.forEach((fig, i) => {
      const media = gl?.get(fig)
      if (media) media.reveal({ delay: 0.25 + i * 0.12, duration: 2 })
      else tl.from(fig.querySelector('img'), { clipPath: 'inset(100% 0 0 0)', scale: 1.3, duration: 1.6, ease: 'expo.out' }, 0.25 + i * 0.12)
    })
    tl.to('.header', { opacity: 1, duration: 1.2, ease: 'power2.out' }, 0.6)
    tl.fromTo('.hero__sub, .hero__foot', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.12, ease: 'expo.out' }, 0.8)
    tl.to(petals, { intro: 1, duration: 2.5, ease: 'power2.out' }, 0.4)
    return tl
  }

  // ---------- Chapter I: the craft, one full-screen scene ----------
  const craft = $('.craft')
  const frames = $$('.craft__frame')
  const frameImgs = frames.map((f) => $('img', f))
  const craftIntro = splitChars('.craft__intro')
  const lines = $$('.craft__line')
  const lineChars = lines.map((l) => splitChars($$('.line', l)).chars)
  const craftIndex = $('.craft__index')
  gsap.set(frames[0], { clipPath: 'inset(34% 32% 34% 32%)' })
  // Later frames wipe in with paired transforms (cheap on phones): the frame
  // slides in while its photo slides the other way, so the photo holds still.
  gsap.set(frames[1], { xPercent: 100 })
  gsap.set(frameImgs[1], { xPercent: -100 })
  gsap.set(frames[2], { yPercent: 100 })
  gsap.set(frameImgs[2], { yPercent: -100 })
  gsap.set(craftIntro.chars, { yPercent: 110 })
  gsap.set(lines, { autoAlpha: 0 })

  const craftTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: craft,
      start: 'top top',
      ...stacked(craft, () => vh() * 4),
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: () => {
        const t = craftTl.time()
        craftIndex.textContent = t < 2.6 ? '01' : t < 3.9 ? '02' : '03'
      },
    },
  })
  craftTl
    // A window in the dark opens to fill the screen.
    .to(frames[0], { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, ease: 'power2.inOut' }, 0)
    .fromTo(frameImgs[0], { scale: 1.7 }, { scale: 1.08, duration: 2.6 }, 0)
    .to(craftIntro.chars, { yPercent: 0, stagger: 0.015, duration: 0.5, ease: 'power3.out' }, 0.25)
    .to(craftIntro.chars, { yPercent: -110, stagger: 0.008, duration: 0.4, ease: 'power3.in' }, 1.3)
    // Beat 1 slides in from the left.
    .fromTo(lines[0], { autoAlpha: 1, x: () => -vw() * 0.7 }, { x: 0, duration: 0.7, ease: 'power3.out' }, 1.7)
    .from(lineChars[0], { yPercent: 110, stagger: 0.012, duration: 0.5, ease: 'power3.out' }, 1.75)
    // Beat 2: the next photo sweeps in from the right; the line hands over sideways.
    .to(frames[1], { xPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 2.6)
    .to(frameImgs[1], { xPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 2.6)
    .fromTo(frameImgs[1], { scale: 1.35 }, { scale: 1.08, duration: 1.6 }, 2.6)
    .to(lines[0], { x: () => vw() * 0.6, autoAlpha: 0, duration: 0.5, ease: 'power3.in' }, 2.6)
    .fromTo(lines[1], { autoAlpha: 1, x: () => -vw() * 0.7 }, { x: 0, duration: 0.7, ease: 'power3.out' }, 3.0)
    .from(lineChars[1], { yPercent: 110, stagger: 0.012, duration: 0.5, ease: 'power3.out' }, 3.05)
    // Beat 3: the last photo rises from below; the line hands over upwards.
    .to(frames[2], { yPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 3.9)
    .to(frameImgs[2], { yPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 3.9)
    .fromTo(frameImgs[2], { scale: 1.35 }, { scale: 1.06, duration: 1.4 }, 3.9)
    .to(lines[1], { y: () => -vh() * 0.35, autoAlpha: 0, duration: 0.5, ease: 'power3.in' }, 3.9)
    .fromTo(lines[2], { autoAlpha: 1, y: () => vh() * 0.35 }, { y: 0, duration: 0.7, ease: 'power3.out' }, 4.3)
    .from(lineChars[2], { yPercent: 110, stagger: 0.012, duration: 0.5, ease: 'power3.out' }, 4.35)
    .to({}, { duration: 0.6 })
    // The next page slides over; the scene recedes into the dark.
    .to('.craft__frames', { scale: 0.86, opacity: 0.35, duration: 1.4 })
    .to('.craft__lines, .craft__count, .craft__kicker', { y: () => -vh() * 0.15, opacity: 0, duration: 0.8 }, '<')

  // ---------- Statement: words light up, photos drift in from the sides ----------
  const statement = SplitText.create('.statement__text', { type: 'words', wordsClass: 'word' })
  gsap.fromTo(
    statement.words,
    { opacity: 0.12 },
    { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '.statement__text', start: 'top 80%', end: 'bottom 45%', scrub: true } },
  )
  $$('.statement__img').forEach((fig, i) => {
    gsap.fromTo(
      fig,
      { yPercent: i ? 40 : 20, x: () => (i ? 1 : -1) * vw() * 0.12 },
      { yPercent: i ? -30 : -15, x: 0, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } },
    )
  })

  // ---------- Marquee: speeds up and leans with scrolling ----------
  const marquee = $('.marquee')
  let marqueeVisible = false
  new IntersectionObserver(([e]) => (marqueeVisible = e.isIntersecting)).observe(marquee)
  const rows = $$('.marquee__inner').map((el, i) => ({ el, x: 0, dir: i % 2 ? 1 : -1, w: 0 }))
  const measureRows = () => rows.forEach((r) => (r.w = r.el.scrollWidth / 3))
  measureRows()
  ScrollTrigger.addEventListener('refresh', measureRows)
  let skew = 0
  let direction = 1
  gsap.ticker.add(
    () => {
      if (!marqueeVisible) return
      const v = scroll.velocity()
      if (Math.abs(v) > 0.5) direction = Math.sign(v)
      skew += (clamp(v * 0.35, -10, 10) - skew) * 0.1
      for (const row of rows) {
        row.x += row.dir * direction * (0.8 + Math.min(Math.abs(v), 60) * 0.35)
        if (row.x <= -row.w) row.x += row.w
        if (row.x > 0) row.x -= row.w
        row.el.style.transform = `translate3d(${row.x}px,0,0) skewX(${-skew}deg)`
      }
    },
    false,
    true,
  )

  // ---------- Chapter II: the bride, sideways ----------
  const bride = $('.bride')
  const brideTrack = $('.bride__track')
  const brideWord = $('.bride__word')
  const brideBar = $('.bride__progress i')
  const brideDist = () => Math.max(0, brideTrack.scrollWidth - vw())
  const brideScroll = gsap.to(brideTrack, {
    x: () => -brideDist(),
    ease: 'none',
    scrollTrigger: {
      trigger: bride,
      start: 'top top',
      end: () => `+=${brideDist()}`,
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => (brideBar.style.transform = `scaleX(${self.progress})`),
    },
  })
  // The giant word drifts the same way, slower, like a layer further back.
  gsap.fromTo(
    brideWord,
    { x: () => vw() * 0.35 },
    {
      x: () => -brideDist() * 0.45,
      ease: 'none',
      scrollTrigger: { trigger: bride, start: 'top top', end: () => `+=${brideDist()}`, scrub: 1.2, invalidateOnRefresh: true },
    },
  )
  $$('.bride__card').forEach((card, i) => {
    const dir = i % 2 ? 1 : -1
    // Each card bobs up or down as it crosses the screen, and grows as it arrives.
    gsap.fromTo(
      card,
      { y: dir * (small ? 50 : 90) },
      { y: -dir * (small ? 50 : 90), ease: 'none', scrollTrigger: { trigger: card, containerAnimation: brideScroll, start: 'left right', end: 'right left', scrub: true } },
    )
    gsap.fromTo(
      $('.bride__media', card),
      { scale: 0.72 },
      { scale: 1, ease: 'power2.out', scrollTrigger: { trigger: card, containerAnimation: brideScroll, start: 'left right', end: 'center 60%', scrub: true } },
    )
    gsap.from($('.bride__cap', card), {
      x: 80,
      opacity: 0,
      ease: 'power2.out',
      scrollTrigger: { trigger: card, containerAnimation: brideScroll, start: 'left 85%', end: 'left 45%', scrub: true },
    })
  })
  gsap.from('.bride__end', {
    x: () => vw() * 0.3,
    opacity: 0,
    ease: 'power2.out',
    scrollTrigger: { trigger: '.bride__end', containerAnimation: brideScroll, start: 'left right', end: 'left 50%', scrub: true },
  })

  // ---------- Chapter III: the ceremony, columns travel in opposite directions ----------
  const ceremony = $('.ceremony')
  const cols = $$('.ceremony__col')
  const card = $('.ceremony__card')
  const travel = (col) => Math.max(0, col.offsetHeight - vh() * 0.9)
  gsap.set(card, { x: 0, y: 0, xPercent: -50, yPercent: -50 })
  const ceremonyTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: ceremony,
      start: 'top top',
      ...stacked(ceremony, () => vh() * 1.9),
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  })
  cols.forEach((col, i) => {
    const up = i !== 1
    ceremonyTl.fromTo(
      col,
      { y: () => (up ? vh() * 0.1 : -travel(col)) },
      { y: () => (up ? -travel(col) * (i === 2 ? 0.8 : 1) : vh() * 0.1), duration: 1 },
      0,
    )
  })
  ceremonyTl
    .fromTo(card, { scale: 0.6, autoAlpha: 0, rotation: -4 }, { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.22, ease: 'power3.out' }, 0.08)
    // Towards the end the outer columns part sideways to frame the card.
    .to(cols[0], { x: () => -vw() * (small ? 0.18 : 0.08), duration: 0.3, ease: 'power2.inOut' }, 0.65)
    .to(cols[2], { x: () => vw() * (small ? 0.18 : 0.08), duration: 0.3, ease: 'power2.inOut' }, 0.65)
    .to(card, { scale: 1.06, duration: 0.3, ease: 'power2.inOut' }, 0.65)
    // The celebration slides over; the ceremony recedes.
    .to('.ceremony__cols', { scale: 0.88, opacity: 0.4, duration: 0.53 }, 1)
    .to(card, { scale: 0.9, opacity: 0.4, duration: 0.53 }, 1)

  // ---------- Chapter IV: the celebration, a ring of cakes turns as you scroll ----------
  const celebration = $('.celebration')
  const ring = $('.ring')
  const spin = $('.ring__spin')
  const cakes = $$('.ring__card')
  const n = cakes.length
  const setRadius = () => {
    const r = (spin.offsetWidth / 2 / Math.tan(Math.PI / n)) * 1.12
    ring.style.setProperty('--radius', `${r}px`)
  }
  setRadius()
  ScrollTrigger.addEventListener('refreshInit', setRadius)
  const shade = () => {
    const rot = gsap.getProperty(spin, 'rotationY')
    cakes.forEach((c, i) => {
      const a = ((i * 360) / n + rot) * (Math.PI / 180)
      c.style.opacity = (0.2 + 0.8 * Math.max(0, Math.cos(a)) ** 1.5).toFixed(3)
    })
  }
  const celebrationTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: celebration,
      start: 'top top',
      ...stacked(celebration, () => vh() * 2.8),
      pin: true,
      scrub: 1,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: shade,
    },
  })
  celebrationTl
    .fromTo(ring, { scale: 0.55, y: () => vh() * 0.2 }, { scale: 1, y: 0, duration: 0.18, ease: 'power3.out' }, 0)
    .fromTo(spin, { rotationY: 50, rotationX: -18 }, { rotationY: (-360 * (n - 1)) / n, rotationX: -5, duration: 1 }, 0)
    .fromTo('.celebration__word', { x: () => vw() * 0.4 }, { x: () => -$('.celebration__word').scrollWidth + vw() * 0.3, duration: 1 }, 0)
    .from('.celebration__tags li', { y: 30, opacity: 0, stagger: 0.015, duration: 0.08, ease: 'back.out(2)' }, 0.1)
    // The home slides over; the cakes recede.
    .to('.ring, .celebration__head, .celebration__foot', { scale: 0.9, opacity: 0.35, duration: 0.36 }, 1)
  shade()

  // ---------- Chapter V: the home, columns drift against each other ----------
  gsap.fromTo('.home__col--a', { yPercent: 12 }, { yPercent: -16, ease: 'none', scrollTrigger: { trigger: '.home', start: 'top bottom', end: 'bottom top', scrub: true } })
  gsap.fromTo('.home__col--b', { yPercent: -10 }, { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.home', start: 'top bottom', end: 'bottom top', scrub: true } })
  $$('.home__img').forEach((fig) => {
    const left = !!fig.closest('.home__col--a')
    gsap.fromTo(
      fig,
      { x: (left ? -1 : 1) * (small ? 60 : 160), rotation: left ? -7 : 7, scale: 0.8, opacity: 0 },
      {
        x: 0,
        rotation: 0,
        scale: 1,
        opacity: 1,
        ease: 'power2.out',
        scrollTrigger: { trigger: fig, start: 'top bottom', end: 'top 55%', scrub: 0.6 },
      },
    )
  })

  // ---------- Gallery rises in ----------
  gsap.from('.gallery__viewport', {
    yPercent: 18,
    opacity: 0,
    duration: 1.6,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.gallery__viewport', start: 'top 92%', once: true },
  })

  // ---------- How it works: steps slide in from alternate sides ----------
  $$('.step').forEach((step, i) => {
    gsap.fromTo(step, { '--progress': 0 }, { '--progress': 1, ease: 'none', scrollTrigger: { trigger: step, start: 'top 90%', end: 'top 55%', scrub: true } })
    gsap.fromTo(
      step,
      { x: () => (i % 2 ? 1 : -1) * vw() * (small ? 0.25 : 0.12), opacity: 0 },
      { x: 0, opacity: 1, ease: 'power2.out', scrollTrigger: { trigger: step, start: 'top bottom', end: 'top 60%', scrub: 0.6 } },
    )
  })

  // ---------- Epilogue: lines glide in from both sides, letters rise ----------
  const ctaSplit = splitChars('.cta__title')
  gsap.set(ctaSplit.chars, { yPercent: 115 })
  gsap.to(ctaSplit.chars, {
    yPercent: 0,
    duration: 1.5,
    stagger: 0.03,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.cta__title', start: 'top 80%', once: true },
  })
  $$('.cta__title .line').forEach((line, i) => {
    gsap.fromTo(
      line,
      { xPercent: (i % 2 ? 1 : -1) * 25 },
      { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'center center', scrub: true } },
    )
  })

  // ---------- Footer wordmark rises letter by letter ----------
  gsap.fromTo(
    '.footer__brand .char',
    { yPercent: 100 },
    { yPercent: 0, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top 90%', end: 'bottom bottom', scrub: true } },
  )

  // ---------- Photos when WebGL is not drawing them ----------
  $$('.media').forEach((fig) => {
    if (gl?.get(fig) || fig.classList.contains('hero__img') || fig.closest('.ceremony, .home')) return
    gsap.from(fig.querySelector('img'), {
      clipPath: 'inset(100% 0 0 0)',
      scale: 1.25,
      duration: 1.6,
      ease: 'expo.out',
      scrollTrigger: { trigger: fig, start: 'top 90%', once: true },
    })
  })

  sync()
  return { intro }
}
