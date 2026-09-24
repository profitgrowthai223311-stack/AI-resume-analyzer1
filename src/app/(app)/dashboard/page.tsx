import {
  ArrowRight,
  BarChart3,
  FileText,
  Gauge,
  Rocket,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { UsageMeter } from "@/components/billing/usage-meter";
import {
  ActivityChart,
  DonutChart,
  ScoreTrendChart,
} from "@/components/charts/charts";
import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAnalytics } from "@/lib/analytics";
import {
  FREE_MONTHLY_GENERATIONS,
  getPlan,
  monthlyUsage,
} from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims.sub ?? "";
  const [{ data: profile }, plan, used, a] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
    getPlan(supabase, uid),
    monthlyUsage(supabase, uid),
    getAnalytics(supabase),
  ]);
  const name =
    profile?.full_name ||
    (claims?.claims.email as string | undefined) ||
    "there";
  const improvement =
    a.firstScore !== null && a.latestScore !== null && a.analysisCount > 1
      ? a.latestScore - a.firstScore
      : null;

  return (
    <>
      <div className="bg-brand-gradient shadow-glow relative overflow-hidden rounded-3xl p-6 text-white md:p-8">
        <div className="absolute -top-10 -right-10 size-56 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/80">Welcome back</p>
            <h2 className="text-2xl font-bold md:text-3xl">Welcome, {name}</h2>
            <p className="mt-1 max-w-lg text-sm text-white/85">
              Tailor your resume to your next job in minutes, using only facts
              from your real experience.
            </p>
          </div>
          <Link
            href="/resumes/new"
            className={
              buttonVariants({ variant: "secondary", size: "lg" }) +
              " h-11 px-5 text-base"
            }
          >
            <Sparkles className="size-4" /> Create tailored resume
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Resumes uploaded"
          value={a.resumeCount}
          hint="Source resumes"
          icon={FileText}
          tone="indigo"
        />
        <StatCard
          label="Tailored versions"
          value={a.versionCount}
          hint={`${a.successRate ?? "–"}% success rate`}
          icon={Rocket}
          tone="pink"
        />
        <StatCard
          label="Average ATS score"
          value={a.avgScore ?? "–"}
          hint={
            improvement !== null
              ? `${improvement >= 0 ? "+" : ""}${improvement} since first analysis`
              : "Advisory keyword match"
          }
          icon={Gauge}
          tone="emerald"
        />
        <StatCard
          label="Best score"
          value={a.bestScore ?? "–"}
          hint={`${a.analysisCount} analyses run`}
          icon={Trophy}
          tone="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>ATS score trend</CardTitle>
            <CardDescription>
              Keyword alignment across your recent analyses
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ScoreTrendChart data={a.scoreTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Usage this month</CardTitle>
            <CardDescription>
              {plan === "pro" ? "Pro plan" : "Free plan"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageMeter
              used={used}
              limit={FREE_MONTHLY_GENERATIONS}
              plan={plan}
            />
            {plan === "free" && (
              <Link
                href="/pricing"
                className={buttonVariants({ variant: "accent" }) + " w-full"}
              >
                Upgrade to Pro
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Keyword coverage</CardTitle>
            <CardDescription>Across all job descriptions</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <DonutChart data={a.coverage} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Weekly activity</CardTitle>
            <CardDescription>Resumes generated, last 8 weeks</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ActivityChart data={a.weekly} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent versions</CardTitle>
              <CardDescription>Your latest tailored resumes</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {a.recent.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No versions yet"
                description="Upload a resume and paste a job description."
                tone="pink"
              />
            ) : (
              <ul className="space-y-1">
                {a.recent.slice(0, 5).map((v) => (
                  <li key={v.id}>
                    <Link
                      href={`/versions/${v.id}`}
                      className="hover:bg-muted flex items-center justify-between gap-2 rounded-xl px-2 py-2 text-sm"
                    >
                      <span className="truncate font-medium">
                        {v.label ?? "Tailored resume"}{" "}
                        <span className="text-muted-foreground">
                          v{v.version_number}
                        </span>
                      </span>
                      <StatusBadge status={v.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: FileText,
            title: "Upload",
            text: "Add a PDF or DOCX and review the extracted text.",
            href: "/resumes/new",
            tone: "from-indigo-500 to-violet-500",
          },
          {
            icon: Target,
            title: "Analyze",
            text: "Paste a job description and see evidenced keyword gaps.",
            href: "/resumes",
            tone: "from-pink-500 to-rose-500",
          },
          {
            icon: BarChart3,
            title: "Track",
            text: "Follow your score and success rate in Analytics.",
            href: "/analytics",
            tone: "from-emerald-500 to-teal-500",
          },
        ].map((c) => (
          <Link key={c.title} href={c.href} className="group">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
              <CardContent className="flex items-start gap-4">
                <span
                  className={`flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-white ${c.tone}`}
                >
                  <c.icon className="size-5" />
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-muted-foreground text-sm">{c.text}</p>
                </div>
                <ArrowRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
