import Link from "next/link";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Tailor: {resume.display_name}
        </h1>
        <Link href={`/resumes/${resumeId}`} className="text-sm underline">
          Review or edit the resume text first
        </Link>
      </div>
      <TailorWorkspace resumeId={resumeId} plan={plan} />
    </div>
  );
}
