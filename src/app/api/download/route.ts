import { z } from "zod";
import { getAuthed, json, logEvent, unauthorized } from "@/lib/server/api-auth";
import { getPlan } from "@/lib/server/plan";

// Returns a short-lived signed URL. LaTeX access is a Pro feature, enforced here on the server.
export async function GET(request: Request) {
  const auth = await getAuthed(request);
  if (!auth) return unauthorized();
  const url = new URL(request.url);
  const q = z
    .object({
      versionId: z.string().uuid(),
      type: z.enum(["pdf", "latex"]),
      download: z.enum(["1", "0"]).default("0"),
    })
    .safeParse(Object.fromEntries(url.searchParams));
  if (!q.success) return json({ error: "invalid_input" }, 400);

  const { supabase, user } = auth;
  const { data: v } = await supabase
    .from("resume_versions")
    .select(
      "status, label, version_number, pdf_storage_path, latex_storage_path",
    )
    .eq("id", q.data.versionId)
    .maybeSingle();
  if (!v) return json({ error: "not_found" }, 404);
  if (v.status !== "ready") return json({ error: "not_ready" }, 409);

  if (q.data.type === "latex" && (await getPlan(supabase, user.id)) !== "pro")
    return json({ error: "upgrade_required" }, 403);

  const path =
    q.data.type === "pdf" ? v.pdf_storage_path : v.latex_storage_path;
  const bucket = q.data.type === "pdf" ? "generated-pdfs" : "generated-latex";
  const filename = `resume-v${v.version_number}.${q.data.type === "pdf" ? "pdf" : "tex"}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(
      path,
      60,
      q.data.download === "1" ? { download: filename } : undefined,
    );
  if (error || !data) return json({ error: "sign_failed" }, 500);
  if (q.data.download === "1")
    logEvent("download", { versionId: q.data.versionId, type: q.data.type });
  return json({ url: data.signedUrl });
}
