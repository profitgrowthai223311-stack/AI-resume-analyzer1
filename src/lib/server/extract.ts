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

export async function extractFromFile(type: "pdf" | "docx", data: Uint8Array) {
  let text: string;
  if (type === "pdf") {
    const pdf = await getDocumentProxy(data);
    const result = await extractText(pdf, { mergePages: true });
    text = result.text;
  } else {
    const result = await mammoth.extractRawText({ buffer: Buffer.from(data) });
    text = result.value;
  }
  text = normalizeText(text);

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
