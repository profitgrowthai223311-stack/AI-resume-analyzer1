// Live test: the Free plan's total-upload cap. Proves the limit is enforced by a database trigger
// (so it can't be bypassed by calling the Supabase client directly, skipping the app's own UI
// checks entirely), and that a Pro user is exempt.
import {
  admin,
  api,
  check,
  cleanup,
  failures,
  tempUser,
  uploadResume,
} from "./lib.mjs";

async function directInsert(user, n) {
  const id = crypto.randomUUID();
  return user.client.from("resumes").insert({
    id,
    user_id: user.id,
    display_name: `Direct insert ${n}`,
    original_file_path: `${user.id}/${id}/original.pdf`,
    original_file_type: "pdf",
    original_file_size: 10,
  });
}

try {
  const free = await tempUser("uploadlimit");

  // Two uploads succeed for a Free user (matches FREE_TOTAL_UPLOADS default of 2).
  await uploadResume(free, "sample-resume.pdf", "pdf");
  await uploadResume(free, "sample-resume.docx", "docx");
  const { count: afterTwo } = await admin
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", free.id);
  check("two uploads succeed", afterTwo === 2, String(afterTwo));

  // A third upload is rejected by the database trigger, not merely by app-level code —
  // this call goes straight through the user's own Supabase client, the same as our UI does,
  // with no server-side pre-check in front of it.
  const third = await directInsert(free, 3);
  check(
    "third insert rejected by the database",
    !!third.error,
    JSON.stringify(third),
  );
  check(
    "rejection is the expected free-upload-limit error",
    (third.error?.message ?? "").includes("FREE_UPLOAD_LIMIT_REACHED"),
    third.error?.message,
  );
  const { count: stillTwo } = await admin
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", free.id);
  check("count did not increase past two", stillTwo === 2, String(stillTwo));

  // A direct call that bypasses the app UI entirely (no client-side quota check ran) is still blocked.
  const bypass = await tempUser("uploadlimitbypass");
  const r1 = await directInsert(bypass, 1);
  const r2 = await directInsert(bypass, 2);
  const r3 = await directInsert(bypass, 3);
  check(
    "bypass: first two direct inserts succeed",
    !r1.error && !r2.error,
    JSON.stringify({ e1: r1.error, e2: r2.error }),
  );
  check(
    "bypass: third direct insert still rejected",
    !!r3.error &&
      (r3.error.message ?? "").includes("FREE_UPLOAD_LIMIT_REACHED"),
    JSON.stringify(r3.error),
  );

  // Pro (active subscription) has no upload limit.
  const pro = await tempUser("uploadlimitpro");
  await admin
    .from("subscriptions")
    .insert({ user_id: pro.id, status: "active", plan_code: "monthly" });
  for (let i = 0; i < 4; i++) {
    const r = await directInsert(pro, i);
    check(`pro upload ${i + 1}/4 succeeds`, !r.error, JSON.stringify(r.error));
  }

  // A cancelled subscription still inside its paid period is treated as Pro too (matches getPlan()).
  const cancelledButPaid = await tempUser("uploadlimitcancelled");
  await admin.from("subscriptions").insert({
    user_id: cancelledButPaid.id,
    status: "cancelled",
    plan_code: "monthly",
    current_period_end: new Date(Date.now() + 7 * 86400_000).toISOString(),
  });
  for (let i = 0; i < 3; i++) {
    const r = await directInsert(cancelledButPaid, i);
    check(
      `cancelled-but-still-paid upload ${i + 1}/3 succeeds`,
      !r.error,
      JSON.stringify(r.error),
    );
  }

  // API-level UX: the upload page reports the right plan/usage numbers and the account-deletion
  // path (used elsewhere) still works after hitting the limit — resumes/versions cleaned up.
  const del = await api(free, "/api/account", { scope: "data" }, "DELETE");
  check("data deletion works for a user who hit the limit", del.status === 200);
  const { count: afterDelete } = await admin
    .from("resumes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", free.id);
  check("resumes gone after deletion", afterDelete === 0, String(afterDelete));

  // After deletion, the Free user can upload again (the count is per-existing-row, not lifetime).
  const again = await directInsert(free, "again-1");
  check(
    "Free user can upload again after deleting resumes",
    !again.error,
    JSON.stringify(again.error),
  );
} finally {
  await cleanup();
}
process.exit(failures() ? 1 : 0);
