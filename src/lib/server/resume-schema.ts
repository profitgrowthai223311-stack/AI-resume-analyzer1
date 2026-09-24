import { z } from "zod";

const str = z.string().trim();
const bullet = z.object({ text: str.min(1), evidence: str.min(1) });

// The model returns structured content only; LaTeX is rendered deterministically from it.
export const resumeSchema = z.object({
  header: z.object({
    name: str.min(1),
    email: str.default(""),
    phone: str.default(""),
    location: str.default(""),
    links: z.array(z.object({ label: str, url: str })).default([]),
  }),
  summary: str.default(""),
  skills: z.array(z.object({ category: str, items: z.array(str) })).default([]),
  experience: z
    .array(
      z.object({
        company: str,
        title: str,
        location: str.default(""),
        start: str.default(""),
        end: str.default(""),
        bullets: z.array(bullet).default([]),
      }),
    )
    .default([]),
  projects: z
    .array(
      z.object({
        name: str,
        tech: str.default(""),
        bullets: z.array(bullet).default([]),
      }),
    )
    .default([]),
  education: z
    .array(
      z.object({
        institution: str,
        degree: str,
        start: str.default(""),
        end: str.default(""),
        details: str.default(""),
      }),
    )
    .default([]),
  certifications: z.array(str).default([]),
});
export type StructuredResume = z.infer<typeof resumeSchema>;
