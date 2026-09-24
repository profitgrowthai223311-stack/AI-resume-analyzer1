import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";

/**
 * Resolves the caller from the session cookie (browser) or a Bearer token (scripts/tests).
 * The returned client acts as the user, so RLS applies.
 */
export async function getAuthed(request: Request) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /i, "");
  const supabase = bearer
    ? createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${bearer}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        },
      )
    : await createCookieClient();
  const { data } = await supabase.auth.getUser(bearer);
  if (!data.user) return null;
  return { supabase, user: data.user };
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status });
}
export const unauthorized = () => json({ error: "unauthorized" }, 401);

/** Structured event log. Never pass resume or job-description text. */
export function logEvent(event: string, fields: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({ event, ts: new Date().toISOString(), ...fields }),
  );
}
