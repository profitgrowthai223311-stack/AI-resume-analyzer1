"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

const email = z.string().trim().email("Enter a valid email address");
const password = z.string().min(8, "Password must be at least 8 characters");
const siteUrl = () =>
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Invalid input";
}

export async function login(
  _: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = z
    .object({ email, password: z.string().min(1, "Enter your password") })
    .safeParse({
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Invalid email or password" };
  redirect("/dashboard");
}

export async function signup(
  _: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = z
    .object({
      fullName: z.string().trim().max(100).optional(),
      email,
      password,
    })
    .safeParse({
      fullName: formData.get("fullName") || undefined,
      email: formData.get("email"),
      password: formData.get("password"),
    });
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard`,
    },
  });
  if (error) return { error: error.message };
  if (data.session) redirect("/dashboard");
  return { message: "Check your email to confirm your account." };
}

export async function sendMagicLink(
  _: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/dashboard` },
  });
  if (error) return { error: error.message };
  return { message: "Magic link sent. Check your email." };
}

export async function requestPasswordReset(
  _: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = email.safeParse(formData.get("email"));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl()}/auth/callback?next=/auth/update-password`,
  });
  // Same response whether or not the account exists.
  return {
    message: "If that email has an account, a reset link is on its way.",
  };
}

export async function updatePassword(
  _: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = password.safeParse(formData.get("password"));
  if (!parsed.success) return { error: firstError(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: error.message };
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
