// Live tests for the browser-driven payment confirmation endpoint (/api/verify-payment),
// exercised against the real Razorpay test-mode API and Supabase project.
import { createHmac } from "node:crypto";
import { admin, api, cleanup, check, failures, env, tempUser } from "./lib.mjs";

const sign = (paymentId, subId, secret = env.RAZORPAY_KEY_SECRET) =>
  createHmac("sha256", secret).update(`${paymentId}|${subId}`).digest("hex");

try {
  const u = await tempUser("verifypay");
  const other = await tempUser("verifypay2");

  const co = await api(u, "/api/create-checkout", { plan: "monthly" });
  check(
    "checkout created a real Razorpay subscription",
    co.status === 200 && co.data.subscriptionId.startsWith("sub_"),
    JSON.stringify(co),
  );
  const subId = co.data.subscriptionId;

  // A well-formed but fabricated payment id: the signature math is right, but no such payment
  // exists at Razorpay. This must NOT activate anything — proves we don't trust the signature alone.
  const fakePaymentId = "pay_" + "0".repeat(14);
  const r1 = await api(u, "/api/verify-payment", {
    razorpay_payment_id: fakePaymentId,
    razorpay_subscription_id: subId,
    razorpay_signature: sign(fakePaymentId, subId),
  });
  check(
    "valid signature but nonexistent payment is NOT accepted",
    r1.status !== 200,
    JSON.stringify(r1),
  );
  const { data: subAfterFake } = await admin
    .from("subscriptions")
    .select("status")
    .eq("user_id", u.id)
    .single();
  check(
    "subscription still inactive after fake-payment attempt",
    subAfterFake.status === "inactive",
  );

  // Tampered / forged signature.
  const r2 = await api(u, "/api/verify-payment", {
    razorpay_payment_id: fakePaymentId,
    razorpay_subscription_id: subId,
    razorpay_signature: "0".repeat(64),
  });
  check(
    "forged signature rejected (400)",
    r2.status === 400,
    JSON.stringify(r2),
  );

  // Signature computed with the wrong secret.
  const r3 = await api(u, "/api/verify-payment", {
    razorpay_payment_id: fakePaymentId,
    razorpay_subscription_id: subId,
    razorpay_signature: sign(fakePaymentId, subId, "not-the-real-secret"),
  });
  check(
    "signature signed with wrong secret rejected",
    r3.status === 400,
    JSON.stringify(r3),
  );

  // Ownership: another signed-in user cannot verify against this subscription id, even with a
  // mathematically valid signature (the row belongs to `u`, not `other`).
  const r4 = await api(other, "/api/verify-payment", {
    razorpay_payment_id: fakePaymentId,
    razorpay_subscription_id: subId,
    razorpay_signature: sign(fakePaymentId, subId),
  });
  check(
    "another user cannot verify someone else's subscription",
    r4.status === 404,
    JSON.stringify(r4),
  );

  // Unknown subscription id entirely.
  const r5 = await api(u, "/api/verify-payment", {
    razorpay_payment_id: fakePaymentId,
    razorpay_subscription_id: "sub_doesnotexist",
    razorpay_signature: sign(fakePaymentId, "sub_doesnotexist"),
  });
  check(
    "unknown subscription id rejected",
    r5.status === 404,
    JSON.stringify(r5),
  );

  // Missing/malformed input.
  const r6 = await api(u, "/api/verify-payment", { razorpay_payment_id: "x" });
  check("missing fields rejected (400)", r6.status === 400, JSON.stringify(r6));

  // Rate limit.
  const attempts = [];
  for (let i = 0; i < 12; i++)
    attempts.push(
      (
        await api(u, "/api/verify-payment", {
          razorpay_payment_id: fakePaymentId,
          razorpay_subscription_id: subId,
          razorpay_signature: "0".repeat(64),
        })
      ).status,
    );
  check("endpoint is rate-limited", attempts.includes(429), attempts.join(","));

  // Retry-after-transient-failure: the fake-payment attempt above recorded a payment_events row
  // with no processed_at (Razorpay 404'd). Re-sending the exact same signed payload must retry
  // verification, not short-circuit into a false "ok: true" duplicate.
  const { data: ev } = await admin
    .from("payment_events")
    .select("processed_at")
    .eq("provider_event_id", `checkout:${fakePaymentId}`)
    .maybeSingle();
  check(
    "unfinished attempt left processed_at unset",
    ev && ev.processed_at === null,
  );
} finally {
  await cleanup();
  await admin
    .from("payment_events")
    .delete()
    .like("provider_event_id", "checkout:pay_00000000000000%");
}
process.exit(failures() ? 1 : 0);
