import { Check, Crown, Sparkles } from "lucide-react";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNav } from "@/components/marketing/nav";
import { CheckoutButton } from "@/components/billing/checkout-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRO_PLANS } from "@/lib/plans";
import {
  FREE_MONTHLY_GENERATIONS,
  FREE_TOTAL_UPLOADS,
} from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Pricing" };

const PRO_FEATURES = [
  "Unlimited generations (fair use)",
  "LaTeX + PDF download",
  "Full keyword gap analysis",
  "Full version history",
  "Priority generation",
];

export default async function PricingPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  const yearlySaving = Math.round(
    (1 - PRO_PLANS.yearly.priceInr / (PRO_PLANS.monthly.priceInr * 12)) * 100,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />
      <main className="bg-hero-mesh flex-1">
        <div className="mx-auto max-w-5xl space-y-10 px-4 py-16">
          <div className="space-y-3 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">
              Simple, <span className="text-brand-gradient">honest</span>{" "}
              pricing
            </h1>
            <p className="text-muted-foreground">
              Start free. Upgrade when you are applying at scale.
            </p>
          </div>
          <div className="grid items-stretch gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Free</CardTitle>
                <CardDescription>For trying it out</CardDescription>
                <p className="pt-2 text-4xl font-extrabold">₹0</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3 text-sm">
                {[
                  `${FREE_TOTAL_UPLOADS} resume uploads total`,
                  `${FREE_MONTHLY_GENERATIONS} tailored resumes / month`,
                  "ATS match overview + basic gaps",
                  "PDF download",
                  "Latest 2 versions in history",
                ].map((f) => (
                  <p key={f} className="flex items-center gap-2">
                    <Check className="text-success size-4" /> {f}
                  </p>
                ))}
                <Link
                  href={signedIn ? "/dashboard" : "/auth/signup"}
                  className={
                    buttonVariants({ variant: "outline", size: "lg" }) +
                    " mt-4 w-full"
                  }
                >
                  {signedIn ? "Go to dashboard" : "Start free"}
                </Link>
              </CardContent>
            </Card>
            {(Object.keys(PRO_PLANS) as (keyof typeof PRO_PLANS)[]).map(
              (code) => {
                const best = code === "yearly";
                return (
                  <Card
                    key={code}
                    className={cn(
                      best &&
                        "shadow-glow ring-primary ring-2 md:-translate-y-2",
                    )}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        {PRO_PLANS[code].label}{" "}
                        {best ? (
                          <Badge variant="success">Save {yearlySaving}%</Badge>
                        ) : (
                          <Crown className="text-warning size-4" />
                        )}
                      </CardTitle>
                      <CardDescription>
                        {best ? "Best value" : "Flexible, cancel anytime"}
                      </CardDescription>
                      <p className="pt-2 text-4xl font-extrabold">
                        ₹{PRO_PLANS[code].priceInr.toLocaleString("en-IN")}
                        <span className="text-muted-foreground text-base font-medium">
                          {" "}
                          / {PRO_PLANS[code].period}
                        </span>
                      </p>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-3 text-sm">
                      {PRO_FEATURES.map((f) => (
                        <p key={f} className="flex items-center gap-2">
                          <Check className="text-success size-4" /> {f}
                        </p>
                      ))}
                      <div className="pt-4">
                        <CheckoutButton
                          plan={code}
                          label={`Upgrade — ${PRO_PLANS[code].label}`}
                          signedIn={signedIn}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              },
            )}
          </div>
          <p className="text-muted-foreground flex items-center justify-center gap-2 text-center text-xs">
            <Sparkles className="size-3.5" /> Payments are processed by
            Razorpay. We never see or store your card details. Scores are
            advisory and do not guarantee interviews or hiring outcomes.
          </p>
          <p className="text-muted-foreground text-center text-xs">
            Subscriptions need a card that supports recurring payments. If yours
            is declined for that reason, try a different card or another method
            shown in the payment window (such as UPI), or reach out and
            we&apos;ll help.
          </p>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
