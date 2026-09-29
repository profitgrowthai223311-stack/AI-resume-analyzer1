import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FREE_MONTHLY_GENERATIONS = Number(
  process.env.FREE_MONTHLY_GENERATIONS ?? 2,
);
// Keep in sync with free_total_upload_limit in
// supabase/migrations/20260930000001_free_upload_limit.sql, which is the actual enforcement
// (a database trigger, so it can't be bypassed by calling the Supabase client directly). This
// constant is only for surfacing the same number in the UI ahead of time.
export const FREE_TOTAL_UPLOADS = Number(process.env.FREE_TOTAL_UPLOADS ?? 2);

export async function getPlan(
  supabase: SupabaseClient,
  userId: string,
): Promise<"pro" | "free"> {
  const { data } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.status === "active") return "pro";
  // A cancelled subscription keeps Pro until the paid period ends.
  if (
    data?.status === "cancelled" &&
    data.current_period_end &&
    new Date(data.current_period_end) > new Date()
  )
    return "pro";
  return "free";
}

export async function totalUploads(supabase: SupabaseClient, userId: string) {
  const { count } = await supabase
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  return count ?? 0;
}

export async function monthlyUsage(supabase: SupabaseClient, userId: string) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "resume_generation")
    .gte("occurred_at", start.toISOString());
  return count ?? 0;
}
