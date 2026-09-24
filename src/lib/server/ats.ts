import "server-only";
import { z } from "zod";
import { chatJson, MODEL } from "./openai";

export const PROMPT_VERSION_ATS = "ats-v1";

const list = z.array(z.string()).default([]);
const requirementsSchema = z.object({
  title: z.string().default(""),
  seniority: z.string().default(""),
  location: z.string().default(""),
  requiredSkills: list,
  preferredSkills: list,
  tools: list,
  certifications: list,
  responsibilities: list,
  domainTerms: list,
  actionVerbs: list,
});
export type Requirements = z.infer<typeof requirementsSchema>;

export async function extractRequirements(jdText: string) {
  const { data, requestId } = await chatJson<unknown>(
    `You extract structured requirements from a job description. Return JSON with keys: title, seniority, location, requiredSkills, preferredSkills, tools, certifications, responsibilities, domainTerms, actionVerbs. Arrays contain short strings (skills/tools as their canonical names, e.g. "Next.js", "CI/CD"). Only include what the text states. Do not invent items.`,
    jdText.slice(0, 12000),
  );
  return { requirements: requirementsSchema.parse(data), requestId };
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");

/** Finds the resume line that mentions a keyword (punctuation/case-insensitive, whole token). */
export function findEvidence(
  resumeText: string,
  keyword: string,
): string | null {
  const k = squash(keyword);
  if (k.length < 2) return null;
  for (const line of resumeText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const words = trimmed.split(/[\s,;|/()]+/).map(squash);
    // Whole-token match, or the keyword spanning adjacent words ("machine learning").
    const joined = words.join(" ");
    const kWords = keyword
      .toLowerCase()
      .split(/\s+/)
      .map(squash)
      .filter(Boolean)
      .join(" ");
    if (words.includes(k) || (kWords.includes(" ") && joined.includes(kWords)))
      return trimmed.slice(0, 300);
  }
  return null;
}

type Kind = "required" | "preferred" | "tool" | "certification";
export type Gap = {
  keyword: string;
  kind: Kind;
  status: "related" | "unsupported";
  evidence?: string;
  note?: string;
};
export type Hit = { keyword: string; kind: Kind; evidence: string };

const WEIGHT: Record<Kind, number> = {
  required: 3,
  preferred: 1,
  tool: 2,
  certification: 1,
};

export async function analyze(resumeText: string, req: Requirements) {
  const items = new Map<string, Kind>();
  const add = (arr: string[], kind: Kind) =>
    arr.forEach((k) => {
      const key = k.trim();
      if (key && !items.has(key.toLowerCase()))
        items.set(key.toLowerCase(), kind);
    });
  add(req.requiredSkills, "required");
  add(req.tools, "tool");
  add(req.certifications, "certification");
  add(req.preferredSkills, "preferred");

  const names = new Map<string, string>();
  [
    ...req.requiredSkills,
    ...req.tools,
    ...req.certifications,
    ...req.preferredSkills,
  ].forEach((k) => names.set(k.trim().toLowerCase(), k.trim()));

  const matched: Hit[] = [];
  const missing: { keyword: string; kind: Kind }[] = [];
  for (const [key, kind] of items) {
    const keyword = names.get(key)!;
    const evidence = findEvidence(resumeText, keyword);
    if (evidence) matched.push({ keyword, kind, evidence });
    else missing.push({ keyword, kind });
  }

  // Classify gaps: related-but-unproven vs unsupported. The model must quote resume text;
  // quotes that are not verbatim substrings of the resume are discarded.
  const gaps: Gap[] = missing.map((m) => ({
    ...m,
    status: "unsupported" as const,
  }));
  let requestId: string | undefined;
  if (missing.length) {
    try {
      const res = await chatJson<{
        related?: { keyword: string; evidence: string; note?: string }[];
      }>(
        `You compare missing job keywords to a resume. For each keyword that is closely RELATED to something the resume explicitly states (e.g. resume says "Jenkins", keyword is "CI/CD"), return it with "evidence": an exact verbatim quote from the resume and a one-sentence "note". Do NOT include keywords with no genuine related evidence. Return JSON: {"related":[{"keyword","evidence","note"}]}.`,
        `RESUME:\n${resumeText.slice(0, 12000)}\n\nMISSING KEYWORDS:\n${missing.map((m) => m.keyword).join("\n")}`,
      );
      requestId = res.requestId;
      const haystack = resumeText.replace(/\s+/g, " ").toLowerCase();
      for (const r of res.data.related ?? []) {
        const gap = gaps.find(
          (g) => g.keyword.toLowerCase() === r.keyword?.toLowerCase(),
        );
        const quote = r.evidence?.replace(/\s+/g, " ").trim();
        if (gap && quote && haystack.includes(quote.toLowerCase())) {
          gap.status = "related";
          gap.evidence = quote;
          gap.note = r.note;
        }
      }
    } catch {
      // Classification is advisory; fall back to "unsupported".
    }
  }

  const total = [...items.values()].reduce((s, k) => s + WEIGHT[k], 0);
  const got = matched.reduce((s, m) => s + WEIGHT[m.kind], 0);
  const score = total ? Math.round((got / total) * 100) : 0;

  const recommendations: string[] = [];
  const related = gaps.filter((g) => g.status === "related");
  const unsupported = gaps.filter((g) => g.status === "unsupported");
  if (related.length)
    recommendations.push(
      `You have related experience for: ${related.map((g) => g.keyword).join(", ")}. If it is accurate, mention it explicitly in your source resume.`,
    );
  if (unsupported.length)
    recommendations.push(
      `Not evidenced in your resume: ${unsupported.map((g) => g.keyword).join(", ")}. We will not add these as experience. Add them to your source text only if you genuinely have them.`,
    );
  if (!missing.length)
    recommendations.push(
      "Your resume already covers the keywords in this job description.",
    );

  return {
    score,
    matched,
    gaps,
    recommendations,
    metadata: {
      model: MODEL,
      promptVersion: PROMPT_VERSION_ATS,
      requestId,
      scoring:
        "weighted keyword coverage: required×3, tools×2, preferred×1, certs×1",
    },
  };
}
