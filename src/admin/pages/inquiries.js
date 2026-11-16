import { supabase } from '../supabase.js'
import { attempt, busy, dateOnly, dateTime, field, fill, h, money, must, toast } from '../ui.js'

// Cake inquiries from the website: who asked, for what, with their photos;
// then the quote and the payments for it.

export const STATUSES = [
  ['new', 'New'],
  ['contacted', 'Contacted'],
  ['quoted', 'Quoted'],
  ['confirmed', 'Confirmed'],
  ['paid', 'Paid'],
  ['delivered', 'Delivered'],
  ['cancelled', 'Cancelled'],
]
const statusLabel = (s) => STATUSES.find(([v]) => v === s)?.[1] || s
const ORDER_STATUSES = [
  ['quoted', 'Quote sent'],
  ['awaiting_payment', 'Awaiting payment'],
  ['advance_paid', 'Advance paid'],
  ['paid', 'Paid in full'],
  ['cancelled', 'Cancelled'],
  ['refunded', 'Refunded'],
]
const METHODS = [
  ['upi_whatsapp', 'UPI (WhatsApp)'],
  ['cash', 'Cash'],
  ['bank_transfer', 'Bank transfer'],
  ['other', 'Other'],
]

const tone = (status) => (status === 'new' ? 'busy' : status === 'cancelled' ? 'bad' : ['paid', 'delivered'].includes(status) ? 'ok' : 'plain')

// WhatsApp wants the number with its country code and digits only.
const waNumber = (phone) => {
  const digits = String(phone).replace(/\D/g, '')
  return digits.length === 10 ? `91${digits}` : digits
}

