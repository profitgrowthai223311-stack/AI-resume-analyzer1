import "server-only";
import { CANONICAL_PREAMBLE } from "./prompts";

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

export type Warning = { rule: string; detail: string };
export type CheckResult = {
  ok: boolean;
  tex: string;
  errors: string[];
  warnings: Warning[];
};

const SECTIONS = [
  "Professional Summary",
  "Technical Skills",
  "Experience",
  "Projects",
  "Education",
  "Certifications",
  "Awards \\& Achievements",
  "Publications",
];

// Body commands are allow-listed (the preamble is verified byte-for-byte separately).
const ALLOWED_COMMANDS = new Set([
  "begin",
  "end",
  "section",
  "vspace",
  "small",
  "footnotesize",
  "large",
  "Large",
  "Huge",
  "scshape",
  "textbf",
  "textit",
  "emph",
  "href",
  "item",
  "pagestyle",
  "noindent",
  "hfill",
  "textbackslash",
  "textbullet",
  "textasciitilde",
  "textasciicircum",
  "ldots",
  "resumeItem",
  "resumeSubheading",
  "resumeProjectHeading",
  "resumeSubHeadingListStart",
  "resumeSubHeadingListEnd",
  "resumeItemListStart",
  "resumeItemListEnd",
]);
const ALLOWED_ENVS = new Set(["center", "itemize"]);
const ALLOWED_SYMBOLS = new Set([
  "&",
  "%",
  "#",
  "_",
  "$",
  "{",
  "}",
  "\\",
  ",",
  " ",
  ";",
  "!",
]);

/** Reads the {...} group starting at s[i]; handles nesting and escaped braces. */
function readGroup(s: string, i: number): { text: string; end: number } | null {
  if (s[i] !== "{") return null;
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === "\\") j++;
    else if (s[j] === "{") depth++;
    else if (s[j] === "}" && --depth === 0)
      return { text: s.slice(i + 1, j), end: j + 1 };
  }
  return null;
}

function readArgs(s: string, i: number, n: number) {
  const args: string[] = [];
  let pos = i;
  for (let k = 0; k < n; k++) {
    while (/\s/.test(s[pos] ?? "")) pos++;
    const g = readGroup(s, pos);
    if (!g) return null;
    args.push(g.text);
    pos = g.end;
  }
  return { args, end: pos };
}

