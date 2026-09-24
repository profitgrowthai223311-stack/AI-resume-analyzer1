import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONES = {
  indigo: "from-[oklch(0.55_0.24_277)] to-[oklch(0.62_0.22_300)]",
  pink: "from-[oklch(0.65_0.24_350)] to-[oklch(0.72_0.2_20)]",
  emerald: "from-[oklch(0.62_0.17_155)] to-[oklch(0.72_0.15_185)]",
  amber: "from-[oklch(0.75_0.17_70)] to-[oklch(0.7_0.19_40)]",
  sky: "from-[oklch(0.62_0.16_235)] to-[oklch(0.7_0.14_260)]",
} as const;
export type Tone = keyof typeof TONES;

export function IconBadge({
  icon: Icon,
  tone = "indigo",
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
        TONES[tone],
        className,
      )}
    >
      <Icon className="size-5" />
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm font-medium">{label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
          {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
        </div>
        <IconBadge icon={icon} tone={tone} />
      </div>
    </Card>
  );
}
