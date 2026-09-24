import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../auth/actions";

// Server-side guard in addition to the proxy redirect (defense in depth).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="font-semibold">
            AI Resume Analyzer
          </Link>
          <Link href="/resumes/new">New resume</Link>
          <Link href="/history">History</Link>
          <Link href="/billing">Billing</Link>
          <Link href="/settings">Settings</Link>
        </nav>
        <form action={logout}>
          <Button variant="outline" size="sm" type="submit">
            Log out
          </Button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 p-6">{children}</main>
    </div>
  );
}
