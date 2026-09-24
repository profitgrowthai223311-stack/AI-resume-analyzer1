import { getAuthed, json, unauthorized } from "@/lib/server/api-auth";
import { razorpay } from "@/lib/server/razorpay";
import { adminClient } from "@/lib/server/supabase-admin";

// Cancels at the end of the paid cycle. Local status changes only via the verified webhook.
export async function POST(request: Request) {
  const auth = await getAuthed(request);
  if (!auth) return unauthorized();
  const { data: sub } = await adminClient()
    .from("subscriptions")
    .select("razorpay_subscription_id, status")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (!sub?.razorpay_subscription_id || sub.status !== "active")
    return json({ error: "no_active_subscription" }, 404);
  try {
    await razorpay(`/subscriptions/${sub.razorpay_subscription_id}/cancel`, {
      cancel_at_cycle_end: 1,
    });
    return json({ ok: true });
  } catch {
    return json({ error: "cancel_failed" }, 502);
  }
}
