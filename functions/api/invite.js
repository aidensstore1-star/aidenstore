// POST /api/invite: invites someone to the admin panel by email. A Cloudflare
// Pages Function, because sending Supabase's invitation email needs the
// project's secret key, which must never reach the browser.
//
// Only an owner can invite: the caller's own Supabase login is checked, and
// the invite is recorded with that same login, so the database's rules decide.
//
// Settings (Cloudflare Pages → Settings → Variables and secrets):
//   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY  the same as the site's
//   SUPABASE_SERVICE_KEY  secret: the project's secret key (Supabase →
//                         Project Settings → API keys)

const reply = (status, message) =>
  new Response(JSON.stringify({ ok: status < 300, message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

export async function onRequestPost({ request, env }) {
  const here = new URL(request.url)
  const origin = request.headers.get('Origin')
  if (origin && new URL(origin).host !== here.host) return reply(403, 'Not allowed from another site.')

  const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key || !env.SUPABASE_SERVICE_KEY) return reply(503, 'Invitations aren’t set up yet.')

  const token = (request.headers.get('Authorization') || '').match(/^Bearer (.+)$/)?.[1]
  if (!token) return reply(401, 'Please sign in again.')
  const asUser = { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  let body
  try {
    body = await request.json()
  } catch {
    return reply(400, 'Missing details.')
  }
  const email = String(body?.email || '').trim().toLowerCase()
  const role = body?.role === 'owner' ? 'owner' : 'editor'
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) return reply(400, 'Enter a valid email address.')
  // The link in the email comes back to this site's admin panel, never elsewhere.
  const redirectTo = new URL('/admin/', here).href

  const owner = await fetch(`${url}/rest/v1/rpc/is_owner`, { method: 'POST', headers: asUser, body: '{}' })
  if (owner.status === 401) return reply(401, 'Please sign in again.')
  if (!owner.ok) return reply(502, 'Couldn’t check your account. Please try again.')
  if ((await owner.json()) !== true) return reply(403, 'Only owners can invite people.')

  // Recorded as the owner, so the database's own rules apply.
  const recorded = await fetch(`${url}/rest/v1/admin_invites?on_conflict=email`, {
    method: 'POST',
    headers: { ...asUser, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ email, role }),
  })
  if (!recorded.ok) return reply(502, 'Couldn’t save the invitation. Please try again.')

  const sent = await fetch(`${url}/auth/v1/invite?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (sent.ok) return reply(200, `Invitation sent to ${email}.`)
  const error = await sent.json().catch(() => ({}))
  if (error.error_code === 'email_exists' || /already been registered/i.test(error.msg || '')) {
    // They already have an account: being invited has put them on the team.
    return reply(200, `${email} already has an account, so they’re on the team now. They sign in with their password (or “Forgot your password?”).`)
  }
  if (sent.status === 429 || /rate limit/i.test(error.msg || '')) return reply(429, 'Too many emails sent in the last hour. Please try again later.')
  return reply(502, 'The invitation was saved, but the email couldn’t be sent. Try “Send again” in a few minutes.')
}
