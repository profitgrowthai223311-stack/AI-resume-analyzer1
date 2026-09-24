import { Check, Crown } from "lucide-react";
import Link from "next/link";
import { CancelButton } from "@/components/billing/cancel-button";
import { UsageMeter } from "@/components/billing/usage-meter";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRO_PLANS, type PlanCode } from "@/lib/plans";
import {
  FREE_MONTHLY_GENERATIONS,
  getPlan,
  monthlyUsage,
} from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: PageProps<"/billing">) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const uid = c!.claims.sub;
  const [plan, used, { data: sub }] = await Promise.all([
    getPlan(supabase, uid),
    monthlyUsage(supabase, uid),
    supabase
      .from("subscriptions")
      .select("plan_code, status, current_period_end")
      .eq("user_id", uid)
      .maybeSingle(),
  ]);
  const planInfo = sub?.plan_code
    ? PRO_PLANS[sub.plan_code as PlanCode]
    : undefined;

  return (
    <>
      <PageHeader
        title="Billing & plan"
        description="Manage your subscription and see your usage."
      />
      {sp.upgraded && (
        <p className="bg-success/15 text-success rounded-xl px-4 py-3 text-sm font-medium">
          Payment received. Welcome to Pro!
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-hidden pt-0 lg:col-span-2">
          <div
            className={
              (plan === "pro" ? "bg-brand-gradient" : "bg-muted") +
              " flex items-center justify-between p-6 " +
              (plan === "pro" ? "text-white" : "")
            }
          >
            <div>
              <p className="text-sm opacity-80">Current plan</p>
              <p className="flex items-center gap-2 text-2xl font-bold">
                {plan === "pro" ? <Crown className="size-6" /> : null}
                {plan === "pro" ? "Pro" : "Free"}
              </p>
            </div>
            {planInfo && plan === "pro" && (
              <p className="text-right text-sm">
                {planInfo.label}
                <br />₹{planInfo.priceInr.toLocaleString("en-IN")} /{" "}
                {planInfo.period}
              </p>
            )}
          </div>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Subscription{" "}
              {sub && sub.status !== "inactive" && (
                <Badge
                  variant={sub.status === "active" ? "success" : "warning"}
                >
                  {sub.status}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {sub?.status === "inactive" &&
                "Payment processing or not completed."}
              {sub &&
                sub.status !== "inactive" &&
                sub.current_period_end &&
                `Period ends ${new Date(sub.current_period_end).toLocaleDateString()}`}
              {!sub && "You are on the free plan."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <UsageMeter
              used={used}
              limit={FREE_MONTHLY_GENERATIONS}
              plan={plan}
            />
            {plan === "free" ? (
              <Link href="/pricing" className={buttonVariants({ size: "lg" })}>
                <Crown className="size-4" /> Upgrade to Pro
              </Link>
            ) : (
              sub?.status === "active" && <CancelButton />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pro includes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              "Unlimited generations (fair use)",
              "LaTeX + PDF download",
              "Full keyword gap analysis",
              "Full version history",
              "Priority generation",
            ].map((f) => (
              <p key={f} className="flex items-center gap-2">
                <Check className="text-success size-4" /> {f}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
