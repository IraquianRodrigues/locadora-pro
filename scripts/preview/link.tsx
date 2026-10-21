import type { ComponentProps } from "react";
// Adaptador exclusivo do servidor de prévia, nunca importado pela aplicação.
export default function PreviewLink({
  href,
  children,
  ...props
}: ComponentProps<"a">) {
  return (
    <a
      {...props}
      href={
        href?.startsWith("/") &&
        !/^\/admin\/(dashboard|frota|clientes|condutores|reservas|locacoes|financeiro|manutencao|relatorios|notificacoes|usuarios|site|categorias|unidades|planos|precos|adicionais)(\/|\?|$)/.test(
          href,
        )
          ? `http://127.0.0.1:3000${href}`
          : href
      }
    >
      {children}
    </a>
  );
}
