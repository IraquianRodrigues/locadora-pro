import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFString } from "pdf-lib";
vi.mock("server-only", () => ({}));
import { prepareFile } from "@/lib/registry/file-content";
import { maxFileBytes, fileAllowed } from "@/lib/registry/file-schema";

describe("arquivos dos cadastros", () => {
  it("decodifica PNG e entrega JPEG sem EXIF e sem confiar no nome original", async () => {
    const png = await sharp({
      create: { width: 20, height: 10, channels: 3, background: "#123456" },
    })
      .png()
      .withExif({ IFD0: { Artist: "Autor de teste" } })
      .toBuffer();
    const result = await prepareFile(
      new File([Uint8Array.from(png)], "foto.png", { type: "image/png" }),
      false,
    );
    const metadata = await sharp(result.body).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.exif).toBeUndefined();
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.extension).toBe("jpg");
  });
  it("HTML/SVG disfarçado, extensão/MIME divergentes e imagem truncada são recusados", async () => {
    for (const [body, name, type] of [
      ["<html>texto</html>", "a.jpg", "image/jpeg"],
      ["<svg></svg>", "a.svg", "image/svg+xml"],
      ["abc", "a.png", "image/png"],
    ])
      await expect(
        prepareFile(new File([body], name, { type }), false),
      ).rejects.toMatchObject({ code: "INVALID_FILE" });
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    await expect(
      prepareFile(
        new File([Uint8Array.from(png)], "foto.jpg", { type: "image/jpeg" }),
        false,
      ),
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
  });
  it("limite é verificado antes de processar os bytes", async () => {
    await expect(
      prepareFile(
        new File([new Uint8Array(maxFileBytes + 1)], "a.jpg", {
          type: "image/jpeg",
        }),
        false,
      ),
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(
      prepareFile(new File([], "a.jpg", { type: "image/jpeg" }), false),
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
  });
  it("PDF tem assinatura/final validados, fica restrito a documentos e recusa conteúdo ativo", async () => {
    const document = await PDFDocument.create();
    document.addPage();
    const pdf = new File(
      [Uint8Array.from(await document.save())],
      "documento.pdf",
      { type: "application/pdf" },
    );
    expect((await prepareFile(pdf, true)).mediaType).toBe("application/pdf");
    await expect(prepareFile(pdf, false)).rejects.toMatchObject({
      code: "INVALID_FILE",
    });
    await expect(
      prepareFile(
        new File(["%PDF-1.7\n/JavaScript\n%%EOF"], "a.pdf", {
          type: "application/pdf",
        }),
        true,
      ),
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
    await expect(
      prepareFile(
        new File(["%PDF-1.7 truncado"], "a.pdf", { type: "application/pdf" }),
        true,
      ),
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
  });
  it("PDF malformado e ações em objetos comprimidos ou nomes escapados são recusados", async () => {
    await expect(
      prepareFile(
        new File(["%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n"], "a.pdf", {
          type: "application/pdf",
        }),
        true,
      ),
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
    const document = await PDFDocument.create();
    document.addPage();
    const action = document.context.obj({
      S: PDFName.of("JavaScript"),
      JS: PDFString.of("test()"),
    });
    document.catalog.set(
      PDFName.of("OpenAction"),
      document.context.register(action),
    );
    // A ação está em ObjStm, sem o nome JavaScript visível em texto claro.
    const compressed = await document.save({ useObjectStreams: true });
    await expect(
      prepareFile(
        new File([Uint8Array.from(compressed)], "a.pdf", {
          type: "application/pdf",
        }),
        true,
      ),
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
    const plain = Buffer.from(await document.save({ useObjectStreams: false }))
      .toString("latin1")
      .replaceAll("/JavaScript", "/Java#53cript")
      .replaceAll("/OpenAction", "/Open#41ction");
    await expect(
      prepareFile(
        new File([Uint8Array.from(Buffer.from(plain, "latin1"))], "a.pdf", {
          type: "application/pdf",
        }),
        true,
      ),
    ).rejects.toMatchObject({ code: "INVALID_FILE" });
  });
  it("permissão de leitura não concede upload; financeiro não recebe documentos", () => {
    expect(fileAllowed("CATEGORY_IMAGE", ["categories.read"])).toBe(true);
    expect(fileAllowed("CATEGORY_IMAGE", ["categories.read"], true)).toBe(
      false,
    );
    expect(fileAllowed("CUSTOMER_DOCUMENT", ["finance.read"])).toBe(false);
    expect(fileAllowed("CUSTOMER_DOCUMENT", ["documents.read"])).toBe(false);
    expect(
      fileAllowed("DRIVER_DOCUMENT", ["drivers.read", "documents.write"], true),
    ).toBe(true);
  });
});
