export const ALLOWED_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;
export type ResumeFileType = keyof typeof ALLOWED_TYPES;

export const MAX_UPLOAD_MB = Number(
  process.env.NEXT_PUBLIC_MAX_UPLOAD_MB ?? 10,
);
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

export type ValidationResult =
  | { ok: true; type: ResumeFileType; displayName: string }
  | { ok: false; error: string };

/** Validates extension, size and magic bytes (PDF: "%PDF-", DOCX: ZIP "PK\x03\x04"). */
export async function validateResumeFile(
  file: File,
): Promise<ValidationResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext !== "pdf" && ext !== "docx") {
    return { ok: false, error: "Only PDF and DOCX files are supported." };
  }
  if (file.size === 0) return { ok: false, error: "This file is empty." };
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `File is too large. The limit is ${MAX_UPLOAD_MB} MB.`,
    };
  }

  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const startsWith = (sig: number[]) => sig.every((b, i) => head[i] === b);
  const looksRight =
    ext === "pdf"
      ? startsWith([0x25, 0x50, 0x44, 0x46, 0x2d])
      : startsWith([0x50, 0x4b, 0x03, 0x04]);
  if (!looksRight) {
    return {
      ok: false,
      error:
        "This file looks corrupt or is not a real " + ext.toUpperCase() + ".",
    };
  }

  const displayName =
    file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^\p{L}\p{N} _.\-()]/gu, "")
      .trim()
      .slice(0, 100) || "Untitled resume";
  return { ok: true, type: ext, displayName };
}
