import { z } from "zod";
import { requirePageStaff } from "@/lib/auth/session";
import { setStaffAccessAction } from "@/lib/auth/actions";
import { UsersView } from "@/components/users/users-view";

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { client } = await requirePageStaff("users.manage");
  const params = await searchParams;
  const cursor =
    typeof params.depois === "string" &&
    z.uuid().safeParse(params.depois).success
      ? params.depois
      : undefined;
  let query = client
    .from("profiles")
    .select("id,display_name,active")
    .order("id")
    .limit(21);
  if (cursor) query = query.gt("id", cursor);
  const result = await query;
  if (result.error) throw new Error("Não foi possível consultar a equipe.");
  const profiles = z
    .array(
      z.object({ id: z.uuid(), display_name: z.string(), active: z.boolean() }),
    )
    .parse(result.data);
  const shown = profiles.slice(0, 20);
  const [assigned, roles] = await Promise.all([
    shown.length
      ? client
          .from("user_roles")
          .select("user_id,role_id")
          .in(
            "user_id",
            shown.map((p) => p.id),
          )
      : Promise.resolve({ data: [], error: null }),
    client.from("roles").select("id,code"),
  ]);
  if (assigned.error || roles.error)
    throw new Error("Não foi possível consultar os acessos.");
  const grants = z
    .array(z.object({ user_id: z.uuid(), role_id: z.uuid() }))
    .parse(assigned.data);
  const roleRows = z
    .array(
      z.object({
        id: z.uuid(),
        code: z.enum(["ADMIN", "MANAGER", "ATTENDANT", "FINANCE"]),
      }),
    )
    .parse(roles.data);
  return (
    <UsersView
      profiles={shown.map((profile) => {
        const grant = grants.find((g) => g.user_id === profile.id);
        return {
          ...profile,
          role: roleRows.find((r) => r.id === grant?.role_id)?.code,
        };
      })}
      cursor={cursor}
      hasNext={profiles.length > 20}
      result={
        typeof params.resultado === "string" ? params.resultado : undefined
      }
      action={setStaffAccessAction}
    />
  );
}
