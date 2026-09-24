import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/dashboard" className={buttonVariants()}>
        Go to dashboard
      </Link>
    </main>
  );
}
