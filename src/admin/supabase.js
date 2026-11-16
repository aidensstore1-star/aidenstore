import { createClient } from '@supabase/supabase-js'

// The project's address and its publishable (anon) key. Both are safe in the
// browser: what each person may see or change is decided by the database's
// row-level security, not by keeping these secret. The service key must never
// appear here.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const configured = Boolean(url && key)

// Someone arriving from their invitation email. Read before the client below
// starts, because it signs them in from the address and then clears it.
export const arrivedFromInvite = /[#&?]type=invite\b/.test(location.hash + location.search)

export const supabase = configured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Password-reset links come back to the admin page signed in. (The
        // default flow, so a link works on any device, not only the browser
        // that asked for it.)
        detectSessionInUrl: true,
        storageKey: 'shop-admin-session',
      },
    })
  : null
