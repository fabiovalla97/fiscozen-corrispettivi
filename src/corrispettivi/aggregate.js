import { config } from "../config.js";
import { isWithinRange, sortDatesAsc } from "../utils/dates.js";
import { buildCorrispettiviDayUrl } from "./month-batch.js";
import { formatEuro, sumAmounts } from "../utils/money.js";

/**
 * Build one corrispettivo per calendar day.
 * Amount = sum of `total` for all rows sharing the same day (from created_at).
 */
export function aggregateDailyCorrispettivi(rows, { targetMonth } = {}) {
  const byDate = new Map();
  let skippedOutsideMonth = 0;

  for (const row of rows) {
    if (!isWithinRange(row.incassoDate, config.corrispettivi.from, config.corrispettivi.to)) {
      continue;
    }

    if (targetMonth && !row.incassoDate.startsWith(`${targetMonth}-`)) {
      skippedOutsideMonth += 1;
      continue;
    }

    if (!byDate.has(row.incassoDate)) {
      byDate.set(row.incassoDate, {
        date: row.incassoDate,
        total: 0,
        transactions: [],
        sheetRowNumbers: [],
      });
    }

    const bucket = byDate.get(row.incassoDate);
    bucket.total = sumAmounts([bucket.total, row.amount]);
    bucket.transactions.push(row);
    bucket.sheetRowNumbers.push(row.sheetRowNumber);
  }

  const days = sortDatesAsc([...byDate.keys()]).map((date) => {
    const bucket = byDate.get(date);
    return {
      date,
      dayUrl: buildCorrispettiviDayUrl(date),
      total: bucket.total,
      totalFormatted: formatEuro(bucket.total),
      transactionCount: bucket.transactions.length,
      transactions: bucket.transactions,
      sheetRowNumbers: bucket.sheetRowNumbers,
    };
  });

  const grandTotal = sumAmounts(days.map((day) => day.total));

  return {
    days,
    grandTotal,
    grandTotalFormatted: formatEuro(grandTotal),
    transactionCount: days.reduce((acc, day) => acc + day.transactionCount, 0),
    skippedOutsideMonth,
  };
}

export function printAggregationSummary(aggregation, { month } = {}) {
  console.log("");
  console.log("=== Corrispettivi giornalieri ===");
  if (month) {
    console.log(`Mese batch (created_at): ${month}`);
  }
  console.log(`Giorni: ${aggregation.days.length}`);
  console.log(`Transazioni incluse: ${aggregation.transactionCount}`);
  console.log(`Totale: ${aggregation.grandTotalFormatted}`);

  if (aggregation.skippedOutsideMonth > 0) {
    console.log(
      `Righe saltate (giorno fuori dal mese ${month}): ${aggregation.skippedOutsideMonth}`
    );
  }

  console.log("");

  for (const day of aggregation.days) {
    console.log(
      `${day.date} | ${day.totalFormatted} | ${day.transactionCount} righe | ${day.dayUrl}`
    );
  }

  console.log("");
}
