import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

export const PARSER_NAME = "unpdf+mammoth";
export const PARSER_VERSION = "1";

export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/[ \t ]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Cleans a raw link target pulled from a PDF/DOCX. PDF annotations sometimes carry a doubled
 * "mailto::" scheme; both formats trim whitespace and drop anything that isn't a real link.
 */
function normalizeLink(url: string): string | null {
  const cleaned = url.trim().replace(/^mailto:+/i, "mailto:");
  if (/^(https?:\/\/|mailto:)\S+$/i.test(cleaned)) return cleaned;
  return null;
}

/**
 * PDF/DOCX resume templates very commonly render social/portfolio links as an icon or a bare
 * username, with the actual URL living only in a hyperlink annotation — invisible to plain-text
 * extraction. Recovering these is important: without them, the model has no way to know the real
 * GitHub/LinkedIn/etc. URL and may (truthfully, but incorrectly) guess one from a visible username,
 * which can produce a wrong link even when it isn't fabricating anything conceptually.
 */
async function extractPdfLinks(
  pdf: Awaited<ReturnType<typeof getDocumentProxy>>,
): Promise<string[]> {
  const found = new Set<string>();
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const annotations = await page.getAnnotations();
    for (const a of annotations) {
      if (a.subtype !== "Link" || !a.url) continue;
      const link = normalizeLink(a.url);
      if (link) found.add(link);
    }
  }
  return [...found];
}

/** Same recovery for DOCX: extractRawText() drops formatting (including hyperlinks) entirely. */
async function extractDocxLinks(buffer: Buffer): Promise<string[]> {
  const { value: html } = await mammoth.convertToHtml({ buffer });
  const found = new Set<string>();
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const link = normalizeLink(m[1].replace(/&amp;/g, "&"));
    if (link) found.add(link);
  }
  return [...found];
}

export async function extractFromFile(type: "pdf" | "docx", data: Uint8Array) {
  let text: string;
  let links: string[];
  if (type === "pdf") {
    const pdf = await getDocumentProxy(data);
    const result = await extractText(pdf, { mergePages: true });
    text = result.text;
    links = await extractPdfLinks(pdf);
  } else {
    const buffer = Buffer.from(data);
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
    links = await extractDocxLinks(buffer);
  }
  text = normalizeText(text);
  // Appended so the review screen shows them and they become part of the truthfulness source of
  // record (the LaTeX generator and its fact-checker both work from this same text).
  if (links.length) text += `\n\nLinks found in document:\n${links.join("\n")}`;

  const warnings: string[] = [];
  if (text.length < 200) {
    warnings.push(
      "Very little text was found. The file may be a scan or image; paste your resume text instead.",
    );
  }
  return { text, warnings, structured: splitSections(text) };
}

const SECTION_HEADINGS: Record<string, RegExp> = {
  summary: /^(professional )?(summary|profile|objective)$/i,
  experience: /^(work |professional )?(experience|employment( history)?)$/i,
  education: /^education( and training)?$/i,
  skills: /^(technical )?skills( & tools)?$/i,
  projects: /^(personal |academic )?projects$/i,
  certifications: /^(certifications?|licenses?( & certifications?)?)$/i,
};

/** Best-effort section split; the user-approved plain text stays the source of truth. */
export function splitSections(text: string) {
  const sections: Record<string, string> = {};
  let current = "header";
  const buf: Record<string, string[]> = { header: [] };
  for (const line of text.split("\n")) {
    const trimmed = line.trim().replace(/[:\s]+$/, "");
    const hit = Object.entries(SECTION_HEADINGS).find(
      ([, re]) => trimmed.length < 40 && re.test(trimmed),
    );
    if (hit) {
      current = hit[0];
      buf[current] ??= [];
    } else {
      buf[current].push(line);
    }
  }
  for (const [k, v] of Object.entries(buf)) {
    const s = v.join("\n").trim();
    if (s) sections[k] = s;
  }
  return { sections };
}
