import Link from "next/link";
import { Logo } from "@/components/logo";

export function MarketingFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm">
        <Logo />
        <nav className="text-muted-foreground flex gap-6">
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy
          </Link>
          <Link href="/auth/login" className="hover:text-foreground">
            Log in
          </Link>
        </nav>
        <p className="text-muted-foreground text-xs">
          ATS scores are advisory and do not guarantee interviews or hiring
          outcomes.
        </p>
      </div>
    </footer>
  );
}
