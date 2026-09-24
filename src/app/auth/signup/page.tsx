import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { signup } from "../actions";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthCard
      title="Create your account"
      description="Tailor your resume to any job."
    >
      <AuthForm
        action={signup}
        submitLabel="Sign up"
        fields={[
          {
            name: "fullName",
            label: "Full name",
            autoComplete: "name",
            required: false,
          },
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
          {
            name: "password",
            label: "Password (min 8 characters)",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
      />
      <p className="text-muted-foreground text-xs">
        By signing up you agree to our{" "}
        <Link href="/privacy" className="underline">
          privacy and AI data handling
        </Link>{" "}
        terms.
      </p>
      <p className="text-sm">
        Already have an account?{" "}
        <Link href="/auth/login" className="underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
