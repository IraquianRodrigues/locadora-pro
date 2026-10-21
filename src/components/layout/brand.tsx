import Link from "next/link";
export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`brand ${inverse ? "brand-inverse" : ""}`}>
      <span className="brand-word">
        APE<span>X</span>
      </span>{" "}
      <span className="brand-description">Locação de veículos</span>
      <span className="sr-only"> — início</span>
    </Link>
  );
}
