import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { notFound, redirect } from "next/navigation";
import { TailorWorkspace } from "@/components/resume/tailor-workspace";
import { createClient } from "@/lib/supabase/server";
import { getPlan } from "@/lib/server/plan";

export const metadata = { title: "Tailor resume" };

export default async function TailorPage({
  params,
}: PageProps<"/resumes/[resumeId]/tailor">) {
  const { resumeId } = await params;
  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const { data: resume } = await supabase
    .from("resumes")
    .select("id, display_name, extracted_text")
    .eq("id", resumeId)
    .maybeSingle();
  if (!resume) notFound();
  if (!resume.extracted_text) redirect(`/resumes/${resumeId}`);
  const plan = await getPlan(supabase, c!.claims.sub);

  return (
    <>
      <PageHeader
        title={`Tailor: ${resume.display_name}`}
        description="Paste a job description, see how you match, then generate a truthful tailored resume."
        actions={
          <Link
            href={`/resumes/${resumeId}`}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm underline"
          >
            <ArrowLeft className="size-3.5" /> Review or edit the resume text
            first
          </Link>
        }
      />
      <TailorWorkspace resumeId={resumeId} plan={plan} />
    </>
  );
}
