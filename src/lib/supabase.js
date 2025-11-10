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
        // Avoid Vite/Rollup preloading/eager evaluation by hiding the module specifier
        // from static analysis and marking with @vite-ignore. This prevents the
        // supabase chunk from being modulepreload'ed and evaluated on initial load
        // when Supabase isn't configured (which caused a runtime ReferenceError).
        const pkg = '@supabase' + '/supabase-js';
        // Using dynamic import with concatenated string prevents static preloading.
        // Type assertion keeps TS happy; module shape inferred at runtime.
        const mod = await import(/* @vite-ignore */ pkg);
        _supabase = mod.createClient(supabaseUrl, supabaseAnonKey, {
            realtime: { params: { eventsPerSecond: 10 } },
        });
        return _supabase;
    }
    catch (err) {
        console.warn('[supabase] Dynamic import failed; falling back to null client:', err);
        return null;
    }
}
// Backwards compatibility export (legacy code may import { supabase })
export const supabase = null;
