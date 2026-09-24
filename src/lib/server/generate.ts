import "server-only";
import { logEvent } from "./api-auth";
import { compilePdf, CompileError } from "./compile";
import { renderLatex, TEMPLATE_VERSION } from "./latex";
import { chatJson, MODEL } from "./openai";
import { GENERATE_SYSTEM_PROMPT, PROMPT_VERSION_GENERATE } from "./prompts";
import { resumeSchema } from "./resume-schema";
import { adminClient } from "./supabase-admin";
import { enforceFacts, validateLatex } from "./validate";

type Status =
  "queued" | "generating" | "validating" | "compiling" | "ready" | "failed";

/** Runs the full pipeline for a queued version. Never throws; failures are stored on the row. */
export async function runGeneration(versionId: string) {
  const admin = adminClient();
  const started = Date.now();
  const setStatus = (status: Status, extra: Record<string, unknown> = {}) =>
    admin
      .from("resume_versions")
      .update({ status, ...extra })
      .eq("id", versionId);
  const fail = async (code: string, message: string) => {
    await setStatus("failed", {
      error_code: code,
      error_message: message,
      completed_at: new Date().toISOString(),
    });
    // A failed generation does not consume the user's quota.
    await admin
      .from("usage_events")
      .delete()
      .eq("resume_version_id", versionId);
    logEvent("generation_failed", {
      versionId,
      code,
      ms: Date.now() - started,
    });
  };

  try {
    const { data: v } = await admin
      .from("resume_versions")
      .select("*")
      .eq("id", versionId)
      .single();
    if (!v || v.status !== "queued") return;
    await setStatus("generating");

    const [{ data: resume }, { data: analysis }, { data: jd }] =
      await Promise.all([
        admin
          .from("resumes")
          .select("structured_content")
          .eq("id", v.resume_id)
          .single(),
        admin.from("ats_analyses").select("*").eq("id", v.analysis_id).single(),
        admin
          .from("job_descriptions")
          .select("extracted_requirements")
          .eq("id", v.job_description_id)
          .single(),
      ]);
    const source: string = v.source_snapshot;

    const userPrompt = [
      `SOURCE RESUME:\n${source}`,
      `STRUCTURED SECTIONS (best-effort parse):\n${JSON.stringify(resume?.structured_content?.sections ?? {})}`,
      `JOB DESCRIPTION:\n${v.job_description_snapshot}`,
      `JOB REQUIREMENTS:\n${JSON.stringify(jd?.extracted_requirements ?? {})}`,
      `ATS ANALYSIS — matched (evidenced, safe to emphasise): ${JSON.stringify(analysis?.matched_keywords ?? [])}`,
      `ATS ANALYSIS — related but unproven / unsupported (DO NOT ADD as experience or skills): ${JSON.stringify(
        (analysis?.missing_keywords ?? []).map(
          (g: { keyword: string; status: string }) => ({
            keyword: g.keyword,
            status: g.status,
          }),
        ),
      )}`,
    ].join("\n\n");

    const { data: raw, requestId } = await chatJson<unknown>(
      GENERATE_SYSTEM_PROMPT,
      userPrompt,
      0.2,
    );
    const parsed = resumeSchema.safeParse(raw);
    if (!parsed.success)
      return fail(
        "invalid_model_output",
        "The AI returned an unexpected format. Please try again.",
      );

    await setStatus("validating");
    let facts;
    try {
      facts = enforceFacts(parsed.data, source);
    } catch {
      return fail(
        "fact_check_failed",
        "We couldn't verify your details against the source resume. Please review your text and retry.",
      );
    }
    if (
      !facts.resume.experience.length &&
      !facts.resume.projects.length &&
      !facts.resume.education.length
    )
      return fail(
        "insufficient_source_content",
        "There wasn't enough verifiable content to build a resume. Add more detail to your source text.",
      );

    const tex = renderLatex(facts.resume);
    const validation = validateLatex(tex);
    if (!validation.ok)
      return fail(
        "latex_validation_failed",
        `LaTeX validation failed: ${validation.errors.join(", ")}`,
      );

    const base = `${v.user_id}/${v.resume_id}/${v.id}`;
    const texUp = await admin.storage
      .from("generated-latex")
      .upload(
        `${base}/resume.tex`,
        new Blob([tex], { type: "application/x-tex" }),
        { upsert: true, contentType: "application/x-tex" },
      );
    if (texUp.error)
      return fail("storage_error", "Could not save the generated resume.");
    await setStatus("compiling", {
      latex_content: tex,
      latex_storage_path: `${base}/resume.tex`,
      validation_result: { ok: true, warnings: facts.warnings },
      generation_metadata: {
        model: MODEL,
        promptVersion: PROMPT_VERSION_GENERATE,
        template: TEMPLATE_VERSION,
        requestId,
        temperature: 0.2,
      },
    });

    let pdf: Uint8Array;
    try {
      pdf = await compilePdf(tex);
    } catch (e) {
      const ce =
        e instanceof CompileError
          ? e
          : new CompileError(
              "compiler_error",
              "The resume could not be compiled to PDF.",
            );
      return fail(ce.code, ce.safeMessage);
    }
    const pdfUp = await admin.storage
      .from("generated-pdfs")
      .upload(
        `${base}/resume.pdf`,
        new Blob([pdf as BlobPart], { type: "application/pdf" }),
        { upsert: true, contentType: "application/pdf" },
      );
    if (pdfUp.error) return fail("storage_error", "Could not save the PDF.");

    await setStatus("ready", {
      pdf_storage_path: `${base}/resume.pdf`,
      completed_at: new Date().toISOString(),
      error_code: null,
      error_message: null,
    });
    logEvent("generation_complete", {
      versionId,
      ms: Date.now() - started,
      warnings: facts.warnings.length,
    });
  } catch (e) {
    logEvent("generation_crashed", { versionId, reason: (e as Error).message });
    await fail(
      "generation_error",
      "Generation failed unexpectedly. Please try again.",
    );
  }
}
