import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
const $ = (s, root = document) => root.querySelector(s)
const $$ = (s, root = document) => [...root.querySelectorAll(s)]
const vw = () => window.innerWidth
const vh = () => window.innerHeight

// Background of each section, for the browser's address-bar colour.
const SURFACES = { ivory: '#f3ece4', blush: '#efd9d3', sage: '#dfe3d5', cocoa: '#221816', night: '#1c1416' }

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

  // ---------- Images load a little before their chapter arrives ----------
  const warm = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return
        // Skip images in layouts hidden at this screen size.
        e.target.querySelectorAll('img[loading="lazy"]').forEach((img) => img.getClientRects().length && (img.loading = 'eager'))
        warm.unobserve(e.target)
      }),
    { rootMargin: '150% 0px' },
  )
  $$('.craft, .bride, .ceremony, .celebration, .home, .gallery').forEach((s) => warm.observe(s))

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

  // Each photo flies straight out from the centre of the screen, far enough to
  // leave it whatever the screen size.
  const flyOut = (item, axis) => {
    const cx = item.offsetLeft + item.offsetWidth / 2 - vw() / 2
    const cy = item.offsetTop + item.offsetHeight / 2 - vh() / 2
    const len = Math.hypot(cx, cy) || 1
    const dist = Math.hypot(vw(), vh()) * 0.8
    return ((axis === 'x' ? cx : cy) / len) * dist
  }
  // A short hold, then Chapter I rises over the opening while it is still
  // bursting apart, so there is never an empty screen between them.
  const heroScene = () => vh() * 0.35
  const heroExit = gsap.timeline({
    defaults: { ease: 'power2.in' },
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      ...stacked(hero, heroScene),
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        // Petals blow outwards and fade with the burst; once they have gone,
        // reset them so they can drift again in the epilogue.
        const burst = clamp((self.progress * (heroScene() + vh())) / heroScene(), 0, 1)
        petals.hero = 1 - burst
        gl?.setBurst(burst >= 1 ? 0 : burst)
      },
    },
  })
  heroExit
    .to(
      heroSplit.chars,
      {
        x: () => gsap.utils.random(-0.55, 0.55) * vw(),
        y: () => gsap.utils.random(-1, -0.3) * vh(),
        rotation: () => gsap.utils.random(-140, 140),
        opacity: 0,
        duration: 0.75,
        stagger: { amount: 0.2, from: 'center' },
      },
      0,
    )
    .fromTo('.hero__sub, .hero__foot', { opacity: 1, y: 0 }, { opacity: 0, y: -80, duration: 0.3, immediateRender: false }, 0)
  heroItems.forEach((item, i) => {
    heroExit.to(heroFigs[i], { x: () => flyOut(item, 'x'), y: () => flyOut(item, 'y'), scale: 1.9, rotation: (i % 2 ? 1 : -1) * 12, duration: 1 }, 0)
  })
  heroExit.to('.hero__media', { scale: 0.85, duration: 1, ease: 'none' }, 0)

  // Petals show in the opening and the epilogue. Driven by scroll progress, so
  // no layout reads are needed each frame.
  const petals = { intro: 0, hero: 1, cta: 0 }
  gl?.setPetalOpacity(() => Math.max(petals.hero * petals.intro, petals.cta))

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
  // Start a little beyond the edge so the gold edge's glow stays out of view.
  gsap.set(frames[1], { xPercent: 108 })
  gsap.set(frameImgs[1], { xPercent: -108 })
  gsap.set(frames[2], { yPercent: 108 })
  gsap.set(frameImgs[2], { yPercent: -108 })
  // Letters travel well past their line's mask so no slivers show.
  gsap.set(craftIntro.chars, { yPercent: 140 })
  gsap.set(lines, { autoAlpha: 0 })

  const craftTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: craft,
      start: 'top top',
      ...stacked(craft, () => vh() * 3.2),
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
    .to(craftIntro.chars, { yPercent: -140, opacity: 0, stagger: 0.008, duration: 0.4, ease: 'power3.in' }, 1.3)
    // Beat 1 slides in from the left.
    .fromTo(lines[0], { autoAlpha: 1, x: () => -vw() * 0.7 }, { x: 0, duration: 0.7, ease: 'power3.out' }, 1.7)
    .from(lineChars[0], { yPercent: 140, stagger: 0.012, duration: 0.5, ease: 'power3.out' }, 1.75)
    // A gold wire draws one petal beside the words, then a stem.
    .to('.craft__wire path', { strokeDashoffset: 0, duration: 0.7, stagger: 0.35, ease: 'power1.inOut' }, 1.75)
    .fromTo('.craft__wire', { rotation: -25, scale: 0.85 }, { rotation: 8, scale: 1, duration: 1.2 }, 1.7)
    // Beat 2: the next photo sweeps in from the right; the line hands over sideways.
    .to('.craft__wire', { x: () => vw() * 0.5, opacity: 0, duration: 0.5, ease: 'power3.in' }, 2.6)
    .to(frames[1], { xPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 2.6)
    .to(frameImgs[1], { xPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 2.6)
    .fromTo(frameImgs[1], { scale: 1.35 }, { scale: 1.08, duration: 1.6 }, 2.6)
    .to(lines[0], { x: () => vw() * 0.6, autoAlpha: 0, duration: 0.5, ease: 'power3.in' }, 2.6)
    .fromTo(lines[1], { autoAlpha: 1, x: () => -vw() * 0.7 }, { x: 0, duration: 0.7, ease: 'power3.out' }, 3.0)
    .from(lineChars[1], { yPercent: 140, stagger: 0.012, duration: 0.5, ease: 'power3.out' }, 3.05)
    // Beat 3: the last photo rises from below; the line hands over upwards.
    .to(frames[2], { yPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 3.9)
    .to(frameImgs[2], { yPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 3.9)
    .fromTo(frameImgs[2], { scale: 1.35 }, { scale: 1.06, duration: 1.4 }, 3.9)
    .to(lines[1], { y: () => -vh() * 0.35, autoAlpha: 0, duration: 0.5, ease: 'power3.in' }, 3.9)
    .fromTo(lines[2], { autoAlpha: 1, y: () => vh() * 0.35 }, { y: 0, duration: 0.7, ease: 'power3.out' }, 4.3)
    .from(lineChars[2], { yPercent: 140, stagger: 0.012, duration: 0.5, ease: 'power3.out' }, 4.35)
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
  // Pinned for the sideways journey, then for one more screen while the
  // ceremony slides up over it (the pin and the track have separate triggers
  // because the track also drives the cards' own triggers).
  const bridePin = $('.bride__pin')
  ScrollTrigger.create({
    trigger: bride,
    start: 'top top',
    ...stacked(bride, brideDist),
    pin: true,
    anticipatePin: 1,
    invalidateOnRefresh: true,
    // Once the cards have passed, the chapter sinks back as the ceremony covers it.
    onUpdate: (self) => {
      const over = clamp((self.progress * (brideDist() + vh()) - brideDist()) / vh(), 0, 1)
      gsap.set(bridePin, { scale: 1 - 0.12 * over, opacity: 1 - 0.6 * over })
    },
  })
  const brideScroll = gsap.to(brideTrack, {
    x: () => -brideDist(),
    ease: 'none',
    scrollTrigger: {
      trigger: bride,
      start: 'top top',
      end: () => `+=${brideDist()}`,
      scrub: 0.8,
      invalidateOnRefresh: true,
      onUpdate: (self) => (brideBar.style.transform = `scaleX(${self.progress})`),
    },
  })
  $$('.bride__card').forEach((card, i) => {
    const dir = i % 2 ? 1 : -1
    // Each card bobs up or down as it crosses the screen, and grows as it arrives.
    // ...and turns in 3D as it passes, facing you in the middle of the screen.
    gsap.fromTo(
      card,
      { y: dir * (small ? 50 : 90), rotationY: -32, transformPerspective: 900 },
      { y: -dir * (small ? 50 : 90), rotationY: 32, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: brideScroll, start: 'left right', end: 'right left', scrub: true } },
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
  // Then they part like curtains to reveal one photo full-screen behind the card.
  const ceremony = $('.ceremony')
  const cols = $$(`.ceremony__cols--${small ? 'narrow' : 'wide'} .ceremony__col`)
  const card = $('.ceremony__card')
  const finale = $('.ceremony__finale')
  const travel = (col) => Math.max(vh() * 0.25, col.offsetHeight - vh() * 0.9)
  gsap.set(card, { x: 0, y: 0, xPercent: -50, yPercent: -50 })
  const ceremonyTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: ceremony,
      start: 'top top',
      ...stacked(ceremony, () => vh() * 2.2),
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  })
  cols.forEach((col, i) => {
    const up = i % 2 === 0
    ceremonyTl.fromTo(col, { y: () => (up ? vh() * 0.1 : -travel(col)) }, { y: () => (up ? -travel(col) : vh() * 0.1), duration: 0.8 }, 0)
  })
  const last = cols.length - 1
  ceremonyTl
    .fromTo(card, { scale: 0.6, autoAlpha: 0, rotation: -4 }, { scale: 1, autoAlpha: 1, rotation: 0, duration: 0.2, ease: 'power3.out' }, 0.06)
    // The curtains part: outer columns slide off to the sides, the middle one sinks away.
    .to(cols[0], { x: () => -vw() * 0.8, duration: 0.3, ease: 'power2.in' }, 0.58)
    .to(cols[last], { x: () => vw() * 0.8, duration: 0.3, ease: 'power2.in' }, 0.58)
  if (cols.length > 2) ceremonyTl.to(cols[1], { yPercent: 30, opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.58)
  ceremonyTl
    .fromTo(finale, { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1.04, duration: 0.42, ease: 'power2.out' }, 0.62)
    .to(card, { scale: 0.92, duration: 0.3, ease: 'power2.inOut' }, 0.62)
    .to({}, { duration: 0.1 })
    // The celebration slides over; the ceremony recedes.
    .to(finale, { scale: 0.9, opacity: 0.5, duration: 0.45 }, 1)
    .to(card, { scale: 0.8, opacity: 0.4, duration: 0.45 }, 1)

  // ---------- Chapter IV: the celebration, a ring of cakes turns as you scroll ----------
  const celebration = $('.celebration')
  const ring = $('.ring')
  const spin = $('.ring__spin')
  const cakes = $$('.ring__card')
  const n = cakes.length
  gsap.set('.celebration__word', { yPercent: -50 })
  const setRadius = () => {
    const r = (spin.offsetWidth / 2 / Math.tan(Math.PI / n)) * 1.3
    ring.style.setProperty('--radius', `${r}px`)
  }
  setRadius()
  ScrollTrigger.addEventListener('refreshInit', setRadius)
  // Cakes turning towards you brighten and grow; the caption below names
  // whichever one faces you.
  const nowNum = $('.ring__now-num')
  const nowTitle = $('.ring__now-title')
  let front = -1
  const shade = () => {
    const rot = gsap.getProperty(spin, 'rotationY')
    let best = 0
    let bestFace = -1
    cakes.forEach((c, i) => {
      const face = Math.max(0, Math.cos(((i * 360) / n + rot) * (Math.PI / 180)))
      c.style.opacity = (0.2 + 0.8 * face ** 1.5).toFixed(3)
      c.style.setProperty('--face', face.toFixed(3))
      if (face > bestFace) {
        bestFace = face
        best = i
      }
    })
    if (best === front) return
    const dir = best > front ? 1 : -1
    front = best
    nowNum.textContent = `${String(best + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`
    nowTitle.textContent = cakes[best].dataset.title
    gsap.fromTo(nowTitle, { yPercent: 100 * dir, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: 'expo.out', overwrite: true })
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

  // ---------- Chapter V: the home, a wall of pieces pulls back ----------
  // It opens on one wreath filling the screen, pulls back to show the whole
  // wall of nine, then the wall steps aside for the words. Each cell moves on
  // its own (as if the wall were one picture being scaled) so phones never
  // have to paint one huge layer.
  const home = $('.home')
  const wall = $('.home__wall')
  const cells = $$('.home__cell')
  const homeText = $('.home__text')
  const geo = () => {
    const W = wall.offsetWidth
    const H = wall.offsetHeight
    const centre = cells[4]
    const fill = Math.max(W / centre.offsetWidth, H / centre.offsetHeight) * 1.02
    let s2, cx2, cy2
    if (small) {
      const top = homeText.offsetTop + homeText.offsetHeight + 16
      const bottom = 76
      s2 = Math.min(0.72, (H - top - bottom) / H)
      cx2 = W / 2
      cy2 = top + (s2 * H) / 2
    } else {
      const left = homeText.offsetLeft + homeText.offsetWidth + 32
      // The text starts at the page gutter; keep the same margin on the right.
      const gutter = homeText.offsetLeft
      s2 = Math.min(0.62, (W - left - gutter) / W)
      cx2 = W - gutter - (s2 * W) / 2
      cy2 = H / 2
    }
    return { W, H, fill, s2, cx2, cy2 }
  }
  let g = geo()
  ScrollTrigger.addEventListener('refreshInit', () => (g = geo()))
  const at = (cell, scale, cx, cy) => {
    const px = cell.offsetLeft + cell.offsetWidth / 2
    const py = cell.offsetTop + cell.offsetHeight / 2
    return { x: cx - g.W / 2 + (scale - 1) * (px - g.W / 2), y: cy - g.H / 2 + (scale - 1) * (py - g.H / 2), scale }
  }
  gsap.set(homeText, { autoAlpha: 0 })
  const homeTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: home,
      start: 'top top',
      ...stacked(home, () => vh() * 2.4),
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  })
  cells.forEach((cell, i) => {
    const d = Math.abs((i % 3) - 1) + Math.abs(Math.floor(i / 3) - 1)
    homeTl.fromTo(
      cell,
      { x: () => at(cell, g.fill, g.W / 2, g.H / 2).x, y: () => at(cell, g.fill, g.W / 2, g.H / 2).y, scale: () => g.fill, rotation: 0 },
      // Outer pieces settle a moment later and with a slight swing, like
      // frames being hung.
      { x: 0, y: 0, scale: 1, rotation: d ? (i % 2 ? 2 : -2) : 0, duration: 0.5 + d * 0.06, ease: 'power2.inOut' },
      0,
    )
    homeTl.to(
      cell,
      { x: () => at(cell, g.s2, g.cx2, g.cy2).x, y: () => at(cell, g.s2, g.cx2, g.cy2).y, scale: () => g.s2, rotation: 0, duration: 0.35, ease: 'power3.inOut' },
      0.68 + d * 0.03,
    )
  })
  homeTl
    .fromTo(homeText, { autoAlpha: 0, x: () => (small ? 0 : -80), y: () => (small ? -30 : 0) }, { autoAlpha: 1, x: 0, y: 0, duration: 0.3, ease: 'power3.out' }, 0.82)
    .to({}, { duration: 0.15 })
    // The gallery slides over; the wall recedes.
    .to('.home__pin', { scale: 0.9, opacity: 0.4, duration: 0.45 })

  // ---------- Gallery rises in ----------
  gsap.from('.gallery__viewport', {
    yPercent: 18,
    opacity: 0,
    duration: 1.6,
    ease: 'expo.out',
    scrollTrigger: { trigger: '.gallery__viewport', start: 'top 92%', once: true },
  })

  // ---------- How it works: pinned, three steps pass sideways ----------
  const process = $('.process')
  const steps = $$('.step')
  const stepList = $('.process__list')
  const stepIndex = $('.process__index')
  // Measured from the steps themselves; the numbers' offsets would inflate scrollWidth.
  const stepDist = () => Math.max(0, steps.length * steps[0].offsetWidth - vw())
  const processScroll = gsap.to(stepList, {
    x: () => -stepDist(),
    ease: 'none',
    scrollTrigger: {
      trigger: process,
      start: 'top top',
      end: () => `+=${stepDist() * 1.2}`,
      pin: true,
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => (stepIndex.textContent = String(Math.min(steps.length, Math.round(self.progress * (steps.length - 1)) + 1)).padStart(2, '0')),
    },
  })
  steps.forEach((step) => {
    const media = $('.step__media', step)
    const body = $('.step__body', step)
    // Each step's photo opens from a sliver as it arrives, then drifts; its
    // number travels faster than the page, and the words follow.
    gsap.fromTo(
      media,
      { clipPath: 'inset(0% 0% 0% 100%)' },
      { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power2.out', scrollTrigger: { trigger: step, containerAnimation: processScroll, start: 'left 95%', end: 'left 25%', scrub: true } },
    )
    gsap.fromTo(
      $('img', media),
      { scale: 1.3, xPercent: 10 },
      { scale: 1, xPercent: -6, ease: 'none', scrollTrigger: { trigger: step, containerAnimation: processScroll, start: 'left right', end: 'right left', scrub: true } },
    )
    gsap.fromTo(
      $('.step__num', step),
      { x: () => vw() * 0.35 },
      { x: () => -vw() * 0.15, ease: 'none', scrollTrigger: { trigger: step, containerAnimation: processScroll, start: 'left right', end: 'right left', scrub: true } },
    )
    gsap.fromTo(body, { '--progress': 0 }, { '--progress': 1, ease: 'none', scrollTrigger: { trigger: step, containerAnimation: processScroll, start: 'left 70%', end: 'left 10%', scrub: true } })
    gsap.from([$('.step__title', step), $('.step__text', step)], {
      x: 120,
      opacity: 0,
      stagger: 0.1,
      ease: 'power2.out',
      scrollTrigger: { trigger: step, containerAnimation: processScroll, start: 'left 80%', end: 'left 20%', scrub: true },
    })
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

  // Epilogue: the finished flower draws itself in gold wire, petal by petal.
  const flower = $('.cta__flower')
  gsap
    .timeline({ scrollTrigger: { trigger: '.cta', start: 'top 75%', end: 'center 45%', scrub: 0.8 } })
    .to($$('.stem, .leaf', flower), { strokeDashoffset: 0, duration: 0.5, stagger: 0.15, ease: 'none' }, 0)
    .to($$('.cta__flower-head > g:first-of-type .petal', flower), { strokeDashoffset: 0, duration: 0.5, stagger: 0.12, ease: 'none' }, 0.2)
    .to($$('.petal--inner', flower), { strokeDashoffset: 0, duration: 0.4, stagger: 0.08, ease: 'none' }, 0.6)
    .from($$('.pearl', flower), { scale: 0, transformOrigin: '50% 50%', duration: 0.25, stagger: 0.03, ease: 'back.out(3)' }, 0.95)
  gsap.fromTo(
    $('.cta__flower-head', flower),
    { rotation: -40, svgOrigin: '0 -40' },
    { rotation: 20, svgOrigin: '0 -40', ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } },
  )

  // ---------- The story tracker ----------
  // Where every section starts in the page, measured once per refresh. The
  // pinned chapters add no spacing, so these positions hold while scrolling,
  // and one scroll listener can work out the section, the chapter, the flower
  // petals and the gold wire edges without measuring anything.
  const root = document.documentElement
  const metaTheme = $('meta[name="theme-color"]')
  const indicator = $('.chapter')
  const chapterNum = $('.chapter__num')
  const chapterTitle = $('.chapter__title')
  const navLinks = $$('.header__nav a')
  const pillPetals = $$('.chapter__flower .petal')
  const surfaces = $$('[data-bg]').map((el) => ({ el, top: 0 }))
  const chapters = surfaces.filter((s) => s.el.dataset.chapter)
  const galleryMark = surfaces.find((s) => s.el.id === 'gallery')
  const cta = { el: $('.cta'), top: 0, h: 1 }
  // A gold wire draws along the top of each chapter as it rises over the last.
  const edges = $$('.craft, .statement, .ceremony, .celebration, .home, .gallery').map((el) => {
    const line = document.createElement('span')
    line.className = 'wire-edge'
    line.setAttribute('aria-hidden', 'true')
    el.prepend(line)
    return { el, line, top: 0, p: -1 }
  })
  const docTop = (el) => {
    const box = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el
    return box.getBoundingClientRect().top + window.scrollY
  }
  const measure = () => {
    for (const s of [...surfaces, ...edges]) s.top = docTop(s.el)
    cta.top = docTop(cta.el)
    cta.h = cta.el.offsetHeight
  }

  let current = null
  const enter = (sec) => {
    if (sec === current) return
    current = sec
    root.dataset.surface = sec.dataset.bg
    metaTheme?.setAttribute('content', SURFACES[sec.dataset.bg])
    const chapter = sec.dataset.chapter ? sec : null
    navLinks.forEach((a) => a.classList.toggle('is-active', !!chapter && a.getAttribute('href') === `#${chapter.id}`))
    if (!chapter) {
      gsap.to(indicator, { autoAlpha: 0, y: 20, duration: 0.5, ease: 'power2.in', overwrite: true })
      return
    }
    gsap.to(indicator, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out', overwrite: true })
    chapterNum.textContent = chapter.dataset.chapter
    chapterTitle.innerHTML = `<span>${chapter.dataset.chapterTitle}</span>`
    gsap.from(chapterTitle.firstChild, { yPercent: 110, duration: 0.7, ease: 'expo.out' })
  }

  const track = () => {
    const y = window.scrollY
    const h = vh()
    let active = surfaces[0]
    for (const s of surfaces) if (s.top <= y + h * 0.5) active = s
    enter(active.el)
    chapters.forEach((c, i) => {
      const end = (chapters[i + 1] || galleryMark).top
      const p = clamp((y + h * 0.4 - c.top) / (end - c.top), 0, 1)
      pillPetals[i].style.strokeDashoffset = (1.05 * (1 - p)).toFixed(3)
    })
    for (const e of edges) {
      const p = clamp((y + h - e.top) / h, 0, 1)
      if (Math.abs(p - e.p) < 0.002) continue
      e.p = p
      e.line.style.transform = `scaleX(${p.toFixed(4)})`
      e.line.style.opacity = (1 - clamp((p - 0.82) / 0.18, 0, 1)).toFixed(3)
    }
    const c = (y + h - cta.top) / (h + cta.h)
    petals.cta = c <= 0 || c >= 1 ? 0 : clamp(1.4 - Math.abs(c - 0.5) * 3, 0, 1)
  }
  ScrollTrigger.addEventListener('refresh', () => {
    measure()
    track()
  })
  scroll.onScroll(track)

  // ---------- Footer wordmark rises letter by letter ----------
  gsap.fromTo(
    '.footer__brand .char',
    { yPercent: 100 },
    { yPercent: 0, stagger: 0.05, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top 90%', end: 'bottom bottom', scrub: true } },
  )

  // ---------- Photos when WebGL is not drawing them ----------
  $$('.media').forEach((fig) => {
    if (gl?.get(fig) || fig.classList.contains('hero__img') || fig.closest('.bride, .ceremony, .home, .process')) return
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
