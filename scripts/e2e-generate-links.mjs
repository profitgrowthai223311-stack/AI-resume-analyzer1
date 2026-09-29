// Regression test for a real reported bug: a PDF's GitHub/LinkedIn/etc. links exist only as
// hyperlink annotations behind icons, never in the visible text. Proves the full pipeline — not
// just extraction — ends up using the REAL recovered URL rather than the model guessing one from
// a bare username (which can silently produce a wrong link, as it did for the real user: it
// guessed "linkedin.com/in/mohan-rao" when the real profile was "mohan-rao-b3b092257").
import { readFileSync } from "node:fs";
import {
  api,
  check,
  cleanup,
  failures,
  tempUser,
  uploadResume,
} from "./lib.mjs";

try {
  const u = await tempUser("genlinks");
  const id = await uploadResume(u, "sample-resume-with-links.pdf", "pdf");
  const extract = await api(u, "/api/extract-resume", { resumeId: id });
  check(
    "extraction recovered the real links",
    extract.data?.extractedText?.includes("github.com/janedoe-dev"),
  );

  const { data: jd } = await u.client
    .from("job_descriptions")
    .insert({
      user_id: u.id,
      title: "Software Engineer",
      raw_text: readFileSync("scripts/fixtures/sample-jd.txt", "utf8"),
    })
    .select("id")
    .single();
  const r = await api(u, "/api/generate-resume", {
    resumeId: id,
    jobDescriptionId: jd.id,
    label: "Link recovery test",
  });
  check("queued", r.status === 200, JSON.stringify(r));

  let v;
  for (let i = 0; i < 90; i++) {
    await new Promise((s) => setTimeout(s, 2000));
    ({ data: v } = await u.client
      .from("resume_versions")
      .select("*")
      .eq("id", r.data.versionId)
      .single());
    if (["ready", "failed"].includes(v.status)) break;
  }
  // The model occasionally fails validation for reasons unrelated to links (e.g. an unrelated
  // hallucinated number — the same live-model variance seen elsewhere in this suite); that's not
  // what this test is about. What matters here is specifically that it never fails on
  // link_not_in_source, and generate.ts persists latex_content even on a final failure, so the
  // href assertions below hold regardless of the overall outcome.
  const failedOnLinks =
    v.status === "failed" && /link_not_in_source/.test(v.error_message ?? "");
  check(
    "did not fail on link_not_in_source (the regression this test guards)",
    !failedOnLinks,
    v.error_message,
  );
  if (v.status !== "ready")
    console.log(
      `note: generation ended as "${v.status}" for an unrelated reason: ${v.error_message}`,
    );

  const tex = v.latex_content ?? "";
  const hrefs = [...tex.matchAll(/\\href\{([^}]*)\}/g)].map((m) => m[1]);
  check(
    "uses the REAL recovered GitHub URL, not a guess",
    hrefs.some((h) => h === "https://github.com/janedoe-dev"),
    JSON.stringify(hrefs),
  );
  check(
    "does not invent a different/guessed GitHub or LinkedIn slug",
    !hrefs.some(
      (h) =>
        /github\.com|linkedin\.com/i.test(h) &&
        ![
          "https://github.com/janedoe-dev",
          "https://www.linkedin.com/in/jane-doe-98765/",
        ].includes(h),
    ),
    JSON.stringify(hrefs),
  );
} finally {
  await cleanup();
}
process.exit(failures() ? 1 : 0);
