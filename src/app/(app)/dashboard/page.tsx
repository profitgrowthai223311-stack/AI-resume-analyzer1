import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", claims?.claims.sub ?? "")
    .maybeSingle();

  const name =
    profile?.full_name ||
    (claims?.claims.email as string | undefined) ||
    "there";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Welcome, {name}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
            <CardDescription>
              Free plan: 2 tailored resumes per month
            </CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground text-sm">
            Usage tracking arrives in Phase 7.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent versions</CardTitle>
            <CardDescription>Nothing here yet</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Create tailored resume</Button>
            <p className="text-muted-foreground mt-2 text-xs">
              Enabled once uploads ship in Phase 2.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
