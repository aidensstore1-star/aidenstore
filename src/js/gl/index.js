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

  const petals = new Petals({ gl, scene, viewport, count: small ? 34 : 70, pixelRatio: dpr })

  function resize() {
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

  const state = { strength: 0, drag: 0, dragTarget: 0, petalOpacity: () => 0 }

  function tick(time) {
    const target = clamp(scroll.velocity() * 0.014, -0.9, 0.9)
    state.strength += (target - state.strength) * 0.1
    state.drag += (clamp(state.dragTarget, -1, 1) - state.drag) * 0.12

    for (const m of medias) m.update({ strength: state.strength, drag: state.drag, time })
    petals.update({ time, mouse, scroll: window.scrollY * 0.00025, opacity: state.petalOpacity() })
    renderer.render({ scene, camera, sort: false, frustumCull: false })
  }
  gsap.ticker.add(tick)

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
  }
}
