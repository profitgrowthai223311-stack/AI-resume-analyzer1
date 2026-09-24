import { AlertTriangle, CheckCircle2, Lightbulb, XCircle } from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type Hit = { keyword: string; kind: string; evidence: string };
export type Gap = {
  keyword: string;
  kind: string;
  status: "related" | "unsupported";
  evidence?: string;
  note?: string;
};

export type Report = {
  match_level?: string;
  summary?: string;
  experience_summary?: string;
  strengths?: string[];
  gaps?: string[];
};

export function AtsScoreCard({
  score,
  report,
}: {
  score: number;
  report?: Report;
}) {
  const verdict = report?.match_level
    ? `${report.match_level} match`
    : score >= 70
      ? "Strong alignment"
      : score >= 40
        ? "Partial alignment"
        : "Low alignment";
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-6">
        <ScoreRing score={score} />
        <div className="min-w-56 flex-1 space-y-1">
          <CardTitle className="text-xl">
            ATS keyword alignment: {score}/100{" "}
            <span className="text-muted-foreground text-sm font-normal">
              · {verdict}
            </span>
          </CardTitle>
          <CardDescription>
            An advisory estimate of how many of the job&apos;s keywords your
            resume evidences. It is not a hiring guarantee.
          </CardDescription>
          {report?.summary && <p className="pt-1 text-sm">{report.summary}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export function KeywordMatchTable({
  matched,
  gaps,
  limitGaps,
}: {
  matched: Hit[];
  gaps: Gap[];
  limitGaps?: number;
}) {
  const shown = limitGaps ? gaps.slice(0, limitGaps) : gaps;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-success/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="text-success size-5" /> Matched{" "}
            <Badge variant="success">{matched.length}</Badge>
          </CardTitle>
          <CardDescription>
            Evidenced in your resume, so safe to emphasise.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {matched.length === 0 && (
            <p className="text-muted-foreground">No direct matches yet.</p>
          )}
          {matched.map((m) => (
            <div key={m.keyword}>
              <Badge variant="success">{m.keyword}</Badge>
              <p className="text-muted-foreground mt-1 text-xs">
                “{m.evidence}”
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="border-warning/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-warning size-5" /> Gaps{" "}
            <Badge variant="warning">{gaps.length}</Badge>
          </CardTitle>
          <CardDescription>We never add these as experience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {shown.map((g) => (
            <div key={g.keyword}>
              <div className="flex items-center gap-2">
                <Badge
                  variant={g.status === "related" ? "warning" : "destructive"}
                >
                  {g.keyword}
                </Badge>
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  {g.status === "unsupported" && <XCircle className="size-3" />}
                  {g.status === "related"
                    ? "related but unproven"
                    : "not in your resume"}
                </span>
              </div>
              {g.evidence && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Related to: “{g.evidence}”
                </p>
              )}
            </div>
          ))}
          {limitGaps && gaps.length > limitGaps && (
            <p className="bg-accent text-accent-foreground rounded-lg px-3 py-2 text-xs">
              +{gaps.length - limitGaps} more gaps. Upgrade to Pro for the full
              gap analysis.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function Recommendations({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <Card className="border-info/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="text-info size-5" /> Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {items.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function AnalysisReport({ report }: { report?: Report }) {
  if (
    !report ||
    (!report.strengths?.length &&
      !report.gaps?.length &&
      !report.experience_summary)
  )
    return null;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {!!report.strengths?.length && (
        <Card className="border-success/30">
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {report.strengths.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {!!report.gaps?.length && (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle>Areas to improve</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {report.gaps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {report.experience_summary && (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Experience match</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {report.experience_summary}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
