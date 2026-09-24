import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
      "id, display_name, original_file_type, original_file_size, extraction_status, created_at",
    )
    .eq("id", resumeId)
    .maybeSingle();
  if (!resume) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{resume.display_name}</h1>
      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Original file</CardTitle>
          <CardDescription>
            {resume.original_file_type?.toUpperCase()} ·{" "}
            {((resume.original_file_size ?? 0) / 1024).toFixed(0)} KB · uploaded{" "}
            {new Date(resume.created_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm">
          Extraction status:{" "}
          <Badge variant="secondary">{resume.extraction_status}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
