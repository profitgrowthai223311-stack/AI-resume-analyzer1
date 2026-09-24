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
  const u = await tempUser("ats");
  const id = await uploadResume(u, "sample-resume.pdf", "pdf");
  await api(u, "/api/extract-resume", { resumeId: id });
  const { data: jd, error } = await u.client
    .from("job_descriptions")
    .insert({
      user_id: u.id,
      title: "Frontend Engineer",
      company_name: "Globex",
      raw_text: readFileSync("scripts/fixtures/sample-jd.txt", "utf8"),
    })
    .select("id")
    .single();
  if (error) throw error;
  const r = await api(u, "/api/analyze-ats", {
    resumeId: id,
    jobDescriptionId: jd.id,
  });
  console.log(JSON.stringify(r.data, null, 1));
  check(
    "200 with score 0..100",
    r.status === 200 && r.data.score >= 0 && r.data.score <= 100,
  );
  const lc = (a) => a.map((x) => x.toLowerCase());
  check(
    "React, Next.js, TypeScript matched",
    ["react", "next.js", "typescript"].every((k) =>
      lc(r.data.matchedKeywords).includes(k),
    ),
  );
  check("Jest matched", lc(r.data.matchedKeywords).includes("jest"));
  const notMatched = lc([
    ...r.data.missingKeywords,
    ...r.data.unsupportedRequirements,
  ]);
  check(
    "CI/CD, GraphQL, Cypress not matched",
    ["ci/cd", "graphql", "cypress"].every((k) =>
      notMatched.some((n) => n.includes(k)),
    ),
  );
  check(
    "AWS certification never matched",
    !lc(r.data.matchedKeywords).some((k) => k.includes("aws")),
  );
  const { data: row } = await u.client
    .from("ats_analyses")
    .select("id, evidence_map")
    .eq("id", r.data.analysisId)
    .single();
  check(
    "analysis row readable by owner with evidence map",
    row?.evidence_map?.length > 0,
  );
} finally {
  await cleanup();
}
process.exit(failures() ? 1 : 0);
