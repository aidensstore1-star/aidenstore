import { Geometry, Mesh, Program } from 'ogl'

const vertex = /* glsl */ `
  attribute vec3 position;
  attribute vec4 aRandom;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform vec2 uViewport;
  uniform vec2 uMouse;
  uniform float uSize;
  uniform float uScroll;
  uniform float uBurst;

  varying float vRotation;
  varying float vFlip;
  varying vec4 vRandom;

  void main() {
    vec3 p = position;

    // Drift down (and a little with the page scroll), wrapping around.
    float fall = uTime * (0.012 + aRandom.x * 0.022) + uScroll;
    p.y = fract(position.y - fall) - 0.5;
    p.x = position.x - 0.5 + sin(uTime * (0.25 + aRandom.y * 0.4) + aRandom.z * 6.2831) * 0.05;

    vec3 world = vec3(p.x * uViewport.x * 1.15, p.y * uViewport.y * 1.2, p.z);

    // When the opening scene bursts apart, petals blow outwards and towards you.
    world.xy += normalize(world.xy + 0.0001) * uBurst * uBurst * (1.5 + aRandom.x * 3.0);
    world.z += uBurst * aRandom.y * 2.5;

    // Petals float away from the pointer.
    vec2 diff = world.xy - uMouse;
    float dist = length(diff);
    world.xy += normalize(diff + 0.0001) * (1.0 - smoothstep(0.0, 1.1, dist)) * 0.45;

    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.6 + aRandom.z * 0.9) * (5.0 / -mv.z);

    vRotation = uTime * (aRandom.w - 0.5) * 1.4 + aRandom.y * 6.2831;
    // Tumbling: the petal turns edge-on and back as it falls.
    vFlip = cos(uTime * (0.6 + aRandom.w * 1.2) + aRandom.x * 6.2831);
    vRandom = aRandom;
  }
`

const fragment = /* glsl */ `
  precision highp float;

  uniform float uOpacity;

  varying float vRotation;
  varying float vFlip;
  varying vec4 vRandom;

  void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float c = cos(vRotation);
    float s = sin(vRotation);
    p = mat2(c, -s, s, c) * p;

    float flip = max(abs(vFlip), 0.18);
    p.x /= flip;

    // Rose petal: an egg shape, narrow at the base and round at the top, with
    // a small notch. Kept inside the sprite so rotating never clips it.
    vec2 q = p * 1.25;
    float w = 0.42 + 0.2 * q.y;
    float d = length(vec2(q.x / w, q.y / 0.9));
    float body = 1.0 - smoothstep(0.82, 1.0, d);
    float notch = 1.0 - smoothstep(0.08, 0.2, length(vec2(q.x * 1.3, q.y - 0.88)));
    float alpha = body * (1.0 - notch);
    if (alpha < 0.01) discard;

    float t = clamp(q.y * 0.55 + 0.5, 0.0, 1.0);
    vec3 deep = vec3(0.86, 0.55, 0.56);
    vec3 pink = vec3(0.95, 0.74, 0.74);
    vec3 pale = vec3(0.99, 0.88, 0.86);
    vec3 champagne = vec3(0.97, 0.88, 0.72);
    vec3 color = mix(mix(deep, pink, vRandom.y), mix(pink, pale, vRandom.y), t);
    color = mix(color, champagne, step(0.94, vRandom.z) * 0.8);

    // Lighter down the middle; light catches one side as it turns.
    color *= 0.93 + 0.07 * (1.0 - abs(q.x) / w);
    color += 0.05 * q.x * sign(vFlip);

    float a = alpha * uOpacity * (0.7 + 0.3 * vRandom.w);
    gl_FragColor = vec4(color * a, a);
  }
`

export class Petals {
  constructor({ gl, scene, viewport, count, pixelRatio }) {
    const position = new Float32Array(count * 3)
    const random = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      position.set([Math.random(), Math.random(), Math.random() * 3 - 1.5], i * 3)
      random.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
    }

    const geometry = new Geometry(gl, {
      position: { size: 3, data: position },
      aRandom: { size: 4, data: random },
    })

    this.viewport = viewport
    this.program = new Program(gl, {
      vertex,
      fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uViewport: { value: [viewport.w, viewport.h] },
        uMouse: { value: [99, 99] },
        uSize: { value: 54 * pixelRatio },
        uScroll: { value: 0 },
        uOpacity: { value: 0 },
        uBurst: { value: 0 },
      },
    })
    this.program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    this.uniforms = this.program.uniforms

    this.mesh = new Mesh(gl, { geometry, program: this.program, mode: gl.POINTS, frustumCulled: false })
    this.mesh.setParent(scene)
  }

  onResize(pixelRatio) {
    this.uniforms.uViewport.value = [this.viewport.w, this.viewport.h]
    this.uniforms.uSize.value = 54 * pixelRatio
  }

  update({ time, mouse, scroll, opacity, burst }) {
    this.uniforms.uTime.value = time
    this.uniforms.uBurst.value = burst
    this.uniforms.uMouse.value = mouse
    this.uniforms.uScroll.value = scroll
    this.uniforms.uOpacity.value = opacity
    this.mesh.visible = opacity > 0.001
  }
}
