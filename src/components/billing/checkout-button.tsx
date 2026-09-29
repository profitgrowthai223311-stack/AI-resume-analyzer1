"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", cb: (response: PaymentFailed) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => RazorpayInstance;
  }
}

type CheckoutSuccess = {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
};

type PaymentFailed = {
  error: {
    code: string;
    description?: string;
    reason?: string;
    metadata?: { payment_id?: string };
  };
};

// Reasons Razorpay uses for a card/method that can't be used for a recurring subscription charge.
// Enabling additional recurring-capable methods (e.g. UPI Autopay, more card networks) for
// Subscriptions is an account-level setting only Razorpay support can change — see README.
const RECURRING_INELIGIBLE = new Set([
  "payment_method_not_supported",
  "card_not_recurring_enabled",
]);

function loadCheckout() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function CheckoutButton({
  plan,
  label,
  signedIn,
}: {
  plan: "monthly" | "yearly";
  label: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "verifying">("idle");
  const [error, setError] = useState<string>();

  async function start() {
    if (!signedIn) return router.push("/auth/login");
    setError(undefined);
    setState("loading");
    if (!(await loadCheckout())) {
      setState("idle");
      return setError("Could not load the payment window.");
    }
    const res = await fetch("/api/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) {
      setState("idle");
      return setError(
        res.status === 409
          ? "You already have an active subscription."
          : "Could not start checkout.",
      );
    }
    const { subscriptionId, keyId } = await res.json();
    const rzp = new window.Razorpay!({
      key: keyId,
      subscription_id: subscriptionId,
      name: "AI Resume Analyzer",
      description: "Pro subscription",
      handler: (response: CheckoutSuccess) => confirm(response),
      modal: { ondismiss: () => setState("idle") },
    });
    // Razorpay's own checkout UI already shows a failure banner and lets the shopper try another
    // method there; this just makes sure OUR page also has a clear, specific explanation once they
    // leave the modal, instead of silently going back to an unlabelled "Upgrade" button.
    rzp.on("payment.failed", (response) => {
      const reason = response.error?.reason ?? "";
      setState("idle");
      setError(
        RECURRING_INELIGIBLE.has(reason)
          ? "This card doesn't support recurring subscription payments. Try a different card, or use UPI if it's offered in the payment window."
          : (response.error?.description ??
              "The payment did not go through. Please try again with a different card or payment method."),
      );
    });
    rzp.open();
  }

  // Razorpay hands the browser a payment id, subscription id and a signature it alone could have
  // produced (HMAC with our key secret). We verify that signature server-side and activate Pro
  // immediately — this is real cryptographic proof, not a client claim. If the immediate check
  // can't complete for some reason, the verified webhook activates the plan shortly after.
  async function confirm(response: CheckoutSuccess) {
    setState("verifying");
    try {
      const res = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(response),
      });
      router.push(res.ok ? "/billing?upgraded=1" : "/billing?processing=1");
    } catch {
      router.push("/billing?processing=1");
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={start} disabled={state !== "idle"}>
        {state === "verifying"
          ? "Confirming payment…"
          : state === "loading"
            ? "Opening…"
            : label}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
