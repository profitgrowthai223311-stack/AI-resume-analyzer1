import "server-only";
import { z } from "zod";
import { chatJson, MODEL } from "./openai";
import {
  ATS_SYSTEM_PROMPT,
  atsUserPrompt,
  PROMPT_VERSION_ATS,
} from "./prompts";

const list = z.array(z.string()).default([]);
const reportSchema = z.object({
  overall_match_percentage: z.coerce.number().default(0),
  match_level: z.string().default(""),
  matched_skills: list,
  missing_skills: list,
  experience_summary: z.string().default(""),
  strengths: list,
  gaps: list,
  top_recommendations: list,
  ats_score: z.coerce.number().optional(),
  summary: z.string().default(""),
});
export type AtsReport = z.infer<typeof reportSchema>;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");

/** Finds the resume line that mentions a keyword (punctuation/case-insensitive, whole token). */
export function findEvidence(
  resumeText: string,
  keyword: string,
): string | null {
  const k = squash(keyword);
  if (k.length < 2) return null;
  const kWords = keyword
    .toLowerCase()
    .split(/\s+/)
    .map(squash)
    .filter(Boolean)
    .join(" ");
  for (const line of resumeText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/[\s,;|/()]+/).map(squash);
    if (
      words.includes(k) ||
      (kWords.includes(" ") && words.join(" ").includes(kWords))
    )
      return trimmed.slice(0, 300);
  }
  return null;
}

export type Hit = { keyword: string; kind: string; evidence: string };
export type Gap = {
  keyword: string;
  kind: string;
  status: "related" | "unsupported";
  evidence?: string;
  note?: string;
};

const clamp = (n: number) =>
  Math.max(0, Math.min(100, Math.round(Number.isFinite(n) ? n : 0)));

/**
 * Runs the owner-supplied ATS prompt, then verifies every "matched" skill against the resume text.
 * Skills the model calls matched but the resume never states are downgraded to "related but unproven";
 * "missing" skills that the resume does state are promoted to matched.
 */
export async function analyze(resumeText: string, jobDescription: string) {
  const { data, requestId } = await chatJson<unknown>(
    ATS_SYSTEM_PROMPT,
    atsUserPrompt(resumeText.slice(0, 15000), jobDescription.slice(0, 12000)),
    0.1,
  );
  const report = reportSchema.parse(data);
  const seen = new Set<string>();
  const uniq = (arr: string[]) =>
    arr
      .map((s) => s.trim())
      .filter(
        (s) => s && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()),
      );

  const matched: Hit[] = [];
  const gaps: Gap[] = [];
  for (const keyword of uniq(report.matched_skills)) {
    const evidence = findEvidence(resumeText, keyword);
    if (evidence) matched.push({ keyword, kind: "skill", evidence });
    else
      gaps.push({
        keyword,
        kind: "skill",
        status: "related",
        note: "Related skill; not stated in your resume.",
      });
  }
  for (const keyword of uniq(report.missing_skills)) {
    const evidence = findEvidence(resumeText, keyword);
    if (evidence) matched.push({ keyword, kind: "skill", evidence });
    else gaps.push({ keyword, kind: "skill", status: "unsupported" });
  }

  const recommendations = [...report.top_recommendations];
  const unsupported = gaps.filter((g) => g.status === "unsupported");
  if (unsupported.length)
    recommendations.push(
      `Not evidenced in your resume: ${unsupported.map((g) => g.keyword).join(", ")}. We will not add these as experience. Add them to your source text only if you genuinely have them.`,
    );

  const score = clamp(report.ats_score ?? report.overall_match_percentage);
  return {
    score,
    matched,
    gaps,
    recommendations,
    report: {
      overall_match_percentage: clamp(report.overall_match_percentage),
      ats_score: score,
      match_level: report.match_level,
      experience_summary: report.experience_summary,
      strengths: report.strengths,
      gaps: report.gaps,
      summary: report.summary,
    },
    metadata: { model: MODEL, promptVersion: PROMPT_VERSION_ATS, requestId },
  };
}
