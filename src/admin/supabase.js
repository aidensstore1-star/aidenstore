import { createClient } from '@supabase/supabase-js'

// The project's address and its publishable (anon) key. Both are safe in the
// browser: what each person may see or change is decided by the database's
// row-level security, not by keeping these secret. The service key must never
// appear here.
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const configured = Boolean(url && key)

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
