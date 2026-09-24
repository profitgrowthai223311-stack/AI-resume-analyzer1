import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

const POINTS = [
  "Only facts from your real resume, verified with evidence",
  "Explainable ATS keyword analysis",
  "Clean LaTeX + PDF ready to send",
];

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="bg-brand-gradient relative hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex">
        <div className="absolute -right-20 -bottom-20 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -top-16 -left-16 size-72 rounded-full bg-white/10 blur-3xl" />
        <Logo light className="relative" />
        <div className="relative space-y-6">
          <h2 className="text-4xl font-extrabold tracking-tight text-balance">
            Tailor your resume to any job — truthfully.
          </h2>
          <ul className="space-y-3">
            {POINTS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-white/90">
                <CheckCircle2 className="size-5 shrink-0" /> {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/70">
          Your resume stays private. Delete your data anytime.
        </p>
      </aside>
      <main className="relative flex flex-col items-center justify-center p-6">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm space-y-6">
          <Logo className="lg:hidden" />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {description && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
          <div className="space-y-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
