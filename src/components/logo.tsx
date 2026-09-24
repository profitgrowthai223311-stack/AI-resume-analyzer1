import { Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({
  href = "/",
  className,
  light,
}: {
  href?: string;
  className?: string;
  light?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 font-bold tracking-tight",
        className,
      )}
    >
      <span className="bg-brand-gradient shadow-glow flex size-8 items-center justify-center rounded-xl text-white">
        <Sparkles className="size-4" />
      </span>
      <span className={cn("text-lg", light && "text-white")}>
        Resume
        <span className={light ? "text-white/80" : "text-brand-gradient"}>
          AI
        </span>
      </span>
    </Link>
  );
}
