import { google } from "googleapis";
import { config, FISCOZEN_STATUS, SHEET_COLUMNS, assertGoogleConfig } from "../config.js";
import { parseEuroAmount } from "../utils/money.js";
import { toIncassoDate, toYearMonth } from "../utils/dates.js";
import { getGoogleSheetsAuthClient } from "./google-auth.js";

function indexHeaders(headerRow) {
  const map = new Map();
  headerRow.forEach((header, index) => {
    if (!header) return;
    map.set(String(header).trim().toLowerCase(), index);
  });
  return map;
}

function cell(row, headerIndex, columnName) {
  const idx = headerIndex.get(columnName.toLowerCase());
  if (idx === undefined) return "";
  return row[idx] ?? "";
}

async function getAuthClient() {
  return getGoogleSheetsAuthClient();
}

export async function readNoFatturaRows() {
  assertGoogleConfig();
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const range = `'${config.google.sheetTab}'!A:Z`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.google.sheetId,
    range,
  });

  const values = response.data.values || [];
  if (values.length < 2) {
    return [];
  }

  const headerIndex = indexHeaders(values[0]);
  const required = [
    SHEET_COLUMNS.id,
    SHEET_COLUMNS.createdAt,
    SHEET_COLUMNS.total,
  ];

  for (const column of required) {
    if (!headerIndex.has(column)) {
      throw new Error(`Missing required column "${column}" in sheet tab "${config.google.sheetTab}"`);
    }
  }

  const hasStatusColumn = headerIndex.has(SHEET_COLUMNS.fiscozenStatus);
  const rows = [];

  for (let i = 1; i < values.length; i += 1) {
    const raw = values[i];
    if (!raw || raw.every((value) => !value)) continue;

    const id = String(cell(raw, headerIndex, SHEET_COLUMNS.id)).trim();
    if (!id) continue;

    const status = hasStatusColumn
      ? String(cell(raw, headerIndex, SHEET_COLUMNS.fiscozenStatus)).trim().toLowerCase()
      : "";

    if (status === FISCOZEN_STATUS.submitted || status === FISCOZEN_STATUS.skipped) {
      continue;
    }

    const periodStart = cell(raw, headerIndex, SHEET_COLUMNS.periodStart);
    const createdAt = String(cell(raw, headerIndex, SHEET_COLUMNS.createdAt)).trim();
    if (!createdAt) continue;

    const explicitIncassoDate = cell(raw, headerIndex, SHEET_COLUMNS.incassoDate);
    const incassoDate = explicitIncassoDate
      ? String(explicitIncassoDate).slice(0, 10)
      : toIncassoDate(createdAt);

    rows.push({
      sheetRowNumber: i + 1,
      id,
      invoiceNumber: String(cell(raw, headerIndex, SHEET_COLUMNS.invoiceNumber)).trim(),
      userId: String(cell(raw, headerIndex, SHEET_COLUMNS.userId)).trim(),
      periodStart: String(periodStart),
      periodEnd: String(cell(raw, headerIndex, SHEET_COLUMNS.periodEnd)),
      createdAt,
      createdAtMonth: createdAt ? toYearMonth(createdAt) : null,
      country: String(cell(raw, headerIndex, SHEET_COLUMNS.country)).trim(),
      amount: parseEuroAmount(cell(raw, headerIndex, SHEET_COLUMNS.total)),
      incassoDate,
      fiscozenStatus: status || FISCOZEN_STATUS.pending,
    });
  }

  return rows;
}

export async function markRowsSubmitted({ rowNumbers, submittedAtIso, errorByRow = {} }) {
  const auth = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: config.google.sheetId,
    range: `'${config.google.sheetTab}'!1:1`,
  });

  const headers = (headerResponse.data.values?.[0] || []).map((h) =>
    String(h || "").trim().toLowerCase()
  );

  const statusCol = headers.indexOf(SHEET_COLUMNS.fiscozenStatus);
  const submittedAtCol = headers.indexOf(SHEET_COLUMNS.fiscozenSubmittedAt);
  const errorCol = headers.indexOf(SHEET_COLUMNS.fiscozenError);

  if (statusCol === -1) {
    console.warn(
      `[sheet] Column "${SHEET_COLUMNS.fiscozenStatus}" not found — skipping write-back`
    );
    return;
  }

  const toColumnLetter = (index) => {
    let n = index + 1;
    let letters = "";
    while (n > 0) {
      const rem = (n - 1) % 26;
      letters = String.fromCharCode(65 + rem) + letters;
      n = Math.floor((n - 1) / 26);
    }
    return letters;
  };

  const data = [];

  for (const rowNumber of rowNumbers) {
    const hasError = Object.prototype.hasOwnProperty.call(errorByRow, rowNumber);
    const status = hasError ? FISCOZEN_STATUS.error : FISCOZEN_STATUS.submitted;

    data.push({
      range: `'${config.google.sheetTab}'!${toColumnLetter(statusCol)}${rowNumber}`,
      values: [[status]],
    });

    if (submittedAtCol !== -1 && !hasError) {
      data.push({
        range: `'${config.google.sheetTab}'!${toColumnLetter(submittedAtCol)}${rowNumber}`,
        values: [[submittedAtIso]],
      });
    }

    if (errorCol !== -1 && hasError) {
      data.push({
        range: `'${config.google.sheetTab}'!${toColumnLetter(errorCol)}${rowNumber}`,
        values: [[errorByRow[rowNumber]]],
      });
    }
  }

  if (!data.length) return;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: config.google.sheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data,
    },
  });
}
