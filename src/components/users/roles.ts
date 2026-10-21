export const roleLabels = {
  ADMIN: "Administrador",
  MANAGER: "Gerente",
  ATTENDANT: "Atendente",
  FINANCE: "Financeiro",
};
export type StaffRole = keyof typeof roleLabels;
