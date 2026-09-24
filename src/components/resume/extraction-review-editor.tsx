"use client";

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
}: {
  resumeId: string;
  initialText: string;
  status: string;
  error?: string | null;
  warnings: string[];
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
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
      <Label htmlFor="text">
        {failed
          ? "Paste your resume text"
          : "Review and correct the extracted text — this is what we'll use"}
      </Label>
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
