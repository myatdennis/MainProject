// Minimal Supabase Edge Function health check
// Deno-first style (no exports, no frameworks)
Deno.serve(() =>
  new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  })
);
