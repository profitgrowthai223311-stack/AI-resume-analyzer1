"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UploadCloud } from "lucide-react";
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

  const [fileName, setFileName] = useState<string>();
  const [drag, setDrag] = useState(false);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label
        htmlFor="file"
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          const input = document.getElementById("file") as HTMLInputElement;
          if (f && input) {
            const dt = new DataTransfer();
            dt.items.add(f);
            input.files = dt.files;
            setFileName(f.name);
          }
        }}
        className={
          "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors " +
          (drag
            ? "border-primary bg-accent"
            : "border-border hover:border-primary/60 hover:bg-muted/50")
        }
      >
        <span className="bg-brand-gradient shadow-glow flex size-14 items-center justify-center rounded-2xl text-white">
          <UploadCloud className="size-7" />
        </span>
        <span className="font-semibold">
          {fileName ?? "Drop your resume here, or click to browse"}
        </span>
        <span className="text-muted-foreground text-sm">
          PDF or DOCX, up to {MAX_UPLOAD_MB} MB
        </span>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.docx"
          required
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name)}
        />
      </label>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy} size="lg" className="w-full">
        {busy ? "Uploading and reading…" : "Upload resume"}
      </Button>
    </form>
  );
}
