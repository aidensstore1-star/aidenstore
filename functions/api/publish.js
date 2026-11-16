// POST /api/publish: rebuilds the website with the latest content from the
// admin panel. A Cloudflare Pages Function, so it runs on Cloudflare next to
// the site.
//
// Only a signed-in admin can publish: the caller's own Supabase login is
// checked against the database, and the request is recorded in publish_log
// with that same login, so the database's own rules decide. The rebuild is
// started through a Cloudflare deploy hook whose address is a secret.
//
// Settings (Cloudflare Pages → Settings → Variables and secrets):
//   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY  the same as the site's
//   DEPLOY_HOOK_URL  secret: Settings → Builds → Deploy hooks → add one for the
//                    production branch, and paste its address here

// Two presses within this time start only one rebuild.
const COOLDOWN_MS = 2 * 60 * 1000

const reply = (status, message, extra = {}) =>
  new Response(JSON.stringify({ ok: status < 300, message, ...extra }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

export async function onRequestPost({ request, env }) {
  // Only the admin panel on this site may call this.
  const origin = request.headers.get('Origin')
  if (origin && new URL(origin).host !== new URL(request.url).host) return reply(403, 'Not allowed from another site.')

  const url = env.VITE_SUPABASE_URL?.replace(/\/$/, '')
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key || !env.DEPLOY_HOOK_URL) return reply(503, 'Publishing isn’t set up yet.')

  const token = (request.headers.get('Authorization') || '').match(/^Bearer (.+)$/)?.[1]
  if (!token) return reply(401, 'Please sign in again.')
  // Requests to Supabase are made as the person who pressed Publish.
  const asUser = { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  let note = ''
  try {
    note = String((await request.json())?.message || '').trim().slice(0, 200)
  } catch {
    // No message given.
  }

  const admin = await fetch(`${url}/rest/v1/rpc/is_admin`, { method: 'POST', headers: asUser, body: '{}' })
  if (admin.status === 401) return reply(401, 'Please sign in again.')
  if (!admin.ok) return reply(502, 'Couldn’t check your account. Please try again.')
  if ((await admin.json()) !== true) return reply(403, 'Only admins can publish.')

  const last = await fetch(`${url}/rest/v1/publish_log?select=created_at&order=created_at.desc&limit=1`, { headers: asUser })
  const [previous] = last.ok ? await last.json() : []
  if (previous && Date.now() - Date.parse(previous.created_at) < COOLDOWN_MS) {
    return reply(429, 'A publish has just started. Your changes made before it are included; wait a couple of minutes to publish again.')
  }

  const hook = await fetch(env.DEPLOY_HOOK_URL, { method: 'POST' })
  if (!hook.ok) return reply(502, 'Cloudflare didn’t start the rebuild. Please try again in a minute.')
  const deployId = (await hook.json().catch(() => null))?.result?.id ?? null

  const logged = await fetch(`${url}/rest/v1/publish_log`, {
    method: 'POST',
    headers: { ...asUser, Prefer: 'return=minimal' },
    body: JSON.stringify({ deploy_id: deployId, message: note }),
  })
  // The rebuild has started either way; a missing log entry only affects the history.
  return reply(202, logged.ok ? 'Publishing started.' : 'Publishing started (not recorded in the history).', { deployId })
}
