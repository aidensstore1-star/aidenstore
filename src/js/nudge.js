// A small "keep scrolling" prompt. It appears as soon as the visitor stops
// scrolling partway through the story (once the page has come to rest, so
// not between flicks), and goes again as soon as they scroll, tap or drag.
export function initNudge() {
  const el = document.querySelector('.nudge')
  const text = el.querySelector('.nudge__text')
  const html = document.documentElement
  const end = document.getElementById('contact')
  let timer = 0

  const show = () => {
    // Not over the menu or a close-up, and not once the story has ended.
    if (html.classList.contains('menu-open') || html.classList.contains('detail-open')) return
    if (end.getBoundingClientRect().top < window.innerHeight * 0.9) return
    text.textContent = window.scrollY < 40 ? 'Scroll to begin' : 'Keep scrolling'
    el.classList.add('is-shown')
  }

  const wait = (ms) => {
    el.classList.remove('is-shown')
    clearTimeout(timer)
    timer = setTimeout(show, ms)
  }

  const wake = () => wait(700)
  return {
    // The opening gets a moment to play first.
    start() {
      wait(3000)
      for (const type of ['scroll', 'wheel', 'touchstart', 'pointerdown', 'keydown']) window.addEventListener(type, wake, { passive: true })
    },
  }
}
