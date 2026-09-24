import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { login, sendMagicLink } from "../actions";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthCard title="Log in" description="Welcome back.">
      <AuthForm
        action={login}
        submitLabel="Log in"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
      />
      <div className="space-y-2 border-t pt-4">
        <p className="text-muted-foreground text-sm">
          Or get a one-time sign-in link:
        </p>
        <AuthForm
          action={sendMagicLink}
          submitLabel="Email me a magic link"
          fields={[
            {
              name: "email",
              label: "Email",
              type: "email",
              autoComplete: "email",
            },
          ]}
        />
      </div>
      <div className="flex justify-between text-sm">
        <Link href="/auth/reset-password" className="underline">
          Forgot password?
        </Link>
        <Link href="/auth/signup" className="underline">
          Create account
        </Link>
      </div>
    </AuthCard>
  );
}
