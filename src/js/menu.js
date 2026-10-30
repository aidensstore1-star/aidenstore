import gsap from 'gsap'

// Full-screen menu (phones and tablets) that opens as a circle from the button.
export function initMenu({ scroll }) {
  const button = document.querySelector('.header__menu')
  const menu = document.querySelector('.menu')
  const label = button.querySelector('.header__menu-label')
  const links = [...menu.querySelectorAll('.menu__link')]
  const texts = links.map((l) => l.querySelector('.menu__text'))
  const imgs = [...menu.querySelectorAll('.menu__img')]
  const foot = menu.querySelector('.menu__foot')
  const groups = [...menu.querySelectorAll('.menu__group')]
  let open = false
  let tl = null

  const show = () => {
    open = true
    button.setAttribute('aria-expanded', 'true')
    menu.setAttribute('aria-hidden', 'false')
    label.textContent = 'Close'
    document.documentElement.classList.add('menu-open')
    scroll.stop()
    tl?.kill()
    tl = gsap
      .timeline()
      .set(menu, { visibility: 'visible' })
      .fromTo(menu, { clipPath: `circle(0% at calc(100% - 3rem) 2rem)` }, { clipPath: `circle(150% at calc(100% - 3rem) 2rem)`, duration: 1.1, ease: 'expo.inOut' })
      .fromTo(texts, { yPercent: 110 }, { yPercent: 0, duration: 1.1, stagger: 0.07, ease: 'expo.out' }, 0.45)
      .fromTo(foot, { opacity: 0 }, { opacity: 0.7, duration: 0.8 }, 0.8)
      .fromTo(groups, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.8, stagger: 0.1, ease: 'expo.out' }, 0.5)
    imgs[0] && gsap.set(imgs[0], { opacity: 1 })
  }

  const hide = (after) => {
    open = false
    button.setAttribute('aria-expanded', 'false')
    menu.setAttribute('aria-hidden', 'true')
    label.textContent = 'Menu'
    tl?.kill()
    tl = gsap
      .timeline({
        onComplete: () => {
          gsap.set(menu, { visibility: 'hidden' })
          document.documentElement.classList.remove('menu-open')
          scroll.start()
          after?.()
        },
      })
      .to(texts, { yPercent: -110, duration: 0.5, stagger: 0.04, ease: 'power3.in' })
      .to(menu, { clipPath: `circle(0% at calc(100% - 3rem) 2rem)`, duration: 0.9, ease: 'expo.inOut' }, 0.2)
  }

  button.addEventListener('click', () => (open ? hide() : show()))
  window.addEventListener('keydown', (e) => e.key === 'Escape' && open && hide())

  links.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      const target = link.getAttribute('href')
      // Jump while the menu still covers the page, so the visitor doesn't
      // watch every chapter scroll past; the menu then lifts onto the chapter.
      scroll.start()
      scroll.jumpTo(target)
      hide()
    })
    link.addEventListener('pointerenter', () => {
      const i = Number(link.dataset.index)
      imgs.forEach((img, j) =>
        gsap.to(img, { opacity: j === i ? 1 : 0, scale: j === i ? 1 : 1.08, duration: 0.8, ease: 'power3.out' }),
      )
    })
  })
}
