import { notFound } from "next/navigation";
import { VersionView } from "@/components/resume/version-view";
import { getPlan } from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Resume version" };

export default async function VersionPage({
  params,
}: PageProps<"/versions/[versionId]">) {
  const { versionId } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const { data: v } = await supabase
    .from("resume_versions")
    .select(
      "id, label, version_number, status, error_message, latex_content, validation_result, analysis_id, resume_id, job_description_id",
    )
    .eq("id", versionId)
    .maybeSingle();
  if (!v) notFound();
  return (
    <VersionView initial={v} plan={await getPlan(supabase, c!.claims.sub)} />
  );
}
