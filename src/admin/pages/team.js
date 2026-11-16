import { supabase } from '../supabase.js'
import { attempt, busy, dateTime, field, fill, h, must, toast } from '../ui.js'

// Who can use the admin panel. Owners invite and remove people; editors can
// do everything else.

export async function team(content, { me }) {
  fill(content, h('h1', 'Team'), h('p.muted', 'Loading…'))
  let admins = []
  let invites = []
  const isOwner = me.role === 'owner'
  const ok = await attempt(async () => {
    admins = must(await supabase.from('admins').select('user_id, email, role, created_at').order('created_at'))
    invites = isOwner ? must(await supabase.from('admin_invites').select('email, role, created_at').order('created_at')) : []
  })
  if (!ok) return

  const list = h('ul.rows')
  const pending = h('div')

  const draw = () => {
    fill(list,
      ...admins.map((a) =>
        h(
          'li.row',
          h('div.row__main', h('span.row__title', a.email), h('span.muted', a.user_id === me.user_id ? 'You' : `Since ${dateTime(a.created_at)}`)),
          isOwner && a.user_id !== me.user_id
            ? [
                h(
                  'select',
                  { 'aria-label': `Role for ${a.email}`, onchange: (e) => setRole(a, e.target.value, e.target) },
                  [['owner', 'Owner'], ['editor', 'Editor']].map(([v, l]) => h('option', { value: v, selected: a.role === v }, l)),
                ),
                h('button.link.link--danger', { type: 'button', onclick: () => remove(a) }, 'Remove'),
              ]
            : h('span.badge.badge--plain', a.role === 'owner' ? 'Owner' : 'Editor'),
        ),
      ),
    )
    const waiting = invites.filter((i) => !admins.some((a) => a.email === i.email))
    fill(pending,
      ...(waiting.length
        ? [
            h('h2', 'Invited, not signed in yet'),
            h(
              'ul.rows',
              waiting.map((i) =>
                h(
                  'li.row',
                  h('div.row__main', h('span.row__title', i.email), h('span.muted', `${i.role === 'owner' ? 'Owner' : 'Editor'} · invited ${dateTime(i.created_at)}`)),
                  h('button.link', { type: 'button', onclick: () => send(i.email, i.role) }, 'Send again'),
                  h('button.link.link--danger', { type: 'button', onclick: () => cancel(i) }, 'Cancel'),
                ),
              ),
            ),
          ]
        : []),
    )
  }

  async function setRole(a, role, select) {
    if (await attempt(async () => {
      must(await supabase.from('admins').update({ role }).eq('user_id', a.user_id))
      must(await supabase.from('admin_invites').upsert({ email: a.email, role }))
    }, 'Saved')) a.role = role
    else select.value = a.role
  }

  async function remove(a) {
    if (!confirm(`Remove ${a.email} from the team? They won’t be able to sign in to the admin panel any more.`)) return
    if (await attempt(async () => {
      must(await supabase.from('admins').delete().eq('user_id', a.user_id))
      must(await supabase.from('admin_invites').delete().eq('email', a.email))
    }, 'Removed')) admins = admins.filter((x) => x !== a)
    draw()
  }

  async function cancel(i) {
    if (await attempt(async () => must(await supabase.from('admin_invites').delete().eq('email', i.email)), 'Invite cancelled')) invites = invites.filter((x) => x !== i)
    draw()
  }

  // The invitation email is sent by the site's server code (it needs a key
  // that never reaches the browser).
  async function send(email, role) {
    const { data } = await supabase.auth.getSession()
    let res
    try {
      res = await fetch(new URL('../api/invite', location.href), {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, redirectTo: new URL('./', location.href).href }),
      })
    } catch {
      return toast('Can’t reach the server. Check your internet connection.', 'bad')
    }
    const body = await res.json().catch(() => ({}))
    if (res.status === 404) return toast('Invitations can only be sent from the live site.', 'bad')
    toast(body.message || (res.ok ? 'Invitation sent' : 'The invitation couldn’t be sent.'), res.ok ? 'ok' : 'bad')
    if (res.ok) {
      invites = must(await supabase.from('admin_invites').select('email, role, created_at').order('created_at'))
      admins = must(await supabase.from('admins').select('user_id, email, role, created_at').order('created_at'))
      draw()
    }
  }

  const email = h('input', { type: 'email', required: true, placeholder: 'their@email.com', 'aria-label': 'Email' })
  const role = h('select', { 'aria-label': 'Role' }, h('option', { value: 'editor' }, 'Editor: can change everything except the team'), h('option', { value: 'owner' }, 'Owner: can also invite and remove people'))
  const inviteForm = h('form.form', field('Email', email), field('Role', role), h('div.form__actions', h('button.btn', { type: 'submit' }, 'Send invitation')))
  inviteForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const address = email.value.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return toast('Enter a valid email address.', 'bad')
    busy(inviteForm, true)
    await send(address, role.value)
    busy(inviteForm, false)
    email.value = ''
  })

  fill(content,
    h('h1', 'Team'),
    h('p', 'People who can sign in to this admin panel.'),
    list,
    pending,
    isOwner ? [h('h2', 'Invite someone'), h('p.muted', 'They get an email with a link to choose a password. The link works once, for 24 hours.'), inviteForm] : h('p.muted', 'Only owners can invite or remove people.'),
  )
  draw()
}
