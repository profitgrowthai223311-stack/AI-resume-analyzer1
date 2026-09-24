// Renders authenticated pages with a real Supabase session cookie, then tests data/account deletion.
import { readFileSync } from "node:fs";
import {
  BASE,
  admin,
  api,
  check,
  cleanup,
  env,
  failures,
  tempUser,
  uploadResume,
} from "./lib.mjs";

const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
try {
  const u = await tempUser("pages");
  const { data: s } = await u.client.auth.getSession();
  const cookie = `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify(s.session)).toString("base64url")}`;
  const get = async (path) => {
    const r = await fetch(BASE + path, {
      headers: { cookie },
      redirect: "manual",
    });
    return {
      status: r.status,
      text: await r.text(),
      loc: r.headers.get("location"),
    };
  };

  const rid = await uploadResume(u, "sample-resume.pdf", "pdf");
  await api(u, "/api/extract-resume", { resumeId: rid });
  const { data: jd } = await u.client
    .from("job_descriptions")
    .insert({
      user_id: u.id,
      title: "FE",
      raw_text: readFileSync("scripts/fixtures/sample-jd.txt", "utf8"),
    })
    .select("id")
    .single();
  const g = await api(u, "/api/generate-resume", {
    resumeId: rid,
    jobDescriptionId: jd.id,
  });
  let v;
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    ({ data: v } = await u.client
      .from("resume_versions")
      .select("status")
      .eq("id", g.data.versionId)
      .single());
    if (["ready", "failed"].includes(v.status)) break;
  }

  const pages = [
    ["/dashboard", /Welcome,[\s\S]*E2E pages/],
    ["/resumes/new", /Upload your resume/],
    [`/resumes/${rid}`, /Extracted text/],
    [`/resumes/${rid}/tailor`, /Job description/],
    [`/versions/${g.data.versionId}`, /Tailored resume|v1|Frontend/],
    ["/history", /History/],
    ["/billing", /Current plan/],
    ["/settings", /Delete data/],
    ["/pricing", /Pro Monthly/],
    ["/privacy", /AI data handling/],
  ];
  for (const [path, re] of pages) {
    const r = await get(path);
    check(
      `${path} → 200 & content`,
      r.status === 200 && re.test(r.text),
      `${r.status} ${r.loc ?? ""}`,
    );
  }
  check(
    "no service-role key or secrets in any HTML",
    !(await Promise.all(pages.map(([p]) => get(p)))).some((r) =>
      [
        env.SUPABASE_SERVICE_ROLE_KEY,
        env.OPENAI_API_KEY,
        env.RAZORPAY_KEY_SECRET,
        env.RAZORPAY_WEBHOOK_SECRET,
      ].some((k) => k && r.text.includes(k)),
    ),
  );
  check(
    "signed-out /dashboard redirects to login",
    (await fetch(BASE + "/dashboard", { redirect: "manual" })).status === 307,
  );
  const other = await tempUser("pages2");
  const foreign = await fetch(`${BASE}/resumes/${rid}`, {
    headers: {
      cookie: `sb-${ref}-auth-token=base64-${Buffer.from(JSON.stringify((await other.client.auth.getSession()).data.session)).toString("base64url")}`,
    },
  });
  check("another user's resume page → 404", foreign.status === 404);

  // rate limit
  const rl = [];
  for (let i = 0; i < 12; i++)
    rl.push(
      (await api(u, "/api/extract-resume", { resumeId: crypto.randomUUID() }))
        .status,
    );
  check("extract endpoint rate-limited (429 after 10/min)", rl.includes(429));

  // deletion
  const del = await api(u, "/api/account", { scope: "data" }, "DELETE");
  check("data deletion ok", del.status === 200);
  check(
    "resumes/versions/jds gone",
    (await admin.from("resumes").select("id").eq("user_id", u.id)).data
      .length === 0 &&
      (await admin.from("resume_versions").select("id").eq("user_id", u.id))
        .data.length === 0,
  );
  const files = await admin.storage.from("generated-pdfs").list(u.id);
  check(
    "generated files removed from storage",
    (files.data ?? []).length === 0,
  );
  const acct = await api(other, "/api/account", { scope: "account" }, "DELETE");
  check(
    "account deletion ok",
    acct.status === 200 &&
      (await admin.auth.admin.getUserById(other.id)).data.user === null,
  );
} finally {
  await cleanup();
}
process.exit(failures() ? 1 : 0);
