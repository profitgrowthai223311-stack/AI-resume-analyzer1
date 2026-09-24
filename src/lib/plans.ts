// Server-configured plans. Prices are display-only here; Razorpay plan IDs come from env.
export type PlanCode = "monthly" | "yearly";

export const PRO_PLANS: Record<
  PlanCode,
  { label: string; priceInr: number; period: string; totalCount: number }
> = {
  monthly: {
    label: "Pro Monthly",
    priceInr: 199,
    period: "month",
    totalCount: 120,
  },
  yearly: {
    label: "Pro Yearly",
    priceInr: 1499,
    period: "year",
    totalCount: 10,
  },
};

export function razorpayPlanId(code: PlanCode) {
  return code === "monthly"
    ? process.env.RAZORPAY_PLAN_ID_MONTHLY
    : process.env.RAZORPAY_PLAN_ID_YEARLY;
}
