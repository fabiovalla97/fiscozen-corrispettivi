import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import { config } from "../config.js";

function loadOAuthClientCredentials() {
  const clientPath = config.google.oauthClientPath;
  if (!clientPath || !existsSync(clientPath)) return null;

  const json = JSON.parse(readFileSync(clientPath, "utf8"));
  const block = json.installed || json.web || json;
  if (!block.client_id || !block.client_secret) return null;

  return {
    clientPath,
    clientId: block.client_id,
    clientSecret: block.client_secret,
  };
}

async function tryServiceAccountAuth() {
  const candidate = config.google.serviceAccountPath;
  if (!candidate || !existsSync(candidate)) return null;

  try {
    const credentials = JSON.parse(await readFile(candidate, "utf8"));
    if (credentials.type !== "service_account") return null;

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    console.log(`[google] Service account: ${candidate}`);
    return auth.getClient();
  } catch {
    return null;
  }
}

async function tryOAuthAuth() {
  const client = loadOAuthClientCredentials();
  if (!client) return null;

  const tokenPath = config.google.oauthTokenPath;
  if (!tokenPath || !existsSync(tokenPath)) return null;

  const token = JSON.parse(await readFile(tokenPath, "utf8"));
  const oauth2 = new OAuth2Client(client.clientId, client.clientSecret);
  oauth2.setCredentials(token);

  console.log(`[google] OAuth token: ${tokenPath}`);
  console.log(`[google] OAuth client: ${client.clientPath}`);
  return oauth2;
}

export async function getGoogleSheetsAuthClient() {
  const oauth = await tryOAuthAuth();
  if (oauth) return oauth;

  const serviceAccount = await tryServiceAccountAuth();
  if (serviceAccount) return serviceAccount;

  throw new Error(
    [
      "Google Sheets auth not configured.",
      "",
      "Set GOOGLE_OAUTH_CLIENT_PATH and GOOGLE_OAUTH_TOKEN_PATH in .env,",
      "then run: npm run google-auth",
      "",
      "Alternatively set GOOGLE_SERVICE_ACCOUNT_PATH and share the sheet",
      "with the service account email.",
    ].join("\n")
  );
}
