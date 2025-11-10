// Frontend Supabase client wrapper for Admin dashboard and realtime subscriptions
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Realtime features will be disabled.')
}

export const supabaseClient = url && anonKey ? createClient(String(url), String(anonKey)) : null

export default supabaseClient
