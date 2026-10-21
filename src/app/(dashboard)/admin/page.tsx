import { redirect } from "next/navigation";
import { requirePageStaff } from "@/lib/auth/session";
export default async function AdminPage() {
  await requirePageStaff();
  redirect("/admin/dashboard");
}
