"use client";

import { FileText, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/status-badge";
import { IconBadge } from "@/components/stat-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type ResumeRow = {
  id: string;
  display_name: string;
  original_file_type: string | null;
  original_file_size: number | null;
  extraction_status: string;
  created_at: string;
  versions: number;
};

export function ResumeCard({ r }: { r: ResumeRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (
      !window.confirm(
        `Delete "${r.display_name}" and all its versions? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/resumes/${r.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) return toast.error("Could not delete this resume.");
    toast.success("Resume deleted.");
    router.refresh();
  }

  return (
    <Card className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <IconBadge
            icon={FileText}
            tone={r.original_file_type === "pdf" ? "pink" : "sky"}
          />
          <div className="min-w-0 flex-1">
            <Link
              href={`/resumes/${r.id}`}
              className="block truncate font-semibold hover:underline"
            >
              {r.display_name}
            </Link>
            <p className="text-muted-foreground text-xs">
              {r.original_file_type?.toUpperCase()} ·{" "}
              {((r.original_file_size ?? 0) / 1024).toFixed(0)} KB ·{" "}
              {new Date(r.created_at).toLocaleDateString()}
            </p>
          </div>
          <StatusBadge status={r.extraction_status} />
        </div>
        <p className="text-muted-foreground text-sm">
          {r.versions} tailored {r.versions === 1 ? "version" : "versions"}
        </p>
        <div className="flex gap-2">
          <Link
            href={`/resumes/${r.id}/tailor`}
            className={buttonVariants({ size: "sm" }) + " flex-1"}
          >
            <Sparkles className="size-3.5" /> Tailor
          </Link>
          <Link
            href={`/resumes/${r.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Open
          </Link>
          <Button
            variant="destructive"
            size="icon-sm"
            onClick={remove}
            disabled={busy}
            aria-label={`Delete ${r.display_name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
