// The cake order form (/order/): photo previews, a running price estimate, and
// sending: the order goes to /api/inquiry, the photos straight to private
// storage through one-time links, then /api/inquiry/complete emails the shop
// and returns the WhatsApp message.

const MAX_PHOTOS = 5
const MAX_BYTES = 5 * 1024 * 1024
const money = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

// Phone photos are large: send them at most 1600 pixels across as JPEG, which
// keeps uploads quick on mobile data. Formats the browser can't open (HEIC
// outside Safari) are sent as they are.
async function shrink(file) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    if (blob) return blob
  } catch {
    // Fall through to the original file.
  }
  return file
}

export function initOrder(form) {
  const api = (path) => new URL(`../api/${path}`, location.href)
  const error = form.querySelector('.order__error')
  const button = form.querySelector('.order__button')
  const estimate = form.querySelector('.order__estimate')
  const list = form.querySelector('.drop__list')
  const picker = form.querySelector('#order-photos')
  const done = document.querySelector('.order__done')
  const photos = []

  // No dates in the past.
  const today = new Date()
  form.elements.date.min = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

  // Starting from a cake on the site: /order/?like=<cake>.
  let liked = null
  try {
    const likes = JSON.parse(document.getElementById('order-likes').textContent)
    const slug = new URLSearchParams(location.search).get('like')
    if (slug && likes[slug]) {
      liked = { slug, ...likes[slug] }
      form.elements.like.value = slug
      const box = form.querySelector('.order__liked')
      box.hidden = false
      const img = document.createElement('img')
      img.src = liked.photo
      img.alt = ''
      const text = document.createElement('p')
      text.innerHTML = '<span class="cat-eyebrow">Starting from</span><strong></strong>'
      text.querySelector('strong').textContent = liked.title
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'order__unlike'
      remove.textContent = 'Remove'
      remove.addEventListener('click', () => {
        liked = null
        form.elements.like.value = ''
        box.hidden = true
        updateEstimate()
      })
      box.append(img, text, remove)
    }
  } catch {
    // No cakes to start from.
  }

  function updateEstimate() {
    const extras = [...form.querySelectorAll('.chip input:checked')].reduce((sum, i) => sum + Number(i.dataset.price || 0), 0)
    const base = liked?.price ?? 0
    const total = base + extras
    estimate.hidden = !total
    estimate.textContent = total ? `Estimated from ${money(total)}. We’ll confirm the price on WhatsApp.` : ''
  }
  form.addEventListener('change', (e) => e.target.matches('.chip input') && updateEstimate())
  updateEstimate()

  function drawPhotos() {
    list.replaceChildren(
      ...photos.map((p, i) => {
        const li = document.createElement('li')
        li.className = 'drop__item'
        const img = document.createElement('img')
        img.src = p.preview
        img.alt = `Photo ${i + 1}`
        const remove = document.createElement('button')
        remove.type = 'button'
        remove.textContent = '×'
        remove.setAttribute('aria-label', `Remove photo ${i + 1}`)
        remove.addEventListener('click', () => {
          URL.revokeObjectURL(p.preview)
          photos.splice(i, 1)
          drawPhotos()
        })
        li.append(img, remove)
        return li
      }),
    )
    picker.disabled = photos.length >= MAX_PHOTOS
  }

  picker.addEventListener('change', async () => {
    error.textContent = ''
    for (const file of picker.files) {
      if (photos.length >= MAX_PHOTOS) {
        error.textContent = `You can add up to ${MAX_PHOTOS} photos.`
        break
      }
      if (!/^image\//.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) {
        error.textContent = `${file.name} isn’t a photo.`
        continue
      }
      const blob = await shrink(file)
      if (blob.size > MAX_BYTES) {
        error.textContent = `${file.name} is too big (5 MB at most).`
        continue
      }
      const type = blob.type || (/\.heif$/i.test(file.name) ? 'image/heif' : 'image/heic')
      photos.push({ blob, type, preview: URL.createObjectURL(blob) })
    }
    picker.value = ''
    drawPhotos()
  })

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    error.textContent = ''
    const f = form.elements
    if (!f.name.value.trim()) return fail('Please tell us your name.', f.name)
    if (f.phone.value.replace(/\D/g, '').length < 10) return fail('Please give a WhatsApp number we can reach you on.', f.phone)
    if (f.email.value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.value.trim())) return fail('That email address doesn’t look right.', f.email)
    const turnstile = form.querySelector('[name="cf-turnstile-response"]')
    if (form.querySelector('.cf-turnstile') && !turnstile?.value) return fail('Please complete the check that you’re not a robot.')

    const value = (name) => form.querySelector(`input[name="${name}"]:checked`)?.value || ''
    const order = {
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      email: f.email.value.trim(),
      date: f.date.value,
      occasion: value('occasion'),
      size: value('size'),
      base: value('base'),
      frosting: value('frosting'),
      notes: f.notes.value.trim(),
      like: f.like.value,
      website: f.website.value,
      turnstile: turnstile?.value || '',
      photos: photos.map((p) => ({ type: p.type, size: p.blob.size })),
    }

    button.disabled = true
    button.textContent = 'Sending…'
    try {
      const started = await post('inquiry', order)
      const uploaded = []
      for (const [i, up] of started.uploads.entries()) {
        button.textContent = `Sending photo ${i + 1} of ${started.uploads.length}…`
        const res = await fetch(up.url, { method: 'PUT', headers: { 'Content-Type': photos[i].type, 'x-upsert': 'false' }, body: photos[i].blob })
        if (res.ok) uploaded.push(up.path)
      }
      button.textContent = 'Finishing…'
      // The order is already saved; this step records the photos and sends the
      // emails. It's safe to repeat, so a dropped connection gets two more tries.
      let finished = { ref: started.ref }
      for (const wait of [0, 1500, 4000]) {
        await new Promise((r) => setTimeout(r, wait))
        try {
          finished = await post('inquiry/complete', { id: started.id, token: started.token, uploaded })
          break
        } catch {}
      }
      showDone(finished.ref || started.ref, finished.whatsappUrl, uploaded.length < photos.length)
    } catch (err) {
      fail(err.message)
      window.turnstile?.reset?.()
    } finally {
      button.disabled = false
      button.textContent = 'Send my order'
    }
  })

  async function post(path, body) {
    let res
    try {
      res = await fetch(api(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    } catch {
      throw new Error('Can’t reach us right now. Check your internet connection and try again.')
    }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.message || 'Your order couldn’t be sent. Please try again, or message us on WhatsApp.')
    return data
  }

  function fail(message, field) {
    error.textContent = message
    field?.focus()
  }

  function showDone(ref, whatsappUrl, missingPhotos) {
    form.hidden = true
    done.hidden = false
    done.querySelector('.order__ref').textContent = `Your order number is ${ref}.${missingPhotos ? ' Some photos didn’t upload: please send them on WhatsApp.' : ''}`
    const wa = done.querySelector('.order__whatsapp')
    if (whatsappUrl) {
      wa.href = whatsappUrl
      wa.hidden = false
    }
    done.focus()
    done.scrollIntoView({ behavior: document.documentElement.classList.contains('reduced-motion') ? 'auto' : 'smooth', block: 'start' })
  }
}
