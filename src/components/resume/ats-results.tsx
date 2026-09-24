import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export type Hit = { keyword: string; kind: string; evidence: string };
export type Gap = {
  keyword: string;
  kind: string;
  status: "related" | "unsupported";
  evidence?: string;
  note?: string;
};

export function AtsScoreCard({ score }: { score: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ATS keyword alignment: {score}/100</CardTitle>
        <CardDescription>
          An advisory estimate of how many of the job&apos;s keywords your
          resume evidences. It is not a hiring guarantee.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Progress value={score} />
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
      <Card>
        <CardHeader>
          <CardTitle>Matched — evidenced in your resume</CardTitle>
          <CardDescription>Safe to emphasise.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {matched.length === 0 && (
            <p className="text-muted-foreground">No direct matches yet.</p>
          )}
          {matched.map((m) => (
            <div key={m.keyword}>
              <Badge>{m.keyword}</Badge>
              <p className="text-muted-foreground mt-1 text-xs">
                “{m.evidence}”
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Gaps</CardTitle>
          <CardDescription>We never add these as experience.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {shown.map((g) => (
            <div key={g.keyword}>
              <Badge variant={g.status === "related" ? "secondary" : "outline"}>
                {g.keyword}
              </Badge>{" "}
              <span className="text-muted-foreground text-xs">
                {g.status === "related"
                  ? "related but unproven"
                  : "not in your resume"}
              </span>
              {g.evidence && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Related to: “{g.evidence}”
                </p>
              )}
            </div>
          ))}
          {limitGaps && gaps.length > limitGaps && (
            <p className="text-muted-foreground text-xs">
              +{gaps.length - limitGaps} more gaps. Upgrade to Pro for the full
              gap analysis.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
