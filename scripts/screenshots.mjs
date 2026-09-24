// Visual QA: seeds a demo user with synthetic analytics data, screenshots key pages, then cleans up.
import puppeteer from "puppeteer-core";
import { BASE, admin, cleanup, env, tempUser, uploadResume } from "./lib.mjs";

const out = process.argv[2];
const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
try {
  const u = await tempUser("shots");
  await admin.from("profiles").update({ full_name: "Jane Doe" }).eq("id", u.id);
  const rid = await uploadResume(u, "sample-resume.pdf", "pdf");
  await admin
    .from("resumes")
    .update({
      extracted_text: "Jane Doe\nExperience\nAcme Corp",
      extraction_status: "complete",
      structured_content: { sections: { experience: "x" }, warnings: [] },
    })
    .eq("id", rid);
  const { data: jd } = await admin
    .from("job_descriptions")
    .insert({
      user_id: u.id,
      title: "Frontend Engineer",
      company_name: "Globex",
      raw_text: "x".repeat(60),
    })
    .select("id")
    .single();
  const kws = [
    "React",
    "Next.js",
    "TypeScript",
    "Jest",
    "CSS",
    "Git",
    "REST APIs",
  ];
  const gaps = ["CI/CD", "GraphQL", "Cypress", "AWS", "Docker"];
  const scores = [38, 45, 52, 49, 61, 66, 72, 70, 78, 84];
  let n = 0;
  for (const [i, score] of scores.entries()) {
    const created = new Date(
      Date.now() - (scores.length - i) * 4 * 86400_000,
    ).toISOString();
    const { data: a } = await admin
      .from("ats_analyses")
      .insert({
        user_id: u.id,
        resume_id: rid,
        job_description_id: jd.id,
        score,
        created_at: created,
        matched_keywords: kws.slice(0, 3 + (i % 5)).map((k) => ({
          keyword: k,
          kind: "required",
          evidence: `Used ${k} at Acme Corp`,
        })),
        missing_keywords: gaps.slice(0, 1 + (i % 4)).map((k, j) => ({
          keyword: k,
          kind: "tool",
          status: j === 0 ? "related" : "unsupported",
          evidence: j === 0 ? "Jenkins pipelines" : undefined,
        })),
        recommendations: [
          "Not evidenced in your resume: CI/CD, GraphQL. We will not add these as experience.",
        ],
      })
      .select("id")
      .single();
    const status = i === 3 ? "failed" : i === 9 ? "generating" : "ready";
    await admin.from("resume_versions").insert({
      user_id: u.id,
      resume_id: rid,
      job_description_id: jd.id,
      analysis_id: a.id,
      version_number: ++n,
      label: [
        "Globex FE",
        "Acme Platform",
        "Initech UI",
        "Hooli Web",
        "Umbrella Dev",
      ][i % 5],
      status,
      created_at: created,
      completed_at:
        status === "ready"
          ? new Date(new Date(created).getTime() + 9000).toISOString()
          : null,
      error_message:
        status === "failed" ? "The resume could not be compiled to PDF." : null,
    });
  }
  const { data: s } = await u.client.auth.getSession();
  const cookieValue = `base64-${Buffer.from(JSON.stringify(s.session)).toString("base64url")}`;
  const { data: v } = await admin
    .from("resume_versions")
    .select("id")
    .eq("user_id", u.id)
    .eq("status", "ready")
    .limit(1)
    .single();

  const browser = await puppeteer.launch({
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const shoot = async (
    name,
    path,
    { width = 1440, height = 900, auth = true, full = true, dark = false } = {},
  ) => {
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    if (auth)
      await page.setCookie({
        name: `sb-${ref}-auth-token`,
        value: cookieValue,
        url: BASE,
      });
    if (dark)
      await page.evaluateOnNewDocument(() =>
        localStorage.setItem("theme", "dark"),
      );
    await page.goto(BASE + path, { waitUntil: "networkidle0", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: full });
    await page.close();
  };
  await shoot("landing", "/", { auth: false });
  await shoot("pricing", "/pricing", { auth: false, full: false });
  await shoot("login", "/auth/login", { auth: false, full: false });
  await shoot("dashboard", "/dashboard");
  await shoot("dashboard-dark", "/dashboard", { dark: true });
  await shoot("analytics", "/analytics");
  await shoot("resumes", "/resumes", { full: false });
  await shoot("resume-detail", `/resumes/${rid}`, { full: false });
  await shoot("tailor", `/resumes/${rid}/tailor`, { full: false });
  await shoot("history", "/history", { full: false });
  await shoot("version-failed", `/versions/${v.id}`, { full: false });
  await shoot("billing", "/billing", { full: false });
  await shoot("settings", "/settings", { full: false });
  await shoot("upload", "/resumes/new", { full: false });
  await shoot("mobile-dashboard", "/dashboard", { width: 390, height: 844 });
  await shoot("mobile-landing", "/", {
    width: 390,
    height: 844,
    auth: false,
    full: false,
  });
  await browser.close();
  console.log("done");
} finally {
  await cleanup();
}
