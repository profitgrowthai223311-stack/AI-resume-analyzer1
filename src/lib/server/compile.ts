import "server-only";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

export class CompileError extends Error {
  constructor(
    public code: "compiler_error" | "compiler_unavailable" | "invalid_pdf",
    public safeMessage: string,
  ) {
    super(code);
  }
}

/** Submits resume.tex to the external pdflatex service (multipart) and validates the PDF. */
export async function compilePdf(tex: string): Promise<Uint8Array> {
  const form = new FormData();
  form.append("compiler", "pdflatex");
  form.append(
    "resources",
    new Blob([new TextEncoder().encode(tex)], { type: "application/x-tex" }),
    "resume.tex",
  );

  let res: Response;
  try {
    res = await fetch(
      process.env.LATEX_COMPILER_URL || "https://latex.ytotech.com/builds/sync",
      {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(60_000),
      },
    );
  } catch {
    throw new CompileError(
      "compiler_unavailable",
      "The PDF compiler is unavailable. Please try again.",
    );
  }

  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("application/pdf")) {
    // Raw compiler output can echo document content; keep it out of user-facing messages.
    throw new CompileError(
      "compiler_error",
      "The resume could not be compiled to PDF.",
    );
  }
  const pdf = new Uint8Array(await res.arrayBuffer());
  const sig = String.fromCharCode(...pdf.slice(0, 5));
  if (sig !== "%PDF-" || pdf.length < 1000 || pdf.length > MAX_PDF_BYTES) {
    throw new CompileError(
      "invalid_pdf",
      "The compiler returned an invalid PDF.",
    );
  }
  return pdf;
}
