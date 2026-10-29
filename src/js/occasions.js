import gsap from 'gsap'

// A photo follows the pointer over the occasions list, tilting as it moves.
export function initOccasions() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return
  const list = document.querySelector('.occasions__list')
  const float = document.querySelector('.occasions__float')
  const img = float.querySelector('img')
  const rows = [...list.querySelectorAll('.occasion')]

  // Warm the cache so swapping photos is instant.
  rows.forEach((row) => {
    const pre = new Image()
    pre.src = row.dataset.photo
  })

  const pos = { x: 0, y: 0, tx: 0, ty: 0 }
  let active = false
  const w = () => float.offsetWidth
  const h = () => float.offsetHeight

  gsap.ticker.add(() => {
    if (!active && Math.abs(pos.tx - pos.x) < 0.5) return
    const dx = pos.tx - pos.x
    pos.x += dx * 0.12
    pos.y += (pos.ty - pos.y) * 0.12
    gsap.set(float, { x: pos.x - w() / 2, y: pos.y - h() / 2, rotation: gsap.utils.clamp(-14, 14, dx * 0.08) })
  })

  list.addEventListener('pointermove', (e) => {
    pos.tx = e.clientX
    pos.ty = e.clientY
  })
  list.addEventListener('pointerenter', (e) => {
    active = true
    pos.x = pos.tx = e.clientX
    pos.y = pos.ty = e.clientY
    gsap.to(float, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.8, ease: 'expo.out' })
  })
  list.addEventListener('pointerleave', () => {
    active = false
    gsap.to(float, { clipPath: 'inset(50% 50% 50% 50%)', duration: 0.6, ease: 'expo.out' })
  })
  rows.forEach((row) =>
    row.addEventListener('pointerenter', () => {
      if (img.getAttribute('src') === row.dataset.photo) return
      img.src = row.dataset.photo
      gsap.fromTo(img, { scale: 1.25 }, { scale: 1, duration: 0.9, ease: 'expo.out' })
    }),
  )
}
