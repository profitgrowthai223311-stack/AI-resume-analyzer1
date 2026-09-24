"use client";

import { ExternalLink, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { History } from "lucide-react";

export type VersionRow = {
  id: string;
  label: string | null;
  version_number: number;
  status: string;
  created_at: string;
  score: number | null;
};

const FILTERS = ["all", "ready", "failed", "in progress"] as const;

export function HistoryTable({ rows }: { rows: VersionRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");

  const shown = useMemo(
    () =>
      rows.filter((r) => {
        const inProgress = !["ready", "failed"].includes(r.status);
        if (filter === "ready" && r.status !== "ready") return false;
        if (filter === "failed" && r.status !== "failed") return false;
        if (filter === "in progress" && !inProgress) return false;
        return (r.label ?? "Tailored resume")
          .toLowerCase()
          .includes(q.toLowerCase());
      }),
    [rows, q, filter],
  );

  if (!rows.length)
    return (
      <EmptyState
        icon={History}
        tone="amber"
        title="No tailored resumes yet"
        description="Your generated versions will appear here."
        action={
          <Link href="/resumes" className={buttonVariants()}>
            Go to my resumes
          </Link>
        }
      />
    );

  return (
    <Card className="gap-0 p-0">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            placeholder="Search by label…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
            aria-label="Search versions"
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={
                "rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors " +
                (filter === f
                  ? "bg-brand-gradient text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent")
              }
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Version</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>ATS score</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="pr-4 text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="pl-4 font-medium">
                {r.label ?? "Tailored resume"}{" "}
                <span className="text-muted-foreground">
                  v{r.version_number}
                </span>
              </TableCell>
              <TableCell>
                <StatusBadge status={r.status} />
              </TableCell>
              <TableCell>{r.score ?? "–"}</TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </TableCell>
              <TableCell className="pr-4 text-right">
                <Link
                  href={`/versions/${r.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  View <ExternalLink className="size-3" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
          {!shown.length && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-muted-foreground py-8 text-center"
              >
                No versions match your filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
