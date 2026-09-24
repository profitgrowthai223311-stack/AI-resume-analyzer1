import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsageMeter } from "@/components/billing/usage-meter";
import {
  FREE_MONTHLY_GENERATIONS,
  getPlan,
  monthlyUsage,
} from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", claims?.claims.sub ?? "")
    .maybeSingle();

  const { data: resumes } = await supabase
    .from("resumes")
    .select("id, display_name, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  const uid = claims?.claims.sub ?? "";
  const plan = await getPlan(supabase, uid);
  const used = await monthlyUsage(supabase, uid);
  const { data: versions } = await supabase
    .from("resume_versions")
    .select("id, label, version_number, status")
    .order("created_at", { ascending: false })
    .limit(3);

  const name =
    profile?.full_name ||
    (claims?.claims.email as string | undefined) ||
    "there";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Welcome, {name}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>
              {plan === "pro" ? "Pro plan" : "Free plan"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsageMeter
              used={used}
              limit={FREE_MONTHLY_GENERATIONS}
              plan={plan}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Your resumes</CardTitle>
            <CardDescription>
              {resumes?.length ? "Most recent uploads" : "Nothing here yet"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ul className="space-y-1 text-sm">
              {resumes?.map((r) => (
                <li key={r.id}>
                  <Link href={`/resumes/${r.id}`} className="underline">
                    {r.display_name}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/resumes/new" className={buttonVariants()}>
              Upload a resume
            </Link>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent versions</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {versions?.map((v) => (
              <li key={v.id}>
                <Link href={`/versions/${v.id}`} className="underline">
                  {v.label ?? "Tailored resume"} v{v.version_number}
                </Link>{" "}
                <span className="text-muted-foreground">({v.status})</span>
              </li>
            ))}
            {!versions?.length && (
              <li className="text-muted-foreground">None yet.</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
