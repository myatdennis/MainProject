// Frontend Supabase client wrapper for Admin dashboard and realtime subscriptions
// IMPORTANT: avoid statically importing @supabase/supabase-js here so the
// bundler doesn't include the large supabase chunk in builds for sites that
// don't configure Supabase (E2E/demo mode). Use the lazy getSupabase() helper
// from ./supabase which performs a guarded dynamic import.
import { getSupabase } from './supabase';
const url = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
    console.warn('[supabaseClient] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set. Realtime features will be disabled.');
}
// Keep a synchronous null export so existing callers that check for the
// presence of a client (if (supabaseClient) { ... }) continue to work.
export let supabaseClient = null;
// Async accessor for code that wants to eagerly initialize the client.
export async function getSupabaseClient() {
    if (supabaseClient) return supabaseClient;
    supabaseClient = await getSupabase();
    return supabaseClient;
}
export default supabaseClient;
