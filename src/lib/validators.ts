export function normalizeIco(ico: string | null | undefined): string {
  if (!ico) return "";
  return String(ico).replace(/\D/g, "");
}

// Oficiální mod-11 kontrola českého IČO (stejná logika jako ARES)
export function isValidIco(ico: string | null | undefined): boolean {
  const digits = normalizeIco(ico);
  if (digits.length === 0) return true; // prázdné IČO je OK (volitelné pole)
  if (digits.length !== 8) return false;

  const weights = [8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  let check: number;
  if (remainder === 0) check = 1;
  else if (remainder === 1) check = 0;
  else check = 11 - remainder;
  return check === parseInt(digits[7], 10);
}
