export const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;
export function normalizeDocument(value: string) {
  return value.replace(/[.\-/\s]/g, "").toUpperCase();
}
export function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  for (let n = 9; n <= 10; n++) {
    let total = 0;
    for (let i = 0; i < n; i++) total += Number(value[i]) * (n + 1 - i);
    const digit = (total * 10) % 11;
    if ((digit === 10 ? 0 : digit) !== Number(value[n])) return false;
  }
  return true;
}
export function validCnpj(value: string) {
  if (!/^[A-Z0-9]{12}\d{2}$/.test(value) || /^(.)\1+$/.test(value))
    return false;
  for (let n = 12; n <= 13; n++) {
    let total = 0;
    for (let i = 0; i < n; i++)
      total += (value.charCodeAt(i) - 48) * (((n - 1 - i) % 8) + 2);
    const rest = total % 11;
    if ((rest < 2 ? 0 : 11 - rest) !== Number(value[n])) return false;
  }
  return true;
}
export function normalizePhone(value: string) {
  const digits = value.replace(/[()+\-\s]/g, "");
  return digits.length >= 12 && digits.startsWith("55")
    ? digits.slice(2)
    : digits;
}
const ddds = new Set(
  "11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split(
    " ",
  ),
);
export function validPhone(value: string) {
  return (
    ddds.has(value.slice(0, 2)) &&
    (/^\d{2}[2-5]\d{7}$/.test(value) || /^\d{2}9\d{8}$/.test(value))
  );
}
export function validCivilDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function brazilToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Fortaleza",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function maskDocument(value: string) {
  return value.length > 4
    ? `${"•".repeat(value.length - 4)}${value.slice(-4)}`
    : value;
}
