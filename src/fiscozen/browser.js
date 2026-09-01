import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { config } from "../config.js";

const WINDOWS_CHROME_PATHS = [
  "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
  "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe",
];

function resolveBrowserExecutable() {
  // Windows Chrome from WSL is NOT compatible with Playwright (remote-debugging-pipe fails).
  // Use Linux Chromium instead: npx playwright install chromium
  if (process.env.FISCOZEN_BROWSER_EXECUTABLE === "windows-chrome") {
    for (const chromePath of WINDOWS_CHROME_PATHS) {
      if (existsSync(chromePath)) return chromePath;
    }
    throw new Error("Windows Chrome not found. Use Linux Chromium instead.");
  }

  if (process.env.FISCOZEN_BROWSER_EXECUTABLE) {
    return process.env.FISCOZEN_BROWSER_EXECUTABLE;
  }

  if (process.env.WSL_DISTRO_NAME) {
    console.log("[browser] WSL detected → using Playwright Linux Chromium");
    console.log("[browser] If missing, run: npx playwright install chromium");
  }

  return undefined;
}

export async function launchPersistentBrowser({ headless = false } = {}) {
  await mkdir(config.fiscozen.browserProfileDir, { recursive: true });

  const executablePath = resolveBrowserExecutable();
  const launchOptions = {
    headless,
    // null = use the real window size (needed to see Salva at the bottom)
    viewport: null,
    locale: "it-IT",
    timezoneId: config.corrispettivi.timezone,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080",
      "--window-position=0,0",
    ],
    ...(executablePath ? { executablePath } : {}),
  };

  const context = await chromium.launchPersistentContext(
    config.fiscozen.browserProfileDir,
    launchOptions
  );

  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

export async function gotoFiscozen(page, path = "/") {
  const url = new URL(path, config.fiscozen.baseUrl).toString();
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

export async function waitForEnter(message) {
  console.log("");
  console.log(message);
  console.log("");

  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      process.stdin.pause();
      resolve();
    });
  });
}

export async function waitForManualOtp() {
  await waitForEnter(
    ">>> Inserisci il codice SMS su Fiscozen nel browser aperto.\n>>> Quando sei dentro la dashboard, premi INVIO in questo terminale."
  );
}

/**
 * Check login on the current page without navigating away.
 */
export async function assertLoggedInOnCurrentPage(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(800);

  const url = page.url();
  if (url.includes("/login") || url.includes("/auth")) {
    return false;
  }

  const emailInput = page.locator('input[type="email"]');
  if (await emailInput.isVisible().catch(() => false)) {
    return false;
  }

  const passwordInput = page.locator('input[type="password"]');
  if (await passwordInput.isVisible().catch(() => false)) {
    return false;
  }

  return url.includes("/app/");
}

/**
 * Check login by opening the corrispettivi list (used at the start of submit/login).
 */
export async function isLoggedIn(page) {
  await gotoFiscozen(page, "/app/corrispettivi");
  return assertLoggedInOnCurrentPage(page);
}
