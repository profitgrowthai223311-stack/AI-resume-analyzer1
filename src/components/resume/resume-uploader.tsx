"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALLOWED_TYPES,
  MAX_UPLOAD_MB,
  validateResumeFile,
} from "@/lib/resume-upload";
import { createClient } from "@/lib/supabase/client";

export function ResumeUploader() {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    const file = new FormData(e.currentTarget).get("file");
    if (!(file instanceof File) || !file.name)
      return setError("Choose a file first.");

    setBusy(true);
    try {
      const check = await validateResumeFile(file);
      if (!check.ok) return setError(check.error);

      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user)
        return setError("Your session expired. Please log in again.");

      // Client-generated id so the storage path is known before the row exists.
      // The original filename is never used in the path.
      const id = crypto.randomUUID();
      const path = `${data.user.id}/${id}/original.${check.type}`;

      const { error: uploadError } = await supabase.storage
        .from("original-resumes")
        .upload(path, file, {
          contentType: ALLOWED_TYPES[check.type],
          upsert: false,
        });
      if (uploadError) return setError("Upload failed. Please try again.");

      const { error: insertError } = await supabase.from("resumes").insert({
        id,
        user_id: data.user.id,
        display_name: check.displayName,
        original_file_path: path,
        original_file_type: check.type,
        original_file_size: file.size,
        extraction_status: "uploaded",
      });
      if (insertError) {
        await supabase.storage.from("original-resumes").remove([path]);
        return setError("Could not save your resume. Please try again.");
      }
      // Extraction failure is not fatal: the review page offers a paste-text fallback.
      await fetch("/api/extract-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId: id }),
      }).catch(() => undefined);
      router.push(`/resumes/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">
          Resume (PDF or DOCX, up to {MAX_UPLOAD_MB} MB)
        </Label>
        <Input id="file" name="file" type="file" accept=".pdf,.docx" required />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? "Uploading and reading…" : "Upload resume"}
      </Button>
    </form>
  );
}
