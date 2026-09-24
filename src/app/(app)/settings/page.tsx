import { PageHeader } from "@/components/page-header";
import { DangerZone, ProfileForm } from "@/components/settings-forms";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <>
      <PageHeader
        title="Settings"
        description="Your profile, appearance and data."
      />
      <Tabs defaultValue="profile" className="max-w-2xl">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="data">Delete data</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>{c!.claims.email as string}</CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm userId={uid} fullName={profile?.full_name ?? ""} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appearance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Switch between light and dark mode.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ThemeToggle />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="data" className="mt-4">
          <Card className="border-destructive/40">
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
        </TabsContent>
      </Tabs>
    </>
  );
}
