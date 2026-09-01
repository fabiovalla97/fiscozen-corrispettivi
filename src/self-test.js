process.env.GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || "test-sheet";
process.env.GOOGLE_SHEET_TAB = process.env.GOOGLE_SHEET_TAB || "incassi";
process.env.FISCOZEN_BASE_URL =
  process.env.FISCOZEN_BASE_URL || "https://app.fiscozen.it";
process.env.FISCOZEN_BROWSER_PROFILE_DIR =
  process.env.FISCOZEN_BROWSER_PROFILE_DIR || "./data/browser-profile";
process.env.TIMEZONE = process.env.TIMEZONE || "Europe/Rome";

const { aggregateDailyCorrispettivi } = await import("./corrispettivi/aggregate.js");
const { resolveMonthBatch } = await import("./corrispettivi/month-batch.js");
const { formatImportoInput } = await import("./utils/money.js");

const sampleRows = [
  {
    sheetRowNumber: 2,
    id: "6",
    createdAt: "2026-07-02T10:00:00.000Z",
    createdAtMonth: "2026-07",
    incassoDate: "2026-07-02",
    amount: 9.99,
    fiscozenStatus: "pending",
  },
  {
    sheetRowNumber: 3,
    id: "5",
    createdAt: "2026-07-02T14:00:00.000Z",
    createdAtMonth: "2026-07",
    incassoDate: "2026-07-02",
    amount: 29.98,
    fiscozenStatus: "pending",
  },
  {
    sheetRowNumber: 4,
    id: "4",
    createdAt: "2026-08-01T12:00:00.000Z",
    createdAtMonth: "2026-08",
    incassoDate: "2026-08-01",
    amount: 14.99,
    fiscozenStatus: "pending",
  },
  {
    sheetRowNumber: 5,
    id: "3",
    createdAt: "2026-07-03T12:00:00.000Z",
    createdAtMonth: "2026-07",
    incassoDate: "2026-07-03",
    amount: 14.99,
    fiscozenStatus: "pending",
  },
];

const batch = resolveMonthBatch(sampleRows);
const aggregation = aggregateDailyCorrispettivi(batch.rows, { targetMonth: batch.targetMonth });

if (formatImportoInput(39.97) !== "39,97") {
  throw new Error("formatImportoInput failed");
}

if (batch.targetMonth !== "2026-07") {
  throw new Error(`Expected target month 2026-07, got ${batch.targetMonth}`);
}

if (aggregation.days.length !== 2) {
  throw new Error(`Expected 2 days in July, got ${aggregation.days.length}`);
}

const july2 = aggregation.days.find((day) => day.date === "2026-07-02");
if (!july2 || july2.total !== 39.97) {
  throw new Error("Expected 39.97 on 2026-07-02");
}

if (july2.dayUrl !== "https://app.fiscozen.it/app/corrispettivi/2026-07-02") {
  throw new Error(`Unexpected day URL: ${july2.dayUrl}`);
}

if (batch.deferredRows.length !== 1) {
  throw new Error("Expected 1 deferred row for August");
}

console.log(JSON.stringify({ batch, aggregation }, null, 2));
console.log("Month batch self-test OK");
