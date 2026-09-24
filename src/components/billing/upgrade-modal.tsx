"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UpgradeModal({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  reason: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upgrade to Pro</DialogTitle>
          <DialogDescription>{reason}</DialogDescription>
        </DialogHeader>
        <ul className="list-disc pl-5 text-sm">
          <li>Unlimited tailored resumes (fair use)</li>
          <li>LaTeX download and full history</li>
          <li>Full keyword gap analysis and priority generation</li>
        </ul>
        <Link
          href="/pricing"
          className={buttonVariants({ size: "lg" }) + " w-full"}
        >
          See plans
        </Link>
      </DialogContent>
    </Dialog>
  );
}
