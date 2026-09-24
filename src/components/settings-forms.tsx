"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({
  userId,
  fullName,
}: {
  userId: string;
  fullName: string;
}) {
  const [name, setName] = useState(fullName);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await createClient()
      .from("profiles")
      .update({ full_name: name.trim() || null })
      .eq("id", userId);
    if (error) toast.error("Could not save profile.");
    else toast.success("Profile saved.");
  }
  return (
    <form onSubmit={save} className="space-y-3">
      <Label htmlFor="name">Full name</Label>
      <Input
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
      />
      <Button type="submit">Save</Button>
    </form>
  );
}

export function DangerZone() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");

  async function del(scope: "data" | "account") {
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    });
    if (!res.ok) return toast.error("Deletion failed. Please try again.");
    if (scope === "account") {
      await createClient().auth.signOut();
      router.push("/");
    } else {
      toast.success("All your resumes, files and versions were deleted.");
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm">
          Delete all resumes, job descriptions, generated files and versions.
          Your account stays.
        </p>
        <Button
          variant="outline"
          onClick={() =>
            window.confirm(
              "Delete all your resume data? This cannot be undone.",
            ) && del("data")
          }
        >
          Delete my resume data
        </Button>
      </div>
      <div className="space-y-2 border-t pt-4">
        <p className="text-sm">
          Delete your account and everything in it. Type DELETE to confirm.
        </p>
        <Input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-label="Type DELETE to confirm"
        />
        <Button
          variant="destructive"
          disabled={confirm !== "DELETE"}
          onClick={() => del("account")}
        >
          Delete my account
        </Button>
      </div>
    </div>
  );
}
