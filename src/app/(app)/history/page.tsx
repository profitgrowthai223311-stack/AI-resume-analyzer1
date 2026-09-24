import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPlan } from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "History" };

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const plan = await getPlan(supabase, c!.claims.sub);
  const { data: versions } = await supabase
    .from("resume_versions")
    .select("id, label, version_number, status, created_at")
    .order("created_at", { ascending: false })
    .limit(plan === "free" ? 2 : 200);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">History</h1>
      {plan === "free" && (
        <p className="text-muted-foreground text-sm">
          Free plan shows your latest 2 versions.{" "}
          <Link href="/pricing" className="underline">
            Upgrade
          </Link>{" "}
          for full history.
        </p>
      )}
      {!versions?.length && (
        <p className="text-muted-foreground text-sm">
          No tailored resumes yet.
        </p>
      )}
      <div className="grid gap-3">
        {versions?.map((v) => (
          <Link key={v.id} href={`/versions/${v.id}`}>
            <Card className="hover:bg-muted/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {v.label ?? "Tailored resume"}{" "}
                  <Badge variant="secondary">{v.status}</Badge>
                </CardTitle>
                <CardDescription>
                  v{v.version_number} ·{" "}
                  {new Date(v.created_at).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
