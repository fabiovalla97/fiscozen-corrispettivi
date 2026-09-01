import { selectors } from "./selectors.js";
import {
  assertLoggedInOnCurrentPage,
  gotoFiscozen,
  isLoggedIn,
  waitForEnter,
  waitForManualOtp,
} from "./browser.js";
import { buildCorrispettiviDayModificaUrl } from "../corrispettivi/month-batch.js";
import { formatImportoInput } from "../utils/money.js";

async function dismissConnectionBanner(page) {
  const aggiorna = page.getByRole("button", { name: "Aggiorna" });
  if (await aggiorna.isVisible().catch(() => false)) {
    console.log("[fiscozen] 'Non sei connesso' banner → clicking Aggiorna");
    await aggiorna.click();
    await page.waitForTimeout(1500);
  }
}

async function revealSalvaButton(page) {
  const { salvaButton } = selectors.editForm;
  const salva = page.getByRole(salvaButton.role, { name: salvaButton.name });

  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(400);

  try {
    await salva.scrollIntoViewIfNeeded({ timeout: 8000 });
  } catch {
    // Last resort: the app may use an inner scroll container
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(400);
    await salva.scrollIntoViewIfNeeded({ timeout: 8000 });
  }

  const visible = await salva.isVisible();
  if (!visible) {
    console.warn(
      "[fiscozen] Salva not visible — scroll manually or enlarge the window."
    );
  }

  return visible;
}

/**
 * Open the edit form for a single day.
 * Example: https://app.fiscozen.it/app/corrispettivi/2026-07-03/modifica
 */
export async function openCorrispettiviDayModifica(page, date) {
  const url = buildCorrispettiviDayModificaUrl(date);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  if (!(await assertLoggedInOnCurrentPage(page))) {
    throw new Error("Not logged in on Fiscozen. Run: npm run login");
  }

  await dismissConnectionBanner(page);
  console.log(`[fiscozen] Edit form open: ${url}`);
}

/**
 * Fill Importo, then optionally click Salva.
 */
export async function submitDailyCorrispettivo(page, day, { dryRun = true } = {}) {
  const importo = formatImportoInput(day.total);
  const { importoInput, salvaButton } = selectors.editForm;

  await openCorrispettiviDayModifica(page, day.date);

  await page.getByRole(importoInput.role, { name: importoInput.name }).fill(importo);

  console.log(
    `[fiscozen] ${day.date}: Importo = ${importo} (${day.transactionCount} sheet rows → ${day.totalFormatted})`
  );

  await revealSalvaButton(page);

  if (dryRun) {
    console.log("[preview] Not clicking Salva. Check Importo and click Salva in the browser.");
    return { submitted: false, dryRun: true };
  }

  await page.getByRole(salvaButton.role, { name: salvaButton.name }).click();
  return { submitted: true, dryRun: false };
}

export async function interactiveLogin(page) {
  console.log("[login] Browser profile is separate from your usual Chrome/Edge.");
  console.log("[login] You must log in here even if you are already logged in elsewhere.");

  const alreadyLoggedIn = await isLoggedIn(page);

  if (alreadyLoggedIn) {
    console.log(`[login] Playwright session already active: ${page.url()}`);
  } else {
    await gotoFiscozen(page, "/login");
    console.log("[login] Effettua login manualmente (email, password, SMS).");
    await waitForManualOtp();

    if (!(await isLoggedIn(page))) {
      throw new Error("Login non riuscito. Controlla il browser e riprova.");
    }

    console.log("[login] Login completato.");
  }

  console.log("[login] Sessione salvata in data/browser-profile/");
  await waitForEnter(">>> Premi INVIO per chiudere il browser.");
}

export async function ensureLoggedIn(page) {
  if (await isLoggedIn(page)) {
    console.log("[login] Sessione Playwright attiva.");
    return;
  }

  await gotoFiscozen(page, "/login");
  console.log("[login] Effettua login manualmente (email, password, SMS).");
  await waitForManualOtp();

  if (!(await isLoggedIn(page))) {
    throw new Error("Login non riuscito. Esegui: npm run login");
  }

  console.log("[login] Login completato. Profilo salvato in data/browser-profile/");
}
