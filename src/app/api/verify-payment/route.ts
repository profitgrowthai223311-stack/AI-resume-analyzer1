import { z } from "zod";
import { getAuthed, json, logEvent, unauthorized } from "@/lib/server/api-auth";
import { rateLimit } from "@/lib/server/rate-limit";
import {
  mapSubscriptionStatus,
  razorpay,
  verifyCheckoutPaymentSignature,
} from "@/lib/server/razorpay";
import { adminClient } from "@/lib/server/supabase-admin";

const schema = z.object({
  razorpay_payment_id: z.string().min(1),
  razorpay_subscription_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

/**
 * Fast-path activation, called by the browser right after Razorpay Checkout succeeds.
 *
 * This does NOT trust the browser's claim of success. `razorpay_signature` is an HMAC that only
 * Razorpay's servers can produce (signed with our key secret), so verifying it is the same trust
 * model as the webhook — just delivered synchronously via the checkout redirect instead of an
 * async server push. We additionally re-fetch the payment and subscription from Razorpay's API
 * before activating anything, so a forged or stale signature can't grant access on its own.
 *
 * The verified webhook keeps running as the durable source of truth (reconciles delayed events,
 * renewals, cancellations, etc.) — this endpoint only shortcuts the *first* activation.
 */
export async function POST(request: Request) {
  const auth = await getAuthed(request);
  if (!auth) return unauthorized();
  if (!rateLimit(`verify-payment:${auth.user.id}`, 10, 60_000))
    return json({ error: "rate_limited" }, 429);

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "invalid_input" }, 400);
  const {
    razorpay_payment_id: paymentId,
    razorpay_subscription_id: subscriptionId,
    razorpay_signature: signature,
  } = body.data;

  const admin = adminClient();
  // The subscription row must already exist (created by /api/create-checkout) and belong to this user.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("user_id, plan_code")
    .eq("razorpay_subscription_id", subscriptionId)
    .maybeSingle();
  if (!sub || sub.user_id !== auth.user.id)
    return json({ error: "not_found" }, 404);

  if (!verifyCheckoutPaymentSignature(paymentId, subscriptionId, signature)) {
    logEvent("checkout_signature_invalid", { userId: auth.user.id });
    return json({ error: "invalid_signature" }, 400);
  }

  // Idempotent and shares the same table/uniqueness the webhook uses, so a retry (or the webhook
  // later processing the same payment) never double-activates or double-counts anything. A prior
  // attempt that recorded the event but failed before finishing (e.g. Razorpay was unreachable)
  // is retried rather than short-circuited, so a transient failure can't be mistaken for success.
  const eventId = `checkout:${paymentId}`;
  const { error: insertError } = await admin.from("payment_events").insert({
    provider_event_id: eventId,
    event_type: "checkout.payment_verified",
    payload: body.data,
  });
  if (insertError && insertError.code !== "23505")
    return json({ error: "store_failed" }, 500);
  if (insertError?.code === "23505") {
    const { data: prior } = await admin
      .from("payment_events")
      .select("processed_at")
      .eq("provider_event_id", eventId)
      .maybeSingle();
    if (prior?.processed_at) {
      const { data: current } = await admin
        .from("subscriptions")
        .select("status")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return json({
        ok: true,
        status: current?.status ?? "unknown",
        duplicate: true,
      });
    }
    // Fall through and retry verification below; this call's insert lost the race but the event
    // was never completed, so there is nothing to duplicate yet.
  }

  let payment: { status: string };
  let subscription: { status: string; current_end: number | null };
  try {
    [payment, subscription] = await Promise.all([
      razorpay<{ status: string }>(`/payments/${paymentId}`),
      razorpay<{ status: string; current_end: number | null }>(
        `/subscriptions/${subscriptionId}`,
      ),
    ]);
  } catch (e) {
    await admin
      .from("payment_events")
      .update({
        processing_error: `razorpay_fetch_failed: ${(e as Error).message}`,
      })
      .eq("provider_event_id", eventId);
    // The signature was valid but we couldn't reach Razorpay to confirm details; the webhook will
    // still activate the plan shortly, so tell the browser to fall back to "processing" rather than error.
    return json({ error: "verification_unavailable" }, 502);
  }

  if (payment.status !== "captured" && payment.status !== "authorized") {
    await admin
      .from("payment_events")
      .update({ processing_error: `payment_status_${payment.status}` })
      .eq("provider_event_id", eventId);
    return json({ error: "payment_not_captured", status: payment.status }, 402);
  }

  const status = mapSubscriptionStatus(subscription.status);
  await admin.from("subscriptions").upsert(
    {
      user_id: sub.user_id,
      plan_code: sub.plan_code,
      status,
      razorpay_subscription_id: subscriptionId,
      current_period_end: subscription.current_end
        ? new Date(subscription.current_end * 1000).toISOString()
        : null,
    },
    { onConflict: "user_id" },
  );
  await admin
    .from("payment_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("provider_event_id", eventId);
  logEvent("payment_verified_browser", { userId: auth.user.id, status });
  return json({ ok: true, status });
}
