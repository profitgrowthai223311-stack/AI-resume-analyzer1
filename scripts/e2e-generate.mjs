import { readFileSync } from "node:fs";
import {
  api,
  admin,
  check,
  cleanup,
  failures,
  tempUser,
  uploadResume,
} from "./lib.mjs";
try {
  const u = await tempUser("gen");
  const id = await uploadResume(u, "sample-resume.pdf", "pdf");
  await api(u, "/api/extract-resume", { resumeId: id });
  const { data: jd } = await u.client
    .from("job_descriptions")
    .insert({
      user_id: u.id,
      title: "Frontend Engineer",
      company_name: "Globex",
      raw_text: readFileSync("scripts/fixtures/sample-jd.txt", "utf8"),
    })
    .select("id")
    .single();

  const r = await api(u, "/api/generate-resume", {
    resumeId: id,
    jobDescriptionId: jd.id,
    label: "Globex FE",
  });
  check(
    "queued",
    r.status === 200 && r.data?.status === "queued",
    JSON.stringify(r),
  );
  const vid = r.data.versionId;
  let v;
  for (let i = 0; i < 90; i++) {
    await new Promise((s) => setTimeout(s, 2000));
    ({ data: v } = await u.client
      .from("resume_versions")
      .select("*")
      .eq("id", vid)
      .single());
    if (["ready", "failed"].includes(v.status)) break;
  }
  check(
    "version ready",
    v.status === "ready",
    `${v.status} ${v.error_code} ${v.error_message}`,
  );
  console.log("warnings:", JSON.stringify(v.validation_result?.warnings));
  const tex = v.latex_content ?? "";
  check(
    "LaTeX starts/ends correctly",
    tex.startsWith("\\documentclass") && tex.endsWith("\\end{document}"),
  );
  check(
    "no fabricated tools in LaTeX (GraphQL/Cypress/AWS/CI/CD)",
    !/graphql|cypress|aws|ci\/cd|ci\\\/cd/i.test(tex),
  );
  check(
    "real facts present (Acme Corp, Beta Labs, VIT University)",
    ["Acme Corp", "Beta Labs", "VIT University"].every((s) => tex.includes(s)),
  );
  const src = readFileSync("scripts/fixtures/sample-resume.txt", "utf8");
  const body = tex.slice(tex.indexOf("\\begin{document}"));
  check(
    "every number in output exists in source",
    [...body.matchAll(/\d[\d,.]*%?/g)].every((m) =>
      src.includes(m[0].replace(/[.,]$/, "")),
    ),
  );
  check(
    "bullets kept (no unnecessary drops)",
    (tex.match(/\\item/g) ?? []).length >= 5,
    String((tex.match(/\\item/g) ?? []).length),
  );
  const { data: pdf, error } = await admin.storage
    .from("generated-pdfs")
    .download(v.pdf_storage_path);
  const bytes = pdf ? new Uint8Array(await pdf.arrayBuffer()) : [];
  check(
    "PDF stored with %PDF signature",
    !error && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-",
  );
  const sig = await u.client.storage
    .from("generated-pdfs")
    .createSignedUrl(v.pdf_storage_path, 60);
  check("owner can create signed PDF URL", !!sig.data?.signedUrl);
  console.log("bytes:", bytes.length);
  // second generation → version 2, 3rd blocked by free quota
  const r2 = await api(u, "/api/generate-resume", {
    resumeId: id,
    jobDescriptionId: jd.id,
  });
  check("second generation queued", r2.status === 200, JSON.stringify(r2));
  for (let i = 0; i < 90; i++) {
    await new Promise((s) => setTimeout(s, 2000));
    const { data } = await u.client
      .from("resume_versions")
      .select("status, version_number")
      .eq("id", r2.data.versionId)
      .single();
    if (["ready", "failed"].includes(data.status)) {
      check("second is version 2", data.version_number === 2);
      break;
    }
  }
  const r3 = await api(u, "/api/generate-resume", {
    resumeId: id,
    jobDescriptionId: jd.id,
  });
  check(
    "third blocked by free quota (402)",
    r3.status === 402,
    JSON.stringify(r3),
  );
} finally {
  await cleanup();
}
process.exit(failures() ? 1 : 0);
