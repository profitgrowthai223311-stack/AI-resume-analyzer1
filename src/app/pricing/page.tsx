import Link from "next/link";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRO_PLANS } from "@/lib/plans";
import { FREE_MONTHLY_GENERATIONS } from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Pricing" };

export default async function PricingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 space-y-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Pricing</h1>
        <Link
          href={signedIn ? "/dashboard" : "/"}
          className={buttonVariants({ variant: "outline" })}
        >
          Back
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>₹0</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{FREE_MONTHLY_GENERATIONS} tailored resumes / month</p>
            <p>ATS match overview, basic gap analysis</p>
            <p>PDF download</p>
            <p>Latest 2 versions in history</p>
          </CardContent>
        </Card>
        {(Object.keys(PRO_PLANS) as (keyof typeof PRO_PLANS)[]).map((code) => (
          <Card key={code}>
            <CardHeader>
              <CardTitle>{PRO_PLANS[code].label}</CardTitle>
              <CardDescription>
                ₹{PRO_PLANS[code].priceInr.toLocaleString("en-IN")} /{" "}
                {PRO_PLANS[code].period}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="space-y-1">
                <p>Unlimited generations (fair use)</p>
                <p>LaTeX + PDF download</p>
                <p>Full gap analysis and history</p>
                <p>Priority generation</p>
              </div>
              <CheckoutButton
                plan={code}
                label={`Upgrade — ${PRO_PLANS[code].label}`}
                signedIn={signedIn}
              />
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Payments are processed by Razorpay. We never see or store your card
        details. Scores are advisory and do not guarantee interviews or hiring
        outcomes.
      </p>
    </main>
  );
}
