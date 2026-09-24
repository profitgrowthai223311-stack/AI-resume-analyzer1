import { after } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { getAuthed, json, logEvent, unauthorized } from "@/lib/server/api-auth";
import { runAnalysis, ServiceError } from "@/lib/server/analysis-service";
import { runGeneration } from "@/lib/server/generate";
import {
  FREE_MONTHLY_GENERATIONS,
  getPlan,
  monthlyUsage,
} from "@/lib/server/plan";
import { adminClient } from "@/lib/server/supabase-admin";

export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await getAuthed(request);
  if (!auth) return unauthorized();
  if (!rateLimit(`generate:${auth.user.id}`, 10, 60_000))
    return json({ error: "rate_limited" }, 429);
  const body = z
    .object({
      resumeId: z.string().uuid(),
      jobDescriptionId: z.string().uuid(),
      label: z.string().trim().max(100).optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "invalid_input" }, 400);
  const { supabase, user } = auth;
  const { resumeId, jobDescriptionId, label } = body.data;

  const [{ data: resume }, { data: jd }] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, extracted_text")
      .eq("id", resumeId)
      .maybeSingle(),
    supabase
      .from("job_descriptions")
      .select("id, title, company_name, raw_text")
      .eq("id", jobDescriptionId)
      .maybeSingle(),
  ]);
  if (!resume || !jd) return json({ error: "not_found" }, 404);
  if (!resume.extracted_text?.trim())
    return json({ error: "resume_not_ready" }, 409);

  const admin = adminClient();

  // Rate limit: one in-flight generation per user (stale ones expire after 10 minutes).
  const { count: inflight } = await admin
    .from("resume_versions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .in("status", ["queued", "generating", "validating", "compiling"])
    .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
  if ((inflight ?? 0) > 0)
    return json({ error: "generation_in_progress" }, 429);

  // Quota is enforced here, server-side, before any job is created.
  const plan = await getPlan(admin, user.id);
  if (
    plan === "free" &&
    (await monthlyUsage(admin, user.id)) >= FREE_MONTHLY_GENERATIONS
  ) {
    logEvent("free_limit_block", { userId: user.id });
    return json(
      { error: "quota_reached", limit: FREE_MONTHLY_GENERATIONS },
      402,
    );
  }

  let analysisId: string;
  const { data: existing } = await supabase
    .from("ats_analyses")
    .select("id")
    .eq("resume_id", resumeId)
    .eq("job_description_id", jobDescriptionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) analysisId = existing.id;
  else {
    try {
      analysisId = (
        await runAnalysis(supabase, user, resumeId, jobDescriptionId)
      ).analysisId;
    } catch (e) {
      if (e instanceof ServiceError) return json({ error: e.code }, e.status);
      throw e;
    }
  }

  // Immutable version: snapshots of the source and JD are frozen at creation.
  let version: { id: string } | null = null;
  for (let attempt = 0; attempt < 3 && !version; attempt++) {
    const { data: last } = await admin
      .from("resume_versions")
      .select("version_number")
      .eq("resume_id", resumeId)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await admin
      .from("resume_versions")
      .insert({
        user_id: user.id,
        resume_id: resumeId,
        job_description_id: jobDescriptionId,
        analysis_id: analysisId,
        version_number: (last?.version_number ?? 0) + 1,
        label:
          label ||
          [jd.title, jd.company_name].filter(Boolean).join(" — ") ||
          "Tailored resume",
        status: "queued",
        source_snapshot: resume.extracted_text,
        job_description_snapshot: jd.raw_text,
      })
      .select("id")
      .single();
    if (!error) version = data;
  }
  if (!version) return json({ error: "could_not_create_version" }, 500);

  await admin.from("usage_events").insert({
    user_id: user.id,
    event_type: "resume_generation",
    resume_version_id: version.id,
  });
  logEvent("generation_queued", { versionId: version.id });

  after(() => runGeneration(version.id));
  return json({ versionId: version.id, status: "queued" });
}
