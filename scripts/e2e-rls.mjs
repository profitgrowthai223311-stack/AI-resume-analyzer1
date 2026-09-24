// Two-user privacy test against the real Supabase project. Creates and deletes temp users.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const mk = () =>
  createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

let fails = 0;
const check = (name, ok) => {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok) fails++;
};
const stamp = Date.now();
const users = [];
async function newUser(tag) {
  const email = `e2e-${tag}-${stamp}@example.com`,
    password = "Test-pass-12345";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${tag}` },
  });
  if (error) throw error;
  users.push(data.user.id);
  const client = mk();
  const { error: e2 } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (e2) throw e2;
  return { id: data.user.id, client };
}

try {
  const a = await newUser("a"),
    b = await newUser("b");
  const { data: prof } = await a.client
    .from("profiles")
    .select("full_name")
    .eq("id", a.id);
  check("profile auto-created by trigger", prof?.[0]?.full_name === "E2E a");

  const id = crypto.randomUUID(),
    path = `${a.id}/${id}/original.pdf`;
  const pdf = new Blob(["%PDF-1.4 test"], { type: "application/pdf" });
  check(
    "A uploads to own folder",
    !(
      await a.client.storage
        .from("original-resumes")
        .upload(path, pdf, { contentType: "application/pdf" })
    ).error,
  );
  check(
    "A cannot upload to B's folder",
    !!(
      await a.client.storage
        .from("original-resumes")
        .upload(`${b.id}/x/original.pdf`, pdf, {
          contentType: "application/pdf",
        })
    ).error,
  );
  check(
    "bad MIME type rejected",
    !!(
      await a.client.storage
        .from("original-resumes")
        .upload(`${a.id}/${crypto.randomUUID()}/x.txt`, new Blob(["hi"]), {
          contentType: "text/plain",
        })
    ).error,
  );

  check(
    "A inserts own resume row",
    !(
      await a.client.from("resumes").insert({
        id,
        user_id: a.id,
        display_name: "A resume",
        original_file_path: path,
        original_file_type: "pdf",
        original_file_size: 13,
      })
    ).error,
  );
  check(
    "A cannot insert row as B",
    !!(
      await a.client
        .from("resumes")
        .insert({ user_id: b.id, display_name: "spoof" })
    ).error,
  );
  check(
    "B sees no rows of A",
    ((await b.client.from("resumes").select("id")).data ?? []).length === 0,
  );
  check(
    "B cannot download A's file",
    !!(await b.client.storage.from("original-resumes").download(path)).error,
  );
  check(
    "B cannot sign URL for A's file",
    !!(
      await b.client.storage.from("original-resumes").createSignedUrl(path, 60)
    ).error,
  );
  check(
    "A can create signed URL",
    !!(
      await a.client.storage.from("original-resumes").createSignedUrl(path, 60)
    ).data?.signedUrl,
  );

  await b.client
    .from("resumes")
    .update({ display_name: "hacked" })
    .eq("id", id);
  check(
    "B cannot update A's row",
    (await admin.from("resumes").select("display_name").eq("id", id).single())
      .data.display_name === "A resume",
  );
  await b.client.from("resumes").delete().eq("id", id);
  check(
    "B cannot delete A's row",
    ((await admin.from("resumes").select("id").eq("id", id)).data ?? [])
      .length === 1,
  );

  await admin
    .from("subscriptions")
    .insert({ user_id: a.id, status: "inactive" });
  await a.client
    .from("subscriptions")
    .update({ status: "active" })
    .eq("user_id", a.id);
  check(
    "client cannot activate own subscription",
    (
      await admin
        .from("subscriptions")
        .select("status")
        .eq("user_id", a.id)
        .single()
    ).data.status === "inactive",
  );
  check(
    "client cannot insert usage_events",
    !!(
      await a.client
        .from("usage_events")
        .insert({ user_id: a.id, event_type: "resume_generation" })
    ).error,
  );
  check(
    "client cannot read payment_events",
    ((await a.client.from("payment_events").select("id")).data ?? []).length ===
      0,
  );
} finally {
  for (const id of users) {
    const { data: files } = await admin.storage
      .from("original-resumes")
      .list(id);
    for (const f of files ?? []) {
      const { data: inner } = await admin.storage
        .from("original-resumes")
        .list(`${id}/${f.name}`);
      await admin.storage
        .from("original-resumes")
        .remove((inner ?? []).map((i) => `${id}/${f.name}/${i.name}`));
    }
    await admin.auth.admin.deleteUser(id);
  }
}
console.log(fails ? `\n${fails} FAILED` : "\nAll RLS/storage checks passed");
process.exit(fails ? 1 : 0);
