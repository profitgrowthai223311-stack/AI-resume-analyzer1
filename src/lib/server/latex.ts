import "server-only";
import type { StructuredResume } from "./resume-schema";

export const TEMPLATE_VERSION = "classic-v1";

const REPLACEMENTS: [RegExp, string][] = [
  [/[\u2018\u2019\u201a]/g, "'"],
  [/[\u201c\u201d\u201e]/g, '"'],
  [/[\u2013]/g, "--"],
  [/[\u2014]/g, "---"],
  [/[\u2022\u25cf\u25aa]/g, "-"],
  [/\u2026/g, "..."],
  [/[\u00a0\u2009\u200b]/g, " "],
];

const ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

/** Escapes text for pdflatex. Characters outside Latin-1 are dropped (they would break compilation). */
export function escapeLatex(input: string): string {
  let s = input;
  for (const [re, rep] of REPLACEMENTS) s = s.replace(re, rep);
  s = s.replace(/[^\x09\x0a\x20-\x7e\u00a1-\u00ff]/g, "");
  // Single pass so replacement text (e.g. the braces in \textbackslash{}) is never re-escaped.
  return s
    .replace(/[\\&%$#_{}~^]/g, (c) => ESCAPES[c])
    .replace(/\s+/g, " ")
    .trim();
}

const safeUrl = (u: string) => /^https:\/\/[A-Za-z0-9._~:/-]+$/.test(u);
const dates = (a: string, b: string) =>
  [a, b].filter(Boolean).map(escapeLatex).join(" -- ");

const PREAMBLE = String.raw`\documentclass[10pt,letterpaper]{article}
% template: ${TEMPLATE_VERSION}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage[margin=0.7in]{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage[hidelinks]{hyperref}
\pagestyle{empty}
\setlength{\parindent}{0pt}
\titleformat{\section}{\large\bfseries}{}{0pt}{}[\titlerule]
\titlespacing*{\section}{0pt}{8pt}{4pt}
\setlist[itemize]{leftmargin=1.2em,itemsep=1pt,topsep=2pt}
`;

function bullets(items: { text: string }[]) {
  if (!items.length) return "";
  return `\\begin{itemize}\n${items.map((b) => `\\item ${escapeLatex(b.text)}`).join("\n")}\n\\end{itemize}\n`;
}

export function renderLatex(r: StructuredResume): string {
  const h = r.header;
  const contact = [h.email, h.phone, h.location]
    .filter(Boolean)
    .map(escapeLatex)
    .concat(
      h.links.map((l) =>
        safeUrl(l.url)
          ? `\\href{${l.url}}{${escapeLatex(l.label || l.url)}}`
          : escapeLatex(l.label),
      ),
    );

  let out = `${PREAMBLE}\\begin{document}\n\\begin{center}\n{\\LARGE\\bfseries ${escapeLatex(h.name)}}\\\\[3pt]\n${contact.join(" $|$ ")}\n\\end{center}\n`;

  if (r.summary) out += `\\section*{Summary}\n${escapeLatex(r.summary)}\n`;
  if (r.skills.length)
    out += `\\section*{Skills}\n${r.skills
      .map(
        (s) =>
          `\\textbf{${escapeLatex(s.category)}:} ${s.items.map(escapeLatex).join(", ")}\\\\`,
      )
      .join("\n")}\n`;
  if (r.experience.length)
    out += `\\section*{Experience}\n${r.experience
      .map(
        (e) =>
          `\\textbf{${escapeLatex(e.company)}} \\hfill ${dates(e.start, e.end)}\\\\\n\\textit{${escapeLatex(e.title)}}${e.location ? ` \\hfill ${escapeLatex(e.location)}` : ""}\n${bullets(e.bullets)}`,
      )
      .join("\\vspace{4pt}\n")}`;
  if (r.projects.length)
    out += `\\section*{Projects}\n${r.projects
      .map(
        (p) =>
          `\\textbf{${escapeLatex(p.name)}}${p.tech ? ` \\hfill \\textit{${escapeLatex(p.tech)}}` : ""}\n${bullets(p.bullets)}`,
      )
      .join("\\vspace{4pt}\n")}`;
  if (r.education.length)
    out += `\\section*{Education}\n${r.education
      .map(
        (e) =>
          `\\textbf{${escapeLatex(e.institution)}} \\hfill ${dates(e.start, e.end)}\\\\\n${escapeLatex(e.degree)}${e.details ? ` -- ${escapeLatex(e.details)}` : ""}\\\\`,
      )
      .join("\n")}\n`;
  if (r.certifications.length)
    out += `\\section*{Certifications}\n${bullets(r.certifications.map((c) => ({ text: c })))}`;

  return `${out}\\end{document}`;
}
