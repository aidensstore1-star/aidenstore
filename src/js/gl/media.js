import { Mesh, Program, Texture } from 'ogl'
import gsap from 'gsap'

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec2 uv;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform vec2 uViewport;
  uniform float uStrength;
  uniform float uDrag;
  uniform float uBend;
  uniform float uHover;
  uniform vec2 uMouse;

  varying vec2 vUv;

  const float PI = 3.141592653589793;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);

    // Scroll speed bows the photo like paper in a breeze.
    world.z += sin(world.y / uViewport.y * PI + PI * 0.5) * -uStrength;

    // Dragging the gallery bends it like a sail.
    world.z += sin(uv.y * PI) * uDrag * 0.35;

    // Gallery photos sit on a gentle curve, edges further away.
    float nx = world.x / (uViewport.x * 0.5);
    world.z -= nx * nx * uBend;

    // Hover lifts the photo towards the pointer.
    float d = distance(uv, uMouse);
    world.z += uHover * 0.12 * (1.0 - smoothstep(0.0, 0.75, d));

    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragment = /* glsl */ `
  precision highp float;

  uniform sampler2D tMap;
  uniform vec2 uPlaneSize;
  uniform vec2 uImageSize;
  uniform float uReveal;
  uniform float uAlpha;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform vec2 uShift;

  varying vec2 vUv;

  void main() {
    // object-fit: cover
    vec2 ratio = vec2(
      min((uPlaneSize.x / uPlaneSize.y) / (uImageSize.x / uImageSize.y), 1.0),
      min((uPlaneSize.y / uPlaneSize.x) / (uImageSize.y / uImageSize.x), 1.0)
    );
    vec2 uv = vec2(
      vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
      vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
    );

    // Settle from a slight zoom as it reveals; zoom a touch on hover.
    float zoom = 1.0 - 0.18 * (1.0 - uReveal) - 0.04 * uHover;
    uv = (uv - 0.5) * zoom + 0.5;

    // Water ripple around the pointer.
    float d = distance(vUv, uMouse);
    float ripple = sin(d * 28.0 - uTime * 3.5) * 0.0045 * uHover * (1.0 - smoothstep(0.0, 0.55, d));
    uv += normalize(vUv - uMouse + 0.0001) * ripple;

    // Colour split with movement.
    vec2 shift = uShift * 0.006;
    vec3 color = vec3(
      texture2D(tMap, uv + shift).r,
      texture2D(tMap, uv).g,
      texture2D(tMap, uv - shift).b
    );

    // Slightly darker at the corners, to settle each photo into the page.
    // (The warm grade itself is baked into the photo files.)
    float vignette = smoothstep(0.95, 0.35, distance(vUv, vec2(0.5)));
    color *= mix(0.86, 1.0, vignette);

    // Reveal upwards behind a soft, wavy edge.
    float edge = uReveal * 1.25 - 0.12;
    float wave = sin(vUv.x * 7.0 + uTime * 1.6) * 0.025 * (1.0 - uReveal);
    float mask = 1.0 - smoothstep(edge - 0.08, edge, vUv.y + wave);

    float a = mask * uAlpha;
    gl_FragColor = vec4(color * a, a);
  }
`

export class Media {
  constructor({ gl, geometry, scene, el, screen, viewport, isWebgl2, manual, small }) {
    this.gl = gl
    this.el = el
    this.img = el.querySelector('img')
    this.screen = screen
    this.viewport = viewport
    this.manual = manual
    this.revealed = false
    this.hidden = false
    this.loaded = false
    this.near = false
    this.bend = el.hasAttribute('data-bend') ? 0.45 : 0

    // Phones get 640px textures without mipmaps, to keep graphics memory low.
    this.small = small
    const mip = isWebgl2 && !small
    this.texOpts = { generateMipmaps: mip, minFilter: mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR }
    this.texture = new Texture(gl, this.texOpts)
    this.source = null

    this.program = new Program(gl, {
      vertex,
      fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        tMap: { value: this.texture },
        uPlaneSize: { value: [1, 1] },
        uImageSize: { value: [1, 1] },
        uViewport: { value: [viewport.w, viewport.h] },
        uStrength: { value: 0 },
        uDrag: { value: 0 },
        uBend: { value: this.bend },
        uHover: { value: 0 },
        uMouse: { value: [0.5, 0.5] },
        uReveal: { value: 0 },
        uAlpha: { value: 1 },
        uTime: { value: 0 },
        uShift: { value: [0, 0] },
      },
    })
    this.program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.uniforms = this.program.uniforms

    this.mesh = new Mesh(gl, { geometry, program: this.program, frustumCulled: false })
    this.mesh.visible = false
    this.mesh.setParent(scene)

    if (!small) {
      const onLoad = () => this.setImage(this.img)
      if (this.img.complete && this.img.naturalWidth) onLoad()
      // Fires again if the browser swaps to a bigger srcset file after a resize.
      this.img.addEventListener('load', onLoad)
    }

