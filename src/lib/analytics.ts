import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

type Kw = { keyword: string; status?: string };

export async function getAnalytics(supabase: SupabaseClient) {
  const [{ data: versions }, { data: analyses }, { count: resumeCount }] =
    await Promise.all([
      supabase
        .from("resume_versions")
        .select(
          "id, label, version_number, status, created_at, completed_at, analysis_id",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("ats_analyses")
        .select("id, score, created_at, matched_keywords, missing_keywords")
        .order("created_at", { ascending: true })
        .limit(500),
      supabase.from("resumes").select("id", { count: "exact", head: true }),
    ]);
  const vs = versions ?? [];
  const as = analyses ?? [];

  const ready = vs.filter((v) => v.status === "ready");
  const failed = vs.filter((v) => v.status === "failed");
  const finished = ready.length + failed.length;
  const times = ready
    .filter((v) => v.completed_at)
    .map(
      (v) =>
        (new Date(v.completed_at!).getTime() -
          new Date(v.created_at).getTime()) /
        1000,
    );
  const scores = as.map((a) => a.score as number);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const scoreTrend = as
    .slice(-14)
    .map((a) => ({ date: fmt(a.created_at), score: a.score as number }));

  // Last 8 weeks, oldest first.
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - start.getDay() - (7 - i) * 7 + 7);
    return { start, label: fmt(start.toISOString()), ready: 0, failed: 0 };
  });
  for (const v of vs) {
    const t = new Date(v.created_at).getTime();
    const w = [...weeks].reverse().find((w) => t >= w.start.getTime());
    if (w && v.status === "ready") w.ready++;
    else if (w && v.status === "failed") w.failed++;
  }

  const buckets = ["0–20", "21–40", "41–60", "61–80", "81–100"].map(
    (range) => ({ range, count: 0 }),
  );
  for (const s of scores)
    buckets[Math.min(4, Math.max(0, Math.ceil(s / 20) - 1))].count++;

  const tally = (
    pick: (a: (typeof as)[number]) => Kw[],
    filter: (k: Kw) => boolean,
  ) => {
    const m = new Map<string, number>();
    for (const a of as)
      for (const k of pick(a))
        if (filter(k)) m.set(k.keyword, (m.get(k.keyword) ?? 0) + 1);
    return [...m]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([keyword, count]) => ({ keyword, count }));
  };
  let matchedTotal = 0,
    related = 0,
    unsupported = 0;
  for (const a of as) {
    matchedTotal += ((a.matched_keywords as Kw[]) ?? []).length;
    for (const g of (a.missing_keywords as Kw[]) ?? []) {
      if (g.status === "related") related++;
      else unsupported++;
    }
  }

  const statusCounts = [
    "ready",
    "failed",
    "queued",
    "generating",
    "validating",
    "compiling",
  ]
    .map((s) => ({ s, n: vs.filter((v) => v.status === s).length }))
    .filter((x) => x.n);

  return {
    resumeCount: resumeCount ?? 0,
    versionCount: vs.length,
    analysisCount: as.length,
    avgScore: scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null,
    bestScore: scores.length ? Math.max(...scores) : null,
    latestScore: scores.length ? scores[scores.length - 1] : null,
    firstScore: scores.length ? scores[0] : null,
    successRate: finished ? Math.round((ready.length / finished) * 100) : null,
    avgSeconds: times.length
      ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
      : null,
    scoreTrend,
    weekly: weeks.map(({ label, ready, failed }) => ({ label, ready, failed })),
    histogram: buckets,
    topMatched: tally(
      (a) => (a.matched_keywords as Kw[]) ?? [],
      () => true,
    ),
    topGaps: tally(
      (a) => (a.missing_keywords as Kw[]) ?? [],
      () => true,
    ),
    coverage: [
      { name: "Matched", value: matchedTotal, color: "var(--chart-3)" },
      { name: "Related", value: related, color: "var(--chart-4)" },
      { name: "Not in resume", value: unsupported, color: "var(--chart-2)" },
    ],
    statusData: statusCounts.map((x) => ({
      name: x.s[0].toUpperCase() + x.s.slice(1),
      value: x.n,
      color:
        { ready: "var(--chart-3)", failed: "var(--chart-2)" }[x.s] ??
        "var(--chart-5)",
    })),
    recent: vs.slice(0, 6),
  };
}
