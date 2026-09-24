import { Progress } from "@/components/ui/progress";

export function UsageMeter({
  used,
  limit,
  plan,
}: {
  used: number;
  limit: number;
  plan: "free" | "pro";
}) {
  if (plan === "pro")
    return (
      <p className="text-sm">
        Pro plan: unlimited tailored resumes (fair use). {used} this month.
      </p>
    );
  return (
    <div className="space-y-2">
      <Progress value={Math.min(100, (used / limit) * 100)} />
      <p className="text-sm">
        {used} of {limit} free generations used this month
      </p>
    </div>
  );
}
