import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export function hashUploadArtifact(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function writeUploadArtifact(fileName: string, buffer: Buffer): Promise<string> {
  const dir = path.join(tmpdir(), "careeros-application-execution");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, buffer);
  return filePath;
}

function pdfEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function renderPlainTextPdf(title: string, lines: string[]): Buffer {
  const contentLines = [`(${pdfEscape(title)}) Tj`, "0 -16 Td"];
  for (const line of lines.slice(0, 80)) {
    contentLines.push(`(${pdfEscape(line.slice(0, 110))}) Tj`, "0 -14 Td");
  }
  const stream = `BT /F1 12 Tf 48 760 Td ${contentLines.join(" ")} ET`;
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj",
    `4 0 obj << /Length ${Buffer.byteLength(stream)} >> stream\n${stream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];
  let offset = 0;
  const header = "%PDF-1.4\n";
  const offsets = [0];
  let body = header;
  offset = Buffer.byteLength(header);
  for (const object of objects) {
    offsets.push(offset);
    const chunk = `${object}\n`;
    body += chunk;
    offset += Buffer.byteLength(chunk);
  }
  const xrefPos = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i += 1) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;
  return Buffer.from(body + xref + trailer);
}
