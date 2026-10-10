/**
 * CSV helpers. Cells starting with = + - @ (or tab / carriage return) are prefixed with an
 * apostrophe so spreadsheet programs never run them as formulas (TC-REG-10).
 */
export function csvCell(value) {
  let s =
    value === null || value === undefined ? '' : Array.isArray(value) ? value.join('; ') : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows) => `${rows.map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
