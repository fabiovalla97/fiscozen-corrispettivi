/**
 * OAuth login for Google Sheets.
 *
 * Usage:
 *   npm run google-auth
 *   npm run google-auth -- --url "http://localhost:8080/?code=..."
 */

import { config as loadEnv } from "dotenv";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { OAuth2Client } from "google-auth-library";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
loadEnv({ path: join(ROOT, ".env") });

const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || "http://localhost:8080";
const LISTEN_HOST = process.env.OAUTH_LISTEN_HOST || "0.0.0.0";
const LISTEN_PORT = Number(process.env.OAUTH_LISTEN_PORT || 8080);
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const CLIENT_PATH = process.env.GOOGLE_OAUTH_CLIENT_PATH
  ? resolve(ROOT, process.env.GOOGLE_OAUTH_CLIENT_PATH)
  : null;
const TOKEN_PATH = process.env.GOOGLE_OAUTH_TOKEN_PATH
  ? resolve(ROOT, process.env.GOOGLE_OAUTH_TOKEN_PATH)
  : null;

function loadClient() {
  if (!CLIENT_PATH || !existsSync(CLIENT_PATH)) {
    throw new Error(
      "Missing GOOGLE_OAUTH_CLIENT_PATH. Download the OAuth client JSON from Google Cloud and set the path in .env."
    );
  }
  if (!TOKEN_PATH) {
    throw new Error(
      "Missing GOOGLE_OAUTH_TOKEN_PATH. Set it in .env (where the token will be saved)."
    );
  }

  const json = JSON.parse(readFileSync(CLIENT_PATH, "utf8"));
  const block = json.installed || json.web || json;
  if (!block.client_id || !block.client_secret) {
    throw new Error(`Invalid OAuth client JSON: ${CLIENT_PATH}`);
  }

  return {
    clientPath: CLIENT_PATH,
    clientId: block.client_id,
    clientSecret: block.client_secret,
  };
}

function parseCodeArg(args) {
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--code=")) return arg.slice("--code=".length);
    if (arg === "--code" && args[i + 1]) return args[i + 1];
    if (arg.startsWith("--url=")) return new URL(arg.slice("--url=".length)).searchParams.get("code");
    if (arg === "--url" && args[i + 1]) {
      return new URL(args[i + 1]).searchParams.get("code");
    }
  }
  return null;
}

async function saveTokens(oauth2, code) {
  const { tokens } = await oauth2.getToken(code);
  mkdirSync(dirname(TOKEN_PATH), { recursive: true });
  writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2), "utf8");
  console.log("");
  console.log("OK — token Sheets salvato in:", TOKEN_PATH);
  console.log("Ora puoi eseguire: npm run inspect");
}

async function main() {
  const { clientId, clientSecret, clientPath } = loadClient();
  console.log("OAuth client:", clientPath);

  const oauth2 = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
  const manualCode = parseCodeArg(process.argv.slice(2));

  if (manualCode) {
    await saveTokens(oauth2, manualCode);
    return;
  }

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("");
  console.log("Apri questo URL nel browser (account Google che ha accesso al foglio):");
  console.log(authUrl);
  console.log("");
  console.log("Dopo il consenso, se il redirect non torna a WSL, copia l'URL completo e lancia:");
  console.log('  npm run google-auth -- --url "http://localhost:8080/?code=..."');
  console.log("");

  await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, REDIRECT_URI);
        const code = url.searchParams.get("code");
        if (!code) {
          res.writeHead(400);
          res.end("Missing code");
          return;
        }

        await saveTokens(oauth2, code);
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end("<h1>OK — puoi chiudere questa scheda e tornare al terminale.</h1>");
        server.close();
        resolve();
      } catch (error) {
        reject(error);
      }
    });

    server.listen(LISTEN_PORT, LISTEN_HOST);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
