import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { PDFDocument, rgb, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { z } from "zod";

const object = z.record(z.string(), z.unknown());
const schema = z.object({
  schema_version: z.literal(1),
  rental_id: z.uuid(),
  start_at: z.string(),
  end_at: z.string(),
  company: z.object({
    legal_name: z.string(),
    tax_document: z.string(),
    contact: object,
    timezone: z.string(),
  }),
  customer: z.object({
    name: z.string(),
    tax_document: z.string(),
    email: z.string(),
    phone: z.string(),
    address: object,
  }),
  vehicle: z.object({
    plate: z.string(),
    make: z.string(),
    model: z.string(),
    model_year: z.number(),
  }),
  branch: z.object({ name: z.string(), address: object }),
  commercial: object,
  drivers: z.array(object),
  locations: z.array(object),
  initial_inspection: object,
  template: z.object({
    id: z.uuid(),
    key: z.string(),
    version: z.number(),
    body: z.string().min(30).max(40000),
    review_status: z.literal("APPROVED"),
  }),
});
function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
function money(v: unknown) {
  const n = typeof v === "number" ? v.toFixed(2) : String(v);
  if (!/^-?\d+\.\d{2}$/.test(n)) throw new Error("INVALID_MONEY");
  const [a, b] = n.split(".");
  return `R$ ${a.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${b}`;
}
function address(v: unknown) {
  const a = record(v);
  return [
    a.street,
    a.number,
    a.complement,
    a.district,
    a.city,
    a.state,
    a.postal_code,
  ]
    .filter(Boolean)
    .join(" · ");
}
export async function renderContractPdf(
  raw: unknown,
  version: number,
  createdAt: string,
) {
  const s = schema.parse(raw),
    pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(
    await readFile(join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf")),
    { subset: true },
  );
  const supported = new Set(font.getCharacterSet());
  const text = (v: unknown) => {
    const value = String(v ?? "")
      .normalize("NFC")
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, "    ");
    if ([...value].some((c) => c !== "\n" && !supported.has(c.codePointAt(0)!)))
      throw new Error("UNSUPPORTED_PDF_CHARACTER");
    return value;
  };
  const hash = createHash("sha256").update(JSON.stringify(raw)).digest("hex");
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) throw new Error("INVALID_DATE");
  pdf.setTitle(`Contrato de locação ${s.rental_id} - versão ${version}`);
  pdf.setAuthor(s.branch.name);
  pdf.setProducer("Locadora Pro / pdf-lib");
  pdf.setCreationDate(created);
  pdf.setModificationDate(created);
  let page!: PDFPage;
  let y = 0;
  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    y = 746;
    page.drawRectangle({
      x: 0,
      y: 784,
      width: 595.28,
      height: 58,
      color: rgb(0.06, 0.16, 0.22),
    });
    page.drawText("CONTRATO DE LOCAÇÃO", {
      x: 44,
      y: 811,
      font,
      size: 15,
      color: rgb(1, 1, 1),
    });
    page.drawText(`Versão ${version}  |  ${s.rental_id}`, {
      x: 44,
      y: 794,
      font,
      size: 8,
      color: rgb(0.85, 0.92, 0.95),
    });
  };
  const room = (height: number) => {
    if (y - height < 63) newPage();
  };
  const wrap = (value: unknown, size = 10, width = 507) => {
    const lines: string[] = [];
    for (const paragraph of text(value).split("\n")) {
      if (!paragraph) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const word of paragraph.split(/ +/)) {
        if (font.widthOfTextAtSize(word, size) > width) {
          if (line) {
            lines.push(line);
          }
          let piece = "";
          for (const c of word) {
            if (font.widthOfTextAtSize(piece + c, size) > width) {
              lines.push(piece);
              piece = "";
            }
            piece += c;
          }
          line = piece;
        } else if (
          line &&
          font.widthOfTextAtSize(`${line} ${word}`, size) > width
        ) {
          lines.push(line);
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      if (line) lines.push(line);
    }
    return lines;
  };
  const paragraph = (value: unknown, size = 10) => {
    for (const line of wrap(value, size)) {
      room(size + 5);
      page.drawText(line, {
        x: 44,
        y,
        font,
        size,
        color: rgb(0.12, 0.18, 0.22),
      });
      y -= size + 5;
    }
    y -= 5;
  };
  const heading = (label: string) => {
    room(58);
    y -= 9;
    page.drawRectangle({
      x: 44,
      y: y - 5,
      width: 507,
      height: 23,
      color: rgb(0.91, 0.95, 0.96),
    });
    page.drawText(label, {
      x: 51,
      y: y + 2,
      font,
      size: 11,
      color: rgb(0.06, 0.26, 0.33),
    });
    y -= 28;
  };
  const date = (v: unknown) =>
    new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: String(
        record(record(s.commercial.quote).policy).timezone ??
          "America/Fortaleza",
      ),
    }).format(new Date(String(v)));
  newPage();
  paragraph(
    `${s.branch.name} · Modelo ${s.template.key}, versão ${s.template.version}`,
    11,
  );
  paragraph(
    `Período previsto: ${date(s.start_at)} a ${date(s.end_at)}. Horários no fuso da política comercial.`,
  );
  heading("1. Partes e veículo");
  paragraph(
    `Locadora: ${s.company.legal_name} | CNPJ: ${s.company.tax_document}`,
  );
  paragraph(
    `Contato da locadora: ${s.company.contact.email} | ${s.company.contact.phone}`,
  );
  paragraph(`Endereço da locadora: ${address(s.company.contact.address)}`);
  paragraph(
    `Cliente: ${s.customer.name} | CPF/CNPJ: ${s.customer.tax_document}`,
  );
  paragraph(`Contato: ${s.customer.email} | ${s.customer.phone}`);
  paragraph(`Endereço do cliente: ${address(s.customer.address)}`);
  paragraph(`Unidade: ${s.branch.name} | ${address(s.branch.address)}`);
  paragraph(
    `Veículo: ${s.vehicle.make} ${s.vehicle.model}, ano ${s.vehicle.model_year} | Placa: ${s.vehicle.plate}`,
  );
  heading("2. Condutores autorizados");
  for (const d of s.drivers)
    paragraph(
      `${d.name} | CPF: ${d.cpf} | CNH: ${d.license_number} | Categoria: ${d.license_category} | Validade: ${d.license_expires_on}`,
    );
  heading("3. Condições comerciais e logística");
  const calculation = record(record(s.commercial.quote).calculation);
  for (const line of Array.isArray(calculation.lines)
    ? calculation.lines
    : []) {
    const l = record(line);
    paragraph(
      `${l.kind === "DISCOUNT" ? "Dedução · " : ""}${l.description}: ${l.quantity} × ${money(l.unit_amount)} = ${money(l.total)}`,
    );
  }
  paragraph(
    `Total da contratação original: ${money(s.commercial.total)}. Caução prevista, separada da receita: ${money(s.commercial.deposit)}.`,
  );
  const extensions = Array.isArray(s.commercial.extensions)
    ? s.commercial.extensions
    : [];
  for (const extension of extensions) {
    const e = record(extension);
    paragraph(
      `Aditivo de prorrogação · cotação ${e.quote_id}: ${money(e.total)}.`,
    );
    if (e.previous_end_at && e.end_at)
      paragraph(
        `Período adicional: ${date(e.previous_end_at)} a ${date(e.end_at)}.`,
      );
    const extra = record(record(e.quote).calculation);
    for (const line of Array.isArray(extra.lines) ? extra.lines : []) {
      const l = record(line);
      paragraph(
        `${l.kind === "DISCOUNT" ? "Dedução · " : ""}${l.description}: ${l.quantity} × ${money(l.unit_amount)} = ${money(l.total)}`,
      );
    }
  }
  for (const l of s.locations) {
    paragraph(
      `${l.direction === "PICKUP" ? "Retirada" : "Devolução"}: ${l.mode === "BRANCH" ? "na unidade" : l.mode === "DELIVERY" ? "entrega" : "coleta"} | ${date(l.scheduled_at)} | ${money(l.fee)}`,
    );
    paragraph(address(l.address));
    if (l.instructions) paragraph(`Instruções: ${l.instructions}`);
  }
  const ops = record(s.commercial.operations),
    policy = record(record(s.commercial.quote).policy);
  paragraph(
    `Intervalo de preparação após o fim: ${policy.turnaround_minutes} minutos. Tolerância comercial: ${policy.tolerance_minutes} minutos.`,
  );
  paragraph(
    `Quilometragem incluída por dia de 24h (arredondado para cima): ${ops.included_km_per_day} km. Km excedente: ${money(ops.extra_km_amount)}. Reposição por ponto percentual de combustível: ${money(ops.fuel_percent_amount)}.`,
  );
  paragraph(
    `Atraso: tolerância de ${ops.late_tolerance_minutes} minutos; após a tolerância, ${money(ops.late_hour_amount)} por hora iniciada excedente. Valores zero significam ausência dessa cobrança.`,
  );
  paragraph(
    `Retirada: ${ops.checkout_payment === "FULL" ? "recebimento integral confirmado exigido" : "recebimento prévio dispensado por política"}; caução ${ops.require_deposit ? "confirmada exigida" : "prévia dispensada"}. Devolução: ${ops.checkin_balance === "SETTLED" ? "saldo liquidado exigido" : "saldo em aberto permitido"}. Danos exigem avaliação separada; nenhuma multa de dano é calculada automaticamente.`,
  );
  room(120);
  heading("4. Vistoria inicial");
  paragraph(
    `Vistoria ${s.initial_inspection.id} | ${s.initial_inspection.mileage} km | Combustível ${s.initial_inspection.fuel}% | Concluída em ${date(s.initial_inspection.completed_at)}`,
  );
  for (const rawItem of Array.isArray(s.initial_inspection.items)
    ? s.initial_inspection.items
    : []) {
    const item = record(rawItem);
    paragraph(
      `${item.key}: ${item.condition}${item.notes ? ` · ${item.notes}` : ""}`,
    );
  }
  heading("5. Cláusulas do modelo aprovado");
  paragraph(s.template.body);
  heading("6. Ciência e assinaturas");
  paragraph(
    "Este PDF registra as condições e evidências congeladas na emissão. A geração do documento não comprova assinatura ou recebimento de pagamento. Assinatura eletrônica não faz parte deste fluxo.",
  );
  room(85);
  y -= 25;
  for (const [x, label] of [
    [44, "Locadora"],
    [320, "Cliente / representante"],
  ] as const) {
    page.drawLine({
      start: { x, y },
      end: { x: x + 225, y },
      thickness: 0.6,
      color: rgb(0.25, 0.3, 0.35),
    });
    page.drawText(label, { x, y: y - 18, font, size: 10 });
  }
  for (const [index, p] of pdf.getPages().entries()) {
    p.drawLine({
      start: { x: 44, y: 47 },
      end: { x: 551, y: 47 },
      thickness: 0.5,
      color: rgb(0.7, 0.77, 0.8),
    });
    p.drawText(`Locação ${s.rental_id} | ${index + 1}/${pdf.getPageCount()}`, {
      x: 44,
      y: 33,
      font,
      size: 7,
      color: rgb(0.35, 0.4, 0.45),
    });
    p.drawText(`Snapshot SHA-256: ${hash}`, {
      x: 44,
      y: 20,
      font,
      size: 6,
      color: rgb(0.35, 0.4, 0.45),
    });
  }
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
