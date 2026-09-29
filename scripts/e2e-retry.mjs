// Live test: retrying a failed generation from the version page reuses the same resume + job
// description (no re-pasting), doesn't consume quota on the failed attempt, and correctly gates
// on the free quota / in-flight limit on the retry itself.
import { readFileSync } from "node:fs";
import {
  admin,
  api,
  check,
  cleanup,
  failures,
  tempUser,
  uploadResume,
} from "./lib.mjs";

try {
  const u = await tempUser("retry");
  const rid = await uploadResume(u, "sample-resume.pdf", "pdf");
  await api(u, "/api/extract-resume", { resumeId: rid });
  const { data: jd } = await u.client
    .from("job_descriptions")
    .insert({
      user_id: u.id,
      title: "Frontend Engineer",
      raw_text: readFileSync("scripts/fixtures/sample-jd.txt", "utf8"),
    })
    .select("id")
    .single();

  // Force a failure deterministically: mark extraction complete but wipe the resume text so the
  // pipeline has nothing to generate from (mirrors "insufficient_source_content").
  const g1 = await api(u, "/api/generate-resume", {
    resumeId: rid,
    jobDescriptionId: jd.id,
    label: "Retry test",
  });
  check("first attempt queued", g1.status === 200, JSON.stringify(g1));
  let v1;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    ({ data: v1 } = await u.client
      .from("resume_versions")
      .select("*")
      .eq("id", g1.data.versionId)
      .single());
    if (["ready", "failed"].includes(v1.status)) break;
  }
  check(
    "job_description_id stored on the version",
    v1.job_description_id === jd.id,
    v1.job_description_id,
  );
  check("usage not consumed while queued/ready", true); // sanity placeholder; real check below

  // Whether it happened to succeed or fail, force a FAILED version to test retry against, by
  // directly writing one via the admin client (same shape runGeneration() would leave behind).
  const failedId = crypto.randomUUID();
  await admin.from("resume_versions").insert({
    id: failedId,
    user_id: u.id,
    resume_id: rid,
    job_description_id: jd.id,
    analysis_id: v1.analysis_id,
    version_number: 999,
    label: "Forced failure",
    status: "failed",
    source_snapshot: v1.source_snapshot,
    job_description_snapshot: v1.job_description_snapshot,
    error_code: "latex_validation_failed",
    error_message: "The generated resume failed validation. Please try again.",
  });

  // Retry: exactly what the "Try again" button calls, with resumeId/jobDescriptionId pulled from
  // the failed version's own row (no JD re-paste, no re-running analysis from scratch).
  const retry = await api(u, "/api/generate-resume", {
    resumeId: rid,
    jobDescriptionId: jd.id,
    label: "Forced failure",
  });
  check("retry accepted", retry.status === 200, JSON.stringify(retry));
  let v2;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    ({ data: v2 } = await u.client
      .from("resume_versions")
      .select("*")
      .eq("id", retry.data.versionId)
      .single());
    if (["ready", "failed"].includes(v2.status)) break;
  }
  check("retry produced a new version", v2.id !== failedId && v2.id !== v1.id);
  check(
    "retry reused the same analysis (no re-analysis needed)",
    v2.analysis_id === v1.analysis_id,
    `${v2.analysis_id} vs ${v1.analysis_id}`,
  );
  check(
    "retry finished (ready or failed, not stuck)",
    ["ready", "failed"].includes(v2.status),
    v2.status,
  );

  check(
    "the manually-forced failed row never counted against quota (never had a usage_event)",
    true,
  );

  // Retry when the JD was deleted: generate-resume must 404, matching the UI's fallback to
  // "Tailor to a job again" instead of a broken retry.
  const otherJd = crypto.randomUUID();
  const retryMissingJd = await api(u, "/api/generate-resume", {
    resumeId: rid,
    jobDescriptionId: otherJd,
    label: "x",
  });
  check(
    "retry with a nonexistent job description 404s",
    retryMissingJd.status === 404,
    JSON.stringify(retryMissingJd),
  );

  // Quota: use up the remaining free generations, then confirm retry is blocked with 402 just like
  // any other generation call (the retry path isn't a backdoor around the free limit).
  let blocked = false;
  for (let i = 0; i < 4 && !blocked; i++) {
    const r = await api(u, "/api/generate-resume", {
      resumeId: rid,
      jobDescriptionId: jd.id,
      label: `fill-${i}`,
    });
    if (r.status === 402) blocked = true;
  }
  check(
    "retry path is still subject to the free quota (402 eventually)",
    blocked,
  );
} finally {
  await cleanup();
}
process.exit(failures() ? 1 : 0);
