import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const auth = () =>
  "Basic " +
  Buffer.from(
    `${process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
  ).toString("base64");

export async function razorpay<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: auth(), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`razorpay_${res.status}`);
  return (await res.json()) as T;
}

function constantTimeHexEqual(expectedHex: string, given: string) {
  const a = Buffer.from(expectedHex);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Constant-time HMAC-SHA256 check of the raw webhook body. */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return constantTimeHexEqual(expected, signature);
}

/**
 * Verifies the signature Checkout.js returns to the browser on a successful subscription payment.
 * Per Razorpay's docs this is HMAC-SHA256 of `payment_id|subscription_id` using the key secret —
 * only Razorpay's servers can produce it, so a valid signature is real proof of payment, not a
 * client claim. This lets us activate Pro the instant checkout succeeds, without waiting for the
 * webhook; the webhook still runs as the durable reconciliation path.
 */
export function verifyCheckoutPaymentSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  return constantTimeHexEqual(expected, signature);
}

export type RazorpaySubscriptionStatus =
  | "created"
  | "authenticated"
  | "active"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "expired";

/** Maps Razorpay's subscription-entity status to this app's `subscriptions.status` values. */
export function mapSubscriptionStatus(
  status: RazorpaySubscriptionStatus | string,
): "inactive" | "active" | "past_due" | "cancelled" | "expired" {
  switch (status) {
    case "active":
      return "active";
    case "pending":
    case "halted":
      return "past_due";
    case "cancelled":
      return "cancelled";
    case "completed":
    case "expired":
      return "expired";
    default:
      // "created", "authenticated": the mandate exists but no payment has been captured yet.
      return "inactive";
  }
}
