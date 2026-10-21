import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiFailure, apiResource, readJson } from "@/lib/registry/api";
import { archiveRecord, getRecord, saveRecord } from "@/lib/registry/service";
import { revisionSchema } from "@/lib/registry/schema";
import { assertMutationOrigin } from "@/lib/registry/origin";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ resource: string; id: string }> };
export async function GET(_request: NextRequest, context: Context) {
  try {
    const { resource, id } = await context.params;
    return NextResponse.json(
      { data: await getRecord(apiResource(resource), id) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
export async function PATCH(request: NextRequest, context: Context) {
  try {
    await assertMutationOrigin();
    const { resource, id } = await context.params;
    const kind = apiResource(resource);
    const body = z
      .object({
        revision: revisionSchema,
        values: z.unknown().optional(),
        restore: z.literal(true).optional(),
      })
      .strict()
      .refine(
        (value) =>
          value.restore
            ? value.values === undefined
            : value.values !== undefined,
        "Informe values ou restore, exclusivamente.",
      )
      .parse(await readJson(request));
    const result = body.restore
      ? await archiveRecord(kind, id, body.revision, false)
      : await saveRecord(kind, body.values, id, body.revision);
    return NextResponse.json(
      { data: result },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
export async function DELETE(request: NextRequest, context: Context) {
  try {
    await assertMutationOrigin();
    const { resource, id } = await context.params;
    const body = z
      .object({ revision: revisionSchema })
      .strict()
      .parse(await readJson(request));
    return NextResponse.json(
      {
        data: await archiveRecord(
          apiResource(resource),
          id,
          body.revision,
          true,
        ),
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return apiFailure(error);
  }
}
