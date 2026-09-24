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
          Your file is stored privately and only used to tailor your resumes.
          Text extraction comes next.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResumeUploader />
      </CardContent>
    </Card>
  );
}
