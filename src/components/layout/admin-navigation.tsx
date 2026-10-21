"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  KeyRound,
  CarFront,
  UsersRound,
  ContactRound,
  Shapes,
  MapPin,
  Tags,
  Wallet,
  Wrench,
  ChartNoAxesCombined,
  Bell,
  ShieldCheck,
  Globe,
  Folder,
} from "lucide-react";
import type { NavigationGroup } from "@/lib/navigation";
const icons: Record<string, typeof Folder> = {
  dashboard: LayoutDashboard,
  calendar: CalendarDays,
  key: KeyRound,
  car: CarFront,
  users: UsersRound,
  driver: ContactRound,
  categories: Shapes,
  branch: MapPin,
  pricing: Tags,
  finance: Wallet,
  wrench: Wrench,
  reports: ChartNoAxesCombined,
  bell: Bell,
  access: ShieldCheck,
  site: Globe,
};
export function NavigationLinks({
  groups,
  pathname,
}: {
  groups: NavigationGroup[];
  pathname: string;
}) {
  return (
    <nav aria-label="Painel">
      {groups.map((group) => (
        <div className="admin-nav-group" key={group.label}>
          <p className="admin-nav-label">{group.label}</p>
          {group.items.map((item) => {
            const Icon = icons[item.icon] ?? Folder;
            return (
              <Link
                className="admin-nav-link"
                key={item.href}
                href={item.href}
                onClick={(event) => {
                  const menu = event.currentTarget.closest("details");
                  if (menu) menu.open = false;
                }}
                aria-current={
                  pathname === item.href || pathname.startsWith(item.href + "/")
                    ? "page"
                    : undefined
                }
              >
                <Icon aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
export function AdminNavigation({ groups }: { groups: NavigationGroup[] }) {
  return <NavigationLinks groups={groups} pathname={usePathname() ?? ""} />;
}
