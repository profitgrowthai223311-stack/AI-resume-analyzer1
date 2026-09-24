// Shared helpers for e2e scripts (real Supabase project + local Next server).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
export const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
export const BASE = process.env.BASE_URL ?? "http://localhost:3111";
export const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
let fails = 0;
export const check = (name, ok, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && extra ? "  → " + extra : ""}`);
  if (!ok) fails++;
  return ok;
};
export const failures = () => fails;
const created = [];
export async function tempUser(tag) {
  const email = `e2e-${tag}-${Date.now()}@example.com`,
    password = "Test-pass-12345";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${tag}` },
  });
  if (error) throw error;
  created.push(data.user.id);
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { data: s, error: e2 } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (e2) throw e2;
  return { id: data.user.id, client, token: s.session.access_token };
}
export async function api(user, path, body, method = "POST") {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${user.token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}
export async function cleanup() {
  for (const id of created) {
    for (const bucket of [
      "original-resumes",
      "generated-latex",
      "generated-pdfs",
    ]) {
      const walk = async (prefix) => {
        const { data } = await admin.storage.from(bucket).list(prefix);
        for (const f of data ?? []) {
          if (f.id)
            await admin.storage.from(bucket).remove([`${prefix}/${f.name}`]);
          else await walk(`${prefix}/${f.name}`);
        }
      };
      await walk(id);
    }
    await admin.auth.admin.deleteUser(id);
  }
}
export async function uploadResume(user, file, type) {
  const fs = await import("node:fs");
  const id = crypto.randomUUID(),
    path = `${user.id}/${id}/original.${type}`;
  const buf = fs.readFileSync(`scripts/fixtures/${file}`);
  const mime =
    type === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const up = await user.client.storage
    .from("original-resumes")
    .upload(path, buf, { contentType: mime });
  if (up.error) throw up.error;
  const ins = await user.client.from("resumes").insert({
    id,
    user_id: user.id,
    display_name: file,
    original_file_path: path,
    original_file_type: type,
    original_file_size: buf.length,
  });
  if (ins.error) throw ins.error;
  return id;
}
