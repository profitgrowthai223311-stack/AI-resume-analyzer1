import { redirect } from "next/navigation";
import { SidebarContent } from "@/components/app-shell/sidebar-content";
import { Topbar } from "@/components/app-shell/topbar";
import {
  FREE_MONTHLY_GENERATIONS,
  getPlan,
  monthlyUsage,
} from "@/lib/server/plan";
import { createClient } from "@/lib/supabase/server";

// Server-side guard in addition to the proxy redirect (defense in depth).
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/login");
  const uid = data.claims.sub;

  const [plan, used, { data: profile }] = await Promise.all([
    getPlan(supabase, uid),
    monthlyUsage(supabase, uid),
    supabase.from("profiles").select("full_name").eq("id", uid).maybeSingle(),
  ]);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 md:block">
        <SidebarContent
          plan={plan}
          used={used}
          limit={FREE_MONTHLY_GENERATIONS}
        />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={profile?.full_name ?? ""}
          email={(data.claims.email as string) ?? ""}
          plan={plan}
          used={used}
          limit={FREE_MONTHLY_GENERATIONS}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
