import Link from "next/link";
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
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Upload your resume</CardTitle>
        <CardDescription>
          Your file is stored privately and only used to tailor your resumes. By
          uploading you agree that your resume text is sent to our AI provider
          and a PDF compiler to tailor your resume. See the{" "}
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
  );
}
