import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  BASE,
  admin,
  api,
  check,
  cleanup,
  env,
  failures,
  tempUser,
  uploadResume,
} from "./lib.mjs";

const send = (
  payload,
  { secret = env.RAZORPAY_WEBHOOK_SECRET, id, sig } = {},
) => {
  const raw = JSON.stringify(payload);
  return fetch(`${BASE}/api/razorpay-webhook`, {
    method: "POST",
    headers: {
      "x-razorpay-signature":
        sig ?? createHmac("sha256", secret).update(raw).digest("hex"),
      "x-razorpay-event-id": id,
      "content-type": "application/json",
    },
    body: raw,
  }).then(async (r) => ({
    status: r.status,
    data: await r.json().catch(() => null),
  }));
};
try {
  const u = await tempUser("bill");
  const status = async () =>
    (
      await admin
        .from("subscriptions")
        .select("status")
        .eq("user_id", u.id)
        .maybeSingle()
    ).data?.status;

  const co = await api(u, "/api/create-checkout", { plan: "monthly" });
  check(
    "checkout creates Razorpay subscription",
    co.status === 200 &&
      co.data?.subscriptionId?.startsWith("sub_") &&
      co.data?.keyId?.startsWith("rzp_test_"),
    JSON.stringify(co),
  );
  check(
    "key secret not leaked to client",
    !JSON.stringify(co.data).includes(env.RAZORPAY_KEY_SECRET),
  );
  check(
    "subscription row is inactive after checkout",
    (await status()) === "inactive",
  );
  check(
    "bad plan rejected",
    (await api(u, "/api/create-checkout", { plan: "lifetime" })).status === 400,
  );

  const subId = co.data.subscriptionId,
    end = Math.floor(Date.now() / 1000) + 30 * 86400;
  const evt = (event) => ({
    event,
    payload: {
      subscription: {
        entity: {
          id: subId,
          current_end: end,
          notes: { user_id: u.id, plan: "monthly" },
        },
      },
    },
  });

  check(
    "forged signature → 400",
    (
      await send(evt("subscription.activated"), {
        sig: "0".repeat(64),
        id: "evt_forged",
      })
    ).status === 400,
  );
  check(
    "wrong secret → 400",
    (
      await send(evt("subscription.activated"), {
        secret: "not-the-secret",
        id: "evt_wrong",
      })
    ).status === 400,
  );
  check("still inactive after forged events", (await status()) === "inactive");
  check(
    "client cannot self-activate",
    (
      await u.client
        .from("subscriptions")
        .update({ status: "active" })
        .eq("user_id", u.id)
    ).error === null && (await status()) === "inactive",
  );

  const id1 = "evt_" + Date.now();
  const ok = await send(evt("subscription.activated"), { id: id1 });
  check(
    "valid webhook accepted",
    ok.status === 200 && !ok.data.duplicate,
    JSON.stringify(ok),
  );
  check("subscription active", (await status()) === "active");
  const dup = await send(evt("subscription.activated"), { id: id1 });
  check(
    "replayed event is idempotent",
    dup.status === 200 && dup.data.duplicate === true,
  );
  const { count } = await admin
    .from("payment_events")
    .select("id", { count: "exact", head: true })
    .eq("provider_event_id", id1);
  check("event stored exactly once", count === 1);

  // Pro features unlock server-side
  const rid = await uploadResume(u, "sample-resume.pdf", "pdf");
  await api(u, "/api/extract-resume", { resumeId: rid });
  for (let i = 0; i < 3; i++)
    await admin
      .from("usage_events")
      .insert({ user_id: u.id, event_type: "resume_generation" });
  const { data: jd } = await u.client
    .from("job_descriptions")
    .insert({
      user_id: u.id,
      raw_text: readFileSync("scripts/fixtures/sample-jd.txt", "utf8"),
    })
    .select("id")
    .single();
  const g = await api(u, "/api/generate-resume", {
    resumeId: rid,
    jobDescriptionId: jd.id,
  });
  check(
    "Pro user not blocked by free quota",
    g.status === 200,
    JSON.stringify(g),
  );
  let v;
  for (let i = 0; i < 60; i++) {
    await new Promise((s) => setTimeout(s, 2000));
    ({ data: v } = await u.client
      .from("resume_versions")
      .select("status")
      .eq("id", g.data.versionId)
      .single());
    if (["ready", "failed"].includes(v.status)) break;
  }
  const dl = await fetch(
    `${BASE}/api/download?versionId=${g.data.versionId}&type=latex`,
    { headers: { Authorization: `Bearer ${u.token}` } },
  );
  check(
    "Pro can get LaTeX download URL",
    v.status === "ready" && dl.status === 200,
    `${v.status} ${dl.status}`,
  );

  await send(evt("subscription.cancelled"), { id: "evt_c" + Date.now() });
  check(
    "cancelled with future period end keeps Pro access",
    (await status()) === "cancelled",
  );
  await send(evt("subscription.halted"), { id: "evt_h" + Date.now() });
  check("halted → past_due", (await status()) === "past_due");
  const free = await api(u, "/api/generate-resume", {
    resumeId: rid,
    jobDescriptionId: jd.id,
  });
  check(
    "past_due user is back on free quota (402)",
    free.status === 402,
    JSON.stringify(free),
  );
  const dl2 = await fetch(
    `${BASE}/api/download?versionId=${g.data.versionId}&type=latex`,
    { headers: { Authorization: `Bearer ${u.token}` } },
  );
  check("LaTeX download blocked for free (403)", dl2.status === 403);
} finally {
  await cleanup();
  await admin
    .from("payment_events")
    .delete()
    .like("provider_event_id", "evt_%");
}
process.exit(failures() ? 1 : 0);
