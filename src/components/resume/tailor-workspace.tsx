"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpgradeModal } from "@/components/billing/upgrade-modal";
import {
  AtsScoreCard,
  KeywordMatchTable,
  Recommendations,
  type Gap,
  type Hit,
} from "@/components/resume/ats-results";
import { Sparkles, Wand2 } from "lucide-react";
import { Stepper } from "@/components/stepper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

type Analysis = {
  id: string;
  score: number;
  matched: Hit[];
  gaps: Gap[];
  recommendations: string[];
};

export function TailorWorkspace({
  resumeId,
  plan,
}: {
  resumeId: string;
  plan: "free" | "pro";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"analyze" | "generate" | null>(null);
  const [error, setError] = useState<string>();
  const [jdId, setJdId] = useState<string>();
  const [analysis, setAnalysis] = useState<Analysis>();
  const [upgrade, setUpgrade] = useState<string>();

  async function analyze(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const f = new FormData(e.currentTarget);
    const raw = String(f.get("text") ?? "").trim();
    if (raw.length < 50)
      return setError(
        "Paste the full job description (at least a few sentences).",
      );
    setBusy("analyze");
    try {
      const supabase = createClient();
      const { data: u } = await supabase.auth.getUser();
      if (!u.user)
        return setError("Your session expired. Please log in again.");
      const { data: jd, error: insErr } = await supabase
        .from("job_descriptions")
        .insert({
          user_id: u.user.id,
          title: String(f.get("title") ?? "") || null,
          company_name: String(f.get("company") ?? "") || null,
          location: String(f.get("location") ?? "") || null,
          raw_text: raw,
        })
        .select("id")
        .single();
      if (insErr || !jd) return setError("Could not save the job description.");
      setJdId(jd.id);

      const res = await fetch("/api/analyze-ats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, jobDescriptionId: jd.id }),
      });
      if (!res.ok) return setError("Analysis failed. Please try again.");
      const { analysisId } = await res.json();
      const { data: a } = await supabase
        .from("ats_analyses")
        .select(
          "id, score, matched_keywords, missing_keywords, recommendations",
        )
        .eq("id", analysisId)
        .single();
      if (a)
        setAnalysis({
          id: a.id,
          score: a.score,
          matched: a.matched_keywords ?? [],
          gaps: a.missing_keywords ?? [],
          recommendations: a.recommendations ?? [],
        });
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setError(undefined);
    setBusy("generate");
    try {
      const res = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId,
          jobDescriptionId: jdId,
          label:
            (document.getElementById("label") as HTMLInputElement)?.value ||
            undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 402)
        return setUpgrade(
          "You've used all of your free generations this month.",
        );
      if (res.status === 429)
        return setError(
          "A generation is already in progress. Please wait for it to finish.",
        );
      if (!res.ok)
        return setError("Could not start generation. Please try again.");
      router.push(`/versions/${body.versionId}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <Stepper
            steps={["Job description", "ATS analysis", "Generate"]}
            current={analysis ? 2 : busy === "analyze" ? 1 : 0}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Job description</CardTitle>
          <CardDescription>
            Paste the posting you are applying to.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={analyze} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="title">Job title</Label>
                <Input id="title" name="title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" name="company" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input id="location" name="location" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="text">Job description text</Label>
              <Textarea id="text" name="text" className="min-h-48" required />
            </div>
            <Button type="submit" disabled={busy !== null} size="lg">
              <Sparkles className="size-4" />
              {busy === "analyze"
                ? "Analyzing…"
                : analysis
                  ? "Re-run analysis with a new job description"
                  : "Analyze match"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      {analysis && (
        <>
          <AtsScoreCard score={analysis.score} />
          <KeywordMatchTable
            matched={analysis.matched}
            gaps={analysis.gaps}
            limitGaps={plan === "free" ? 5 : undefined}
          />
          <Recommendations items={analysis.recommendations} />
          <Card>
            <CardHeader>
              <CardTitle>Generate tailored resume</CardTitle>
              <CardDescription>
                Only facts from your resume are used. Missing keywords are never
                added as experience.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="label">Version label</Label>
                <Input id="label" placeholder="e.g. Frontend Engineer — Acme" />
              </div>
              <Button onClick={generate} disabled={busy !== null} size="lg">
                <Wand2 className="size-4" />
                {busy === "generate" ? "Starting…" : "Generate tailored resume"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
      <UpgradeModal
        open={!!upgrade}
        onOpenChange={(o) => !o && setUpgrade(undefined)}
        reason={upgrade ?? ""}
      />
    </div>
  );
}
