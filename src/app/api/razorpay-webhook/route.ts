import { json, logEvent } from "@/lib/server/api-auth";
import { verifyWebhookSignature } from "@/lib/server/razorpay";
import { adminClient } from "@/lib/server/supabase-admin";

type SubEntity = {
  id: string;
  status?: string;
  current_end?: number | null;
  notes?: { user_id?: string; plan?: string };
};
type Event = {
  event: string;
  payload?: { subscription?: { entity?: SubEntity } };
};

const STATUS_BY_EVENT: Record<
  string,
  "active" | "cancelled" | "past_due" | "expired"
> = {
  "subscription.activated": "active",
  "subscription.charged": "active",
  "subscription.resumed": "active",
  "subscription.cancelled": "cancelled",
  "subscription.halted": "past_due",
  "subscription.pending": "past_due",
  "subscription.completed": "expired",
  "subscription.expired": "expired",
};

export async function POST(request: Request) {
  const raw = await request.text();
  if (
    !verifyWebhookSignature(
      raw,
      request.headers.get("x-razorpay-signature"),
      process.env.RAZORPAY_WEBHOOK_SECRET,
    )
  ) {
    logEvent("webhook_bad_signature");
    return json({ error: "invalid_signature" }, 400);
  }

  const admin = adminClient();
  let event: Event;
  try {
    event = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  // Idempotency: the provider event id is unique, so a replay is acknowledged and skipped.
  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    `${event.event}:${event.payload?.subscription?.entity?.id}:${event.payload?.subscription?.entity?.current_end}`;
  const { error: insertError } = await admin
    .from("payment_events")
    .insert({
      provider_event_id: eventId,
      event_type: event.event,
      payload: event,
    });
  if (insertError) {
    if (insertError.code === "23505")
      return json({ ok: true, duplicate: true });
    return json({ error: "store_failed" }, 500);
  }

  const status = STATUS_BY_EVENT[event.event];
  const entity = event.payload?.subscription?.entity;
  try {
    if (status && entity?.id) {
      const { data: existing } = await admin
        .from("subscriptions")
        .select("user_id")
        .eq("razorpay_subscription_id", entity.id)
        .maybeSingle();
      const userId = existing?.user_id ?? entity.notes?.user_id;
      if (!userId) throw new Error("unknown_subscription");
      await admin.from("subscriptions").upsert(
        {
          user_id: userId,
          status,
          razorpay_subscription_id: entity.id,
          plan_code: entity.notes?.plan,
          current_period_end: entity.current_end
            ? new Date(entity.current_end * 1000).toISOString()
            : null,
        },
        { onConflict: "user_id" },
      );
    }
    await admin
      .from("payment_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("provider_event_id", eventId);
    logEvent("webhook_processed", { type: event.event });
    return json({ ok: true });
  } catch (e) {
    await admin
      .from("payment_events")
      .update({ processing_error: (e as Error).message })
      .eq("provider_event_id", eventId);
    logEvent("webhook_failed", {
      type: event.event,
      reason: (e as Error).message,
    });
    return json({ error: "processing_failed" }, 500);
  }
}
