import Link from "next/link";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 space-y-4 p-6 text-sm">
      <h1 className="text-2xl font-semibold">Privacy and AI data handling</h1>
      <p>Your resume is sensitive personal data. This is how we handle it.</p>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Original files and generated resumes are stored in private storage,
          visible only to you, and served through short-lived signed links.
        </li>
        <li>
          To analyze and tailor your resume, the resume text and the job
          description are sent to our AI provider (OpenAI). Generated LaTeX is
          sent to a third-party compiler (latex.ytotech.com) to produce your
          PDF.
        </li>
        <li>
          We only add facts that appear in your original resume. Missing
          keywords are suggested to you, never inserted as experience.
        </li>
        <li>
          ATS scores are advisory. They do not guarantee interviews or hiring
          outcomes.
        </li>
        <li>
          We do not log resume or job-description contents. Payments are handled
          by Razorpay; we never store card data.
        </li>
        <li>
          You can delete all your data, or your whole account, at any time from
          Settings.
        </li>
      </ul>
      <Link href="/" className="underline">
        Home
      </Link>
    </main>
  );
}
