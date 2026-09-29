import "server-only";
import { logEvent } from "./api-auth";
import { compilePdf, CompileError } from "./compile";
import { checkLatex, type CheckResult } from "./latex-check";
import { chatText, MODEL } from "./openai";
import {
  GENERATE_SYSTEM_PROMPT,
  generateUserPrompt,
  PROMPT_VERSION_GENERATE,
} from "./prompts";
import { adminClient } from "./supabase-admin";

type Status =
  "queued" | "generating" | "validating" | "compiling" | "ready" | "failed";
const MAX_ATTEMPTS = 2;

/** Runs the full pipeline for a queued version. Never throws; failures are stored on the row. */
export async function runGeneration(versionId: string) {
  const admin = adminClient();
  const started = Date.now();
  const setStatus = (status: Status, extra: Record<string, unknown> = {}) =>
    admin
      .from("resume_versions")
      .update({ status, ...extra })
      .eq("id", versionId);
  const fail = async (
    code: string,
    message: string,
    debug: Record<string, unknown> = {},
  ) => {
    await setStatus("failed", {
      error_code: code,
      error_message: message,
      completed_at: new Date().toISOString(),
      ...debug,
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

    const { data: analysis } = await admin
      .from("ats_analyses")
      .select("missing_keywords")
      .eq("id", v.analysis_id)
      .single();
    const unsupported: string[] = (analysis?.missing_keywords ?? []).map(
      (g: { keyword: string }) => g.keyword,
    );
    const source: string = v.source_snapshot;
    const basePrompt = generateUserPrompt(
      source,
      v.job_description_snapshot,
      unsupported,
    );

    let check: CheckResult | undefined;
    let requestId: string | undefined;
    let feedback = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) await setStatus("generating");
      const res = await chatText(
        GENERATE_SYSTEM_PROMPT,
        basePrompt + feedback,
        0.2,
      );
      requestId = res.requestId;
      await setStatus("validating");
      check = checkLatex(res.text, source);
      if (check.ok) break;
      logEvent("latex_validation_failed", {
        versionId,
        attempt,
        errors: check.errors,
      });
      feedback = `\n\nYOUR PREVIOUS OUTPUT FAILED VALIDATION (${check.errors.join("; ")}). Output the complete corrected LaTeX again. Copy the preamble exactly, escape special characters, and use only facts, names, dates and figures from the ORIGINAL RESUME.`;
    }
    if (!check?.ok)
      // Persist the actual failing output (never shown to the user; the failed-status UI branch
      // doesn't render latex_content/validation_result) so a recurrence can be diagnosed from the
      // database directly instead of needing to be reproduced live.
      return fail(
        "latex_validation_failed",
        `The generated resume failed validation (${check?.errors.slice(0, 3).join(", ")}). Please try again.`,
        {
          latex_content: check?.tex ?? null,
          validation_result: {
            ok: false,
            errors: check?.errors ?? [],
            warnings: check?.warnings ?? [],
          },
        },
      );

    const tex = check.tex;
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
      validation_result: { ok: true, warnings: check.warnings },
      generation_metadata: {
        model: MODEL,
        promptVersion: PROMPT_VERSION_GENERATE,
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
      warnings: check.warnings.length,
    });
  } catch (e) {
    logEvent("generation_crashed", { versionId, reason: (e as Error).message });
    await fail(
      "generation_error",
      "Generation failed unexpectedly. Please try again.",
    );
  }
}
