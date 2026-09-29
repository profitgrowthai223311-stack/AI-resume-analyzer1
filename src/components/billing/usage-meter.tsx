import { Progress } from "@/components/ui/progress";

export function UsageMeter({
  used,
  limit,
  plan,
  label = "free generations",
  period = "this month",
  proText = "unlimited tailored resumes (fair use)",
}: {
  used: number;
  limit: number;
  plan: "free" | "pro";
  label?: string;
  period?: string;
  proText?: string;
}) {
  if (plan === "pro")
    return (
      <p className="text-sm">
        Pro plan: {proText}. {used} {period}.
      </p>
    );
  return (
    <div className="space-y-2">
      <Progress value={Math.min(100, (used / limit) * 100)} />
      <p className="text-sm">
        {used} of {limit} {label} used {period}
      </p>
    </div>
  );
}
