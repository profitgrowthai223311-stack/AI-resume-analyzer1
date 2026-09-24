import {
  BarChart3,
  CheckCircle2,
  FileCheck2,
  FileText,
  Lock,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  Wand2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNav } from "@/components/marketing/nav";
import { IconBadge, type Tone } from "@/components/stat-card";
import { ScoreRing } from "@/components/score-ring";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const FEATURES: {
  icon: typeof Target;
  title: string;
  text: string;
  tone: Tone;
}[] = [
  {
    icon: ScanSearch,
    title: "Smart extraction",
    text: "Upload a PDF or DOCX. We read it and let you correct the text before anything is generated.",
    tone: "indigo",
  },
  {
    icon: Target,
    title: "Explainable ATS analysis",
    text: "See matched keywords, related skills and true gaps, each tied to a quote from your resume.",
    tone: "pink",
  },
  {
    icon: ShieldCheck,
    title: "No fabricated experience",
    text: "Every bullet must trace back to your original resume. Unsupported claims are removed and flagged.",
    tone: "emerald",
  },
  {
    icon: FileCheck2,
    title: "Clean LaTeX + PDF",
    text: "A validated, ATS-friendly template compiled to a polished PDF, with LaTeX source on Pro.",
    tone: "amber",
  },
  {
    icon: BarChart3,
    title: "Analytics dashboard",
    text: "Track score trends, top skills and gaps, and how your applications improve over time.",
    tone: "sky",
  },
  {
    icon: Lock,
    title: "Private by design",
    text: "Private storage, per-user access rules, short-lived download links and one-click deletion.",
    tone: "indigo",
  },
];

const STEPS = [
  {
    icon: FileText,
    title: "Upload your resume",
    text: "Drop in a PDF or DOCX and review the extracted text.",
  },
  {
    icon: Target,
    title: "Paste the job description",
    text: "Get a transparent match score and evidence-based keyword gaps.",
  },
  {
    icon: Wand2,
    title: "Generate and download",
    text: "Receive a tailored, truthful PDF and LaTeX version, saved to your history.",
  },
];

