import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { config } from "./config.js";
import { aggregateDailyCorrispettivi, printAggregationSummary } from "./corrispettivi/aggregate.js";
import {
  printMonthBatchSummary,
  resolveMonthBatch,
} from "./corrispettivi/month-batch.js";
import { readNoFatturaRows, markRowsSubmitted } from "./sheets/reader.js";
import {
  ensureLoggedIn,
  interactiveLogin,
  submitDailyCorrispettivo,
} from "./fiscozen/corrispettivi-form.js";
import { launchPersistentBrowser, waitForEnter } from "./fiscozen/browser.js";

async function loadState() {
  try {
    const raw = await readFile(config.statePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return { submittedDatesByMonth: {} };
  }
}

async function saveState(state) {
  await mkdir(config.statePath.replace(/\/[^/]+$/, ""), { recursive: true });
  await writeFile(config.statePath, JSON.stringify(state, null, 2));
}

async function buildMonthBatch() {
  const allRows = await readNoFatturaRows();
  const batch = resolveMonthBatch(allRows);
  const aggregation = aggregateDailyCorrispettivi(batch.rows, {
    targetMonth: batch.targetMonth,
  });

  return { allRows, batch, aggregation };
}

async function cmdInspect() {
  const { batch, aggregation } = await buildMonthBatch();

  if (!batch.targetMonth) {
    console.log("Nessuna riga pending da processare.");
    return;
  }

  printMonthBatchSummary(batch, aggregation);
  printAggregationSummary(aggregation, { month: batch.targetMonth });
}

async function cmdDryRun() {
  await cmdInspect();
  console.log("Nessuna modifica su Fiscozen o sul foglio.");
}

async function cmdLogin() {
  if (process.argv.includes("--reset")) {
    await rm(config.fiscozen.browserProfileDir, { recursive: true, force: true });
    console.log("[login] Profilo browser resettato.");
  }

  const { page, context } = await launchPersistentBrowser({ headless: false });
  try {
    await interactiveLogin(page);
  } finally {
    await context.close();
  }
}

async function cmdSubmit() {
  const state = await loadState();
  const { batch, aggregation } = await buildMonthBatch();

  if (!batch.targetMonth || !batch.rows.length) {
    console.log("Nessuna riga pending da processare per il mese corrente.");
    return;
  }

  const monthState = state.submittedDatesByMonth[batch.targetMonth] || [];
  const submittedSet = new Set(monthState);
  const pendingDays = aggregation.days.filter((day) => !submittedSet.has(day.date));

  if (!pendingDays.length) {
    console.log(`Mese ${batch.targetMonth} già completato nello state locale.`);
    if (batch.deferredRows.length) {
      console.log(
        "Ci sono righe in mesi successivi: completa i passaggi manuali su Fiscozen e rilancia."
      );
    }
    return;
  }

  printMonthBatchSummary(batch, {
    ...aggregation,
    days: pendingDays,
    transactionCount: pendingDays.reduce((acc, day) => acc + day.transactionCount, 0),
  });
  printAggregationSummary(
    { ...aggregation, days: pendingDays },
    { month: batch.targetMonth }
  );

  const { page, context } = await launchPersistentBrowser({ headless: false });

  try {
    await ensureLoggedIn(page);

    for (const day of pendingDays) {
      console.log(`\n--- ${day.date} (${day.totalFormatted}, ${day.transactionCount} righe) ---`);
      console.log(`URL: ${day.dayUrl}`);

      try {
        const result = await submitDailyCorrispettivo(page, day, {
          dryRun: !config.fiscozen.autoSubmit,
        });

        if (result.submitted) {
          submittedSet.add(day.date);
          state.submittedDatesByMonth[batch.targetMonth] = [...submittedSet];
          await saveState(state);

          await markRowsSubmitted({
            rowNumbers: day.sheetRowNumbers,
            submittedAtIso: new Date().toISOString(),
          });

          console.log(`[ok] Salvato ${day.date}`);
        } else if (result.dryRun) {
          await waitForEnter(
            ">>> Controlla Importo nel browser. Clicca Salva se è corretto.\n>>> Premi INVIO qui per passare al giorno successivo."
          );
        }
      } catch (error) {
        console.error(`[error] ${day.date}: ${error.message}`);
        await markRowsSubmitted({
          rowNumbers: day.sheetRowNumbers,
          submittedAtIso: new Date().toISOString(),
          errorByRow: Object.fromEntries(
            day.sheetRowNumbers.map((rowNumber) => [rowNumber, error.message])
          ),
        });
      }
    }

    if (batch.deferredRows.length) {
      console.log("");
      console.log(
        `Mese ${batch.targetMonth} elaborato. ${batch.deferredRows.length} righe in mesi successivi NON sono state toccate.`
      );
      console.log("Completa i passaggi manuali su Fiscozen, poi rilancia lo script.");
    }
  } finally {
    await context.close();
  }
}

function printHelp() {
  console.log(`
Uso:
  npm run login     Salva sessione Fiscozen (SMS). Opzione: --reset
  npm run inspect   Legge il foglio e mostra il batch del mese corrente
  npm run dry-run   Come inspect, senza browser
  npm run submit    Per ogni giorno: apre /app/corrispettivi/YYYY-MM-DD/modifica, compila Importo

Logica:
  - Batch mensile: righe con lo stesso mese in created_at (es. 2026-07)
  - Giorno URL: data da created_at (es. 2026-07-02)
  - Importo: somma di total per tutte le righe con lo stesso giorno (created_at)
  - Un mese alla volta; mesi successivi saltati fino alla prossima run

Env utili:
  CORRISPETTIVI_MONTH=2026-07    Forza un mese specifico
  CORRISPETTIVI_FROM=2026-07-01  Filtro extra per giorno (created_at)
  CORRISPETTIVI_TO=2026-07-31
  FISCOZEN_AUTO_SUBMIT=true      Clicca Salva e aggiorna il foglio
`);
}

const command = process.argv[2] || "help";

const handlers = {
  login: cmdLogin,
  inspect: cmdInspect,
  "dry-run": cmdDryRun,
  submit: cmdSubmit,
  help: printHelp,
};

if (!handlers[command]) {
  console.error(`Comando sconosciuto: ${command}`);
  printHelp();
  process.exit(1);
}

handlers[command]().catch((error) => {
  console.error(error);
  process.exit(1);
});
