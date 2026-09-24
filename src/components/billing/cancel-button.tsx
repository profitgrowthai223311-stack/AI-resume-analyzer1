"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CancelButton() {
  const [msg, setMsg] = useState<string>();
  async function cancel() {
    if (!confirm("Cancel at the end of the current billing period?")) return;
    const res = await fetch("/api/cancel-subscription", { method: "POST" });
    setMsg(
      res.ok
        ? "Cancellation requested. You keep Pro until the period ends."
        : "Could not cancel. Please try again.",
    );
  }
  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={cancel}>
        Cancel subscription
      </Button>
      {msg && <p className="text-sm">{msg}</p>}
    </div>
  );
}
