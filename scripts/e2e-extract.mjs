import { api, check, cleanup, failures, tempUser, uploadResume } from "./lib.mjs";
try {
  const u = await tempUser("ext");
  for (const [file, type] of [["sample-resume.pdf", "pdf"], ["sample-resume.docx", "docx"]]) {
    const id = await uploadResume(u, file, type);
    const r = await api(u, "/api/extract-resume", { resumeId: id });
    check(`${type}: extraction complete`, r.status === 200 && r.data?.status === "complete", JSON.stringify(r.data)?.slice(0, 200));
    check(`${type}: text contains Acme Corp and Next.js`, /Acme Corp/.test(r.data?.extractedText) && /Next\.js/.test(r.data?.extractedText));
    const { data: row } = await u.client.from("resumes").select("extraction_status, structured_content").eq("id", id).single();
    check(`${type}: row updated with sections`, row.extraction_status === "complete" && !!row.structured_content?.sections?.experience);
  }
  const bad = crypto.randomUUID();
  check("unknown resumeId → 404", (await api(u, "/api/extract-resume", { resumeId: bad })).status === 404);
  check("no auth → 401", (await fetch((process.env.BASE_URL ?? "http://localhost:3111") + "/api/extract-resume", { method: "POST", body: "{}" })).status === 401);
} finally { await cleanup(); }
process.exit(failures() ? 1 : 0);
