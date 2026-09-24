"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { UpgradeModal } from "@/components/billing/upgrade-modal";
import {
  AtsScoreCard,
  KeywordMatchTable,
  type Gap,
  type Hit,
} from "@/components/resume/ats-results";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

type Version = {
  id: string;
  label: string | null;
  version_number: number;
  status: string;
  error_message: string | null;
  latex_content: string | null;
  validation_result: { warnings?: { rule: string; detail: string }[] } | null;
  analysis_id: string | null;
  resume_id: string;
};
const STEPS = ["queued", "generating", "validating", "compiling", "ready"];
const STEP_LABEL: Record<string, string> = {
  queued: "Queued",
  generating: "Writing tailored content",
  validating: "Checking facts and LaTeX",
  compiling: "Compiling PDF",
  ready: "Ready",
};

export function VersionView({
  initial,
  plan,
}: {
  initial: Version;
  plan: "free" | "pro";
}) {
  const [v, setV] = useState(initial);
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [analysis, setAnalysis] = useState<{
    score: number;
    matched: Hit[];
    gaps: Gap[];
  }>();
  const [upgrade, setUpgrade] = useState(false);
  const [slow, setSlow] = useState(false);
  const inFlight = STEPS.slice(0, 4).includes(v.status);

  // Poll until the version is ready or failed.
  useEffect(() => {
    if (!inFlight) return;
    const supabase = createClient();
    const t = setInterval(async () => {
      const { data } = await supabase
        .from("resume_versions")
        .select(
          "id, label, version_number, status, error_message, latex_content, validation_result, analysis_id, resume_id",
        )
        .eq("id", v.id)
        .single();
      if (data) setV(data);
    }, 2000);
    const slowTimer = setTimeout(() => setSlow(true), 60_000);
    return () => {
      clearInterval(t);
      clearTimeout(slowTimer);
    };
  }, [inFlight, v.id]);

  const sign = useCallback(
    async (type: "pdf" | "latex", download: boolean) => {
      const res = await fetch(
        `/api/download?versionId=${v.id}&type=${type}&download=${download ? 1 : 0}`,
      );
      if (!res.ok) return { status: res.status };
      return { status: 200, url: (await res.json()).url as string };
    },
    [v.id],
  );

  useEffect(() => {
    if (v.status !== "ready") return;
    let cancelled = false;
    sign("pdf", false).then((r) => {
      if (!cancelled) setPdfUrl(r.url);
    });
    return () => {
      cancelled = true;
    };
  }, [v.status, sign]);

  useEffect(() => {
    if (!v.analysis_id) return;
    createClient()
      .from("ats_analyses")
      .select("score, matched_keywords, missing_keywords")
      .eq("id", v.analysis_id)
      .single()
      .then(
        ({ data }) =>
          data &&
          setAnalysis({
            score: data.score,
            matched: data.matched_keywords ?? [],
            gaps: data.missing_keywords ?? [],
          }),
      );
  }, [v.analysis_id]);

  async function download(type: "pdf" | "latex") {
    const r = await sign(type, true);
    if (r.status === 403) setUpgrade(true);
    else if (r.url) window.location.href = r.url;
  }

  const step = STEPS.indexOf(v.status);
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">
          {v.label || "Tailored resume"}{" "}
          <span className="text-muted-foreground text-base">
            v{v.version_number}
          </span>
        </h1>
        <Badge variant={v.status === "failed" ? "destructive" : "secondary"}>
          {v.status}
        </Badge>
      </div>

      {inFlight && (
        <Card>
          <CardContent className="space-y-2 pt-6" aria-live="polite">
            {STEPS.map((s, i) => (
              <p
                key={s}
                className={i <= step ? "font-medium" : "text-muted-foreground"}
              >
                {i < step ? "✓" : i === step ? "…" : "○"} {STEP_LABEL[s]}
              </p>
            ))}
            {slow && (
              <p className="text-sm text-amber-700">
                Generation is taking longer than expected. It will keep running;
                you can leave and come back.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {v.status === "failed" && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p role="alert" className="text-destructive text-sm">
              {v.error_message ?? "Generation failed."}
            </p>
            <Link
              href={`/resumes/${v.resume_id}/tailor`}
              className={buttonVariants()}
            >
              Try again
            </Link>
            <p className="text-muted-foreground text-xs">
              Failed attempts don&apos;t count against your free limit.
            </p>
          </CardContent>
        </Card>
      )}

      {v.status === "ready" && (
        <>
          {!!v.validation_result?.warnings?.length && (
            <Card>
              <CardHeader>
                <CardTitle>Validation notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="text-muted-foreground">
                  Some generated content couldn&apos;t be verified against your
                  original resume and was removed.
                </p>
                <ul className="list-disc pl-5">
                  {v.validation_result.warnings.map((w, i) => (
                    <li key={i}>
                      {w.rule.replace(/_/g, " ")}: {w.detail}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <div className="flex gap-3">
            <Button onClick={() => download("pdf")}>Download PDF</Button>
            <Button variant="outline" onClick={() => download("latex")}>
              Download LaTeX {plan === "free" && "(Pro)"}
            </Button>
          </div>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="Resume PDF preview"
              className="h-[80vh] w-full rounded-md border"
            />
          ) : (
            <p className="text-muted-foreground text-sm">Loading preview…</p>
          )}
          {plan === "pro" && v.latex_content && (
            <Card>
              <CardHeader>
                <CardTitle>LaTeX source</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto text-xs">
                  {v.latex_content}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {analysis && (
        <>
          <AtsScoreCard score={analysis.score} />
          <KeywordMatchTable
            matched={analysis.matched}
            gaps={analysis.gaps}
            limitGaps={plan === "free" ? 5 : undefined}
          />
        </>
      )}
      <UpgradeModal
        open={upgrade}
        onOpenChange={setUpgrade}
        reason="LaTeX download is available on the Pro plan."
      />
    </div>
  );
}
