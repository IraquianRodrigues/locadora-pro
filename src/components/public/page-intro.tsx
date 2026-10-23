import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function PublicPageIntro({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="public-page-intro">
      <Link href="/" className="public-back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Início
      </Link>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
