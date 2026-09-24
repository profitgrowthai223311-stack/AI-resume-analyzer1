import { z } from "zod";
import { PRO_PLANS, razorpayPlanId } from "@/lib/plans";
import { getAuthed, json, logEvent, unauthorized } from "@/lib/server/api-auth";
import { getPlan } from "@/lib/server/plan";
import { razorpay } from "@/lib/server/razorpay";
import { adminClient } from "@/lib/server/supabase-admin";

export async function POST(request: Request) {
  const auth = await getAuthed(request);
  if (!auth) return unauthorized();
  const body = z
    .object({ plan: z.enum(["monthly", "yearly"]) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "invalid_input" }, 400);

  const planId = razorpayPlanId(body.data.plan);
  if (!planId) return json({ error: "plan_not_configured" }, 500);
  const admin = adminClient();
  if ((await getPlan(admin, auth.user.id)) === "pro")
    return json({ error: "already_subscribed" }, 409);

  try {
    const sub = await razorpay<{ id: string }>("/subscriptions", {
      plan_id: planId,
      total_count: PRO_PLANS[body.data.plan].totalCount,
      customer_notify: 1,
      notes: { user_id: auth.user.id, plan: body.data.plan },
    });
    // Stays inactive until a verified webhook says otherwise; the client is never trusted.
    await admin
      .from("subscriptions")
      .upsert(
        {
          user_id: auth.user.id,
          plan_code: body.data.plan,
          status: "inactive",
          razorpay_subscription_id: sub.id,
        },
        { onConflict: "user_id" },
      );
    logEvent("checkout_started", { plan: body.data.plan });
    return json({
      subscriptionId: sub.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (e) {
    logEvent("checkout_failed", { reason: (e as Error).message });
    return json({ error: "checkout_failed" }, 502);
  }
}
