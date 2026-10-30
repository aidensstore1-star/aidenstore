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

// ---------- Chapter entrance shapes ----------
// Each chapter rises through a window shaped from its own world, outlined in
// gold wire. Each returns an SVG path in the section's pixels for progress p
// (0: just entering at the bottom, 1: filling the screen).
const f = (n) => n.toFixed(1)
const SHAPES = {
  // Chapter I: a chapel arch that widens and squares off.
  arch(p, W, H) {
    const q = 1 - p
    const side = 0.3 * q ** 1.3 * W
    const r = ((W - 2 * side) / 2) * q ** 0.7
    return `M${f(side)},${f(H)} L${f(side)},${f(r)} A${f(r)},${f(r)} 0 0 1 ${f(side + r)},0 L${f(W - side - r)},0 A${f(r)},${f(r)} 0 0 1 ${f(W - side)},${f(r)} L${f(W - side)},${f(H)} Z`
  },
  // The ceremony: a pointed gothic window, like the church it happens in.
  lancet(p, W, H) {
    const q = 1 - p
    const side = 0.28 * q ** 1.2 * W
    const half = (W - 2 * side) / 2
    const rise = half * 1.5 * q ** 0.8
    const R = Math.hypot(half, rise) * 0.72
    return `M${f(side)},${f(H)} L${f(side)},${f(rise)} A${f(R)},${f(R)} 0 0 1 ${f(W / 2)},0 A${f(R)},${f(R)} 0 0 1 ${f(W - side)},${f(rise)} L${f(W - side)},${f(H)} Z`
  },
  // The celebration: a round cake plate opening like an iris.
  iris(p, W, H) {
    const R = Math.hypot(W / 2, H / 2) * 1.04 * p ** 1.15
    const cx = W / 2
    const cy = 0.5 * p * H
    return `M${f(cx - R)},${f(cy)} a${f(R)},${f(R)} 0 1 0 ${f(2 * R)},0 a${f(R)},${f(R)} 0 1 0 ${f(-2 * R)},0 Z`
  },
}
SHAPES.hoop = SHAPES.iris
// The bride: an oval dressing-table mirror, taller than it is wide.
SHAPES.mirror = (p, W, H) => {
  const k = 1.35
  const rx = Math.hypot(W / 2, H / (2 * k)) * 1.04 * p ** 1.15
  const cy = 0.5 * p * H
  return `M${f(W / 2 - rx)},${f(cy)} a${f(rx)},${f(rx * k)} 0 1 0 ${f(2 * rx)},0 a${f(rx)},${f(rx * k)} 0 1 0 ${f(-2 * rx)},0 Z`
}

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
  $$('.craft, .sign, .bride, .ceremony, .celebration, .home, .gallery').forEach((s) => warm.observe(s))

  // Mouse and trackpad users click rather than tap.
  if (canHover) $('.gallery__hint').textContent = 'Drag to explore. Click a piece to see it up close.'

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

  $$('.eyebrow:not(.craft__kicker), .process__count, .bride__text, .ceremony__text, .ceremony .link, .home__body, .gallery__hint, .cta__text, .cta__buttons').forEach((el) => {
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

  let floats = []
  if (!canHover) {
    // Touch screens: the photos float gently, and a tap ripples the photo
    // under the finger.
    floats = heroItems.map((item, i) =>
      gsap.to(item, { y: i % 2 ? 10 : -10, rotation: i % 2 ? 1.5 : -1.5, duration: 2.6 + i * 0.35, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
    )
    hero.addEventListener('pointerdown', (e) => {
      for (const fig of heroFigs) {
        const r = fig.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) gl?.get(fig)?.pulse(e.clientX, e.clientY)
      }
    })
  }

  // Each photo first drifts outwards, then sweeps down into the arched window
  // of Chapter I as it rises, as if the pieces were gathered into the story.
  const centre = (item) => ({ x: item.offsetLeft + item.offsetWidth / 2, y: item.offsetTop + item.offsetHeight / 2 })
  const outward = (item, axis) => {
    const c = centre(item)
    const dx = c.x - vw() / 2
    const dy = c.y - vh() / 2
    const len = Math.hypot(dx, dy) || 1
    return ((axis === 'x' ? dx : dy) / len) * Math.min(vw(), vh()) * 0.12
  }
  const gather = (item, axis) => (axis === 'x' ? vw() / 2 - centre(item).x : vh() * 0.84 - centre(item).y)
  // A short hold, then Chapter I rises over the opening while it is still
  // bursting apart, so there is never an empty screen between them.
  const heroScene = () => vh() * 0.2
  const heroExit = gsap.timeline({
    defaults: { ease: 'power1.in' },
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
        // They keep drifting through the whole hand-over, thinning out as
        // Chapter I's arch rises.
        const burst = self.progress
        petals.hero = 1 - burst ** 2
        gl?.setBurst(burst >= 1 ? 0 : burst * 0.6)
        // The idle float only runs while the opening is at rest.
        floats.forEach((t) => (self.progress > 0.01 ? t.pause() : t.play()))
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
        // Letters drift up and away over the whole hand-over, fading late,
        // so the screen above the rising arch never sits empty.
        opacity: 0,
        duration: 0.85,
        ease: 'power1.in',
        stagger: { amount: 0.12, from: 'center' },
      },
      0,
    )
    .fromTo('.hero__sub, .hero__foot', { opacity: 1, y: 0 }, { opacity: 0, y: -80, duration: 0.3, immediateRender: false }, 0)
  heroItems.forEach((item, i) => {
    heroExit
      .to(heroFigs[i], { x: () => outward(item, 'x'), y: () => outward(item, 'y'), scale: 1.12, rotation: (i % 2 ? 1 : -1) * 7, duration: 0.15, ease: 'power1.out' }, 0)
      .to(heroFigs[i], { x: () => gather(item, 'x'), y: () => gather(item, 'y'), scale: 0.3, rotation: 0, duration: 0.45, ease: 'power1.inOut' }, 0.15 + i * 0.025)
  })
  heroExit.to({}, { duration: 1 }, 0)

  // Petals show in the opening and the epilogue. Driven by scroll progress, so
  // no layout reads are needed each frame.
  const petals = { intro: 0, hero: 1, cta: 0 }
  gl?.setPetalOpacity(() => Math.max(petals.hero * petals.intro, petals.cta))

  // Once the opening has played, quietly load and decode every remaining
  // photo, one at a time, so later chapters never arrive empty or stutter
  // while a photo decodes.
  const preloadAll = () => {
    const queue = $$('img[loading="lazy"]').filter((img) => img.getClientRects().length)
    // Nearest chapters first, three at a time.
    queue.sort((a, b) => Math.abs(a.getBoundingClientRect().top) - Math.abs(b.getBoundingClientRect().top))
    const next = () => {
      const img = queue.shift()
      if (!img) return
      img.loading = 'eager'
      ;(img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(() => setTimeout(next, 30))
    }
    next()
    next()
    next()
  }

  function intro() {
    const tl = gsap.timeline({ onComplete: preloadAll })
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
  // Later frames wipe in with paired transforms (cheap on phones): the frame
  // slides in while its photo slides the other way, so the photo holds still.
  // Start a little beyond the edge so the gold edge's glow stays out of view.
  gsap.set(frames[1], { xPercent: 108 })
  gsap.set(frameImgs[1], { xPercent: -108 })
  gsap.set(frames[2], { yPercent: 108 })
  gsap.set(frameImgs[2], { yPercent: -108 })
  // Letters travel well past their line's mask so no slivers show.
  // The opening words are already in place, revealed by the widening arch.
  gsap.set(lines, { autoAlpha: 0 })

  const craftTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: craft,
      start: 'top top',
      ...stacked(craft, () => vh() * 2.6),
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
    // (The chapter's arched window has already opened onto this photo as it rose.)
    // Phone photos are only lightly enlarged, so they stay sharp.
    .fromTo(frameImgs[0], { scale: small ? 1.15 : 1.5, xPercent: 0 }, { scale: small ? 1.02 : 1.08, xPercent: small ? -3 : 0, duration: 2.6 }, 0)
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
    .fromTo(frameImgs[1], { scale: small ? 1.12 : 1.3 }, { scale: small ? 1.02 : 1.08, duration: 1.6 }, 2.6)
    .to(lines[0], { x: () => vw() * 0.6, autoAlpha: 0, duration: 0.5, ease: 'power3.in' }, 2.6)
    .fromTo(lines[1], { autoAlpha: 1, x: () => -vw() * 0.7 }, { x: 0, duration: 0.7, ease: 'power3.out' }, 3.0)
    .from(lineChars[1], { yPercent: 140, stagger: 0.012, duration: 0.5, ease: 'power3.out' }, 3.05)
    // Beat 3: the last photo rises from below; the line hands over upwards.
    .to(frames[2], { yPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 3.9)
    .to(frameImgs[2], { yPercent: 0, duration: 0.9, ease: 'power3.inOut' }, 3.9)
    .fromTo(frameImgs[2], { scale: small ? 1.12 : 1.3 }, { scale: small ? 1.02 : 1.06, duration: 1.4 }, 3.9)
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
  gsap.to('.statement__wire path', {
    strokeDashoffset: 0,
    ease: 'none',
    scrollTrigger: { trigger: '.statement__text', start: 'top 70%', end: 'bottom 35%', scrub: true },
  })
  $$('.statement__img').forEach((fig, i) => {
    gsap.fromTo(
      fig,
      { yPercent: i ? 18 : 10, x: () => (i ? 1 : -1) * vw() * 0.05 },
      { yPercent: i ? -18 : -10, x: 0, ease: 'none', scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true } },
    )
  })

  // ---------- The two houses: a pair of doors opening ----------
  $$('.house').forEach((house, i) => {
    const side = i ? 1 : -1
    const door = $('.house__media', house)
    // Desktop: the two arched doors swing open from the middle like a pair of
    // shop doors; phones: each slides in from its own side as it arrives.
    gsap.fromTo(
      door,
      { rotationY: side * (small ? 28 : 42), x: () => -side * (small ? -vw() * 0.35 : vw() * 0.1), transformPerspective: 1200, transformOrigin: i ? '100% 50%' : '0% 50%' },
      { rotationY: 0, x: 0, ease: 'power2.out', scrollTrigger: { trigger: house, start: 'top bottom', end: small ? 'top 35%' : 'top 25%', scrub: 0.8 } },
    )
    const name = splitChars($('.house__name', house))
    gsap.from(name.chars, {
      yPercent: 110,
      opacity: 0,
      stagger: 0.03,
      duration: 1.2,
      ease: 'expo.out',
      scrollTrigger: { trigger: $('.house__name', house), start: 'top 88%', once: true },
    })
    gsap.from([$('.house__num', house), $('.house__line', house), ...$$('.house__sections li', house)], {
      y: 24,
      opacity: 0,
      stagger: 0.06,
      duration: 1,
      ease: 'expo.out',
      scrollTrigger: { trigger: $('.house__info', house), start: 'top 90%', once: true },
    })
  })
  $$('.house-tag').forEach((tag) =>
    gsap.from(tag, { scale: 0.6, opacity: 0, duration: 0.9, ease: 'back.out(2)', scrollTrigger: { trigger: tag, start: 'top 92%', once: true } }),
  )

  // ---------- Section signs: walking into each section of the shop ----------
  // As a section arrives, its name slides past in both directions and its
  // pieces swing in from the sides while the sign is lowered on its chains.
  // The sign swings and settles, its name rises letter by letter, and it stays
  // pinned while the section's first chapter rises over it.
  $$('.sign').forEach((sign) => {
    const board = $('.sign__board', sign)
    const [wordA, wordB] = $$('.sign__word', sign)
    const pics = $$('.sign__media', sign)
    const name = splitChars($('.sign__name', sign))
    // The pinned scene, in screens.
    const S = small ? 1.5 : 1.3
    ScrollTrigger.create({ trigger: sign, start: 'top top', ...stacked(sign, () => vh() * S), pin: true, anticipatePin: 1, invalidateOnRefresh: true })
    // The sign swings from the top of its chains.
    const pivot = () => gsap.set(board, { transformOrigin: `50% ${-board.offsetTop}px` })
    pivot()
    ScrollTrigger.addEventListener('refreshInit', pivot)
    // From the moment the sign enters the screen until the next chapter has
    // covered it: one screen arriving, the scene, one screen leaving.
    const T = 2 + S
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: sign, start: 'top bottom', end: () => `+=${vh() * T}`, scrub: 0.8, invalidateOnRefresh: true },
    })
    const slide = (el) => Math.max(0, el.scrollWidth - vw()) * 0.8
    tl.fromTo(wordA, { x: () => vw() * 0.15 }, { x: () => -slide(wordA), duration: T }, 0)
      .fromTo(wordB, { x: () => -slide(wordB) }, { x: () => vw() * 0.15, duration: T }, 0)
      .fromTo(board, { y: () => -(board.offsetTop + board.offsetHeight + 60) }, { y: 0, duration: 1.15, ease: 'power2.out' }, 0.05)
    const swing = [9, -6, 3.5, -1.6, 0]
    for (let k = 1; k < swing.length; k++) {
      tl.fromTo(board, { rotation: swing[k - 1] }, { rotation: swing[k], duration: 0.32, ease: 'sine.inOut', immediateRender: k === 1 }, 0.1 + (k - 1) * 0.32)
    }
    const from = [
      { x: -0.6, y: 0.2, r: -16 },
      { x: 0.6, y: -0.1, r: 14 },
      { x: 0.3, y: 0.7, r: 10 },
    ]
    pics.forEach((pic, i) => {
      const settled = 1.2 + i * 0.2
      tl.fromTo(
        pic,
        { x: () => vw() * from[i].x, y: () => vh() * from[i].y, rotation: from[i].r },
        { x: 0, y: 0, rotation: [-4, 3, -2][i], duration: settled - (0.1 + i * 0.08), ease: 'power3.out' },
        0.1 + i * 0.08,
      ).to(pic, { y: () => -vh() * (0.06 + i * 0.03), duration: 1 + S - settled }, settled)
    })
    tl.from(name.chars, { yPercent: 120, rotationX: -80, opacity: 0, transformPerspective: 600, stagger: 0.035, duration: 0.45, ease: 'back.out(1.7)' }, 0.85)
      .from([$('.sign__num', sign), $('.sign__line', sign)], { y: 24, opacity: 0, stagger: 0.1, duration: 0.4, ease: 'power2.out' }, 1.05)
      .from($$('.sign__aisles li', sign), { x: (i) => (i % 2 ? 60 : -60), opacity: 0, stagger: 0.08, duration: 0.45, ease: 'power2.out' }, 1.2)
      // The first chapter rises over it; the sign sinks back into the dark.
      .to(board, { scale: 0.9, duration: 1 }, 1 + S)
      .to($('.sign__scrim', sign), { opacity: 0.55, duration: 1 }, 1 + S)
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
  // Measured from layout (the last card's edge plus the gutter): the cards'
  // 3D turns would inflate scrollWidth.
  const brideCards = $$('.bride__card')
  const brideLastCard = brideCards[brideCards.length - 1]
  const brideGutter = () => parseFloat(getComputedStyle(brideTrack).paddingLeft) || 0
  let brideLen = 0
  const measureBride = () => (brideLen = Math.max(0, brideLastCard.offsetLeft + brideLastCard.offsetWidth + brideGutter() - vw()))
  measureBride()
  ScrollTrigger.addEventListener('refreshInit', measureBride)
  const brideDist = () => brideLen
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
      if (over === bridePin._over) return
      bridePin._over = over
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
  // The giant word drifts the same way, slower, like a layer further back;
  // it starts off to the right so it never sits behind the opening words.
  gsap.set(brideWord, { yPercent: -50 })
  gsap.fromTo(
    brideWord,
    { x: () => vw() * (small ? 0.15 : 0.95) },
    {
      x: () => -brideDist() * 0.45,
      ease: 'none',
      scrollTrigger: { trigger: bride, start: 'top top', end: () => `+=${brideDist()}`, scrub: 1.2, invalidateOnRefresh: true },
    },
  )
  $$('.bride__card').forEach((card, i) => {
    const dir = i % 2 ? 1 : -1
    // Each card bobs up or down as it crosses the screen, and grows as it arrives.
    // ...and turns in 3D as it passes, facing you in the middle of the screen.
    const passing = { trigger: card, containerAnimation: brideScroll, start: 'left right', end: 'right left', scrub: true }
    gsap.fromTo(card, { y: dir * (small ? 50 : 90) }, { y: -dir * (small ? 50 : 90), ease: 'none', scrollTrigger: passing })
    gsap.fromTo($('.bride__media', card), { rotationY: -22, transformPerspective: 900 }, { rotationY: 22, ease: 'none', scrollTrigger: passing })
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

  // ---------- Chapter III: the ceremony, columns travel in opposite directions ----------
  // Then they part like curtains to reveal one photo full-screen behind the card.
  const ceremony = $('.ceremony')
  const cols = $$(`.ceremony__cols--${small ? 'narrow' : 'wide'} .ceremony__col`)
  const card = $('.ceremony__card')
  const finale = $('.ceremony__finale')
  const travel = (col) => Math.max(vh() * 0.25, col.offsetHeight - vh() * 0.9)
  // Centred on wide screens; a sheet along the bottom on phones.
  gsap.set(card, { x: 0, y: 0, xPercent: -50, yPercent: small ? 0 : -50 })
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
    // The columns run on their own first, then the card arrives.
    .fromTo(card, { y: () => vh() * 0.6, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.22, ease: 'power3.out' }, 0.5)
    // The curtains part: outer columns slide off to the sides, the middle one sinks away.
    .to(cols[0], { x: () => -vw() * 0.8, duration: 0.3, ease: 'power2.in' }, 0.58)
    .to(cols[last], { x: () => vw() * 0.8, duration: 0.3, ease: 'power2.in' }, 0.58)
  if (cols.length > 2) ceremonyTl.to(cols[1], { yPercent: 30, opacity: 0, duration: 0.3, ease: 'power2.in' }, 0.58)
  ceremonyTl
    .fromTo(finale, { opacity: 0, scale: 1.3 }, { opacity: 1, scale: 1.04, duration: 0.42, ease: 'power2.out' }, 0.62)
    .to(card, { scale: 0.92, duration: 0.3, ease: 'power2.inOut' }, 0.62)
    .to({}, { duration: 0.1 })
    // The décor slides over; the ceremony recedes.
    .to(finale, { scale: 0.9, opacity: 0.5, duration: 0.45 }, 1)
    .to(card, { scale: 0.8, opacity: 0.4, duration: 0.45 }, 1)

  // ---------- Chapter IV: the celebration, a ring of cakes turns as you scroll ----------
  const celebration = $('.celebration')
  const ring = $('.ring')
  const spin = $('.ring__spin')
  const cakes = $$('.ring__card')
  const n = cakes.length
  gsap.set('.celebration__word', { yPercent: -50 })
  const turn = $('.ring__turn')
  // Sizes the ring so the cake in front, enlarged by perspective, always
  // fits above the caption.
  const setRadius = () => {
    ring.style.removeProperty('--card-w')
    const k = (0.5 / Math.tan(Math.PI / n)) * (small ? 1.12 : 1.3)
    const style = getComputedStyle(ring)
    const P = parseFloat(style.perspective) || 2000
    const H = ring.clientHeight
    // The viewpoint sits above centre, which also pushes the front cake down.
    const originY = (parseFloat(style.perspectiveOrigin.split(' ')[1]) || H / 2) / H
    const fits = (w) => {
      const m = (P / (P - k * w)) * 1.02
      return ((4 / 3) * w * m) / 2 + (0.5 - originY) * H * (m - 1) <= H * 0.47
    }
    let w = turn.offsetWidth
    while (w > 80 && !fits(w)) w -= 4
    ring.style.setProperty('--card-w', `${w}px`)
    ring.style.setProperty('--radius', `${k * w}px`)
  }
  setRadius()
  ScrollTrigger.addEventListener('refreshInit', setRadius)
  // Cakes turning towards you brighten and grow; the caption below names
  // whichever one faces you.
  // Extra turn while the arch rises (set by the story tracker below).
  let preTurn = 0
  const setPreTurn = (deg) => {
    preTurn = deg
    gsap.set(turn, { rotationY: deg })
    shade()
  }
  const nowNum = $('.ring__now-num')
  const nowTitle = $('.ring__now-title')
  let front = -1
  const shade = () => {
    const rot = gsap.getProperty(spin, 'rotationY') + preTurn
    let best = 0
    let bestFace = -1
    cakes.forEach((c, i) => {
      const face = Math.max(0, Math.cos(((i * 360) / n + rot) * (Math.PI / 180)))
      const key = Math.round(face * 200)
      if (key !== c._face) {
        c._face = key
        c.style.opacity = (0.2 + 0.8 * face ** 1.5).toFixed(3)
        c.style.setProperty('--face', face.toFixed(3))
      }
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
    },
    // Follows the smoothed playhead, so the caption always names the cake in front.
    onUpdate: shade,
  })
  celebrationTl
    // Starts with the first cake in front, so the count opens at 01.
    .fromTo(spin, { rotationY: 10, rotationX: () => (small ? -10 : -6) }, { rotationY: (-360 * (n - 1)) / n, rotationX: () => (small ? -10 : -6), duration: 1 }, 0)
    .fromTo('.celebration__word', { x: () => vw() * 0.4 }, { x: () => -$('.celebration__word').scrollWidth + vw() * 0.3, duration: 1 }, 0)
    // The gallery slides over; the cakes recede.
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
    // The middle piece first fills the whole screen.
    const fill = Math.max(vw() / centre.offsetWidth, vh() / centre.offsetHeight) * 1.02
    let s2, cx2, cy2
    if (small) {
      // Phones: the wall settles under the words, nearly full width, its
      // pieces in portrait cells so each one is recognisable.
      const top = homeText.offsetTop + homeText.offsetHeight + 14
      const bottom = 76
      const gutter = homeText.offsetLeft
      s2 = Math.min((W - gutter * 2) / W, (vh() - top - bottom) / H)
      cx2 = W / 2
      cy2 = top - wall.offsetTop + (s2 * H) / 2
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
      { x: () => at(cell, g.s2, g.cx2, g.cy2).x, y: () => at(cell, g.s2, g.cx2, g.cy2).y, scale: () => g.s2, rotation: 0, duration: 0.28, ease: 'power3.inOut' },
      0.62 + d * 0.03,
    )
  })
  homeTl
    .fromTo(homeText, { autoAlpha: 0, x: () => (small ? 0 : -80), y: () => (small ? -30 : 0) }, { autoAlpha: 1, x: 0, y: 0, duration: 0.25, ease: 'power3.out' }, 0.8)
    .to({}, { duration: 0.08 })
    // The cakes sign slides over; the wall recedes.
    .to('.home__pin', { scale: 0.9, opacity: 0.4, duration: 0.45 })


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
      end: () => `+=${stepDist() * (small ? 1.3 : 0.85)}`,
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
    // Each step's photo is wiped in as it arrives (the frame slides one way,
    // the photo the other, so only transforms change), then drifts; its
    // number travels faster than the page, and the words follow.
    const photo = $('img', media)
    const wipe = { trigger: step, containerAnimation: processScroll, start: 'left 95%', end: 'left 25%', scrub: true }
    gsap.fromTo(media, { x: () => media.offsetWidth }, { x: 0, ease: 'power2.out', scrollTrigger: wipe })
    gsap.fromTo(photo, { x: () => -media.offsetWidth }, { x: 0, ease: 'power2.out', scrollTrigger: wipe })
    gsap.fromTo(
      photo,
      { scale: 1.3, xPercent: 8 },
      { scale: 1.12, xPercent: -4, ease: 'none', scrollTrigger: { trigger: step, containerAnimation: processScroll, start: 'left right', end: 'right left', scrub: true } },
    )
    if (!small) gsap.fromTo(
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
    scrollTrigger: { trigger: '.cta__title', start: 'top 92%', once: true },
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
    .timeline({ scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'top 30%', scrub: 0.8 } })
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
  // Each chapter rises over the last through an arched window, like a chapel
  // window, that widens until it fills the screen.
  // Labels near the top of a chapter wait until its arch is nearly open, so
  // the arch never cuts through their words.
  const archGated = { craft: '.craft__kicker, .craft__count', celebration: '.celebration__head, .ring__now' }
  // While the arch rises, the chapter inside settles into place like a camera
  // coming to rest, so a hand-over never shows a still frame.
  // (Not the bride: its track's own transform is animated.)
  const riseTargets = { craft: '.craft__pin', ceremony: '.ceremony__pin', celebration: '.celebration__pin', home: '.home__wall' }
  const shapeOf = { craft: 'arch', bride: 'mirror', ceremony: 'lancet', celebration: 'iris', home: 'hoop' }
  const svgNS = 'http://www.w3.org/2000/svg'
  const arches = $$('.craft, .bride, .ceremony, .celebration, .home').map((el) => {
    const shape = shapeOf[el.id]
    // The gold wire tracing the window's edge, drawn as it opens.
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('class', `window-wire window-wire--${shape}`)
    svg.setAttribute('aria-hidden', 'true')
    const wire = document.createElementNS(svgNS, 'path')
    wire.setAttribute('pathLength', '1')
    svg.append(wire)
    let clasp = null
    if (shape === 'hoop') {
      // The brass screw clasp at the top of an embroidery hoop.
      clasp = document.createElementNS(svgNS, 'rect')
      clasp.setAttribute('class', 'window-wire__clasp')
      clasp.setAttribute('width', '14')
      clasp.setAttribute('height', '22')
      clasp.setAttribute('rx', '3')
      svg.append(clasp)
    }
    el.append(svg)
    return { el, top: 0, p: -1, shape, svg, wire, clasp, gated: $$(archGated[el.id] || '_none_', el), rise: riseTargets[el.id] ? $(riseTargets[el.id], el) : null }
  })
  // Between chapters, and as each section's sign arrives, a gold wire draws
  // along the top edge instead.
  const edges = $$('.statement, .sign, .gallery').map((el) => {
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
  // The cake plate opens around the ring: while it rises, the ring sits at
  // the plate's centre, so cakes show through it from the start.
  const ringMid = () => {
    let y = ring.offsetHeight / 2
    for (let el = ring; el && el !== celebration; el = el.offsetParent) y += el.offsetTop
    return y
  }
  const measure = () => {
    for (const a of arches) {
      a.h = a.el.offsetHeight || vh()
      if (a.el === celebration) a.centre = ringMid()
    }
    for (const s of [...surfaces, ...edges, ...arches]) s.top = docTop(s.el)
    cta.top = docTop(cta.el)
    cta.h = cta.el.offsetHeight
  }

  // The header takes the colours of whatever is under it, and the chapter
  // pill of whatever is under it at the bottom, so each switches exactly as
  // a new section passes it.
  const under = (line) => {
    let found = surfaces[0]
    for (const s of surfaces) if (s.top <= line) found = s
    return found.el.dataset.bg
  }
  let current = null
  const enter = (sec) => {
    if (sec === current) return
    current = sec
    const chapter = sec.dataset.chapter ? sec : null
    navLinks.forEach((a) => a.classList.toggle('is-active', !!sec.id && (a.dataset.chapters || '').split(' ').includes(sec.id)))
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
    const top = under(y + 30)
    if (root.dataset.surface !== top) {
      root.dataset.surface = top
      metaTheme?.setAttribute('content', SURFACES[top])
    }
    const low = under(y + h - 50)
    if (root.dataset.surfaceLow !== low) root.dataset.surfaceLow = low
    // The chapter pill (and the active menu link) follow the section under
    // the bottom of the screen, where the pill sits.
    let active = surfaces[0]
    for (const s of surfaces) if (s.top <= y + h * 0.55) active = s
    enter(active.el)
    chapters.forEach((c, i) => {
      const end = (chapters[i + 1] || galleryMark).top
      const p = clamp((y + h * 0.4 - c.top) / (end - c.top), 0, 1)
      if (Math.abs(p - (c.p ?? -1)) < 0.004) return
      c.p = p
      pillPetals[i].style.strokeDashoffset = (1.05 * (1 - p)).toFixed(3)
    })
    for (const a of arches) {
      const p = clamp((y + h - a.top) / h, 0, 1)
      if (Math.abs(p - a.p) < 0.002) continue
      a.p = p
      for (const g of a.gated) g.style.opacity = p >= 1 ? '' : clamp((p - 0.9) / 0.1, 0, 1).toFixed(3)
      const q = 1 - p
      const W = vw()
      const H = a.h
      if (a.rise) {
        const rising = p > 0 && p < 1
        // Its own GPU layer only while it moves, so it isn't repainted each frame.
        a.rise.style.willChange = rising ? 'transform' : ''
        const shift = a.centre ? `${(q * (0.5 * p * H - a.centre)).toFixed(1)}px` : `${(-7 * q).toFixed(2)}vh`
        a.rise.style.transform = rising ? `translate3d(0, ${shift}, 0) scale(${(1 + 0.12 * q).toFixed(4)})` : ''
      }
      if (a.el.id === 'celebration') setPreTurn(p <= 0 ? 70 : 70 * q)
      if (p >= 1 || p <= 0) {
        a.el.style.clipPath = p <= 0 ? 'inset(0 50% 0 50%)' : ''
        a.svg.style.opacity = '0'
        continue
      }
      const d = SHAPES[a.shape](p, W, H)
      a.el.style.clipPath = `path('${d}')`
      a.wire.setAttribute('d', d)
      // The wire draws itself around the window as it begins to open, then
      // fades as the window fills the screen.
      a.wire.style.strokeDashoffset = (1.02 * (1 - clamp(p / 0.45, 0, 1))).toFixed(3)
      a.svg.style.opacity = (1 - clamp((p - 0.75) / 0.25, 0, 1)).toFixed(3)
      if (a.clasp) {
        const R = Math.hypot(W / 2, H / 2) * 1.04 * p ** 1.15
        a.clasp.setAttribute('x', f(W / 2 - 7))
        a.clasp.setAttribute('y', f(0.5 * p * H - R - 11))
      }
    }
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
    if (gl?.get(fig) || fig.classList.contains('hero__img') || fig.closest('.sign, .bride, .ceremony, .home, .process, .gallery')) return
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
