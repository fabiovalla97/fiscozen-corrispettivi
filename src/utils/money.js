/**
 * Parse Italian-formatted money strings from the sheet.
 * Examples: "€ 9,99", "9,99", "€9.99"
 */
export function parseEuroAmount(raw) {
  if (raw === null || raw === undefined || raw === "") {
    throw new Error("Empty amount");
  }

  const normalized = String(raw)
    .replace(/\s/g, "")
    .replace("€", "")
    .replace(/\./g, "")
    .replace(",", ".");

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid amount: ${raw}`);
  }

  return roundMoney(value);
}

export function formatEuro(amount) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sumAmounts(values) {
  return roundMoney(values.reduce((acc, value) => acc + value, 0));
}

/** Format for Fiscozen "Importo" input: 109.98 → "109,98" */
export function formatImportoInput(amount) {
  return roundMoney(amount).toFixed(2).replace(".", ",");
}
