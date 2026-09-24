import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export const FREE_MONTHLY_GENERATIONS = Number(
  process.env.FREE_MONTHLY_GENERATIONS ?? 2,
);

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
