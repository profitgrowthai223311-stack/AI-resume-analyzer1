import {
  BarChart3,
  CreditCard,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  Upload,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string[];
};
export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
  {
    section: "Workspace",
    items: [
      {
        href: "/resumes",
        label: "My resumes",
        icon: FileText,
        match: ["/resumes"],
      },
      { href: "/resumes/new", label: "Upload resume", icon: Upload },
      {
        href: "/history",
        label: "Version history",
        icon: History,
        match: ["/history", "/versions"],
      },
    ],
  },
  {
    section: "Account",
    items: [
      { href: "/billing", label: "Billing & plan", icon: CreditCard },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export const PAGE_TITLES: [string, string][] = [
  ["/resumes/new", "Upload resume"],
  ["/resumes", "My resumes"],
  ["/dashboard", "Dashboard"],
  ["/analytics", "Analytics"],
  ["/history", "Version history"],
  ["/versions", "Resume version"],
  ["/billing", "Billing & plan"],
  ["/settings", "Settings"],
];

export function isActive(pathname: string, item: NavItem) {
  if (item.href === "/resumes")
    return pathname === "/resumes" || /^\/resumes\/(?!new)/.test(pathname);
  if (item.match)
    return item.match.some(
      (m) => pathname === m || pathname.startsWith(m + "/"),
    );
  return pathname === item.href;
}
