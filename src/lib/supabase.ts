import { createClient } from '@supabase/supabase-js'

// Publishable key: safe in the browser; all data is protected by RLS (allowlist only).
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://jlvwdgbhntmqujcfbhxx.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_XEwBN6eF5mUUufKVAiwixw_pxUhi4f1'

export const supabase = createClient(url, key)
