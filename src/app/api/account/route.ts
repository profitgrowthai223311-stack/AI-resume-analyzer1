import { z } from "zod";
import { getAuthed, json, logEvent, unauthorized } from "@/lib/server/api-auth";
import { adminClient } from "@/lib/server/supabase-admin";

const BUCKETS = [
  "original-resumes",
  "generated-latex",
  "generated-pdfs",
] as const;

async function removeFolder(
  admin: ReturnType<typeof adminClient>,
  bucket: string,
  prefix: string,
) {
  const { data } = await admin.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });
  const files: string[] = [];
  for (const item of data ?? []) {
    if (item.id) files.push(`${prefix}/${item.name}`);
    else await removeFolder(admin, bucket, `${prefix}/${item.name}`);
  }
  if (files.length) await admin.storage.from(bucket).remove(files);
}

/** Deletes the caller's files and records. scope "account" also deletes the auth user. */
export async function DELETE(request: Request) {
  const auth = await getAuthed(request);
  if (!auth) return unauthorized();
  const body = z
    .object({ scope: z.enum(["data", "account"]) })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return json({ error: "invalid_input" }, 400);

  const admin = adminClient();
  const uid = auth.user.id;
  for (const bucket of BUCKETS) await removeFolder(admin, bucket, uid);

  if (body.data.scope === "account") {
    // Cascades to profiles and every user-owned table.
    const { error } = await admin.auth.admin.deleteUser(uid);
    if (error) return json({ error: "delete_failed" }, 500);
  } else {
    // Resumes cascade to analyses and versions; job descriptions and usage are removed explicitly.
    await admin.from("resumes").delete().eq("user_id", uid);
    await admin.from("job_descriptions").delete().eq("user_id", uid);
  }
  logEvent("data_deleted", { scope: body.data.scope });
  return json({ ok: true });
}
