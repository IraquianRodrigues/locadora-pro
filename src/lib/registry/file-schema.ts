import { z } from "zod";
export const fileKindSchema = z.enum([
  "CATEGORY_IMAGE",
  "VEHICLE_IMAGE",
  "VEHICLE_DOCUMENT",
  "CUSTOMER_DOCUMENT",
  "DRIVER_DOCUMENT",
]);
export type FileKind = z.infer<typeof fileKindSchema>;
export const fileRules = {
  CATEGORY_IMAGE: {
    resource: "categorias",
    owner: "category_id",
    bucket: "vehicle-images",
    read: ["categories.read"],
    write: ["categories.write"],
    title: "Imagem da categoria",
  },
  VEHICLE_IMAGE: {
    resource: "frota",
    owner: "vehicle_id",
    bucket: "vehicle-images",
    read: ["vehicles.read"],
    write: ["vehicles.write"],
    title: "Foto do veículo",
  },
  VEHICLE_DOCUMENT: {
    resource: "frota",
    owner: "vehicle_id",
    bucket: "documents",
    read: ["vehicles.read", "documents.read"],
    write: ["vehicles.read", "documents.write"],
    title: "Documento do veículo",
  },
  CUSTOMER_DOCUMENT: {
    resource: "clientes",
    owner: "customer_id",
    bucket: "documents",
    read: ["customers.read", "documents.read"],
    write: ["customers.read", "documents.write"],
    title: "Documento do cliente",
  },
  DRIVER_DOCUMENT: {
    resource: "condutores",
    owner: "driver_id",
    bucket: "documents",
    read: ["drivers.read", "documents.read"],
    write: ["drivers.read", "documents.write"],
    title: "CNH do condutor",
  },
} as const;
export function fileAllowed(
  kind: FileKind,
  permissions: string[],
  writing = false,
) {
  return fileRules[kind][writing ? "write" : "read"].every((p) =>
    permissions.includes(p),
  );
}
export const maxFileBytes = 4 * 1024 * 1024;
export const fileRowSchema = z.object({
  id: z.uuid(),
  kind: fileKindSchema,
  label: z.string(),
  status: z.enum(["PENDING", "READY", "FAILED", "ARCHIVED"]),
  media_type: z.enum(["image/jpeg", "application/pdf"]),
  byte_size: z.number(),
  created_at: z.string(),
  bucket: z.enum(["vehicle-images", "documents"]),
  storage_path: z.string(),
  public_visible: z.boolean().default(false),
});
export type RegistryFile = z.infer<typeof fileRowSchema>;
