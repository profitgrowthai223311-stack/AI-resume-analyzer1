import { Badge } from "@/components/ui/badge";

const MAP: Record<
  string,
  {
    variant: "success" | "warning" | "info" | "destructive" | "secondary";
    label: string;
  }
> = {
  ready: { variant: "success", label: "Ready" },
  complete: { variant: "success", label: "Complete" },
  failed: { variant: "destructive", label: "Failed" },
  queued: { variant: "secondary", label: "Queued" },
  uploaded: { variant: "secondary", label: "Uploaded" },
  generating: { variant: "info", label: "Generating" },
  validating: { variant: "info", label: "Validating" },
  compiling: { variant: "info", label: "Compiling" },
  processing: { variant: "info", label: "Processing" },
};

export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { variant: "secondary" as const, label: status };
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
