import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        Tailor your resume to any job — truthfully.
      </h1>
      <p className="text-muted-foreground">
        Upload your resume, paste a job description, and get an ATS-optimized
        LaTeX and PDF resume that only uses facts from your original.
      </p>
      <div className="flex gap-3">
        <Link href="/auth/signup" className={buttonVariants()}>
          Get started
        </Link>
        <Link
          href="/auth/login"
          className={buttonVariants({ variant: "outline" })}
        >
          Log in
        </Link>
      </div>
    </main>
  );
}
