import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { databaseError } from "@/lib/registry/service";
import { renderContractPdf } from "./contract-pdf";
const jobsSchema = z.array(
  z.object({
    id: z.uuid(),
    rental_id: z.uuid(),
    lease_token: z.uuid(),
    version: z.number().int().positive(),
    snapshot: z.unknown(),
    created_at: z.string(),
  }),
);
export async function processRentalJobs(batch = 3) {
  const admin = createAdminClient();
  const marked = await admin.rpc("mark_overdue_rentals", { batch_size: 100 });
  if (marked.error) databaseError(marked.error);
  const claimed = await admin.rpc("claim_contract_jobs", { batch_size: batch });
  if (claimed.error) databaseError(claimed.error);
  const jobs = jobsSchema.parse(claimed.data);
  let generated = 0,
    failed = 0;
  for (const job of jobs) {
    const path = `${job.rental_id}/${job.lease_token}.pdf`;
    let uploaded = false;
    try {
      const body = await renderContractPdf(
        job.snapshot,
        job.version,
        job.created_at,
      );
      if (body.length > 10 * 1024 * 1024) throw new Error("PDF_TOO_LARGE");
      const upload = await admin.storage.from("contracts").upload(path, body, {
        contentType: "application/pdf",
        cacheControl: "0",
        upsert: false,
      });
      if (upload.error) throw new Error("UPLOAD_FAILED");
      uploaded = true;
      const finish = await admin.rpc("finish_contract_job", {
        contract_id: job.id,
        lease: job.lease_token,
        path,
        file_hash: createHash("sha256").update(body).digest("hex"),
      });
      if (finish.error) throw new Error("FINALIZE_UNCERTAIN");
      if (!finish.data) throw new Error("LEASE_NOT_ACTIVE");
      generated++;
    } catch {
      // Antes de remover, resolve confirmação ambígua: nunca apagar um PDF já publicado.
      const current = await admin
        .from("contracts")
        .select("generation_status,storage_path")
        .eq("id", job.id)
        .maybeSingle();
      if (current.error) {
        failed++;
        continue;
      } // lease expira; reconciliador verifica o objeto.
      if (current.data?.generation_status === "GENERATED") {
        if (uploaded && current.data.storage_path !== path)
          await admin.storage.from("contracts").remove([path]);
        generated++;
        continue;
      }
      if (uploaded) await admin.storage.from("contracts").remove([path]);
      await admin.rpc("finish_contract_job", {
        contract_id: job.id,
        lease: job.lease_token,
        path: null,
        file_hash: null,
      });
      failed++;
    }
  }
  return {
    generated,
    failed,
    overdue: Number(marked.data),
    processed: jobs.length,
  };
}
