import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { createClient } from "@/lib/supabase/server";
import { updatePassword } from "../actions";

export const metadata = { title: "Set new password" };

export default async function UpdatePasswordPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/login");

  return (
    <AuthCard title="Set a new password">
      <AuthForm
        action={updatePassword}
        submitLabel="Update password"
        fields={[
          {
            name: "password",
            label: "New password",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
      />
    </AuthCard>
  );
}
