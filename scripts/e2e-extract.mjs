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
  const u = await tempUser("ext");
  // This test uploads 3 fixtures; the Free plan's total-upload cap is covered separately by
  // test:upload-limit, so make this user Pro to keep that concern out of this test.
  await admin
    .from("subscriptions")
    .insert({ user_id: u.id, status: "active", plan_code: "monthly" });
  for (const [file, type] of [
    ["sample-resume.pdf", "pdf"],
    ["sample-resume.docx", "docx"],
  ]) {
    const id = await uploadResume(u, file, type);
    const r = await api(u, "/api/extract-resume", { resumeId: id });
    check(
      `${type}: extraction complete`,
      r.status === 200 && r.data?.status === "complete",
      JSON.stringify(r.data)?.slice(0, 200),
    );
    check(
      `${type}: text contains Acme Corp and Next.js`,
      /Acme Corp/.test(r.data?.extractedText) &&
        /Next\.js/.test(r.data?.extractedText),
    );
    const { data: row } = await u.client
      .from("resumes")
      .select("extraction_status, structured_content")
      .eq("id", id)
      .single();
    check(
      `${type}: row updated with sections`,
      row.extraction_status === "complete" &&
        !!row.structured_content?.sections?.experience,
    );
  }
  // Regression: a PDF whose links exist only as hyperlink annotations (icon-style contact links,
  // extremely common in resume templates), never in the visible text layer, must still surface
  // those real URLs — otherwise the model can't use the real link and may guess a wrong one.
  const linkId = await uploadResume(u, "sample-resume-with-links.pdf", "pdf");
  const linkR = await api(u, "/api/extract-resume", { resumeId: linkId });
  check(
    "pdf with icon-only hyperlinks: real URLs recovered from annotations, not just visible text",
    [
      "github.com/janedoe-dev",
      "linkedin.com/in/jane-doe-98765",
      "leetcode.com/u/janedoecodes",
    ].every((s) => linkR.data?.extractedText?.includes(s)),
    linkR.data?.extractedText,
  );

  // The "Re-extract from file" button on the review page just calls this same endpoint again for
  // an already-extracted resume — proves it's safe to re-run and picks up the same real links.
  const reextract = await api(u, "/api/extract-resume", { resumeId: linkId });
  check(
    "re-extracting an already-complete resume works and is idempotent",
    reextract.status === 200 &&
      reextract.data?.extractedText?.includes("github.com/janedoe-dev"),
    JSON.stringify(reextract).slice(0, 200),
  );

  const bad = crypto.randomUUID();
  check(
    "unknown resumeId → 404",
    (await api(u, "/api/extract-resume", { resumeId: bad })).status === 404,
  );
  check(
    "no auth → 401",
    (
      await fetch(
        (process.env.BASE_URL ?? "http://localhost:3111") +
          "/api/extract-resume",
        { method: "POST", body: "{}" },
      )
    ).status === 401,
  );
} finally {
  await cleanup();
}
process.exit(failures() ? 1 : 0);
