import { config as loadEnv } from "dotenv";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

loadEnv({ path: join(ROOT, ".env") });

function required(name) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name, fallback = null) {
  const value = process.env[name];
  if (value === undefined || value === "") return fallback;
  return value;
}

function optionalBool(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function optionalPath(name) {
  const value = optional(name);
  return value ? resolve(ROOT, value) : null;
}

export const config = {
  rootDir: ROOT,
  google: {
    sheetId: optional("GOOGLE_SHEET_ID", ""),
    sheetTab: optional("GOOGLE_SHEET_TAB", ""),
    oauthClientPath: optionalPath("GOOGLE_OAUTH_CLIENT_PATH"),
    oauthTokenPath: optionalPath("GOOGLE_OAUTH_TOKEN_PATH"),
    serviceAccountPath: optionalPath("GOOGLE_SERVICE_ACCOUNT_PATH"),
  },
  fiscozen: {
    baseUrl: required("FISCOZEN_BASE_URL"),
    browserProfileDir: resolve(ROOT, required("FISCOZEN_BROWSER_PROFILE_DIR")),
    autoSubmit: optionalBool("FISCOZEN_AUTO_SUBMIT", false),
  },
  corrispettivi: {
    timezone: required("TIMEZONE"),
    from: optional("CORRISPETTIVI_FROM"),
    to: optional("CORRISPETTIVI_TO"),
    // Optional override; otherwise inferred from created_at of the first pending row
    month: optional("CORRISPETTIVI_MONTH"),
  },
  statePath: resolve(ROOT, "data/state.json"),
  logsDir: resolve(ROOT, "logs"),
};

export const SHEET_COLUMNS = {
  id: "id",
  invoiceNumber: "invoice_number",
  userId: "user_id",
  periodStart: "period_start",
  periodEnd: "period_end",
  createdAt: "created_at",
  country: "country",
  total: "total",
  incassoDate: "incasso_date",
  fiscozenStatus: "fiscozen_status",
  fiscozenSubmittedAt: "fiscozen_submitted_at",
  fiscozenError: "fiscozen_error",
};

export const FISCOZEN_STATUS = {
  pending: "pending",
  submitted: "submitted",
  error: "error",
  skipped: "skipped",
};

export function assertGoogleConfig() {
  if (!config.google.sheetId) {
    throw new Error(
      "Missing GOOGLE_SHEET_ID. Copy .env.example to .env:\n  cp .env.example .env"
    );
  }
  if (!config.google.sheetTab) {
    throw new Error("Missing GOOGLE_SHEET_TAB. Set it in .env.");
  }
}
