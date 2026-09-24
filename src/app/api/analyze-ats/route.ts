import { z } from "zod";
import { rateLimit } from "@/lib/server/rate-limit";
import { getAuthed, json, unauthorized } from "@/lib/server/api-auth";
import { runAnalysis, ServiceError } from "@/lib/server/analysis-service";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getAuthed(request);
  if (!auth) return unauthorized();
  if (!rateLimit(`analyze:${auth.user.id}`, 15, 60_000))
    return json({ error: "rate_limited" }, 429);
  const body = z
    .object({
      resumeId: z.string().uuid(),
      jobDescriptionId: z.string().uuid(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "invalid_input" }, 400);

  try {
    const r = await runAnalysis(
      auth.supabase,
      auth.user,
      body.data.resumeId,
      body.data.jobDescriptionId,
    );
    return json({
      analysisId: r.analysisId,
      score: r.score,
      matchedKeywords: r.matched.map((m) => m.keyword),
      missingKeywords: r.gaps
        .filter((g) => g.status === "related")
        .map((g) => g.keyword),
      unsupportedRequirements: r.gaps
        .filter((g) => g.status === "unsupported")
        .map((g) => g.keyword),
      recommendations: r.recommendations,
      matchLevel: r.report.match_level,
      summary: r.report.summary,
    });
  } catch (e) {
    if (e instanceof ServiceError) return json({ error: e.code }, e.status);
    throw e;
  }
}
