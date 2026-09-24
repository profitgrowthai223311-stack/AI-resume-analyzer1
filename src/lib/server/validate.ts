import "server-only";
import type { StructuredResume } from "./resume-schema";

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");

export type FactWarning = { rule: string; detail: string };

/**
 * Enforces the anti-fabrication rules. Anything not traceable to the source text is removed
 * and reported, never silently kept. Hard-required facts (name) throw.
 */
export function enforceFacts(resume: StructuredResume, source: string) {
  const warnings: FactWarning[] = [];
  const srcSquash = squash(source);
  const inSource = (v: string) => !v || srcSquash.includes(squash(v));
  const drop = (rule: string, detail: string) =>
    warnings.push({ rule, detail: detail.slice(0, 120) });
  const numbers = (s: string) => s.match(/\d[\d,.]*%?/g) ?? [];

  const checkBullets = (items: { text: string; evidence: string }[]) =>
    items.filter((b) => {
      if (!srcSquash.includes(squash(b.evidence)))
        return (drop("evidence_not_in_source", b.text), false);
      const bad = numbers(b.text).find(
        (n) => !source.includes(n.replace(/[.,]$/, "")),
      );
      if (bad)
        return (drop("metric_not_in_source", `${bad} in "${b.text}"`), false);
      return true;
    });

  const out: StructuredResume = structuredClone(resume);
  out.header.links = out.header.links.filter((l) =>
    source.includes(l.url) ? true : (drop("link_not_in_source", l.url), false),
  );
  for (const f of ["email", "phone", "location"] as const)
    if (out.header[f] && !inSource(out.header[f])) {
      drop("header_not_in_source", `${f}: ${out.header[f]}`);
      out.header[f] = "";
    }
  if (!inSource(out.header.name)) throw new Error("name_not_in_source");

  out.skills = out.skills
    .map((s) => ({
      ...s,
      items: s.items.filter((i) =>
        inSource(i) ? true : (drop("skill_not_in_source", i), false),
      ),
    }))
    .filter((s) => s.items.length);

  out.experience = out.experience
    .filter((e) => {
      const ok = inSource(e.company) && inSource(e.title);
      if (!ok) drop("experience_not_in_source", `${e.company} — ${e.title}`);
      return ok;
    })
    .map((e) => {
      const dateOk = (d: string) =>
        !d ||
        /^present$/i.test(d) ||
        d
          .split(/[\s,/-]+/)
          .filter(Boolean)
          .every((t) => inSource(t));
      if (!dateOk(e.start) || !dateOk(e.end)) {
        drop("dates_not_in_source", `${e.company}: ${e.start} - ${e.end}`);
        return { ...e, start: "", end: "", bullets: checkBullets(e.bullets) };
      }
      return { ...e, bullets: checkBullets(e.bullets) };
    });

  out.projects = out.projects
    .filter((p) =>
      inSource(p.name) ? true : (drop("project_not_in_source", p.name), false),
    )
    .map((p) => ({ ...p, bullets: checkBullets(p.bullets) }));

  out.education = out.education.filter((e) => {
    const ok = inSource(e.institution) && inSource(e.degree);
    if (!ok) drop("education_not_in_source", `${e.institution} — ${e.degree}`);
    return ok;
  });
  out.certifications = out.certifications.filter((c) =>
    inSource(c) ? true : (drop("certification_not_in_source", c), false),
  );
  if (out.summary) {
    const bad = numbers(out.summary).find((n) => !source.includes(n));
    if (bad) {
      drop("summary_metric_not_in_source", bad);
      out.summary = "";
    }
  }
  return { resume: out, warnings };
}

const FORBIDDEN =
  /\\(input|include|includeonly|write|immediate|openin|openout|read|readline|catcode|csname|expandafter|def|edef|gdef|xdef|let|newcommand|renewcommand|providecommand|usepackage\[[^\]]*\]\{(shellesc|minted)\}|verbatiminput|lstinputlisting|includegraphics|url|special|directlua|pdfshellescape|ShellEscape|immediate\\write18)\b/;
const ALLOWED_PACKAGES = new Set([
  "fontenc",
  "inputenc",
  "lmodern",
  "geometry",
  "enumitem",
  "titlesec",
  "hyperref",
]);
const SECTION_ORDER = [
  "Summary",
  "Skills",
  "Experience",
  "Projects",
  "Education",
  "Certifications",
];

export function validateLatex(tex: string): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!tex.startsWith("\\documentclass"))
    errors.push("must_start_with_documentclass");
  if (!tex.endsWith("\\end{document}"))
    errors.push("must_end_with_end_document");
  if (tex.includes("```")) errors.push("markdown_fence_present");
  if (!tex.includes("% template: ")) errors.push("template_marker_missing");
  if (FORBIDDEN.test(tex)) errors.push("forbidden_command");
  if (/\\write18|\|\s*\w+\s*\|/.test(tex)) errors.push("shell_escape");

  for (const m of tex.matchAll(/\\usepackage(?:\[[^\]]*\])?\{([^}]+)\}/g))
    if (!ALLOWED_PACKAGES.has(m[1])) errors.push(`disallowed_package:${m[1]}`);
  for (const m of tex.matchAll(/\\href\{([^}]*)\}/g))
    if (!/^https:\/\//.test(m[1])) errors.push("non_https_link");

  const stack: string[] = [];
  for (const m of tex.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
    if (m[1] === "begin") stack.push(m[2]);
    else if (stack.pop() !== m[2])
      errors.push(`unbalanced_environment:${m[2]}`);
  }
  if (stack.length) errors.push("unclosed_environment");

  const sections = [...tex.matchAll(/\\section\*\{([^}]+)\}/g)].map(
    (m) => m[1],
  );
  const idx = sections.map((s) => SECTION_ORDER.indexOf(s));
  if (idx.some((i) => i < 0) || idx.some((v, i) => i > 0 && v <= idx[i - 1]))
    errors.push("sections_invalid_or_out_of_order");

  // Body text is escaped by construction; any raw special char left would break compilation.
  const body = tex.slice(tex.indexOf("\\begin{document}"));
  if (
    /(^|[^\\])[#_^](?![{])/.test(
      body.replace(/\$\|\$/g, "").replace(/\\href\{[^}]*\}/g, ""),
    )
  )
    errors.push("unescaped_special_character");
  return { ok: errors.length === 0, errors };
}
