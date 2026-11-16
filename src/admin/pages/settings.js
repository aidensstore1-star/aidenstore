import { supabase } from '../supabase.js'
import { attempt, busy, field, fill, h, must, photoUrl, removePhotoFiles, toast, uploadPhoto } from '../ui.js'

// The business's name, contact details, payment details and how it appears
// in search results.

export async function settings(content) {
  fill(content, h('h1', 'Settings'), h('p.muted', 'Loading…'))
  let s
  if (!(await attempt(async () => (s = must(await supabase.from('site_settings').select('*').single()))))) return

  let qrFile = null
  let qrRemoved = false
  const qrPreview = h('img.qr', { alt: 'UPI QR code' })
  const showQr = () => {
    const src = qrFile ? qrFile.preview : !qrRemoved && s.upi_qr_path ? photoUrl(s.upi_qr_path) : ''
    qrPreview.hidden = !src
    if (src) qrPreview.src = src
  }

  const input = (name, attrs = {}) => h('input', { name, value: s[name], ...attrs })
  const form = h(
    'form.form.form--wide',
    { novalidate: true },
    h('h2', 'Business'),
    field('Business name', input('business_name', { required: true, maxlength: 80 }), 'Shown in the top corner, the footer and page titles.'),
    field('Tagline', input('tagline', { maxlength: 160 }), 'One line about what you make, used in the footer and search results.'),
    h('h2', 'How customers reach you'),
    h(
      'div.form__row',
      field('WhatsApp number', input('whatsapp', { inputmode: 'tel', placeholder: '919800000000' }), 'With the country code, digits only (91 for India). Every “Enquire” button opens WhatsApp to this number.'),
      field('Email', input('email', { type: 'email', placeholder: 'hello@example.com' })),
      field('Instagram', input('instagram', { placeholder: 'yourhandle' }), 'Without the @.'),
    ),
    h('h2', 'Payments'),
    field('UPI ID', input('upi_id', { placeholder: 'name@bank' }), 'Shown to customers when you confirm an order.'),
    field(
      'UPI QR code',
      h(
        'div.qr-box',
        qrPreview,
        h('input', {
          type: 'file',
          accept: 'image/jpeg,image/png,image/webp',
          'aria-label': 'Upload a UPI QR code',
          onchange: (e) => {
            const file = e.target.files[0]
            if (!file) return
            file.preview = URL.createObjectURL(file)
            qrFile = file
            showQr()
          },
        }),
        s.upi_qr_path ? h('button.link.link--danger', { type: 'button', onclick: () => ((qrRemoved = true), (qrFile = null), showQr()) }, 'Remove') : null,
      ),
    ),
    h('h2', 'Search engines'),
    field('Title in search results', input('seo_title', { maxlength: 70 }), 'About 60 characters.'),
    field('Description in search results', h('textarea', { name: 'seo_description', rows: 3, maxlength: 200, value: s.seo_description }), 'About 150 characters.'),
    h('div.form__actions', h('button.btn', { type: 'submit' }, 'Save')),
  )

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const v = (name) => form.elements[name].value.trim()
    const whatsapp = v('whatsapp').replace(/[\s+()-]/g, '')
    const instagram = v('instagram').replace(/^@/, '')
    if (!v('business_name')) return toast('The business needs a name.', 'bad')
    if (!/^[0-9]{0,15}$/.test(whatsapp)) return toast('The WhatsApp number can only have digits (with the country code, e.g. 919800000000).', 'bad')
    if (whatsapp && whatsapp.length < 10) return toast('That WhatsApp number looks too short: include the country code.', 'bad')
    if (!/^[A-Za-z0-9._]{0,30}$/.test(instagram)) return toast('That Instagram handle isn’t valid.', 'bad')
    if (v('email') && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v('email'))) return toast('That email address isn’t valid.', 'bad')
    busy(form, true)
    const ok = await attempt(async () => {
      const change = {
        business_name: v('business_name'),
        tagline: v('tagline'),
        whatsapp,
        email: v('email'),
        instagram,
        upi_id: v('upi_id'),
        seo_title: v('seo_title'),
        seo_description: v('seo_description'),
      }
      const oldQr = s.upi_qr_path
      // Exact colours, so it still scans.
      if (qrFile) change.upi_qr_path = (await uploadPhoto(qrFile, 'settings/upi-qr', { grade: false })).path
      else if (qrRemoved) change.upi_qr_path = null
      must(await supabase.from('site_settings').update(change).eq('id', 1))
      if (oldQr && change.upi_qr_path !== undefined && oldQr !== change.upi_qr_path) await removePhotoFiles([oldQr])
      Object.assign(s, change)
      qrFile = null
      qrRemoved = false
    }, 'Saved')
    busy(form, false)
    if (ok) {
      form.elements.whatsapp.value = s.whatsapp
      form.elements.instagram.value = s.instagram
      showQr()
    }
  })

  fill(content, h('h1', 'Settings'), form, h('p.muted.small', 'Changes show on the website after you publish.'))
  showQr()
}
