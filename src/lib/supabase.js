// Lazy/dynamic import to avoid bundling supabase client when not configured
// This prevents runtime errors in environments without Supabase and avoids loading the supabase chunk unnecessarily.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
// Export a value that is either a Supabase client instance or null.
// Use top-level await with dynamic import so the module only loads when configured.
// Type is any to avoid importing supabase types eagerly.
// Consumers should handle the possibility of null (many already do).
// Defensive wrapper: some bundlers can still pre-evaluate dynamic import chunk.
// Provide a lazy getter so code only loads when actually needed.
let _supabase = null;
export async function getSupabase() {
    if (!hasSupabaseConfig)
        return null;
    if (_supabase)
        return _supabase;
    try {
        const pkg = '@supabase' + '/supabase-js';
        let mod = null;
        // Always use the @vite-ignore dynamic import so bundlers don't eagerly
        // include the supabase bundle for builds that don't set the
        // VITE_SUPABASE_* env vars. This prevents runtime evaluation of the
        // supabase chunk in E2E/demo scenarios.
        mod = await import(/* @vite-ignore */ pkg);
        _supabase = mod.createClient(supabaseUrl, supabaseAnonKey, {
            realtime: { params: { eventsPerSecond: 10 } },
        });
        return _supabase;
    }
    catch (err) {
        try {
            // Only warn during local development. In production (or E2E/demo
            // builds) we intentionally silence this to avoid noisy console
            // messages that pollute Playwright captures and user telemetry.
            if (import.meta && import.meta.env && import.meta.env.DEV) {
                console.warn('[supabase] Dynamic import failed; falling back to null client:', err);
            }
        }
        catch (_) { }
        return null;
    }
}
// Backwards compatibility export (legacy code may import { supabase })
export const supabase = null;
