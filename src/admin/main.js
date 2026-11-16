import '@fontsource/cormorant-garamond/latin-400.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import '@fontsource-variable/manrope'
import './admin.css'
import { arrivedFromInvite, configured, supabase } from './supabase.js'

// The admin panel: signing in, password reset, the dashboard and publishing.
// The other pages arrive in later phases.
//
// Everything shown comes from the database, so text is always set with
// textContent (never as HTML) to keep anything typed into the site from
// running as code here.

const app = document.getElementById('app')

// Builds an element: h('p.note', 'Hello') or h('button', { type: 'submit' }, 'Go').
function h(tag, ...rest) {
  const [name, ...classes] = tag.split('.')
  const el = document.createElement(name)
  if (classes.length) el.className = classes.join(' ')
  for (const part of rest) {
    if (part == null || part === false) continue
    if (typeof part === 'string' || typeof part === 'number') el.append(String(part))
    else if (part instanceof Node) el.append(part)
    else if (Array.isArray(part)) el.append(...part.filter(Boolean))
    else
      for (const [k, v] of Object.entries(part)) {
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
        else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v)
      }
  }
  return el
}

const show = (...nodes) => app.replaceChildren(...nodes)

// Turns Supabase's error messages into plain words for the owner.
function friendly(error) {
  const m = (error?.message || '').toLowerCase()
  if (m.includes('invalid login')) return 'That email and password don’t match an account.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first: open the link we sent you.'
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Please wait a few minutes and try again.'
  if (m.includes('password should be')) return 'The password needs to be at least 8 characters.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Can’t reach the server. Check your internet connection.'
  return 'Something went wrong. Please try again.'
}

function card(title, ...body) {
  return h('main.auth', h('section.auth__card', h('p.brand', 'Admin'), h('h1', title), ...body))
}

function busy(form, on) {
  for (const el of form.elements) el.disabled = on
}

// ---------- Not set up yet ----------

function notConfigured() {
  show(
    card(
      'Not connected yet',
      h('p', 'This admin panel isn’t connected to a database yet.'),
      h(
        'p.muted',
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example and supabase/README.md), then rebuild.',
      ),
    ),
  )
}

// ---------- Signing in ----------

// A message for the next sign-in screen (shown after being signed out).
let notice = ''

function signIn() {
  const note = h('p.note', { role: 'alert' }, notice)
  notice = ''
  const form = h(
    'form.form',
    { novalidate: true },
    h('label', 'Email', h('input', { type: 'email', name: 'email', autocomplete: 'username', required: true })),
    h('label', 'Password', h('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true })),
    note,
    h('button.btn', { type: 'submit' }, 'Sign in'),
    h('button.link', { type: 'button', onclick: () => forgot(form.elements.email.value) }, 'Forgot your password?'),
  )
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = form.elements.email.value.trim()
    const password = form.elements.password.value
    if (!email || !password) return (note.textContent = 'Enter your email and password.')
    note.textContent = ''
    busy(form, true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    busy(form, false)
    // On success the auth listener below opens the dashboard.
    if (error) note.textContent = friendly(error)
  })
  show(card('Sign in', form))
  form.elements.email.focus()
}

function forgot(prefill = '') {
  const note = h('p.note', { role: 'alert' })
  const form = h(
    'form.form',
    { novalidate: true },
    h('p.muted', 'Enter your email and we’ll send you a link to choose a new password.'),
    h('label', 'Email', h('input', { type: 'email', name: 'email', autocomplete: 'username', required: true, value: prefill })),
    note,
    h('button.btn', { type: 'submit' }, 'Send the link'),
    h('button.link', { type: 'button', onclick: () => signIn() }, 'Back to sign in'),
  )
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = form.elements.email.value.trim()
    if (!email) return (note.textContent = 'Enter your email.')
    busy(form, true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })
    busy(form, false)
    if (error) return (note.textContent = friendly(error))
    // Worded so it doesn't reveal whether the email has an account.
    show(
      card(
        'Check your email',
        h('p', 'If that email belongs to an admin, a link to choose a new password is on its way.'),
        h('button.link', { type: 'button', onclick: () => signIn() }, 'Back to sign in'),
      ),
    )
  })
  show(card('Reset your password', form))
  form.elements.email.focus()
}

// Also the first screen for someone arriving from their invitation email.
function newPassword({ invited = false } = {}) {
  const note = h('p.note', { role: 'alert' })
  const form = h(
    'form.form',
    { novalidate: true },
    h('label', 'New password', h('input', { type: 'password', name: 'password', autocomplete: 'new-password', minlength: 8, required: true })),
    h('label', 'Type it again', h('input', { type: 'password', name: 'again', autocomplete: 'new-password', required: true })),
    note,
    h('button.btn', { type: 'submit' }, invited ? 'Save and continue' : 'Save the new password'),
  )
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const password = form.elements.password.value
    if (password.length < 8) return (note.textContent = 'Use at least 8 characters.')
    if (password !== form.elements.again.value) return (note.textContent = 'The two passwords don’t match.')
    busy(form, true)
    const { error } = await supabase.auth.updateUser({ password })
    busy(form, false)
    if (error) return (note.textContent = friendly(error))
    recovering = false
    openPanel()
  })
  show(
    invited
      ? card('Welcome', h('p', 'Choose a password for signing in to the admin panel. You’ll use it with this email from now on.'), form)
      : card('Choose a new password', form),
  )
  form.elements.password.focus()
}

