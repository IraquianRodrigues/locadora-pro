// Adaptador exclusivo de SSR da prévia, sem sessão, cookies ou credenciais.
export function usePathname() {
  return typeof window === "undefined"
    ? "/admin/dashboard"
    : window.location.pathname;
}
export function useRouter() {
  return {
    push: (href: string) => window.location.assign(href),
    refresh: () => window.location.reload(),
  };
}
