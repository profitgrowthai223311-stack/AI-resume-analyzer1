import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export async function MarketingNav() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims);
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
        <Logo />
        <nav className="text-muted-foreground hidden items-center gap-6 text-sm font-medium md:flex">
          <Link href="/#features" className="hover:text-foreground">
            Features
          </Link>
          <Link href="/#how" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/#faq" className="hover:text-foreground">
            FAQ
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {signedIn ? (
            <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className={
                  buttonVariants({ variant: "ghost", size: "lg" }) +
                  " hidden sm:inline-flex"
                }
              >
                Log in
              </Link>
              <Link
                href="/auth/signup"
                className={buttonVariants({ size: "lg" })}
              >
                Get started free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
