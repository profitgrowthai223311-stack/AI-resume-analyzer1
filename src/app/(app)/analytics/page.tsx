import { CheckCircle2, Clock, Gauge, Layers, TrendingUp } from "lucide-react";
import {
  ActivityChart,
  DonutChart,
  HistogramChart,
  KeywordBarChart,
  ScoreTrendChart,
} from "@/components/charts/charts";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAnalytics } from "@/lib/analytics";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const a = await getAnalytics(await createClient());
  return (
    <>
      <PageHeader
        title="Analytics"
        description="How your resumes perform against the jobs you target. Scores are advisory."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Average ATS score"
          value={a.avgScore ?? "–"}
          hint={`${a.analysisCount} analyses`}
          icon={Gauge}
          tone="indigo"
        />
        <StatCard
          label="Latest score"
          value={a.latestScore ?? "–"}
          hint="Most recent analysis"
          icon={TrendingUp}
          tone="pink"
        />
        <StatCard
          label="Generation success"
          value={a.successRate !== null ? `${a.successRate}%` : "–"}
          hint={`${a.versionCount} versions`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <StatCard
          label="Avg. generation time"
          value={a.avgSeconds !== null ? `${a.avgSeconds}s` : "–"}
          hint="Upload to ready PDF"
          icon={Clock}
          tone="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Score over time</CardTitle>
            <CardDescription>Last 14 analyses</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ScoreTrendChart data={a.scoreTrend} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Score distribution</CardTitle>
            <CardDescription>
              How many analyses fall in each range
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <HistogramChart data={a.histogram} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top matched keywords</CardTitle>
            <CardDescription>
              Skills your resume evidences most often
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <KeywordBarChart data={a.topMatched} color="var(--chart-3)" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Most common gaps</CardTitle>
            <CardDescription>
              Keywords jobs ask for that your resume does not show
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <KeywordBarChart data={a.topGaps} color="var(--chart-2)" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Keyword coverage</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <DonutChart data={a.coverage} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Version status</CardTitle>
            <CardDescription className="flex items-center gap-1">
              <Layers className="size-3.5" /> {a.versionCount} total
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <DonutChart data={a.statusData} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Weekly generations</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ActivityChart data={a.weekly} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
