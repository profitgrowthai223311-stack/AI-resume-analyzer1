import type { LucideIcon } from "lucide-react";
import { IconBadge, type Tone } from "@/components/stat-card";

export function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "indigo",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
      <IconBadge icon={icon} tone={tone} className="size-14 rounded-2xl" />
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      {action}
    </div>
  );
}