const FAQ = [
  [
    "Will it invent experience to match a job?",
    "No. Every claim must be supported by a quote from your original resume. Anything we can't verify is removed and shown to you as a warning. Missing keywords are suggested to you, never inserted as experience.",
  ],
  [
    "Does a high score guarantee interviews?",
    "No. The score is an advisory keyword-alignment estimate. It does not predict hiring outcomes.",
  ],
  [
    "Which files can I upload?",
    "PDF and DOCX up to 10 MB. If extraction fails you can paste your resume text instead.",
  ],
  [
    "Who sees my resume?",
    "Only you. Files sit in private storage. To generate results, the resume text and job description are sent to our AI provider, and the generated LaTeX to a PDF compiler. You can delete everything from Settings at any time.",
  ],
  [
    "What does the free plan include?",
    "2 tailored resumes a month, the ATS overview, PDF download and your latest 2 versions. Pro adds unlimited generations, LaTeX download, full gap analysis and full history.",
  ],
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <MarketingNav />
      <main className="flex-1">
        <section className="bg-hero-mesh relative overflow-hidden">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 md:py-24 lg:grid-cols-2">
            <div className="space-y-6">
              <span className="bg-accent text-accent-foreground inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
                <Sparkles className="size-3.5" /> AI-assisted, truthful resume
                tailoring
              </span>
              <h1 className="text-4xl font-extrabold tracking-tight text-balance md:text-6xl">
                Tailor your resume to any job —{" "}
                <span className="text-brand-gradient">truthfully.</span>
              </h1>
              <p className="text-muted-foreground max-w-xl text-lg">
                Upload your resume, paste a job description, and get an
                ATS-optimized LaTeX and PDF resume that only uses facts from
                your original. No invented experience, ever.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/auth/signup"
                  className={
                    buttonVariants({ size: "lg" }) + " h-12 px-6 text-base"
                  }
                >
                  <Sparkles className="size-4" /> Start free
                </Link>
                <Link
                  href="/pricing"
                  className={
                    buttonVariants({ variant: "outline", size: "lg" }) +
                    " h-12 px-6 text-base"
                  }
                >
                  See pricing
                </Link>
              </div>
              <p className="text-muted-foreground text-sm">
                Free plan includes 2 tailored resumes a month. No card required.
              </p>
            </div>

            <Card className="shadow-glow mx-auto w-full max-w-md rotate-1">
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">Frontend Engineer — Globex</p>
                    <p className="text-muted-foreground text-xs">
                      ATS keyword analysis
                    </p>
                  </div>
                  <ScoreRing score={78} size={96} label="Score" />
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    ["React", true],
                    ["Next.js", true],
                    ["TypeScript", true],
                    ["GraphQL", false],
                  ].map(([k, ok]) => (
                    <div
                      key={String(k)}
                      className="flex items-center justify-between rounded-xl border px-3 py-2"
                    >
                      <span className="font-medium">{k}</span>
                      {ok ? (
                        <span className="text-success flex items-center gap-1 text-xs font-semibold">
                          <CheckCircle2 className="size-4" /> Evidenced
                        </span>
                      ) : (
                        <span className="text-destructive flex items-center gap-1 text-xs font-semibold">
                          <XCircle className="size-4" /> Not added
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Sample illustration. Missing skills are suggested, never
                  inserted.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20"
        >
          <div className="mx-auto max-w-2xl space-y-3 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              Everything you need to apply with confidence
            </h2>
            <p className="text-muted-foreground">
              A complete workflow from upload to a polished, verified PDF.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card
                key={f.title}
                className="transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <CardContent className="space-y-3">
                  <IconBadge icon={f.icon} tone={f.tone} />
                  <h3 className="text-lg font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground text-sm">{f.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="how" className="bg-muted/50 scroll-mt-20 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-center text-3xl font-bold tracking-tight md:text-4xl">
              How it works
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <div key={s.title} className="relative space-y-3 text-center">
                  <span className="bg-brand-gradient shadow-glow mx-auto flex size-14 items-center justify-center rounded-2xl text-white">
                    <s.icon className="size-6" />
                  </span>
                  <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
                    Step {i + 1}
                  </p>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="text-muted-foreground text-sm">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-destructive/30">
              <CardContent className="space-y-3">
                <h3 className="text-destructive flex items-center gap-2 text-lg font-semibold">
                  <XCircle className="size-5" /> Typical AI resume tools
                </h3>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>Stuff in every keyword from the job posting</li>
                  <li>Invent metrics and skills you never had</li>
                  <li>Risk failed background checks and awkward interviews</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-success/40">
              <CardContent className="space-y-3">
                <h3 className="text-success flex items-center gap-2 text-lg font-semibold">
                  <CheckCircle2 className="size-5" /> ResumeAI
                </h3>
                <ul className="text-muted-foreground space-y-2 text-sm">
                  <li>Uses only facts backed by a quote from your resume</li>
                  <li>Shows missing keywords as suggestions, not claims</li>
                  <li>Flags anything it couldn&apos;t verify and removes it</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 pb-20">
          <h2 className="mb-8 text-center text-3xl font-bold tracking-tight">
            Frequently asked questions
          </h2>
          <div className="space-y-3">
            {FAQ.map(([q, a]) => (
              <details
                key={q}
                className="bg-card group rounded-2xl border p-5 shadow-sm open:shadow-md"
              >
                <summary className="cursor-pointer list-none font-semibold marker:hidden">
                  {q}
                </summary>
                <p className="text-muted-foreground mt-3 text-sm">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="px-4 pb-20">
          <div className="bg-brand-gradient shadow-glow mx-auto max-w-4xl space-y-5 rounded-3xl p-10 text-center text-white">
            <h2 className="text-3xl font-bold">
              Ready for your next application?
            </h2>
            <p className="text-white/85">
              Create your free account and tailor your first resume in minutes.
            </p>
            <Link
              href="/auth/signup"
              className={
                buttonVariants({ variant: "secondary", size: "lg" }) +
                " h-12 px-8 text-base"
              }
            >
              Get started free
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
