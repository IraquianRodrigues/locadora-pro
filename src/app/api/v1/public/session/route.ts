import { NextResponse, type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { assertMutationOrigin } from "@/lib/registry/origin";
import { apiFailure, readJson } from "@/lib/registry/api";
import { z } from "zod";
import { authConfig } from "@/lib/auth/config";
import { getSite, bookingOptions } from "@/lib/public/catalog";
import { turnstileConfig } from "@/lib/public/antispam";
import { publicLimit } from "@/lib/public/service";
import {
  VISITOR_COOKIE,
  readVisitor,
  signVisitor,
  publicHash,
} from "@/lib/public/security";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
  try {
    const config = authConfig();
    await assertMutationOrigin();
    z.object({})
      .strict()
      .parse(await readJson(request));
    const captcha = turnstileConfig(),
      site = await getSite(),
      options = await bookingOptions();
    const previous = readVisitor(
        config.secret,
        request.cookies.get(VISITOR_COOKIE)?.value,
      ),
      id = previous?.id ?? randomUUID();
    await publicLimit("session", publicHash(config.secret, "visitor", id), 30);
    const response = NextResponse.json(
      { data: { site, options, site_key: captcha.siteKey } },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
    if (!previous)
      response.cookies.set(VISITOR_COOKIE, signVisitor(config.secret, id), {
        httpOnly: true,
        secure: config.secure,
        sameSite: "strict",
        path: "/",
        maxAge: 86400,
      });
    return response;
  } catch (error) {
    return apiFailure(error);
  }
}
