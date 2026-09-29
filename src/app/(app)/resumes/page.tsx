import { FileUp, Plus } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ResumeCard } from "@/components/resume/resume-card";
import { buttonVariants } from "@/components/ui/button";
import { FREE_TOTAL_UPLOADS, getPlan } from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "My resumes" };

export default async function ResumesPage() {
  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const [plan, { data: resumes }, { data: versions }] = await Promise.all([
    getPlan(supabase, c!.claims.sub),
    supabase
      .from("resumes")
      .select(
        "id, display_name, original_file_type, original_file_size, extraction_status, created_at",
      )
      .order("created_at", { ascending: false }),
    supabase.from("resume_versions").select("resume_id"),
  ]);
  const counts = new Map<string, number>();
  for (const v of versions ?? [])
    counts.set(v.resume_id, (counts.get(v.resume_id) ?? 0) + 1);
  const uploadCount = resumes?.length ?? 0;

  return (
    <>
      <PageHeader
        title="My resumes"
        description={
          plan === "free"
            ? `Your source resumes. ${uploadCount} of ${FREE_TOTAL_UPLOADS} free uploads used.`
            : "Your source resumes. Tailor each one to as many jobs as you like."
        }
        actions={
          <Link href="/resumes/new" className={buttonVariants({ size: "lg" })}>
            <Plus className="size-4" /> Upload resume
          </Link>
        }
      />
      {!resumes?.length ? (
        <EmptyState
          icon={FileUp}
          title="Upload your first resume"
          description="PDF or DOCX up to 10 MB. We extract the text so you can review it before anything is generated."
          action={
            <Link href="/resumes/new" className={buttonVariants()}>
              Upload resume
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {resumes.map((r) => (
            <ResumeCard
              key={r.id}
              r={{ ...r, versions: counts.get(r.id) ?? 0 }}
            />
          ))}
        </div>
      )}
    </>
  );
}
