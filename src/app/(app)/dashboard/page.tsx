import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
              Free plan: 2 tailored resumes per month
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Usage tracking arrives in Phase 7.
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
    </div>
  );
}
