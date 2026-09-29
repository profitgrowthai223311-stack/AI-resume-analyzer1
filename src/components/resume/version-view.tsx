"use client";

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Download,
  FileCode2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { UpgradeModal } from "@/components/billing/upgrade-modal";
import { PageHeader } from "@/components/page-header";
import {
  AnalysisReport,
  AtsScoreCard,
  KeywordMatchTable,
  type Gap,
  type Hit,
  type Report,
} from "@/components/resume/ats-results";
import { StatusBadge } from "@/components/status-badge";
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
  job_description_id: string | null;
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
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pdfUrl, setPdfUrl] = useState<string>();
  const [analysis, setAnalysis] = useState<{
    score: number;
    matched: Hit[];
    gaps: Gap[];
    report?: Report;
  }>();
  const [upgradeReason, setUpgradeReason] = useState<string>();
  const [slow, setSlow] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string>();
  const inFlight = STEPS.slice(0, 4).includes(v.status);

  // Poll until the version is ready or failed.
  useEffect(() => {
    if (!inFlight) return;
    const supabase = createClient();
    const t = setInterval(async () => {
      const { data } = await supabase
        .from("resume_versions")
        .select(
          "id, label, version_number, status, error_message, latex_content, validation_result, analysis_id, resume_id, job_description_id",
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
      .select("score, matched_keywords, missing_keywords, model_metadata")
      .eq("id", v.analysis_id)
      .single()
      .then(({ data }) => {
        if (data)
          setAnalysis({
            score: data.score,
            matched: data.matched_keywords ?? [],
            gaps: data.missing_keywords ?? [],
            report: data.model_metadata?.report,
          });
      });
  }, [v.analysis_id]);

  async function download(type: "pdf" | "latex") {
    const r = await sign(type, true);
    if (r.status === 403)
      setUpgradeReason("LaTeX download is available on the Pro plan.");
    else if (r.url) window.location.href = r.url;
  }

  // Retries with the SAME resume + job description this version used, so the user doesn't have to
  // re-paste the job description or redo the ATS analysis. Re-uses the existing analysis row for
  // that resume/JD pair (generate-resume looks it up by id) rather than re-running it.
  async function retry() {
    if (!v.job_description_id) return;
    setRetrying(true);
    setRetryError(undefined);
    try {
      const res = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: v.resume_id,
          jobDescriptionId: v.job_description_id,
          label: v.label ?? undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 402)
        return setUpgradeReason(
          "You've used all of your free generations this month.",
        );
      if (res.status === 429)
        return setRetryError(
          "A generation is already in progress. Please wait for it to finish.",
        );
      if (!res.ok)
        return setRetryError(
          "Could not start a new attempt. Please try again.",
        );
      router.push(`/versions/${body.versionId}`);
    } finally {
      setRetrying(false);
    }
  }

  const step = STEPS.indexOf(v.status);
  return (
    <>
      <PageHeader
        title={`${v.label || "Tailored resume"} · v${v.version_number}`}
        description="Generated only from facts in your original resume."
        actions={<StatusBadge status={v.status} />}
      />

      {inFlight && (
        <Card>
          <CardContent className="space-y-3" aria-live="polite">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={
                  "flex items-center gap-3 " +
                  (i > step ? "text-muted-foreground" : "font-medium")
                }
              >
                {i < step ? (
                  <CheckCircle2 className="text-success size-5" />
                ) : i === step ? (
                  <Loader2 className="text-primary size-5 animate-spin" />
                ) : (
                  <Circle className="size-5" />
                )}
                {STEP_LABEL[s]}
              </div>
            ))}
            {slow && (
              <p className="text-warning text-sm">
                Generation is taking longer than expected. It will keep running;
                you can leave and come back.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {v.status === "failed" && (
        <Card className="border-destructive/40">
          <CardContent className="space-y-3">
            <p
              role="alert"
              className="text-destructive flex items-center gap-2 font-medium"
            >
              <AlertCircle className="size-5" />{" "}
              {v.error_message ?? "Generation failed."}
            </p>
            {retryError && (
              <p role="alert" className="text-destructive text-sm">
                {retryError}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              {v.job_description_id ? (
                <Button onClick={retry} disabled={retrying} size="lg">
                  <RefreshCw
                    className={"size-4" + (retrying ? " animate-spin" : "")}
                  />
                  {retrying ? "Starting new attempt…" : "Try again"}
                </Button>
              ) : (
                <Link
                  href={`/resumes/${v.resume_id}/tailor`}
                  className={buttonVariants()}
                >
                  <RefreshCw className="size-4" /> Tailor to a job again
                </Link>
              )}
              <Link
                href={`/resumes/${v.resume_id}/tailor`}
                className={
                  buttonVariants({ variant: "outline" }) +
                  " " +
                  (retrying ? "pointer-events-none opacity-50" : "")
                }
              >
                Change the job description
              </Link>
            </div>
            <p className="text-muted-foreground text-xs">
              {v.job_description_id
                ? "“Try again” reuses the same resume and job description — you don't need to re-paste anything. "
                : ""}
              Failed attempts don&apos;t count against your free limit.
            </p>
          </CardContent>
        </Card>
      )}

      {v.status === "ready" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                title="Resume PDF preview"
                className="bg-card h-[80vh] w-full rounded-2xl border shadow-sm"
              />
            ) : (
              <div
                className="bg-muted h-[80vh] animate-pulse rounded-2xl"
                aria-label="Loading preview"
              />
            )}
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Download</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => download("pdf")}
                >
                  <Download className="size-4" /> Download PDF
                </Button>
                <Button
                  variant="accent"
                  className="w-full"
                  size="lg"
                  onClick={() => download("latex")}
                >
                  <FileCode2 className="size-4" /> Download LaTeX{" "}
                  {plan === "free" && "(Pro)"}
                </Button>
              </CardContent>
            </Card>
            {!!v.validation_result?.warnings?.length && (
              <Card className="border-warning/40">
                <CardHeader>
                  <CardTitle>Validation notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    Some generated content couldn&apos;t be verified against
                    your original resume and was removed.
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
            {plan === "pro" && v.latex_content && (
              <Card>
                <CardHeader>
                  <CardTitle>LaTeX source</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted max-h-72 overflow-auto rounded-xl p-3 text-xs">
                    {v.latex_content}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {analysis && (
        <>
          <AtsScoreCard score={analysis.score} report={analysis.report} />
          <AnalysisReport report={analysis.report} />
          <KeywordMatchTable
            matched={analysis.matched}
            gaps={analysis.gaps}
            limitGaps={plan === "free" ? 5 : undefined}
          />
        </>
      )}
      <UpgradeModal
        open={!!upgradeReason}
        onOpenChange={(o) => !o && setUpgradeReason(undefined)}
        reason={upgradeReason ?? ""}
      />
    </>
  );
}
