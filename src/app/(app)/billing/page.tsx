import Link from "next/link";
import { CancelButton } from "@/components/billing/cancel-button";
import { UsageMeter } from "@/components/billing/usage-meter";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      {sp.upgraded && (
        <p className="text-sm text-green-700 dark:text-green-400">
          Payment received. Welcome to Pro!
        </p>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Current plan <Badge>{plan === "pro" ? "Pro" : "Free"}</Badge>
          </CardTitle>
          {sub && sub.status !== "inactive" && (
            <CardDescription>
              Status: {sub.status}
              {sub.current_period_end &&
                ` · period ends ${new Date(sub.current_period_end).toLocaleDateString()}`}
            </CardDescription>
          )}
          {sub?.status === "inactive" && (
            <CardDescription>
              Payment processing or not completed.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <UsageMeter
            used={used}
            limit={FREE_MONTHLY_GENERATIONS}
            plan={plan}
          />
          {plan === "free" ? (
            <Link href="/pricing" className={buttonVariants()}>
              Upgrade to Pro
            </Link>
          ) : (
            sub?.status === "active" && <CancelButton />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
