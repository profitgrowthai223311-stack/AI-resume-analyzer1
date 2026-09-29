// Usage: npm run check-env [-- --phase=1..7]  (loads .env.local)
import { readFileSync, existsSync } from "node:fs";

const file = ".env.local";
if (!existsSync(file)) {
  console.error("✗ .env.local not found. Run: cp .env.example .env.local");
  process.exit(1);
}
const env = {};
for (const line of readFileSync(file, "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const phaseArg = process.argv.find((a) => a.startsWith("--phase="));
const phase = phaseArg ? Number(phaseArg.split("=")[1]) : 1;

const groups = [
  {
    phase: 1,
    vars: [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SITE_URL",
    ],
  },
  {
    phase: 2,
    vars: [
      "SUPABASE_SERVICE_ROLE_KEY",
      "MAX_UPLOAD_MB",
      "FREE_MONTHLY_GENERATIONS",
      "FREE_TOTAL_UPLOADS",
    ],
  },
  { phase: 5, vars: ["OPENAI_API_KEY", "OPENAI_MODEL"] },
  { phase: 6, vars: ["LATEX_COMPILER_URL"] },
  {
    phase: 7,
    vars: [
      "NEXT_PUBLIC_RAZORPAY_KEY_ID",
      "RAZORPAY_KEY_SECRET",
      "RAZORPAY_WEBHOOK_SECRET",
      "RAZORPAY_PLAN_ID_MONTHLY",
      "RAZORPAY_PLAN_ID_YEARLY",
    ],
  },
];

let missing = 0;
for (const g of groups.filter((g) => g.phase <= phase)) {
  for (const v of g.vars) {
    const ok = Boolean(env[v]);
    if (!ok) missing++;
    console.log(`${ok ? "✓" : "✗"} ${v}  (phase ${g.phase})`);
  }
}
if (
  env.NEXT_PUBLIC_SUPABASE_URL &&
  !/^https:\/\/.+\.supabase\.co\/?$/.test(env.NEXT_PUBLIC_SUPABASE_URL)
)
  console.log(
    "! NEXT_PUBLIC_SUPABASE_URL does not look like https://<ref>.supabase.co",
  );
console.log(
  missing
    ? `\n${missing} missing for phases ≤ ${phase}`
    : `\nAll set for phases ≤ ${phase}`,
);
process.exit(missing ? 1 : 0);