// ---------- The panel ----------

// Pages in the menu, with the phase that brings each one.
const pages = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'inquiries', label: 'Inquiries', soon: 'phase 4' },
  { id: 'products', label: 'Products', soon: 'phase 3' },
  { id: 'cake-options', label: 'Cake options', soon: 'phase 3' },
  { id: 'content', label: 'Site text', soon: 'phase 3' },
  { id: 'gallery', label: 'Gallery', soon: 'phase 3' },
  { id: 'settings', label: 'Settings', soon: 'phase 3' },
  { id: 'publish', label: 'Publish' },
]

// Shows a page of the panel; remembered in the address (#publish) so a
// reload stays on it.
const views = { dashboard: (el) => dashboard(el), publish: (el) => publish(el) }
let stopPage = null
function go(id, content, nav) {
  if (!views[id]) id = 'dashboard'
  stopPage?.()
  stopPage = null
  for (const b of nav.querySelectorAll('.nav__item')) b.setAttribute('aria-current', b.dataset.page === id ? 'page' : 'false')
  history.replaceState(null, '', id === 'dashboard' ? location.pathname : `#${id}`)
  views[id](content)
}

const dateTime = (iso) =>
  iso ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—'

const describe = {
  insert: 'added',
  update: 'changed',
  delete: 'removed',
}
const tableNames = {
  site_settings: 'settings',
  sections: 'a section',
  content_blocks: 'site text',
  products: 'a product',
  product_images: 'a product photo',
  gallery_items: 'the gallery',
  cake_options: 'a cake option',
  inquiries: 'an inquiry',
  orders: 'an order',
  payments: 'a payment',
  admins: 'the team',
  admin_invites: 'an invite',
}

async function openPanel() {
  const { data: session } = await supabase.auth.getSession()
  const user = session.session?.user
  if (!user) return signIn()
  openFor = user.id

  // Only people on the team get in, whatever account they signed in with.
  const { data: isAdmin, error } = await supabase.rpc('is_admin')
  if (error || !isAdmin) {
    notice = error ? friendly(error) : 'That account isn’t on the admin team. Ask the owner to invite you.'
    // Signing out shows the sign-in screen with the notice.
    return supabase.auth.signOut()
  }

  const { data: me } = await supabase.from('admins').select('email, role').eq('user_id', user.id).single()
  const { data: settings } = await supabase.from('site_settings').select('business_name').single()

  const content = h('section.content')
  const nav = h(
    'nav.nav',
    { 'aria-label': 'Admin' },
    pages.map((p) =>
      h(
        'button.nav__item',
        {
          type: 'button',
          'data-page': p.id,
          disabled: Boolean(p.soon),
          title: p.soon ? `Coming in ${p.soon}` : false,
          onclick: () => go(p.id, content, nav),
        },
        p.label,
        p.soon ? h('span.nav__soon', 'soon') : null,
      ),
    ),
  )
  show(
    h(
      'div.panel',
      h(
        'header.top',
        h('p.brand', settings?.business_name || 'Shop', h('span', ' · Admin')),
        h(
          'div.top__me',
          h('span.muted', `${me?.email || user.email} · ${me?.role || 'admin'}`),
          h('button.link', { type: 'button', onclick: () => supabase.auth.signOut() }, 'Sign out'),
        ),
      ),
      nav,
      content,
    ),
  )
  go(location.hash.slice(1), content, nav)
}

// ---------- Publishing ----------

