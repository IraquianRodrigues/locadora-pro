import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { maxFileBytes } from "./file-schema";
import { RegistryError } from "./service";
import { validatePassivePdf } from "./pdf-validation";

export async function prepareFile(file: File, document: boolean) {
  if (file.size < 1 || file.size > maxFileBytes)
    throw new RegistryError(
      400,
      "INVALID_FILE",
      "O arquivo deve ter entre 1 byte e 4 MiB.",
    );
  const raw = Buffer.from(await file.arrayBuffer());
  let body = raw,
    mediaType: "image/jpeg" | "application/pdf" = "image/jpeg",
    extension = "jpg";
  if (raw.subarray(0, 5).toString("ascii") === "%PDF-") {
    if (
      !document ||
      file.type !== "application/pdf" ||
      !/\.pdf$/i.test(file.name) ||
      !/^%PDF-(1\.[0-7]|2\.0)/.test(raw.subarray(0, 9).toString("ascii")) ||
      !raw.subarray(-1024).toString("latin1").trimEnd().endsWith("%%EOF")
    )
      throw new RegistryError(
        400,
        "INVALID_FILE",
        "PDF inválido ou não permitido neste campo.",
      );
    // Barreiras básicas; não substituem antivírus. PDFs só são entregues como download.
    if (
      /\/(JavaScript|JS|Launch|OpenAction|AA|EmbeddedFile|RichMedia|XFA|Encrypt)\b/i.test(
        raw.toString("latin1"),
      )
    )
      throw new RegistryError(
        400,
        "INVALID_FILE",
        "PDF com conteúdo ativo, incorporado ou criptografado não é aceito.",
      );
    try {
      await validatePassivePdf(raw);
    } catch {
      throw new RegistryError(
        400,
        "INVALID_FILE",
        "PDF inválido, ativo, protegido ou acima do limite de 100 páginas. Use uma cópia simples do documento.",
      );
    }
    mediaType = "application/pdf";
    extension = "pdf";
  } else {
    const detected = raw.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      ? "image/jpeg"
      : raw
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "image/png"
        : raw.subarray(0, 4).toString() === "RIFF" &&
            raw.subarray(8, 12).toString() === "WEBP"
          ? "image/webp"
          : null;
    const expected = /\.jpe?g$/i.test(file.name)
      ? "image/jpeg"
      : /\.png$/i.test(file.name)
        ? "image/png"
        : /\.webp$/i.test(file.name)
          ? "image/webp"
          : null;
    if (!detected || file.type !== detected || expected !== detected)
      throw new RegistryError(
        400,
        "INVALID_FILE",
        "Use JPEG, PNG ou WebP com conteúdo e extensão correspondentes.",
      );
    try {
      const image = sharp(raw, {
        limitInputPixels: 20000000,
        failOn: "warning",
      });
      const metadata = await image.metadata();
      if ((metadata.pages ?? 1) > 1) throw new Error("ANIMATION");
      body = await image
        .rotate()
        .resize({
          width: 2560,
          height: 2560,
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 90 })
        .timeout({ seconds: 5 })
        .toBuffer();
    } catch {
      throw new RegistryError(
        400,
        "INVALID_FILE",
        "Imagem inválida, animada ou com dimensões excessivas.",
      );
    }
  }
  if (body.length > maxFileBytes)
    throw new RegistryError(
      400,
      "INVALID_FILE",
      "O arquivo processado excede 4 MiB.",
    );
  return {
    body,
    mediaType,
    extension,
    size: body.length,
    sha256: createHash("sha256").update(body).digest("hex"),
  };
}
