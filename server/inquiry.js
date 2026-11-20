// The cake order form's server side, used by the Cloudflare Pages Functions in
// functions/api/inquiry/. Customers never write to the database directly:
// this code checks what they send, stores it with the project's secret key,
// and hands out short-lived links for uploading their photos into the
// private inquiry-uploads bucket.
//
// 1. POST /api/inquiry           checks and saves the inquiry, returns upload links
// 2. (the browser uploads the photos to those links)
// 3. POST /api/inquiry/complete  records the photos, emails the shop and the
//                                customer, and returns the WhatsApp message
//
// Settings (Cloudflare Pages → Settings → Variables and secrets):
//   VITE_SUPABASE_URL      the project's address (the same as the site's)
//   SUPABASE_SERVICE_KEY   secret: the project's secret key
//   TURNSTILE_SECRET       secret, optional: Cloudflare Turnstile's secret key;
//                          when set, every submission must pass its spam check
//   RESEND_API_KEY         secret, optional: sends the emails through Resend
//   EMAIL_FROM             optional: the sender, e.g. "Alita’s Cakes <orders@domain>"

export const MAX_PHOTOS = 5
export const MAX_BYTES = 5 * 1024 * 1024
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' }
const KINDS = ['occasion', 'size', 'base', 'frosting']
const PHONE = /^\+?[0-9 ()-]{7,20}$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export const reply = (status, body) =>
  new Response(JSON.stringify({ ok: status < 300, ...body }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
const fail = (status, message) => reply(status, { message })

function config(env) {
  const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const key = env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
  const rest = async (path, init = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } })
    const text = await res.text()
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${text.slice(0, 200)}`)
    // "return=minimal" writes answer with an empty body.
    return text ? JSON.parse(text) : null
  }
  return { url, key, headers, rest }
}

const sameSite = (request) => {
  const origin = request.headers.get('Origin')
  return !origin || new URL(origin).host === new URL(request.url).host
}

// A proof, given to the browser that started an inquiry, that it may finish it.
async function sign(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function turnstileOk(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true
  if (!token) return false
  const form = new FormData()
  form.append('secret', env.TURNSTILE_SECRET)
  form.append('response', token)
  if (ip) form.append('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
  return Boolean((await res.json().catch(() => ({}))).success)
}

const today = () => new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10) // India's date

// ---------- 1. Start ----------

export async function startInquiry(request, env) {
  if (!sameSite(request)) return fail(403, 'Not allowed from another site.')
  const db = config(env)
  if (!db) return fail(503, 'Orders can’t be sent from the website yet. Please message us on WhatsApp.')

  let b
  try {
    b = await request.json()
  } catch {
    return fail(400, 'Something went wrong. Please try again.')
  }
  // A field people can't see: only bots fill it in.
  if (b.website) return fail(400, 'Something went wrong. Please try again.')

  const name = String(b.name || '').trim()
  const phone = String(b.phone || '').trim()
  const email = String(b.email || '').trim().toLowerCase()
  const notes = String(b.notes || '').trim()
  const date = String(b.date || '').trim()
  if (!name || name.length > 100) return fail(400, 'Please tell us your name.')
  if (!PHONE.test(phone) || phone.replace(/\D/g, '').length < 10) return fail(400, 'Please give a phone number we can reach you on WhatsApp.')
  if (email && (!EMAIL.test(email) || email.length > 200)) return fail(400, 'That email address doesn’t look right.')
  if (notes.length > 2000) return fail(400, 'Please keep your message under 2,000 characters.')
  if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today())) return fail(400, 'Please choose a date from today onwards.')
  const photos = Array.isArray(b.photos) ? b.photos : []
  if (photos.length > MAX_PHOTOS) return fail(400, `Please send at most ${MAX_PHOTOS} photos.`)
  for (const p of photos) {
    if (!TYPES[p?.type]) return fail(400, 'Photos need to be JPG, PNG, WebP or HEIC.')
    if (!(p.size > 0 && p.size <= MAX_BYTES)) return fail(400, 'Each photo can be at most 5 MB.')
  }

  const ip = request.headers.get('CF-Connecting-IP')
  if (!(await turnstileOk(env, b.turnstile, ip))) return fail(400, 'Please complete the check that you’re not a robot, then send again.')

  try {
    // Limits, so the form can't be used to flood the shop (or to send
    // confirmation emails to strangers): three per phone number in ten
    // minutes, five per visitor an hour, and 60 a day in all. Visitors are
    // told by a fingerprint of their address, never the address itself.
    const ago = (minutes) => encodeURIComponent(new Date(Date.now() - minutes * 60 * 1000).toISOString())
    const visitor = ip ? await sign(db.key, `ip:${ip}`) : null
    const [byPhone, byVisitor, today] = await Promise.all([
      db.rest(`inquiries?select=id&customer_phone=eq.${encodeURIComponent(phone)}&created_at=gte.${ago(10)}`),
      visitor ? db.rest(`inquiries?select=id&visitor=eq.${visitor}&created_at=gte.${ago(60)}`) : [],
      db.rest(`inquiries?select=id&created_at=gte.${ago(24 * 60)}&limit=60`),
    ])
    if (byPhone.length >= 3 || byVisitor.length >= 5) return fail(429, 'You’ve sent a few already. We’ll be in touch soon, or message us on WhatsApp.')
    if (today.length >= 60) return fail(429, 'We’ve had a lot of orders today. Please message us on WhatsApp instead.')

    // The choices as the customer saw them, with the price they add.
    const options = await db.rest('cake_options?select=id,kind,label,price_delta&is_active=eq.true')
    const chosen = {}
    for (const kind of KINDS) {
      const v = String(b[kind] || '')
      if (!v) continue
      const o = options.find((x) => x.kind === kind && (x.id === v || x.label === v))
      if (!o) return fail(400, 'One of the choices isn’t available any more. Please reload the page.')
      chosen[kind] = o
    }
    let liked = null
    if (b.like) {
      const [p] = await db.rest(`products?select=slug,title,price_from&slug=eq.${encodeURIComponent(String(b.like))}&is_published=eq.true`)
      liked = p || null
    }
    const priced = liked?.price_from != null || Object.values(chosen).some((o) => Number(o.price_delta))
    const estimate = priced ? Number(liked?.price_from || 0) + Object.values(chosen).reduce((s, o) => s + Number(o.price_delta), 0) : null
    const snapshot = {
      ...Object.fromEntries(Object.entries(chosen).map(([k, o]) => [k, o.label])),
      ...(liked ? { liked: liked.title, likedSlug: liked.slug } : {}),
      ...(estimate != null ? { estimate } : {}),
    }

    const [inquiry] = await db.rest('inquiries?select=id,ref', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        section_key: 'cakes',
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        event_date: date || null,
        occasion_id: chosen.occasion?.id ?? null,
        size_id: chosen.size?.id ?? null,
        base_id: chosen.base?.id ?? null,
        frosting_id: chosen.frosting?.id ?? null,
        options_snapshot: snapshot,
        notes,
        visitor,
      }),
    })

    // A one-time upload link per photo, into the private bucket.
    const uploads = []
    for (const [i, p] of photos.entries()) {
      const path = `${inquiry.ref}/photo-${i + 1}.${TYPES[p.type]}`
      const res = await fetch(`${db.url}/storage/v1/object/upload/sign/inquiry-uploads/${path}`, { method: 'POST', headers: db.headers, body: '{}' })
      if (!res.ok) throw new Error(`upload link ${res.status}`)
      const { url } = await res.json()
      uploads.push({ path, url: `${db.url}/storage/v1${url}` })
    }
    return reply(200, { id: inquiry.id, ref: inquiry.ref, token: await sign(db.key, inquiry.id), uploads })
  } catch (e) {
    console.error(e)
    return fail(502, 'Your order couldn’t be sent just now. Please try again, or message us on WhatsApp.')
  }
}

// ---------- 3. Complete ----------

const escapeHtml = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function summary(inq, { photoLinks = [] } = {}) {
  const s = inq.options_snapshot || {}
  const when = inq.event_date ? new Date(`${inq.event_date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  return [
    ['Reference', inq.ref],
    ['Name', inq.customer_name],
    ['Phone', inq.customer_phone],
    ['Email', inq.customer_email],
    ['For', when],
    ['Occasion', s.occasion],
    ['Size', s.size],
    ['Base', s.base],
    ['Frosting', s.frosting],
    ['Like this cake', s.liked],
    ['Estimate', s.estimate != null ? `from ₹${Number(s.estimate).toLocaleString('en-IN')}` : null],
    ['Message', inq.notes],
    ...photoLinks.map((link, i) => [`Photo ${i + 1}`, link]),
  ].filter(([, v]) => v)
}

async function sendEmail(env, { to, subject, rows, intro, replyTo }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !to) return false
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#2a1f22">
<p>${escapeHtml(intro)}</p>
<table style="border-collapse:collapse;width:100%">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#6b5a5e;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0">${k.startsWith('Photo ') ? `<a href="${escapeHtml(v)}">Open photo</a>` : escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`)
    .join('')}</table></div>`
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  })
  if (!res.ok) console.error('Resend', res.status, await res.text())
  return res.ok
}

export async function completeInquiry(request, env) {
  if (!sameSite(request)) return fail(403, 'Not allowed from another site.')
  const db = config(env)
  if (!db) return fail(503, 'Orders can’t be sent from the website yet.')
  let b
  try {
    b = await request.json()
  } catch {
    return fail(400, 'Something went wrong.')
  }
  const id = String(b.id || '')
  if (!/^[0-9a-f-]{36}$/.test(id) || String(b.token || '') !== (await sign(db.key, id))) return fail(403, 'This order can’t be finished from here.')

  try {
    const [inq] = await db.rest(`inquiries?select=*&id=eq.${id}`)
    if (!inq) return fail(404, 'Order not found.')
    if (Date.now() - Date.parse(inq.created_at) > 60 * 60 * 1000) return fail(410, 'This order is too old to finish.')
    const already = await db.rest(`inquiry_photos?select=path&inquiry_id=eq.${id}`)

    // Record the photos that really arrived (only this inquiry's, only once).
    const photoLinks = []
    const paths = (Array.isArray(b.uploaded) ? b.uploaded : []).filter((p) => typeof p === 'string' && p.startsWith(`${inq.ref}/`) && !p.includes('..')).slice(0, MAX_PHOTOS)
    for (const path of paths) {
      const info = await fetch(`${db.url}/storage/v1/object/info/inquiry-uploads/${path}`, { headers: db.headers })
      if (!info.ok) continue
      const meta = await info.json()
      const size = Number(meta.size ?? meta.metadata?.size ?? 0)
      const mime = meta.content_type ?? meta.metadata?.mimetype ?? 'image/jpeg'
      if (!already.some((a) => a.path === path)) {
        await db.rest('inquiry_photos', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ inquiry_id: id, path, mime: TYPES[mime] ? mime : 'image/jpeg', size_bytes: Math.min(Math.max(size, 1), MAX_BYTES) }),
        })
      }
      // Links that work for 30 days, for the WhatsApp message and the email.
      const signed = await fetch(`${db.url}/storage/v1/object/sign/inquiry-uploads/${path}`, { method: 'POST', headers: db.headers, body: JSON.stringify({ expiresIn: 30 * 24 * 3600 }) })
      if (signed.ok) photoLinks.push(`${db.url}/storage/v1${(await signed.json()).signedURL}`)
    }

    const [settings] = await db.rest('site_settings?select=business_name,whatsapp,email')
    const [section] = await db.rest('sections?select=name,enquiry_text&key=eq.cakes')
    const shop = section?.name || settings?.business_name || 'us'
    const rows = summary(inq, { photoLinks })
    const text = [`${section?.enquiry_text || `Hello ${shop}! I’d love to order`} a cake.`, '', ...rows.filter(([k]) => !['Name', 'Phone', 'Email'].includes(k)).map(([k, v]) => `${k}: ${v}`)].join('\n')
    const whatsappUrl = settings?.whatsapp ? `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(text)}` : null

    // Only once per order, however many times this is called.
    let emailed = false
    if (!inq.options_snapshot?.notified) {
      await db.rest(`inquiries?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ options_snapshot: { ...inq.options_snapshot, notified: true } }),
      })
      const toShop = await sendEmail(env, {
        to: settings?.email,
        subject: `New cake order ${inq.ref} from ${inq.customer_name}`,
        intro: `A new cake order came in from the website. It’s also in the admin panel under Inquiries.`,
        rows,
        replyTo: inq.customer_email,
      })
      const toCustomer = await sendEmail(env, {
        to: inq.customer_email,
        subject: `We’ve got your cake order (${inq.ref})`,
        intro: `Thank you, ${inq.customer_name}! ${shop} has your order and will reply on WhatsApp soon. Here’s what you sent:`,
        rows: rows.filter(([k]) => !k.startsWith('Photo')),
        replyTo: settings?.email,
      })
      emailed = toShop || toCustomer
    }
    return reply(200, { ref: inq.ref, whatsappUrl, photos: photoLinks.length, emailed })
  } catch (e) {
    console.error(e)
    return fail(502, 'Your order was saved, but something went wrong at the end. We’ll still see it.')
  }
}
