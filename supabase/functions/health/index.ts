// Ultra-simple health check for Supabase Edge Functions
Deno.serve(() =>
  new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain" },
  })
);
