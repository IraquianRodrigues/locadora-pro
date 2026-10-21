import { NextResponse, type NextRequest } from "next/server";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { readJson } from "@/lib/registry/api";
import { quotePublic } from "@/lib/public/service";
import { publicFailure, publicHeaders } from "@/lib/public/api";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    await assertMutationOrigin();
    return NextResponse.json(
      { data: await quotePublic(await readJson(request)) },
      { status: 201, headers: publicHeaders },
    );
  } catch (error) {
    return publicFailure(error);
  }
}
