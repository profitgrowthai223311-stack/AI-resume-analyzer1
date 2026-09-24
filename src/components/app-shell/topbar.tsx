"use client";

import { LogOut, Menu, Plus, Settings, CreditCard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { logout } from "@/app/auth/actions";
import { PAGE_TITLES } from "./nav";
import { SidebarContent } from "./sidebar-content";

export function Topbar({
  name,
  email,
  plan,
  used,
  limit,
}: {
  name: string;
  email: string;
  plan: "free" | "pro";
  used: number;
  limit: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const title =
    PAGE_TITLES.find(
      ([p]) => pathname === p || pathname.startsWith(p + "/"),
    )?.[1] ?? "";
  const initials = (name || email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <header className="bg-background/80 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-8">
      <Sheet open={open} onOpenChange={setOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
        <SheetContent side="left" className="w-72 max-w-[80vw] border-0 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarContent
            plan={plan}
            used={used}
            limit={limit}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <Link
          href="/resumes/new"
          className={buttonVariants({ size: "lg" }) + " hidden sm:inline-flex"}
        >
          <Plus className="size-4" /> New resume
        </Link>
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            className="focus-visible:ring-ring flex items-center gap-2 rounded-full outline-none focus-visible:ring-2"
            aria-label="Account menu"
          >
            <Avatar>
              <AvatarFallback className="bg-brand-gradient font-semibold text-white">
                {initials || "U"}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-2 py-2">
              <p className="truncate text-sm font-semibold">
                {name || "Your account"}
              </p>
              <p className="text-muted-foreground truncate text-xs">{email}</p>
              <Badge
                variant={plan === "pro" ? "success" : "secondary"}
                className="mt-2"
              >
                {plan === "pro" ? "Pro plan" : "Free plan"}
              </Badge>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/settings" />}>
              <Settings className="size-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/billing" />}>
              <CreditCard className="size-4" /> Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <form action={logout}>
              <button
                type="submit"
                className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                <LogOut className="size-4" /> Log out
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