/** LaTeX → readable text for comparing against the source resume. */
function plain(s: string) {
  return s
    .replace(/\\(textbf|textit|emph|small|href)\b/g, "")
    .replace(/\\([&%#_$])/g, "$1")
    .replace(/\\\\|\\[a-zA-Z]+/g, " ")
    .replace(/---|--/g, "-")
    .replace(/[{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const numbersIn = (s: string) =>
  (plain(s).match(/\d[\d,.]*%?/g) ?? []).map((n) => n.replace(/[.,]+$/, ""));

/**
 * Validates model-produced LaTeX against the PRD rules and the resume's facts.
 * Unsupported bullets, skills and certifications are removed (and reported);
 * structural problems and unsupported employers/titles/education are hard errors.
 */
export function checkLatex(raw: string, source: string): CheckResult {
  const errors: string[] = [];
  const warnings: Warning[] = [];
  let tex = raw.trim();
  const inSource = (v: string) =>
    !squash(plain(v)) || squash(source).includes(squash(plain(v)));

  // --- structure ---
  if (tex.includes("```")) errors.push("markdown_fence_present");
  if (!tex.startsWith("\\documentclass"))
    errors.push("must_start_with_documentclass");
  if (!tex.endsWith("\\end{document}"))
    errors.push("must_end_with_end_document");
  const bodyStart = tex.indexOf("\\begin{document}");
  if (bodyStart < 0)
    return {
      ok: false,
      tex,
      errors: [...errors, "missing_begin_document"],
      warnings,
    };
  if (norm(tex.slice(0, bodyStart)) !== norm(CANONICAL_PREAMBLE))
    errors.push("preamble_modified");
  if (errors.length) return { ok: false, tex, errors, warnings };

  const head = tex.slice(0, bodyStart + "\\begin{document}".length);
  let body = tex.slice(head.length);
  if (!/^\s*\\pagestyle\{empty\}/.test(body))
    warnings.push({ rule: "pagestyle_missing", detail: "" });

  // --- allow-listed commands, environments ---
  for (const m of body.matchAll(/\\([A-Za-z]+)/g))
    if (!ALLOWED_COMMANDS.has(m[1])) errors.push(`disallowed_command:${m[1]}`);
  for (const m of body.matchAll(/\\([^A-Za-z])/g))
    if (!ALLOWED_SYMBOLS.has(m[1])) errors.push(`disallowed_symbol:${m[1]}`);
  const stack: string[] = [];
  for (const m of body.matchAll(/\\(begin|end)\{([^}]+)\}/g)) {
    if (!ALLOWED_ENVS.has(m[2]) && m[2] !== "document")
      errors.push(`disallowed_environment:${m[2]}`);
    // \begin{document} sits above; the ending check covers \end{document}.
    if (m[2] === "document") continue;
    if (m[1] === "begin") stack.push(m[2]);
    else if (stack.pop() !== m[2])
      errors.push(`unbalanced_environment:${m[2]}`);
  }
  if (stack.length) errors.push("unclosed_environment");
  for (const [start, end] of [
    ["resumeItemListStart", "resumeItemListEnd"],
    ["resumeSubHeadingListStart", "resumeSubHeadingListEnd"],
  ])
    if (body.split(`\\${start}`).length !== body.split(`\\${end}`).length)
      errors.push(`unbalanced_${start}`);
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\") i++;
    else if (body[i] === "{") depth++;
    else if (body[i] === "}" && --depth < 0) break;
  }
  if (depth !== 0) errors.push("unbalanced_braces");

  // --- links ---
  for (const m of body.matchAll(/\\href\{([^}]*)\}/g)) {
    const url = m[1];
    if (!/^(https:\/\/|mailto:)/.test(url)) errors.push("non_https_link");
    else if (
      !source.toLowerCase().includes(
        url
          .replace(/^mailto:/, "")
          .replace(/^https:\/\//, "")
          .replace(/\/$/, "")
          .toLowerCase(),
      )
    )
      errors.push("link_not_in_source");
  }

  // --- unescaped special characters (hrefs and $|$ excluded) ---
  const scrubbed = body
    .replace(/\\href\{[^}]*\}/g, "")
    .replace(/\$\|\$/g, "")
    .replace(/\\./g, "");
  const bad = scrubbed.match(/[&%#_^~]/);
  if (bad) errors.push(`unescaped_special_character:${bad[0]}`);

  // --- sections ---
  const sectionMatches = [...body.matchAll(/\\section\{([^}]+)\}/g)];
  const names = sectionMatches.map((m) => m[1]);
  const idx = names.map((n) => SECTIONS.indexOf(n));
  if (idx.some((i) => i < 0) || idx.some((v, i) => i > 0 && v <= idx[i - 1]))
    errors.push("sections_invalid_or_out_of_order");
  if (!names.some((n) => ["Experience", "Projects", "Education"].includes(n)))
    errors.push("insufficient_content");
  if (errors.length)
    return { ok: false, tex, errors: [...new Set(errors)], warnings };

  const sectionAt = (pos: number) => {
    let cur = "Header";
    for (const m of sectionMatches) if ((m.index ?? 0) < pos) cur = m[1];
    return cur;
  };

  // --- header facts ---
  const headerText = body.slice(0, sectionMatches[0]?.index ?? body.length);
  const name = headerText.match(/\\textbf\{([^}]*)\}/)?.[1];
  if (!name || !inSource(name)) errors.push("name_not_in_source");
  const email = headerText.match(/mailto:([^}]*)\}/)?.[1];
  if (email && !source.toLowerCase().includes(email.toLowerCase()))
    errors.push("email_not_in_source");
  const contact = headerText.split(/\\small/)[1] ?? "";
  const location = contact
    .split("$|$")[0]
    ?.replace(/\\href\{[^}]*\}\{[^}]*\}/g, "")
    .trim();
  if (
    location &&
    /[A-Za-z]/.test(location) &&
    !/\d{6,}/.test(location) &&
    !inSource(location)
  )
    errors.push("location_not_in_source");
  const phone = contact
    .split("$|$")
    .find((p) => /\d{6,}/.test(p.replace(/\D/g, "")) && !/@|href/.test(p));
  if (phone && !source.replace(/\D/g, "").includes(phone.replace(/\D/g, "")))
    errors.push("phone_not_in_source");

  // --- summary numbers ---
  const summary =
    body.match(
      /\\section\{Professional Summary\}([\s\S]*?)(?=\\section\{|$)/,
    )?.[1] ?? "";
  const years = [...source.matchAll(/\b(19|20)\d{2}\b/g)].map((m) =>
    Number(m[0]),
  );
  const maxYears = years.length
    ? new Date().getFullYear() - Math.min(...years) + 1
    : 0;
  for (const m of plain(summary).matchAll(/(\d[\d,.]*)(\+?\s*years?)?/gi)) {
    const n = m[1].replace(/[.,]+$/, "");
    const isYears = Boolean(m[2]);
    if (isYears ? Number(n) > maxYears : !source.includes(n))
      errors.push(`summary_number_not_in_source:${n}`);
  }

  // --- experience / education / project headings ---
  for (const m of body.matchAll(/\\resumeSubheading/g)) {
    const r = readArgs(body, (m.index ?? 0) + m[0].length, 4);
    if (!r) continue;
    const [a, dates, c] = r.args;
    const sec = sectionAt(m.index ?? 0);
    if (sec === "Experience") {
      if (!inSource(a)) errors.push(`company_not_in_source:${plain(a)}`);
      if (!inSource(c)) errors.push(`title_not_in_source:${plain(c)}`);
    } else if (sec === "Education") {
      if (!inSource(a)) errors.push(`institution_not_in_source:${plain(a)}`);
      for (const part of plain(c).split(/,| in /))
        if (!inSource(part)) errors.push(`degree_not_in_source:${part.trim()}`);
    }
    for (const t of plain(dates)
      .split(/[\s-]+/)
      .filter(Boolean))
      if (!/^present$/i.test(t) && !inSource(t))
        errors.push(`date_not_in_source:${t}`);
  }
  for (const m of body.matchAll(/\\resumeProjectHeading/g)) {
    const r = readArgs(body, (m.index ?? 0) + m[0].length, 2);
    const projectName = r && plain(r.args[0].split("$|$")[0]);
    if (projectName && !inSource(projectName))
      errors.push(`project_not_in_source:${projectName}`);
  }

  // --- sanitize: drop unsupported bullets ---
  const removals: [number, number][] = [];
  for (const m of body.matchAll(/\\resumeItem(?![A-Za-z])/g)) {
    const r = readArgs(body, (m.index ?? 0) + m[0].length, 1);
    if (!r) continue;
    const unsupported = numbersIn(r.args[0]).find((n) => !source.includes(n));
    if (unsupported) {
      warnings.push({
        rule: "metric_not_in_source",
        detail: `${unsupported} in "${plain(r.args[0]).slice(0, 90)}"`,
      });
      removals.push([m.index ?? 0, r.end]);
    }
  }
  for (const [s, e] of removals.reverse())
    body = body.slice(0, s) + body.slice(e);

  // --- sanitize: skills and certifications ---
  body = body.replace(
    /(\\section\{Technical Skills\})([\s\S]*?)(?=\\section\{|$)/,
    (_, h: string, sec: string) => {
      const lines = sec.split("\n").flatMap((line) => {
        const m = line.match(/^(\s*\\item\s*\\textbf\{[^}]*\})\s*(.*)$/);
        if (!m) return [line];
        const kept = m[2]
          .split(",")
          .map((s) => s.trim())
          .filter((s) => {
            const base = plain(s).replace(/\(.*?\)/g, "");
            const ok = !plain(s) || inSource(s) || inSource(base);
            if (!ok)
              warnings.push({ rule: "skill_not_in_source", detail: plain(s) });
            return ok;
          });
        return kept.length ? [`${m[1]} ${kept.join(", ")}`] : [];
      });
      return h + lines.join("\n");
    },
  );
  body = body.replace(
    /(\\section\{Certifications\})([\s\S]*?)(?=\\section\{|$)/,
    (_, h: string, sec: string) => {
      const lines = sec.split("\n").filter((line) => {
        const m = line.match(/^\s*\\item\s+(.*?)(?:\s---|\s\()/);
        if (!m || inSource(m[1])) return true;
        warnings.push({
          rule: "certification_not_in_source",
          detail: plain(m[1]),
        });
        return false;
      });
      return h + lines.join("\n");
    },
  );

  tex = head + body;
  if (!tex.endsWith("\\end{document}"))
    errors.push("must_end_with_end_document");
  return {
    ok: errors.length === 0,
    tex,
    errors: [...new Set(errors)],
    warnings,
  };
}
