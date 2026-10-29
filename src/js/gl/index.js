import { Camera, Plane, Renderer, Transform } from 'ogl'
import gsap from 'gsap'
import { Media } from './media.js'
import { Petals } from './petals.js'

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

// One fixed, transparent canvas behind the page. Every <figure data-gl> photo
// is drawn here as a plane that follows its <img> position each frame.
export function createGL(canvas, { scroll }) {
  const small = matchMedia('(max-width: 900px)').matches
  const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2)

  let renderer
  try {
    // premultipliedAlpha: shaders output colour already multiplied by alpha, so
    // see-through edges blend cleanly with the page instead of turning grey.
    renderer = new Renderer({ canvas, alpha: true, premultipliedAlpha: true, antialias: !small, dpr, webgl: 2, powerPreference: 'high-performance' })
  } catch {
    return null
  }
  const { gl } = renderer
  if (!gl) return null
  gl.clearColor(0, 0, 0, 0)

  const camera = new Camera(gl, { fov: 45 })
  camera.position.z = 5
  const scene = new Transform()
  const screen = { w: window.innerWidth, h: window.innerHeight }
  const viewport = { w: 1, h: 1 }

  const geometry = new Plane(gl, { widthSegments: 24, heightSegments: 24 })
  const medias = [...document.querySelectorAll('[data-gl]')].map(
    (el) =>
      new Media({
        gl,
        geometry,
        scene,
        el,
        screen,
        viewport,
        isWebgl2: renderer.isWebgl2,
        manual: el.classList.contains('hero__img'),
      }),
  )
  const byElement = new Map(medias.map((m) => [m.el, m]))

  // Only photos within about a screen of the viewport are measured and drawn.
  const nearby = new IntersectionObserver(
    (entries) => entries.forEach((e) => (byElement.get(e.target).near = e.isIntersecting)),
    { rootMargin: '60% 60%' },
  )
  medias.forEach((m) => nearby.observe(m.el))

  const petals = new Petals({ gl, scene, viewport, count: small ? 30 : 70, pixelRatio: dpr })

  let dirty = true
  let lost = false

  function resize() {
    dirty = true
    screen.w = window.innerWidth
    screen.h = window.innerHeight
    renderer.setSize(screen.w, screen.h)
    camera.perspective({ aspect: screen.w / screen.h })
    viewport.h = 2 * Math.tan((camera.fov * Math.PI) / 180 / 2) * camera.position.z
    viewport.w = viewport.h * camera.aspect
    medias.forEach((m) => m.onResize())
    petals.onResize(dpr)
  }
  resize()
  let resizeTimer
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(resize, 120)
  })

  const mouse = [99, 99]
  window.addEventListener('pointermove', (e) => {
    mouse[0] = (e.clientX / screen.w - 0.5) * viewport.w
    mouse[1] = -(e.clientY / screen.h - 0.5) * viewport.h
  })

  const state = { strength: 0, drag: 0, dragTarget: 0, burst: 0, petalOpacity: () => 0 }

  function tick(time) {
    if (lost) return
    const target = clamp(scroll.velocity() * 0.014, -0.9, 0.9)
    state.strength += (target - state.strength) * 0.1
    state.drag += (clamp(state.dragTarget, -1, 1) - state.drag) * 0.12

    let changed = dirty || Math.abs(state.strength) > 0.002 || Math.abs(state.drag) > 0.0005
    for (const m of medias) changed = m.update({ strength: state.strength, drag: state.drag, time }) || changed
    const petalOpacity = state.petalOpacity()
    petals.update({ time, mouse, scroll: window.scrollY * 0.0004, opacity: petalOpacity, burst: state.burst })
    changed = changed || petalOpacity > 0.001 || petals.wasVisible
    petals.wasVisible = petalOpacity > 0.001

    // Nothing moved this frame: keep the last image and save the battery.
    if (!changed) return
    dirty = false
    renderer.render({ scene, camera, sort: false, frustumCull: false })
    for (const m of medias) if (m.mesh.visible) m.uploaded = true
  }
  gsap.ticker.add(tick)

  // If the phone drops the WebGL context, show the plain photos instead.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    lost = true
    document.documentElement.classList.remove('gl-on')
  })
  canvas.addEventListener('webglcontextrestored', () => location.reload())

  document.documentElement.classList.add('gl-on')

  return {
    get: (el) => byElement.get(el),
    medias,
    setDrag(v) {
      state.dragTarget = v
    },
    setPetalOpacity(fn) {
      state.petalOpacity = fn
    },
    setBurst(v) {
      state.burst = v
    },
  }
}
