"use client";

import { UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UpgradeModal } from "@/components/billing/upgrade-modal";
import { UsageMeter } from "@/components/billing/usage-meter";
import { Button } from "@/components/ui/button";
import {
  ALLOWED_TYPES,
  MAX_UPLOAD_MB,
  validateResumeFile,
} from "@/lib/resume-upload";
import { createClient } from "@/lib/supabase/client";

// A user calling the Supabase client directly (bypassing this UI) still can't exceed the limit —
// a database trigger enforces it (see supabase/migrations/20260930000001_free_upload_limit.sql).
// This string must match the RAISE EXCEPTION message there.
const LIMIT_ERROR_MARKER = "FREE_UPLOAD_LIMIT_REACHED";

export function ResumeUploader({
  plan,
  used,
  limit,
}: {
  plan: "free" | "pro";
  used: number;
  limit: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string>();
  const [drag, setDrag] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<string>();

  const atLimit = plan === "free" && used >= limit;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    if (atLimit)
      return setUpgradeReason(
        `You've used all ${limit} of your free resume uploads.`,
      );

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
        if (insertError.message.includes(LIMIT_ERROR_MARKER)) {
          setUpgradeReason(
            `You've used all ${limit} of your free resume uploads.`,
          );
          return;
        }
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
    <div className="space-y-4">
      {plan === "free" && (
        <UsageMeter
          used={used}
          limit={limit}
          plan={plan}
          label="resume uploads"
          period="in total"
        />
      )}
      <form onSubmit={onSubmit} className="space-y-4">
        <label
          htmlFor="file"
          onDragOver={(e) => {
            e.preventDefault();
            if (!atLimit) setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (atLimit)
              return setUpgradeReason(
                `You've used all ${limit} of your free resume uploads.`,
              );
            const f = e.dataTransfer.files[0];
            const input = document.getElementById("file") as HTMLInputElement;
            if (f && input) {
              const dt = new DataTransfer();
              dt.items.add(f);
              input.files = dt.files;
              setFileName(f.name);
            }
          }}
          onClick={(e) => {
            // The input is disabled at the limit, so clicking the label would otherwise do
            // nothing; show the upgrade modal instead.
            if (atLimit) {
              e.preventDefault();
              setUpgradeReason(
                `You've used all ${limit} of your free resume uploads.`,
              );
            }
          }}
          aria-disabled={atLimit}
          className={
            "flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors " +
            (atLimit
              ? "border-border bg-muted/40 cursor-not-allowed opacity-60"
              : drag
                ? "border-primary bg-accent"
                : "border-border hover:border-primary/60 hover:bg-muted/50")
          }
        >
          <span className="bg-brand-gradient shadow-glow flex size-14 items-center justify-center rounded-2xl text-white">
            <UploadCloud className="size-7" />
          </span>
          <span className="font-semibold">
            {atLimit
              ? "Free upload limit reached"
              : (fileName ?? "Drop your resume here, or click to browse")}
          </span>
          <span className="text-muted-foreground text-sm">
            {atLimit
              ? "Upgrade to Pro for unlimited uploads"
              : `PDF or DOCX, up to ${MAX_UPLOAD_MB} MB`}
          </span>
          <input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.docx"
            required
            disabled={atLimit}
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name)}
          />
        </label>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {atLimit ? (
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() =>
              setUpgradeReason(
                `You've used all ${limit} of your free resume uploads.`,
              )
            }
          >
            Upgrade to upload more
          </Button>
        ) : (
          <Button type="submit" disabled={busy} size="lg" className="w-full">
            {busy ? "Uploading and reading…" : "Upload resume"}
          </Button>
        )}
      </form>
      <UpgradeModal
        open={!!upgradeReason}
        onOpenChange={(o) => !o && setUpgradeReason(undefined)}
        reason={upgradeReason ?? ""}
      />
    </div>
  );
}
