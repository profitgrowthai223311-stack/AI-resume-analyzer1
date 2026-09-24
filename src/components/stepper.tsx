import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2 last:flex-none">
          <span
            aria-current={i === current ? "step" : undefined}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors",
              i < current && "bg-success text-white",
              i === current && "bg-brand-gradient shadow-glow text-white",
              i > current && "bg-muted text-muted-foreground",
            )}
          >
            {i < current ? <Check className="size-4" /> : i + 1}
          </span>
          <span
            className={cn(
              "hidden font-medium sm:inline",
              i > current && "text-muted-foreground",
            )}
          >
            {s}
          </span>
          {i < steps.length - 1 && (
            <span
              className={cn(
                "h-0.5 flex-1 rounded",
                i < current ? "bg-success" : "bg-border",
              )}
            />
          )}
        </li>
      ))}
    </ol>
  );
}
