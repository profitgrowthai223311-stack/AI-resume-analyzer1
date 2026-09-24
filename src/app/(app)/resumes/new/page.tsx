import { Lock, ScanText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ResumeUploader } from "@/components/resume/resume-uploader";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Upload resume" };

export default function NewResumePage() {
  return (
    <>
      <PageHeader
        title="Upload your resume"
        description="Step 1 of 3: upload, review the extracted text, then tailor it to a job."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Upload your resume</CardTitle>
            <CardDescription>
              By uploading you agree that your resume text is sent to our AI
              provider and a PDF compiler to tailor your resume. See the{" "}
              <Link href="/privacy" className="underline">
                privacy notes
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResumeUploader />
          </CardContent>
        </Card>
        <div className="space-y-4">
          {[
            {
              icon: Lock,
              title: "Private by default",
              text: "Stored in a private bucket, visible only to you.",
              tone: "from-indigo-500 to-violet-500",
            },
            {
              icon: ScanText,
              title: "You review the text",
              text: "Fix any extraction errors before we use it.",
              tone: "from-pink-500 to-rose-500",
            },
            {
              icon: ShieldCheck,
              title: "No made-up facts",
              text: "Every claim is traced back to your resume.",
              tone: "from-emerald-500 to-teal-500",
            },
          ].map((f) => (
            <Card key={f.title}>
              <CardContent className="flex gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white ${f.tone}`}
                >
                  <f.icon className="size-5" />
                </span>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-muted-foreground text-sm">{f.text}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
