import { readFileSync } from "node:fs";
import { checkLatex } from "../src/lib/server/latex-check";
import { CANONICAL_PREAMBLE } from "../src/lib/server/prompts";

let fails = 0;
const check = (n: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "✓" : "✗"} ${n}${!ok && extra ? "  → " + extra : ""}`);
  if (!ok) fails++;
};
const src = readFileSync("scripts/fixtures/sample-resume.txt", "utf8");

const doc = (body: string) =>
  `${CANONICAL_PREAMBLE}\\begin{document}\n\\pagestyle{empty}\n${body}\n\\end{document}`;
const HEADER = String.raw`\begin{center}
    {\Huge\scshape\textbf{Jane Doe}} \\[4pt]
    \small Bengaluru, India $|$ +91 98765 43210 $|$ \href{mailto:jane.doe@example.com}{jane.doe@example.com} $|$ \href{https://github.com/janedoe}{github.com/janedoe}
\end{center}`;
const SUMMARY = String.raw`\section{Professional Summary}
\vspace{2pt}
\small{Frontend Engineer with 4 years of experience building React and Next.js applications with TypeScript.}
\vspace{4pt}`;
const SKILLS = (items: string) => String.raw`\section{Technical Skills}
\begin{itemize}[leftmargin=0.2in, label=\textbullet, itemsep=2pt]
\small
\item \textbf{Frameworks:} ${items}
\end{itemize}`;
const EXP = (
  company: string,
  bullets: string[],
) => String.raw`\section{Experience}
\resumeSubHeadingListStart
  \resumeSubheading{${company}}{Jan 2022 -- Present}{Frontend Engineer}{}
  \resumeItemListStart
${bullets.map((b) => `    \\resumeItem{${b}}`).join("\n")}
  \resumeItemListEnd
\resumeSubHeadingListEnd`;
const EDU = String.raw`\section{Education}
\resumeSubHeadingListStart
  \resumeSubheading{VIT University}{2020}{B.Tech, Computer Science}{}
\resumeSubHeadingListEnd`;
const CERT = (name: string) => String.raw`\section{Certifications}
\begin{itemize}[leftmargin=0.2in, label=\textbullet, itemsep=2pt]
\small
\item ${name} --- Coursera (2022)
\end{itemize}`;

const good = doc(
  [
    HEADER,
    SUMMARY,
    SKILLS("React, Next.js, Jest"),
    EXP("Acme Corp", [
      "Developed internal dashboard using Next.js and TypeScript for 200 employees.",
      "Reduced page load time by 35\\% through code splitting.",
    ]),
    EDU,
    CERT("Meta Front-End Developer Certificate"),
  ].join("\n"),
);
const ok = checkLatex(good, src);
check(
  "valid document passes",
  ok.ok && ok.warnings.length === 0,
  ok.errors.join(",") + JSON.stringify(ok.warnings),
);

// sanitizing (removed, reported, still ok)
const dirty = checkLatex(
  doc(
    [
      HEADER,
      SUMMARY,
      SKILLS("React, GraphQL, Kubernetes, Jest"),
      EXP("Acme Corp", [
        "Developed internal dashboard using Next.js.",
        "Cut costs by 90\\% across teams.",
        "Led 12 engineers.",
      ]),
      EDU,
      CERT("AWS Solutions Architect"),
    ].join("\n"),
  ),
  src,
);
check("dirty doc still ok after sanitizing", dirty.ok, dirty.errors.join(","));
check(
  "invented skills removed",
  !/GraphQL|Kubernetes/.test(dirty.tex) && /React, Jest/.test(dirty.tex),
);
check(
  "invented metrics removed (90%, 12)",
  !/90\\%|Led 12/.test(dirty.tex) && /internal dashboard/.test(dirty.tex),
);
check("invented certification removed", !/AWS Solutions/.test(dirty.tex));
check(
  "warnings reported",
  [
    "skill_not_in_source",
    "metric_not_in_source",
    "certification_not_in_source",
  ].every((r) => dirty.warnings.some((w) => w.rule === r)),
);

// hard errors
const errs = (name: string, tex: string, code: RegExp) => {
  const r = checkLatex(tex, src);
  check(
    `rejects ${name}`,
    !r.ok && r.errors.some((e) => code.test(e)),
    r.errors.join(","),
  );
};
errs("markdown fence", "```latex\n" + good + "\n```", /markdown_fence/);
errs("prose after document", good + "\nHope this helps!", /must_end/);
errs("prose before document", "Here you go:\n" + good, /must_start/);
errs(
  "modified preamble (extra package)",
  good.replace(
    "\\usepackage{latexsym}",
    "\\usepackage{latexsym}\\usepackage{shellesc}",
  ),
  /preamble_modified/,
);
errs(
  "\\input in body",
  good.replace("\\pagestyle{empty}", "\\pagestyle{empty}\\input{/etc/passwd}"),
  /disallowed_command:input/,
);
errs(
  "\\write18 in body",
  good.replace(
    "\\pagestyle{empty}",
    "\\pagestyle{empty}\\immediate\\write18{ls}",
  ),
  /disallowed_command/,
);
errs(
  "\\newcommand in body",
  good.replace("\\pagestyle{empty}", "\\pagestyle{empty}\\newcommand{\\x}{y}"),
  /disallowed_command:newcommand/,
);
errs(
  "fake company",
  doc(
    [
      HEADER,
      SUMMARY,
      SKILLS("React"),
      EXP("Google", ["Developed things."]),
      EDU,
    ].join("\n"),
  ),
  /company_not_in_source/,
);
errs(
  "fake university",
  doc(
    [
      HEADER,
      SUMMARY,
      SKILLS("React"),
      EXP("Acme Corp", ["Developed things."]),
      EDU.replace("VIT University", "MIT"),
    ].join("\n"),
  ),
  /institution_not_in_source/,
);
errs(
  "fake dates",
  doc(
    [
      HEADER,
      SUMMARY,
      SKILLS("React"),
      EXP("Acme Corp", ["Developed things."]).replace(
        "Jan 2022 -- Present",
        "Jan 2015 -- Present",
      ),
      EDU,
    ].join("\n"),
  ),
  /date_not_in_source/,
);
errs(
  "JD city instead of candidate's",
  doc(
    [
      HEADER.replace("Bengaluru, India", "Seattle, WA"),
      SUMMARY,
      SKILLS("React"),
      EXP("Acme Corp", ["Developed things."]),
      EDU,
    ].join("\n"),
  ),
  /location_not_in_source/,
);
errs(
  "invented years of experience",
  doc(
    [
      HEADER,
      SUMMARY.replace("4 years", "15 years"),
      SKILLS("React"),
      EXP("Acme Corp", ["Developed things."]),
      EDU,
    ].join("\n"),
  ),
  /summary_number/,
);
errs(
  "invented email",
  doc(
    [
      HEADER.replace("jane.doe@example.com", "fake@x.io"),
      SUMMARY,
      SKILLS("React"),
      EXP("Acme Corp", ["Developed things."]),
      EDU,
    ].join("\n"),
  ),
  /email_not_in_source|link_not_in_source/,
);
errs(
  "http link",
  doc(
    [
      HEADER.replace("https://github.com/janedoe", "http://github.com/janedoe"),
      SUMMARY,
      SKILLS("React"),
      EXP("Acme Corp", ["x."]),
      EDU,
    ].join("\n"),
  ),
  /non_https/,
);
errs(
  "unescaped & in bullet",
  doc(
    [
      HEADER,
      SUMMARY,
      SKILLS("React"),
      EXP("Acme Corp", ["Improved R&D speed."]),
      EDU,
    ].join("\n"),
  ),
  /unescaped_special_character/,
);
errs(
  "unescaped % in bullet",
  doc(
    [
      HEADER,
      SUMMARY,
      SKILLS("React"),
      EXP("Acme Corp", ["Improved speed by 35%."]),
      EDU,
    ].join("\n"),
  ),
  /unescaped_special_character/,
);
errs(
  "section out of order",
  doc([HEADER, SUMMARY, EDU, EXP("Acme Corp", ["x."])].join("\n")),
  /sections_invalid/,
);
errs(
  "unknown section",
  doc(
    [
      HEADER,
      SUMMARY,
      SKILLS("React"),
      "\\section{Hacking}",
      EXP("Acme Corp", ["x."]),
    ].join("\n"),
  ),
  /sections_invalid/,
);
errs(
  "unclosed environment",
  good.replace("\\end{center}", ""),
  /unbalanced|unclosed/,
);
errs(
  "unbalanced item list",
  good.replace("  \\resumeItemListEnd\n", ""),
  /unbalanced_resumeItemListStart/,
);
process.exit(fails ? 1 : 0);