    this.bindHover()
  }

  setImage(source) {
    this.source = source
    this.texture.image = source
    this.texture.needsUpdate = true
    this.uploaded = false
    this.uniforms.uImageSize.value = [source.naturalWidth, source.naturalHeight]
    this.loaded = true
  }

  // Called when the photo comes within reach of the screen.
  prepare() {
    if (!this.small || this.source || this.loading) return
    this.loading = true
    const small = new Image()
    small.decoding = 'async'
    small.src = this.img.getAttribute('src').replace(/-1280\.webp$/, '-640.webp')
    small
      .decode()
      .then(() => this.setImage(small))
      .catch(() => (this.loading = false))
  }

  // Sends the photo to the graphics card ahead of time, so it doesn't stall
  // the frame it first appears in. Returns true if it uploaded.
  upload() {
    if (!this.loaded || this.uploaded) return false
    this.texture.update()
    this.uploaded = true
    return true
  }

  // Frees graphics memory for photos far from the screen; they upload again
  // when they come back.
  free() {
    if (!this.uploaded) return
    const old = this.texture
    this.texture = new Texture(this.gl, this.texOpts)
    this.texture.image = this.source
    this.uniforms.tMap.value = this.texture
    this.gl.deleteTexture(old.texture)
    this.uploaded = false
    this.syncReady()
  }

  bindHover() {
    const target = this.el.closest('a, button') || this.el
    if (!matchMedia('(hover: hover)').matches) return
    target.addEventListener('pointerenter', () => {
      gsap.to(this.uniforms.uHover, { value: 1, duration: 0.8, ease: 'power3.out', overwrite: true })
    })
    target.addEventListener('pointermove', (e) => {
      const r = this.el.getBoundingClientRect()
      this.uniforms.uMouse.value = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height]
    })
    target.addEventListener('pointerleave', () => {
      gsap.to(this.uniforms.uHover, { value: 0, duration: 1, ease: 'power3.out', overwrite: true })
    })
  }

  reveal({ delay = 0, duration = 1.8 } = {}) {
    if (this.revealed) return
    this.revealed = true
    gsap.to(this.uniforms.uReveal, { value: 1, duration, delay, ease: 'power3.out' })
  }

  onResize() {
    this.uniforms.uViewport.value = [this.viewport.w, this.viewport.h]
  }

  // Returns true when this photo needs the frame redrawn.
  update({ strength, drag, time }) {
    // Skip layout reads entirely for photos nowhere near the screen.
    if (!this.near) {
      const was = this.mesh.visible
      this.mesh.visible = false
      return was
    }
    const rect = this.el.getBoundingClientRect()
    const { w: sw, h: sh } = this.screen
    const margin = 120
    const onScreen =
      rect.width > 0 && rect.bottom > -margin && rect.top < sh + margin && rect.right > -margin && rect.left < sw + margin

    const was = this.mesh.visible
    this.mesh.visible = onScreen && this.loaded && !this.hidden
    if (!this.mesh.visible) return was

    if (!this.manual && !this.revealed && this.loaded && rect.top < sh * 0.9 && rect.bottom > 0 && rect.left < sw && rect.right > 0) {
      this.reveal()
    }

    const { w: vw, h: vh } = this.viewport
    this.mesh.scale.x = (vw * rect.width) / sw
    this.mesh.scale.y = (vh * rect.height) / sh
    this.mesh.position.x = -vw / 2 + this.mesh.scale.x / 2 + (rect.left / sw) * vw
    this.mesh.position.y = vh / 2 - this.mesh.scale.y / 2 - (rect.top / sh) * vh

    const u = this.uniforms
    const last = this.lastRect
    const moved = !last || last.left !== rect.left || last.top !== rect.top || last.width !== rect.width || last.height !== rect.height
    this.lastRect = rect
    u.uPlaneSize.value = [rect.width, rect.height]
    u.uStrength.value = strength
    u.uDrag.value = this.bend ? drag : 0
    u.uShift.value = [this.bend ? drag * 0.6 : 0, strength * 0.6]
    u.uTime.value = time
    this.syncReady(rect)
    return !was || moved || u.uHover.value > 0.001 || (this.revealed && u.uReveal.value < 1)
  }

  // Hides the plain photo once the WebGL copy is drawing. If that happens
  // while the photo is already on screen (after a jump), skip the reveal so
  // it doesn't vanish and wipe in again.
  syncReady(rect) {
    const ready = this.loaded && this.uploaded
    if (ready === this.ready) return
    this.ready = ready
    if (ready && !this.revealed && rect && rect.top < this.screen.h && rect.bottom > 0) {
      this.revealed = true
      this.uniforms.uReveal.value = 1
    }
    this.el.classList.toggle('gl-ready', ready)
  }
}
