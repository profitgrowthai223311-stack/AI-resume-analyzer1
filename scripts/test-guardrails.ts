import { readFileSync } from "node:fs";
import { renderLatex, escapeLatex } from "../src/lib/server/latex";
import { enforceFacts, validateLatex } from "../src/lib/server/validate";
import { resumeSchema } from "../src/lib/server/resume-schema";

let fails = 0;
const check = (n: string, ok: boolean) => {
  console.log(`${ok ? "✓" : "✗"} ${n}`);
  if (!ok) fails++;
};
const src = readFileSync("scripts/fixtures/sample-resume.txt", "utf8");

const fake = resumeSchema.parse({
  header: {
    name: "Jane Doe",
    email: "jane.doe@example.com",
    links: [{ label: "evil", url: "https://evil.example/x" }],
  },
  skills: [{ category: "Tools", items: ["React", "GraphQL", "Kubernetes"] }],
  experience: [
    {
      company: "Acme Corp",
      title: "Frontend Engineer",
      start: "Jan 2022",
      end: "Present",
      bullets: [
        {
          text: "Developed internal dashboard using Next.js",
          evidence: "Developed internal dashboard using Next.js and TypeScript",
        },
        { text: "Cut costs by 90%", evidence: "Reduced page load time by 35%" },
        { text: "Led a team of 12", evidence: "Led a team of 12 engineers" },
      ],
    },
    { company: "Google", title: "Staff Engineer", bullets: [] },
  ],
  education: [
    { institution: "MIT", degree: "PhD" },
    {
      institution: "VIT University",
      degree: "B.Tech in Computer Science",
      start: "2016",
      end: "2020",
    },
  ],
  certifications: [
    "AWS Solutions Architect",
    "Meta Front-End Developer Certificate",
  ],
});
const { resume, warnings } = enforceFacts(fake, src);
const rules = warnings.map((w) => w.rule);
check(
  "fake skills removed",
  !resume.skills
    .flatMap((s) => s.items)
    .some((i) => /graphql|kubernetes/i.test(i)) &&
    resume.skills[0].items.includes("React"),
);
check(
  "fake company removed",
  !resume.experience.some((e) => e.company === "Google"),
);
check(
  "invented metric bullet removed",
  !resume.experience[0].bullets.some((b) => /90%/.test(b.text)),
);
check(
  "bullet with unsupported evidence removed",
  !resume.experience[0].bullets.some((b) => /12/.test(b.text)),
);
check("real bullet kept", resume.experience[0].bullets.length === 1);
check(
  "fake school removed, real kept",
  resume.education.length === 1 &&
    resume.education[0].institution === "VIT University",
);
check(
  "fake cert removed, real kept",
  resume.certifications.join() === "Meta Front-End Developer Certificate",
);
check("link not in source removed", resume.header.links.length === 0);
check("warnings recorded", rules.length >= 7);

const tex = renderLatex(resume);
check("rendered LaTeX validates", validateLatex(tex).ok);
check(
  "escaping",
  escapeLatex("R&D 100% #1 a_b {x} ~ ^ \\ “q” – ✓") ===
    'R\\&D 100\\% \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{} "q" --',
);
for (const [name, bad] of [
  [
    "\\input",
    tex.replace("\\begin{document}", "\\begin{document}\\input{/etc/passwd}"),
  ],
  [
    "\\write18",
    tex.replace(
      "\\begin{document}",
      "\\begin{document}\\immediate\\write18{ls}",
    ),
  ],
  ["fence", "```latex\n" + tex],
  ["prose after", tex + "\nHope this helps!"],
  [
    "bad package",
    tex.replace("\\usepackage{lmodern}", "\\usepackage{shellesc}"),
  ],
  [
    "http link",
    tex.replace("\\begin{document}", "\\begin{document}\\href{http://x.y}{a}"),
  ],
  [
    "section order",
    tex.replace("\\section*{Experience}", "\\section*{Education}"),
  ],
  ["unbalanced", tex.replace("\\end{itemize}", "")],
  ["unknown section", tex.replace("\\section*{Skills}", "\\section*{Hacking}")],
] as const)
  check(`validator rejects ${name}`, !validateLatex(bad).ok);
process.exit(fails ? 1 : 0);
