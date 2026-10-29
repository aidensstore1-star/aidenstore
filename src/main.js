import '@fontsource/cormorant-garamond/latin-300.css'
import '@fontsource/cormorant-garamond/latin-300-italic.css'
import '@fontsource/cormorant-garamond/latin-400.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import '@fontsource-variable/manrope'
import './styles/main.css'

import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { createScroll } from './js/scroll.js'
import { createGL } from './js/gl/index.js'
import { runPreloader } from './js/preloader.js'
import { initAnimations } from './js/animations.js'
import { initGallery } from './js/gallery.js'
import { initDetail } from './js/detail.js'
import { initCursor } from './js/cursor.js'
import { initMenu } from './js/menu.js'

gsap.registerPlugin(ScrollTrigger, SplitText)
// Phones show and hide the address bar while scrolling; don't re-measure for that.
ScrollTrigger.config({ ignoreMobileResize: true })

const html = document.documentElement
const reduced = html.classList.contains('reduced-motion')
// Switches on the pinned, cinematic layouts in CSS (set here so they only apply when the script runs).
if (!reduced) html.classList.add('motion')

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
window.scrollTo(0, 0)

const scroll = createScroll({ reduced })
scroll.stop()

const preloaderDone = runPreloader({ reduced })

// Split text only once the fonts are in, so lines break in the right places.
await (document.fonts ? document.fonts.ready : Promise.resolve())

initMenu({ scroll })
initCursor()

if (reduced) {
  // Calm version: no WebGL, no smooth scrolling, everything already in place.
  const detail = initDetail({ scroll, gl: null, galleryApi: null, reduced })
  document.querySelectorAll('.gallery__item').forEach((item, i) => {
    item.addEventListener('click', () => detail.open(i, item))
  })
} else {
  const gl = createGL(document.querySelector('.gl'), { scroll })
  let detail
  const galleryApi = initGallery({ scroll, gl, onOpen: (i, item) => detail.open(i, item) })
  detail = initDetail({ scroll, gl, galleryApi, reduced })
  const { intro } = initAnimations({ scroll, gl })
  // Refresh triggers in page order so ones below a pinned chapter account for it.
  ScrollTrigger.sort()
  ScrollTrigger.refresh()

  await preloaderDone
  intro()
  scroll.start()
}
