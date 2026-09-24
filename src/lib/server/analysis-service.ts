import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { analyze } from "./ats";
import { logEvent } from "./api-auth";
import { adminClient } from "./supabase-admin";

export class ServiceError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

/** Runs and stores an ATS analysis. `supabase` acts as the user (RLS enforces ownership). */
export async function runAnalysis(
  supabase: SupabaseClient,
  user: User,
  resumeId: string,
  jobDescriptionId: string,
) {
  const [{ data: resume }, { data: jd }] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, extracted_text")
      .eq("id", resumeId)
      .maybeSingle(),
    supabase
      .from("job_descriptions")
      .select("*")
      .eq("id", jobDescriptionId)
      .maybeSingle(),
  ]);
  if (!resume || !jd) throw new ServiceError("not_found", 404);
  if (!resume.extracted_text?.trim())
    throw new ServiceError("resume_not_ready", 409);

  const started = Date.now();
  try {
    const admin = adminClient();
    const result = await analyze(resume.extracted_text, jd.raw_text);
    await admin
      .from("job_descriptions")
      .update({ normalized_text: jd.raw_text.trim() })
      .eq("id", jd.id);
    const { data: row, error } = await admin
      .from("ats_analyses")
      .insert({
        user_id: user.id,
        resume_id: resume.id,
        job_description_id: jd.id,
        score: result.score,
        matched_keywords: result.matched,
        missing_keywords: result.gaps,
        evidence_map: result.matched.map((m) => ({
          claim: m.keyword,
          sourceEvidence: m.evidence,
          allowed: true,
        })),
        recommendations: result.recommendations,
        model_metadata: { ...result.metadata, report: result.report },
      })
      .select("id")
      .single();
    if (error) throw error;
    logEvent("ats_analysis_complete", {
      analysisId: row.id,
      ms: Date.now() - started,
      score: result.score,
    });
    return { analysisId: row.id as string, ...result };
  } catch (e) {
    logEvent("ats_analysis_failed", {
      ms: Date.now() - started,
      reason: (e as Error).message,
    });
    throw new ServiceError("analysis_failed", 502);
  }
}
