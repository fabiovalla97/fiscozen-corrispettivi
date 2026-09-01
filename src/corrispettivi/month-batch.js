import { config } from "../config.js";

export function buildCorrispettiviMonthUrl(month) {
  return `${config.fiscozen.baseUrl}/app/corrispettivi?month=${month}`;
}

export function buildCorrispettiviDayUrl(date) {
  return `${config.fiscozen.baseUrl}/app/corrispettivi/${date}`;
}

export function buildCorrispettiviDayModificaUrl(date) {
  return `${buildCorrispettiviDayUrl(date)}/modifica`;
}

/**
 * Process one Fiscozen month at a time.
 * Target month comes from created_at of the earliest pending row,
 * unless CORRISPETTIVI_MONTH is set in .env.
 */
export function resolveMonthBatch(rows) {
  if (!rows.length) {
    return {
      targetMonth: null,
      rows: [],
      deferredRows: [],
      fiscozenUrl: null,
      anchorRow: null,
    };
  }

  const sorted = [...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const targetMonth = config.corrispettivi.month || sorted[0].createdAtMonth;
  const inMonth = sorted.filter((row) => row.createdAtMonth === targetMonth);
  const deferredRows = sorted.filter((row) => row.createdAtMonth !== targetMonth);
  const anchorRow = inMonth[0] || sorted[0];

  return {
    targetMonth,
    rows: inMonth,
    deferredRows,
    fiscozenUrl: buildCorrispettiviMonthUrl(targetMonth),
    anchorRow,
  };
}

export function printMonthBatchSummary(batch, aggregation) {
  console.log("");
  console.log("=== Batch mensile Fiscozen ===");
  console.log(`Mese: ${batch.targetMonth}`);
  console.log(`URL: ${batch.fiscozenUrl}`);

  if (batch.anchorRow) {
    console.log(
      `Riga di riferimento: id=${batch.anchorRow.id}, created_at=${batch.anchorRow.createdAt}`
    );
  }

  console.log(`Righe nel mese: ${batch.rows.length}`);
  console.log(`Giorni da compilare: ${aggregation.days.length}`);
  console.log(`Totale corrispettivi: ${aggregation.grandTotalFormatted}`);

  if (batch.deferredRows.length) {
    const deferredMonths = [
      ...new Set(batch.deferredRows.map((row) => row.createdAtMonth)),
    ].sort();

    console.log("");
    console.log(
      `ATTENZIONE: ${batch.deferredRows.length} righe in altri mesi (${deferredMonths.join(", ")}) verranno saltate.`
    );
    console.log(
      "Completa questo mese (e i passaggi manuali su Fiscozen), poi rilancia lo script."
    );
  }

  console.log("");
}
