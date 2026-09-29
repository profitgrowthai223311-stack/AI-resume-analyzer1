import { FileText, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { ExtractionReviewEditor } from "@/components/resume/extraction-review-editor";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Resume" };

export default async function ResumePage({
  params,
}: PageProps<"/resumes/[resumeId]">) {
  const { resumeId } = await params;
  const supabase = await createClient();
  // RLS returns nothing for other users' rows, so this 404s instead of leaking.
  const { data: resume } = await supabase
    .from("resumes")
    .select(
      "id, display_name, original_file_path, original_file_type, original_file_size, extraction_status, extraction_error, extracted_text, structured_content, parser_name, created_at",
    )
    .eq("id", resumeId)
    .maybeSingle();
  if (!resume) notFound();
  const { data: versions } = await supabase
    .from("resume_versions")
    .select("id, label, version_number, status, created_at")
    .eq("resume_id", resumeId)
    .order("version_number", { ascending: false });

  return (
    <>
      <PageHeader
        title={resume.display_name}
        description={`${resume.original_file_type?.toUpperCase()} · ${((resume.original_file_size ?? 0) / 1024).toFixed(0)} KB · uploaded ${new Date(resume.created_at).toLocaleDateString()}`}
        actions={
          <>
            <StatusBadge status={resume.extraction_status} />
            {resume.extracted_text && (
              <Link
                href={`/resumes/${resume.id}/tailor`}
                className={buttonVariants({ size: "lg" })}
              >
                <Sparkles className="size-4" /> Tailor to a job
              </Link>
            )}
          </>
        }
      />
      <Tabs defaultValue="text">
        <TabsList>
          <TabsTrigger value="text">Extracted text</TabsTrigger>
          <TabsTrigger value="versions">
            Versions ({versions?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="text" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Extracted text</CardTitle>
              <CardDescription>
                Correct anything the parser got wrong. This text is the source
                of truth.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExtractionReviewEditor
                resumeId={resume.id}
                initialText={resume.extracted_text ?? ""}
                status={resume.extraction_status}
                error={resume.extraction_error}
                hasOriginalFile={!!resume.original_file_path}
                warnings={
                  (resume.structured_content as { warnings?: string[] } | null)
                    ?.warnings ?? []
                }
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="versions" className="mt-4">
          {versions?.length ? (
            <div className="grid gap-3">
              {versions.map((v) => (
                <Link key={v.id} href={`/versions/${v.id}`}>
                  <Card className="hover:bg-muted/40 transition-colors">
                    <CardContent className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {v.label ?? "Tailored resume"}{" "}
                          <span className="text-muted-foreground">
                            v{v.version_number}
                          </span>
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {new Date(v.created_at).toLocaleString()}
                        </p>
                      </div>
                      <StatusBadge status={v.status} />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No versions yet"
              description="Tailor this resume to a job description to create your first version."
            />
          )}
        </TabsContent>
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">File type</p>
                <p className="font-medium">
                  {resume.original_file_type?.toUpperCase()}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Parser</p>
                <p className="font-medium">{resume.parser_name ?? "–"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Characters extracted</p>
                <p className="font-medium">
                  {resume.extracted_text?.length ?? 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Sections detected</p>
                <p className="font-medium">
                  {Object.keys(
                    (resume.structured_content as { sections?: object } | null)
                      ?.sections ?? {},
                  ).join(", ") || "–"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
