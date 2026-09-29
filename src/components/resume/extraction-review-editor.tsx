"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

export function ExtractionReviewEditor({
  resumeId,
  initialText,
  status,
  error,
  warnings,
  hasOriginalFile,
}: {
  resumeId: string;
  initialText: string;
  status: string;
  error?: string | null;
  warnings: string[];
  hasOriginalFile: boolean;
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [reextracting, setReextracting] = useState(false);
  const failed = status === "failed";

  async function save() {
    setSaving(true);
    const { error: err } = await createClient()
      .from("resumes")
      .update({
        extracted_text: text,
        extraction_status: "complete",
        extraction_error: null,
      })
      .eq("id", resumeId);
    setSaving(false);
    if (err) toast.error("Could not save. Please try again.");
    else toast.success("Saved. This text will be used to tailor your resume.");
  }

  // Re-runs extraction on the original file. Useful after we improve extraction (e.g. recovering
  // links that only exist as PDF/DOCX hyperlinks, not in the visible text) for a resume uploaded
  // before that improvement — no re-upload needed. Overwrites unsaved edits in the box below.
  async function reextract() {
    if (
      text !== initialText &&
      !window.confirm(
        "This replaces the text below with a fresh extraction from your original file. Continue?",
      )
    )
      return;
    setReextracting(true);
    try {
      const res = await fetch("/api/extract-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.status !== "complete") {
        toast.error("Could not re-extract. Please try again.");
        return;
      }
      setText(body.extractedText ?? "");
      toast.success("Re-extracted from your original file.");
    } finally {
      setReextracting(false);
    }
  }

  return (
    <div className="space-y-3">
      {failed && (
        <p role="alert" className="text-destructive text-sm">
          {error ?? "Extraction failed."}
        </p>
      )}
      {warnings.map((w) => (
        <p key={w} className="text-sm text-amber-700 dark:text-amber-400">
          {w}
        </p>
      ))}
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="text">
          {failed
            ? "Paste your resume text"
            : "Review and correct the extracted text — this is what we'll use"}
        </Label>
        {hasOriginalFile && !failed && (
          <Button
            variant="outline"
            size="sm"
            onClick={reextract}
            disabled={reextracting}
          >
            <RefreshCw
              className={"size-3.5" + (reextracting ? " animate-spin" : "")}
            />
            {reextracting ? "Re-extracting…" : "Re-extract from file"}
          </Button>
        )}
      </div>
      <Textarea
        id="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="min-h-96 font-mono text-sm"
      />
      <Button
        onClick={save}
        disabled={saving || text.trim().length < 50}
        variant="success"
        size="lg"
      >
        {saving ? "Saving…" : "Save text"}
      </Button>
    </div>
  );
}
