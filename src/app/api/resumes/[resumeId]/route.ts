import { z } from "zod";
import { getAuthed, json, logEvent, unauthorized } from "@/lib/server/api-auth";
import { adminClient } from "@/lib/server/supabase-admin";

// Deletes one resume: its original file, every generated file, and (by cascade) analyses and versions.
export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/resumes/[resumeId]">,
) {
  const auth = await getAuthed(request);
  if (!auth) return unauthorized();
  const { resumeId } = await ctx.params;
  if (!z.string().uuid().safeParse(resumeId).success)
    return json({ error: "invalid_input" }, 400);

  const { data: resume } = await auth.supabase
    .from("resumes")
    .select("id")
    .eq("id", resumeId)
    .maybeSingle();
  if (!resume) return json({ error: "not_found" }, 404);

  const admin = adminClient();
  for (const bucket of [
    "original-resumes",
    "generated-latex",
    "generated-pdfs",
  ]) {
    const root = `${auth.user.id}/${resumeId}`;
    const { data } = await admin.storage
      .from(bucket)
      .list(root, { limit: 1000 });
    const paths: string[] = [];
    for (const item of data ?? []) {
      if (item.id) paths.push(`${root}/${item.name}`);
      else {
        const { data: inner } = await admin.storage
          .from(bucket)
          .list(`${root}/${item.name}`, { limit: 1000 });
        for (const f of inner ?? [])
          paths.push(`${root}/${item.name}/${f.name}`);
      }
    }
    if (paths.length) await admin.storage.from(bucket).remove(paths);
  }
  await admin.from("resumes").delete().eq("id", resumeId);
  logEvent("resume_deleted", { resumeId });
  return json({ ok: true });
}
