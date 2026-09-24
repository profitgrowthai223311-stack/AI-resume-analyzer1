import Link from "next/link";
import { HistoryTable } from "@/components/resume/history-table";
import { PageHeader } from "@/components/page-header";
import { getPlan } from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "History" };

export default async function HistoryPage() {
  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const plan = await getPlan(supabase, c!.claims.sub);
  const { data: versions } = await supabase
    .from("resume_versions")
    .select("id, label, version_number, status, created_at, analysis_id")
    .order("created_at", { ascending: false })
    .limit(plan === "free" ? 2 : 200);

  const ids = (versions ?? []).map((v) => v.analysis_id).filter(Boolean);
  const { data: analyses } = ids.length
    ? await supabase.from("ats_analyses").select("id, score").in("id", ids)
    : { data: [] };
  const scores = new Map(
    (analyses ?? []).map((a) => [a.id, a.score as number]),
  );
  const rows = (versions ?? []).map((v) => ({
    ...v,
    score: scores.get(v.analysis_id) ?? null,
  }));

  return (
    <>
      <PageHeader
        title="Version history"
        description="Every tailored resume you have generated. Versions are immutable."
      />
      {plan === "free" && (
        <p className="bg-accent text-accent-foreground rounded-xl px-4 py-3 text-sm">
          Free plan shows your latest 2 versions.{" "}
          <Link href="/pricing" className="font-semibold underline">
            Upgrade to Pro
          </Link>{" "}
          for your full history.
        </p>
      )}
      <HistoryTable rows={rows} />
    </>
  );
}
