// The "Reduce motion" button in the footer. The site plays its full motion by
// default; a visitor who prefers less can switch it off, and the choice is
// remembered on their device. The page reloads so every effect starts in the
// chosen mode (the choice is read in the <head> before anything is drawn).
export function initMotionToggle() {
  const reduced = document.documentElement.classList.contains('reduced-motion')
  for (const btn of document.querySelectorAll('[data-motion-toggle]')) {
    btn.textContent = reduced ? 'Full motion' : 'Reduce motion'
    btn.setAttribute('aria-pressed', String(reduced))
    btn.addEventListener('click', () => {
      try {
        if (reduced) localStorage.removeItem('motion')
        else localStorage.setItem('motion', 'reduced')
      } catch (e) {
        return
      }
      location.reload()
    })
  }
}