// When the live site last fetched its content, from the build-info.json that
// every build writes. A publish is live once the live site's content is
// newer than the moment it was requested.
async function liveBuild() {
  try {
    const res = await fetch(new URL('../build-info.json', location.href), { cache: 'no-store' })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

function publishState(entry, build) {
  const asked = Date.parse(entry.created_at)
  if (build?.contentFetchedAt && Date.parse(build.contentFetchedAt) >= asked) return { label: 'Live', tone: 'ok' }
  if (Date.now() - asked < 15 * 60 * 1000) return { label: 'Building…', tone: 'busy' }
  return { label: 'Didn’t go live: check the build in Cloudflare', tone: 'bad' }
}

async function dashboard(content) {
  content.replaceChildren(h('h1', 'Dashboard'), h('p.muted', 'Loading…'))
  const [{ data: summary, error }, { data: activity }] = await Promise.all([
    supabase.rpc('dashboard_summary'),
    supabase.from('activity_log').select('action, table_name, at, actor').order('at', { ascending: false }).limit(8),
  ])
  if (error) return content.replaceChildren(h('h1', 'Dashboard'), h('p.note', friendly(error)))

  const stat = (label, value, hint) => h('div.stat', h('p.stat__value', String(value ?? 0)), h('p.stat__label', label), hint ? h('p.muted', hint) : null)
  const last = summary.last_publish
  const lastState = last ? publishState(last, await liveBuild()) : null
  content.replaceChildren(
    h('h1', 'Dashboard'),
    h(
      'div.stats',
      stat('New inquiries', summary.new_inquiries),
      stat('Open inquiries', summary.open_inquiries),
      stat('Awaiting payment', summary.awaiting_payment),
      stat('Products on the site', summary.products_published, summary.products_hidden ? `${summary.products_hidden} hidden` : null),
    ),
    h(
      'div.box',
      h('h2', 'Last publish'),
      last
        ? h('p', h(`span.badge.badge--${lastState.tone}`, lastState.label), ` ${dateTime(last.created_at)}${last.message ? ` · ${last.message}` : ''}`)
        : h('p.muted', 'Nothing published from here yet.'),
    ),
    h(
      'div.box',
      h('h2', 'Recent changes'),
      activity?.length
        ? h(
            'ul.activity',
            activity.map((a) => h('li', h('span', `${a.actor ? 'Admin' : 'Website'} ${describe[a.action] || a.action} ${tableNames[a.table_name] || a.table_name}`), h('span.muted', dateTime(a.at)))),
          )
        : h('p.muted', 'No changes yet.'),
    ),
  )
}

async function publish(content) {
  const note = h('p.note', { role: 'status' })
  const form = h(
    'form.form.publish',
    h('label', 'What changed? (optional)', h('input', { name: 'message', maxlength: 200, placeholder: 'e.g. New cake prices' })),
    note,
    h('button.btn', { type: 'submit' }, 'Publish changes'),
  )
  const liveLine = h('p.muted')
  const historyBox = h('div.box', h('h2', 'History'), h('p.muted', 'Loading…'))
  content.replaceChildren(
    h('h1', 'Publish'),
    h('p', 'Changes made here appear on the website once you publish. The site is rebuilt with everything saved so far, which takes about a minute.'),
    h('div.box', form, liveLine),
    historyBox,
  )

  let timer = 0
  let alive = true
  stopPage = () => {
    alive = false
    clearTimeout(timer)
  }

  async function refresh() {
    const [{ data: log, error }, { data: team }, build] = await Promise.all([
      supabase.from('publish_log').select('created_at, message, requested_by').order('created_at', { ascending: false }).limit(15),
      supabase.from('admins').select('user_id, email'),
      liveBuild(),
    ])
    if (!alive) return
    liveLine.textContent = build ? `The live site was built ${dateTime(build.builtAt)}.` : ''
    if (error) return historyBox.replaceChildren(h('h2', 'History'), h('p.note', friendly(error)))
    const who = Object.fromEntries((team || []).map((t) => [t.user_id, t.email]))
    const states = (log || []).map((e) => publishState(e, build))
    historyBox.replaceChildren(
      h('h2', 'History'),
      log?.length
        ? h(
            'ul.activity',
            log.map((e, i) =>
              h(
                'li',
                h('span', h(`span.badge.badge--${states[i].tone}`, states[i].label), ` ${e.message || 'Published'}`),
                h('span.muted', `${who[e.requested_by] || 'Someone'} · ${dateTime(e.created_at)}`),
              ),
            ),
          )
        : h('p.muted', 'Nothing published from here yet.'),
    )
    // Keep checking while a publish is on its way.
    if (states.some((s) => s.tone === 'busy')) timer = setTimeout(refresh, 10000)
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    busy(form, true)
    note.textContent = 'Starting…'
    try {
      const { data } = await supabase.auth.getSession()
      const res = await fetch(new URL('../api/publish', location.href), {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: form.elements.message.value }),
      })
      const body = await res.json().catch(() => ({}))
      note.textContent =
        body.message || (res.status === 404 ? 'Publishing only works on the live site (it needs Cloudflare).' : 'Couldn’t start publishing. Please try again.')
      if (res.ok) form.reset()
    } catch {
      note.textContent = 'Can’t reach the server. Check your internet connection.'
    }
    busy(form, false)
    clearTimeout(timer)
    refresh()
  })

  refresh()
}

// ---------- Start ----------

// Arriving from a password-reset link or an invitation: choose a password
// before anything else (for an invitation, only on that first arrival).
let recovering = false
let inviteToAnswer = arrivedFromInvite
// Whose panel is open, so repeated sign-in events don't redraw it.
let openFor = null

if (!configured) {
  notConfigured()
} else {
  supabase.auth.onAuthStateChange((event, session) => {
    // Run outside the callback: Supabase asks that it not await other calls.
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY' || (inviteToAnswer && session && event !== 'SIGNED_OUT')) {
        const invited = event !== 'PASSWORD_RECOVERY'
        inviteToAnswer = false
        recovering = true
        return newPassword({ invited })
      }
      if (recovering) return
      if (!session || event === 'SIGNED_OUT') {
        openFor = null
        return signIn()
      }
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && openFor !== session.user.id) {
        openFor = session.user.id
        openPanel()
      }
    })
  })
}
