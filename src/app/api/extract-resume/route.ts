import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { getAuthed, json, logEvent, unauthorized } from "@/lib/server/api-auth";
import {
  PARSER_NAME,
  PARSER_VERSION,
  extractFromFile,
} from "@/lib/server/extract";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getAuthed(request);
  if (!auth) return unauthorized();
  if (!rateLimit(`extract:${auth.user.id}`, 10, 60_000))
    return json({ error: "rate_limited" }, 429);
  const body = z
    .object({ resumeId: z.string().uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "invalid_input" }, 400);

  const { supabase } = auth;
  // RLS: only the owner's row is visible.
  const { data: resume } = await supabase
    .from("resumes")
    .select("*")
    .eq("id", body.data.resumeId)
    .maybeSingle();
  if (!resume || !resume.original_file_path)
    return json({ error: "not_found" }, 404);

  const started = Date.now();
  await supabase
    .from("resumes")
    .update({ extraction_status: "processing", extraction_error: null })
    .eq("id", resume.id);

  try {
    const { data: file, error } = await supabase.storage
      .from("original-resumes")
      .download(resume.original_file_path);
    if (error || !file) throw new Error("download_failed");
    const { text, warnings, structured } = await extractFromFile(
      resume.original_file_type,
      new Uint8Array(await file.arrayBuffer()),
    );
    await supabase
      .from("resumes")
      .update({
        extracted_text: text,
        structured_content: { ...structured, warnings },
        extraction_status: "complete",
        parser_name: PARSER_NAME,
        parser_version: PARSER_VERSION,
      })
      .eq("id", resume.id);
    logEvent("extraction_complete", {
      resumeId: resume.id,
      ms: Date.now() - started,
      chars: text.length,
    });
    return json({
      resumeId: resume.id,
      status: "complete",
      extractedText: text,
      warnings,
    });
  } catch (e) {
    logEvent("extraction_failed", {
      resumeId: resume.id,
      ms: Date.now() - started,
      reason: (e as Error).message,
    });
    await supabase
      .from("resumes")
      .update({
        extraction_status: "failed",
        extraction_error:
          "We couldn't read this file. Paste your resume text instead.",
      })
      .eq("id", resume.id);
    return json({ resumeId: resume.id, status: "failed", warnings: [] }, 200);
  }
}
