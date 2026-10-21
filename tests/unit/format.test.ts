import { expect, it } from "vitest";
import { formatDate } from "@/lib/utils/format";

it("formata a data brasileira no timezone comercial, inclusive na virada UTC", () => {
  expect(formatDate(new Date("2026-10-19T01:00:00Z"))).toBe("18/10/2026");
  expect(formatDate(new Date("2026-10-19T01:00:00Z"), "UTC")).toBe(
    "19/10/2026",
  );
});
