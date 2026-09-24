"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

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
  const [state, setState] = useState<"idle" | "loading" | "processing">("idle");
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
    new window.Razorpay!({
      key: keyId,
      subscription_id: subscriptionId,
      name: "AI Resume Analyzer",
      description: "Pro subscription",
      handler: () => waitForActivation(),
      modal: { ondismiss: () => setState("idle") },
    }).open();
  }

  // The checkout result is not trusted. Wait for the verified webhook to activate the plan.
  async function waitForActivation() {
    setState("processing");
    const supabase = createClient();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const { data } = await supabase
        .from("subscriptions")
        .select("status")
        .maybeSingle();
      if (data?.status === "active") return router.push("/billing?upgraded=1");
    }
    router.push("/billing");
  }

  return (
    <div className="space-y-2">
      <Button onClick={start} disabled={state !== "idle"}>
        {state === "processing"
          ? "Payment processing…"
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
