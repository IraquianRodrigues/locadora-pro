import { requirePageStaff } from "@/lib/auth/session";
import { databaseError } from "@/lib/registry/service";
import { SiteSettingsView } from "@/components/public/site-settings-view";
export default async function PublicSettings() {
  const { client } = await requirePageStaff("settings.manage");
  const { data, error } = await client
    .from("system_settings")
    .select("value,version")
    .eq("key", "public_site")
    .maybeSingle();
  if (error) databaseError(error);
  return (
    <SiteSettingsView
      initial={data?.value ?? {}}
      version={data?.version ?? 0}
    />
  );
}