export async function inquiries(content) {
  let filter = { status: 'open', search: '' }

  async function showList() {
    fill(content, h('h1', 'Inquiries'), h('p.muted', 'Loading…'))
    let list = []
    if (!(await attempt(async () => (list = must(await supabase.from('inquiries').select('id, ref, status, customer_name, customer_phone, event_date, options_snapshot, created_at').order('created_at', { ascending: false }).limit(500))))))
      return
    const rows = h('ul.rows')
    const draw = () => {
      const q = filter.search.trim().toLowerCase()
      const shown = list.filter(
        (i) =>
          (filter.status === 'all' || (filter.status === 'open' ? !['delivered', 'cancelled'].includes(i.status) : i.status === filter.status)) &&
          (!q || `${i.ref} ${i.customer_name} ${i.customer_phone}`.toLowerCase().includes(q)),
      )
      fill(rows,
        ...(shown.length
          ? shown.map((i) =>
              h(
                'li.row',
                h('span', { class: `badge badge--${tone(i.status)}` }, statusLabel(i.status)),
                h(
                  'div.row__main',
                  h('button.row__title', { type: 'button', onclick: () => open(i.id) }, `${i.customer_name} · ${i.ref}`),
                  h('span.muted', [i.options_snapshot?.occasion, i.event_date ? `for ${dateOnly(i.event_date)}` : null, `sent ${dateTime(i.created_at)}`].filter(Boolean).join(' · ')),
                ),
                h('button.btn.btn--quiet', { type: 'button', onclick: () => open(i.id) }, 'Open'),
              ),
            )
          : [h('li.muted', list.length ? 'No inquiries match.' : 'No inquiries yet. They arrive here from the cake form on the website.')]),
      )
    }
    fill(content,
      h('h1', 'Inquiries'),
      h(
        'div.toolbar',
        h('input', { type: 'search', placeholder: 'Search name, phone or number', 'aria-label': 'Search inquiries', value: filter.search, oninput: (e) => ((filter.search = e.target.value), draw()) }),
        h(
          'select',
          { 'aria-label': 'Show', onchange: (e) => ((filter.status = e.target.value), draw()) },
          [['open', 'Open'], ['all', 'All'], ...STATUSES].map(([v, l]) => h('option', { value: v, selected: filter.status === v }, l)),
        ),
      ),
      rows,
    )
    draw()
  }

  async function open(id) {
    fill(content, h('p.muted', 'Loading…'))
    let inq, photos, order, payments
    const ok = await attempt(async () => {
      ;[inq, photos, order] = await Promise.all([
        supabase.from('inquiries').select('*').eq('id', id).single().then(must),
        supabase.from('inquiry_photos').select('id, path, mime').eq('inquiry_id', id).order('created_at').then(must),
        supabase.from('orders').select('*').eq('inquiry_id', id).maybeSingle().then(must),
      ])
      payments = order ? must(await supabase.from('payments').select('*').eq('order_id', order.id).order('created_at')) : []
    })
    if (!ok) return

    // Customers' photos are private: short-lived links, only for admins.
    const gallery = h('div.inquiry-photos')
    if (photos.length) {
      const signed = must(await supabase.storage.from('inquiry-uploads').createSignedUrls(photos.map((p) => p.path), 3600))
      gallery.append(...signed.filter((s) => s.signedUrl).map((s) => h('a', { href: s.signedUrl, target: '_blank', rel: 'noopener' }, h('img', { src: s.signedUrl, alt: 'Inspiration photo from the customer', loading: 'lazy' }))))
    }

    const snap = inq.options_snapshot || {}
    const facts = [
      ['Phone', inq.customer_phone],
      ['Email', inq.customer_email],
      ['For', inq.event_date ? dateOnly(inq.event_date) : null],
      ['Occasion', snap.occasion],
      ['Size', snap.size],
      ['Base', snap.base],
      ['Frosting', snap.frosting],
      ['Estimated price', snap.estimate != null ? money(snap.estimate) : null],
      ['Sent', dateTime(inq.created_at)],
    ].filter(([, v]) => v)

    const status = h('select', { 'aria-label': 'Status' }, STATUSES.map(([v, l]) => h('option', { value: v, selected: v === inq.status }, l)))
    // The badge by the name always shows the saved status.
    const badge = h('span')
    const setStatus = (value) => {
      inq.status = status.value = value
      badge.className = `badge badge--${tone(value)}`
      badge.textContent = statusLabel(value)
    }
    setStatus(inq.status)
    const notes = h('textarea', { rows: 4, value: inq.admin_notes, placeholder: 'Only admins see these notes.' })
    const handling = h(
      'form.form',
      field('Status', status),
      field('Your notes', notes),
      h('div.form__actions', h('button.btn', { type: 'submit' }, 'Save')),
    )
    handling.addEventListener('submit', async (e) => {
      e.preventDefault()
      busy(handling, true)
      if (await attempt(async () => must(await supabase.from('inquiries').update({ status: status.value, admin_notes: notes.value }).eq('id', inq.id)), 'Saved')) {
        setStatus(status.value)
        inq.admin_notes = notes.value
      }
      busy(handling, false)
    })

    const reply = `https://wa.me/${waNumber(inq.customer_phone)}?text=${encodeURIComponent(`Hello ${inq.customer_name}, thank you for your cake inquiry (${inq.ref}).`)}`

    fill(content,
      h('button.link.back', { type: 'button', onclick: () => showList() }, '← All inquiries'),
      h('div.page-head', h('h1', `${inq.customer_name}`), badge),
      h('p.muted', inq.ref),
      h('div.columns',
        h(
          'div.box',
          h('h2', 'Their request'),
          h('dl.facts', facts.map(([k, v]) => [h('dt', k), h('dd', v)])),
          inq.notes ? [h('h3', 'Their words'), h('p.quote', inq.notes)] : null,
          photos.length ? [h('h3', `Photos (${photos.length})`), gallery] : h('p.muted', 'No photos sent.'),
          h('a.btn', { href: reply, target: '_blank', rel: 'noopener' }, 'Reply on WhatsApp'),
        ),
        h('div', h('div.box', h('h2', 'Handling'), handling), orderBox()),
      ),
    )

    function orderBox() {
      const box = h('div.box')
      const draw = () => {
        if (!order) {
          const total = h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric', required: true, 'aria-label': 'Total price' })
          const advance = h('input', { type: 'number', min: 0, step: 1, inputmode: 'numeric', value: '', 'aria-label': 'Advance due' })
          const form = h(
            'form.form',
            h('div.form__row', field('Total price (₹)', total), field('Advance to ask for (₹)', advance, 'Optional.')),
            h('div.form__actions', h('button.btn', { type: 'submit' }, 'Save the quote')),
          )
          form.addEventListener('submit', async (e) => {
            e.preventDefault()
            const t = Number(total.value)
            const a = Number(advance.value || 0)
            if (!total.value || t < 0) return toast('Enter the total price.', 'bad')
            if (a > t) return toast('The advance can’t be more than the total.', 'bad')
            busy(form, true)
            const ok = await attempt(async () => {
              order = must(await supabase.from('orders').insert({ inquiry_id: inq.id, total: t, advance_due: a, status: 'quoted' }).select('*').single())
              if (['new', 'contacted'].includes(inq.status)) {
                must(await supabase.from('inquiries').update({ status: 'quoted' }).eq('id', inq.id))
                setStatus('quoted')
              }
            }, 'Quote saved')
            busy(form, false)
            if (ok) draw()
          })
          return fill(box, h('h2', 'Quote'), h('p.muted', 'Once you’ve agreed a price, note it here to keep track of payments.'), form)
        }

        const paid = payments.filter((p) => p.status === 'succeeded').reduce((sum, p) => sum + Number(p.amount), 0)
        const orderStatus = h('select', { 'aria-label': 'Order status', onchange: async (e) => {
          if (await attempt(async () => must(await supabase.from('orders').update({ status: e.target.value }).eq('id', order.id)), 'Saved')) order.status = e.target.value
          else e.target.value = order.status
        } }, ORDER_STATUSES.map(([v, l]) => h('option', { value: v, selected: v === order.status }, l)))

        const amount = h('input', { type: 'number', min: 1, step: 1, inputmode: 'numeric', 'aria-label': 'Amount received' })
        const method = h('select', { 'aria-label': 'How it was paid' }, METHODS.map(([v, l]) => h('option', { value: v }, l)))
        const when = h('input', { type: 'date', value: new Date().toISOString().slice(0, 10), 'aria-label': 'Date paid' })
        const reference = h('input', { maxlength: 80, placeholder: 'UPI reference (optional)', 'aria-label': 'Reference' })
        const payForm = h(
          'form.form',
          h('div.form__row', field('Amount (₹)', amount), field('Paid by', method), field('Date', when)),
          field('Reference', reference),
          h('div.form__actions', h('button.btn', { type: 'submit' }, 'Record payment')),
        )
        payForm.addEventListener('submit', async (e) => {
          e.preventDefault()
          const amt = Number(amount.value)
          if (!amt || amt <= 0) return toast('Enter the amount received.', 'bad')
          busy(payForm, true)
          const ok = await attempt(async () => {
            const row = must(
              await supabase
                .from('payments')
                .insert({ order_id: order.id, amount: amt, provider: method.value, provider_ref: reference.value.trim() || null, paid_at: new Date(when.value).toISOString(), status: 'succeeded' })
                .select('*')
                .single(),
            )
            payments.push(row)
            // Move the order (and inquiry) along as money comes in.
            const total = paid + amt
            const next = total >= Number(order.total) ? 'paid' : 'advance_paid'
            if (order.status !== next && !['cancelled', 'refunded'].includes(order.status)) {
              must(await supabase.from('orders').update({ status: next }).eq('id', order.id))
              order.status = next
            }
            if (next === 'paid' && !['delivered', 'cancelled'].includes(inq.status)) {
              must(await supabase.from('inquiries').update({ status: 'paid' }).eq('id', inq.id))
              setStatus('paid')
            } else if (['new', 'contacted', 'quoted'].includes(inq.status)) {
              must(await supabase.from('inquiries').update({ status: 'confirmed' }).eq('id', inq.id))
              setStatus('confirmed')
            }
          }, 'Payment recorded')
          busy(payForm, false)
          if (ok) draw()
        })

        fill(box,
          h('h2', 'Order'),
          h(
            'dl.facts',
            h('dt', 'Total'),
            h('dd', money(order.total)),
            h('dt', 'Advance asked'),
            h('dd', Number(order.advance_due) ? money(order.advance_due) : '—'),
            h('dt', 'Received'),
            h('dd', money(paid)),
            h('dt', 'Still to pay'),
            h('dd', money(Math.max(0, Number(order.total) - paid))),
          ),
          field('Order status', orderStatus),
          payments.length
            ? h(
                'ul.activity',
                payments.map((p) =>
                  h(
                    'li',
                    h('span', `${money(p.amount)} · ${METHODS.find(([v]) => v === p.provider)?.[1] || p.provider}${p.provider_ref ? ` · ${p.provider_ref}` : ''}`),
                    h('span.muted', dateOnly(p.paid_at || p.created_at)),
                  ),
                ),
              )
            : h('p.muted', 'No payments recorded yet.'),
          h('h3', 'Record a payment'),
          payForm,
        )
      }
      draw()
      return box
    }
  }

  await showList()
}
