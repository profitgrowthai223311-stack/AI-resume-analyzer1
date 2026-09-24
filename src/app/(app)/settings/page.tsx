import { DangerZone, ProfileForm } from "@/components/settings-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: c } = await supabase.auth.getClaims();
  const uid = c!.claims.sub;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", uid)
    .maybeSingle();
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>{c!.claims.email as string}</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm userId={uid} fullName={profile?.full_name ?? ""} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Delete data</CardTitle>
          <CardDescription>
            Permanent. Files are removed from private storage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DangerZone />
        </CardContent>
      </Card>
    </div>
  );
}
