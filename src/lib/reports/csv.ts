export function csvCell(raw: unknown) {
  let text = String(raw ?? "").replaceAll("\0", "");
  const significant = Array.from(text).find(
    (char) => char.charCodeAt(0) > 31 && !/\s/.test(char),
  );
  if ((significant && "=+-@".includes(significant)) || /^[\t\r\n]/.test(text))
    text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
export function reportCsv(
  rows: Record<string, string | null>[],
  columns: string[],
) {
  return (
    "\uFEFF" +
    [
      columns.map(csvCell).join(";"),
      ...rows.map((row) => columns.map((key) => csvCell(row[key])).join(";")),
    ].join("\r\n") +
    "\r\n"
  );
}
