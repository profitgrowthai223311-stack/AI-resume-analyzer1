// Edge Function: create-checkout (see PRD section 11). Not implemented yet.
Deno.serve(() =>
  new Response(JSON.stringify({ error: "not_implemented" }), {
    status: 501,
    headers: { "Content-Type": "application/json" },
  }),
);
