"use client";

import { Crown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { isActive, NAV } from "./nav";

export function SidebarContent({
  plan,
  used,
  limit,
  onNavigate,
}: {
  plan: "free" | "pro";
  used: number;
  limit: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="bg-sidebar text-sidebar-foreground flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo href="/dashboard" light />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="text-sidebar-foreground/50 mb-2 px-3 text-[11px] font-semibold tracking-wider uppercase">
              {group.section}
            </p>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                        active
                          ? "bg-brand-gradient shadow-glow text-white"
                          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white",
                      )}
                    >
                      <item.icon className="size-[18px]" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="p-3">
        {plan === "free" ? (
          <div className="bg-sidebar-accent/70 border-sidebar-border space-y-3 rounded-2xl border p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Crown className="text-warning size-4" /> Go Pro
            </div>
            <p className="text-sidebar-foreground/70 text-xs">
              {used}/{limit} free resumes used this month.
            </p>
            <Progress value={Math.min(100, (used / limit) * 100)} />
            <Link
              href="/pricing"
              onClick={onNavigate}
              className="bg-brand-gradient block rounded-lg py-2 text-center text-xs font-semibold text-white hover:brightness-110"
            >
              Upgrade for unlimited
            </Link>
          </div>
        ) : (
          <div className="bg-sidebar-accent/70 border-sidebar-border rounded-2xl border p-4 text-sm">
            <div className="flex items-center gap-2 font-semibold text-white">
              <Crown className="text-warning size-4" /> Pro plan
            </div>
            <p className="text-sidebar-foreground/70 mt-1 text-xs">
              Unlimited tailored resumes. {used} this month.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
