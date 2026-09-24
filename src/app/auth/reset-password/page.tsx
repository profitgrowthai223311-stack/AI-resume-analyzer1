import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthForm } from "@/components/auth/auth-form";
import { requestPasswordReset } from "../actions";

export const metadata = { title: "Reset password" };

export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a reset link."
    >
      <AuthForm
        action={requestPasswordReset}
        submitLabel="Send reset link"
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            autoComplete: "email",
          },
        ]}
      />
      <Link href="/auth/login" className="text-sm underline">
        Back to log in
      </Link>
    </AuthCard>
  );
}
