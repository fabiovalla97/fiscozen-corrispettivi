# Guida operativa (per umani e per AI)

Questo file spiega **come installare e far funzionare** lo script. Il [README](README.md) spiega solo il perché. Leggi questo file per intero prima di modificare codice o di guidare un utente nell’installazione.

Lingua: messaggi CLI in italiano; codice e commenti in inglese. Non committare `.env`, `.secrets/` né `data/browser-profile/` (contengono token e cookie di sessione).

Non è un client ufficiale Fiscozen. Non chiudere il mese in automatico. Non inventare importi.

---

## 1. Prerequisiti

| Componente | Versione | Note |
|------------|----------|------|
| Node.js | ≥ 20 | `node -v` |
| npm | incluso con Node | |
| Chromium Playwright | installato a parte | `npx playwright install chromium` è **obbligatorio** |

Serve un account Google con accesso in modifica al foglio, un client OAuth (o service account) con **Google Sheets API** abilitata, e un account Fiscozen (SMS al primo login nel browser dello script).

---

## 2. Installazione

```bash
cp .env.example .env
# Compila GOOGLE_SHEET_ID e i path delle credenziali
npm install
npx playwright install chromium
```

Poi, in ordine:

```bash
npm run google-auth    # token Google Sheets
npm run inspect        # deve mostrare mese e giorni senza errore
npm run login          # login Fiscozen nel Chromium Playwright
npm run submit         # preview: compila Importo, NON clicca Salva
```

---

## 3. Variabili d’ambiente

Tutti i valori arrivano da `.env` (caricato dalla root del progetto). Copia da `.env.example`. Non ci sono ID foglio o path segreti nel codice.

| Variabile | Obbligatoria | Significato |
|-----------|--------------|-------------|
| `GOOGLE_SHEET_ID` | sì | ID del foglio (dall’URL di Fogli Google) |
| `GOOGLE_SHEET_TAB` | sì | Nome della tab (es. `incassi`) |
| `GOOGLE_OAUTH_CLIENT_PATH` | sì (se OAuth) | JSON client OAuth Google Cloud |
| `GOOGLE_OAUTH_TOKEN_PATH` | sì (se OAuth) | Dove salvare/leggere il token (`npm run google-auth`) |
| `GOOGLE_SERVICE_ACCOUNT_PATH` | no | Alternativa all’OAuth: JSON service account |
| `FISCOZEN_BASE_URL` | sì | Di solito `https://app.fiscozen.it` |
| `FISCOZEN_BROWSER_PROFILE_DIR` | sì | Profilo Playwright (sessione Fiscozen), es. `./data/browser-profile` |
| `TIMEZONE` | sì | Timezone per `created_at` → giorno/mese, es. `Europe/Rome` |
| `FISCOZEN_AUTO_SUBMIT` | no | Default `false`. `true` = clicca Salva e aggiorna il foglio |
| `CORRISPETTIVI_MONTH` | no | Forza il mese `YYYY-MM` |
| `CORRISPETTIVI_FROM` / `TO` | no | Filtro inclusivo sul giorno (`YYYY-MM-DD`) |
| `FISCOZEN_BROWSER_EXECUTABLE` | no | Path Chromium. **Non** usare Chrome Windows da WSL |
| `OAUTH_REDIRECT_URI` | no | Default `http://localhost:8080` |
| `OAUTH_LISTEN_HOST` / `PORT` | no | Server locale per il redirect OAuth |

Lo script prova prima OAuth (client + token), poi il service account se il path esiste.

---

## 4. Google Sheets — autenticazione

### 4.1 Client OAuth (consigliato)

1. [Google Cloud Console](https://console.cloud.google.com/) → progetto tuo
2. Abilita **Google Sheets API**
3. Credenziali → ID client OAuth, tipo **Applicazione web**
4. URI di reindirizzamento: `http://localhost:8080`
5. Scarica il JSON (`"web": { "client_id", "client_secret", ... }` oppure `"installed"`)
6. Salvalo dove indica `GOOGLE_OAUTH_CLIENT_PATH` (es. `.secrets/google-oauth-web.json`)

```bash
npm run google-auth
```

Apri l’URL stampato con l’account che ha accesso al foglio. Se il redirect su `localhost:8080` non torna al terminale (tipico WSL), copia l’URL dalla barra del browser:

```bash
npm run google-auth -- --url "http://localhost:8080/?code=4/0A..."
```

Il token va in `GOOGLE_OAUTH_TOKEN_PATH`.

### 4.2 Service account

1. Crea un service account, scarica il JSON
2. `GOOGLE_SERVICE_ACCOUNT_PATH=.secrets/google-service-account.json`
3. **Condividi il foglio** con l’email del service account (Editor)

---

## 5. Login Fiscozen

Fiscozen non ha API. Si usa Playwright con un profilo dedicato (`FISCOZEN_BROWSER_PROFILE_DIR`), **non** il Chrome di tutti i giorni.

```bash
npm run login
```

Nel Chromium che si apre: email, password, SMS. Quando sei in dashboard, INVIO nel terminale. La sessione resta sul disco; l’SMS non serve a ogni run.

Reset:

```bash
npm run login -- --reset
```

Serve **WSLg** (Windows 11) se lanci da WSL e vuoi vedere il browser. Non puntare a `chrome.exe` Windows da WSL (`remote-debugging-pipe`).

---

## 6. Schema del foglio

Colonne usate (intestazioni esatte, case-insensitive). Modello importabile: [`examples/sheet-template.csv`](examples/sheet-template.csv).

| Colonna | Obbligatoria | Uso |
|---------|--------------|-----|
| `id` | sì | Identificativo riga |
| `created_at` | sì | Giorno, mese del batch, aggregazione |
| `total` | sì | Importo (`€ 9,99` o simile) |
| `fiscozen_status` | consigliata | `pending` / `submitted` / `error` / `skipped` |
| `fiscozen_submitted_at` | no | Timestamp write-back dopo Salva |
| `fiscozen_error` | no | Ultimo errore |
| `incasso_date` | no | Se presente (`YYYY-MM-DD`), sostituisce il giorno ricavato da `created_at` |
| `invoice_number`, `user_id`, `period_*`, `country` | no | Letti ma non usati per l’importo |

Regole:

- Mese da processare = mese di `created_at` della prima riga ancora pending, salvo `CORRISPETTIVI_MONTH`
- Un mese per run; le righe di altri mesi restano intatte
- Giorno Fiscozen = data `created_at` nella `TIMEZONE` (o `incasso_date`)
- Importo = somma di `total` delle righe con lo stesso giorno
- `submitted` e `skipped` vengono saltati in lettura
- Con `FISCOZEN_AUTO_SUBMIT=true`, dopo Salva lo script scrive `submitted` (o `error`) sul foglio

Non è un CSV Stripe nativo: è un foglio di incassi già normalizzati.

---

## 7. Comandi

| Comando | Effetto |
|---------|---------|
| `npm run google-auth` | OAuth Google Sheets |
| `npm run login` | Login Fiscozen nel profilo Playwright |
| `npm run login -- --reset` | Cancella il profilo e rilogga |
| `npm run inspect` / `npm run dry-run` | Legge il foglio, stampa batch (niente browser) |
| `npm run submit` | Preview: apre `/modifica`, compila Importo, **non** Salva |
| `FISCOZEN_AUTO_SUBMIT=true npm run submit` | Compila + Salva + write-back foglio |
| `npm test` | Self-test aggregazione (niente rete) |

Flusso `submit` per ogni giorno pending:

1. Apre `{FISCOZEN_BASE_URL}/app/corrispettivi/YYYY-MM-DD/modifica`
2. Compila **Importo** in formato italiano (`39,97`)
3. Scroll verso **Salva**
4. Se preview: aspetti INVIO nel terminale dopo il controllo visivo
5. Se auto-submit: clicca Salva, aggiorna state locale (`data/state.json`) e colonne status sul foglio

Se compare il banner “Non sei connesso”, lo script prova **Aggiorna**.

Consiglio: 1–2 giorni in preview, poi auto-submit per il resto del mese. I passaggi Fiscozen dopo i corrispettivi (chiusura mese, ecc.) restano manuali.

---

## 8. Mappa del codice

```
src/index.js                 CLI (login, inspect, submit)
src/config.js                Env (nessun default aziendale)
src/sheets/google-auth.js    OAuth o service account
src/sheets/reader.js         Lettura righe + write-back status
src/corrispettivi/           Batch mensile + aggregazione giornaliera
src/fiscozen/                Playwright, selettori, form Importo/Salva
src/utils/                   Date (timezone) e importi
scripts/sheets-oauth-login.mjs
examples/sheet-template.csv
```

State locale: `data/state.json` (giorni già inviati in questa macchina). Il foglio è la fonte di verità se c’è `fiscozen_status`.

---

## 9. Selettori UI Fiscozen

Calibrati con Playwright codegen. Navigazione diretta a `/modifica` (non serve più “Azioni corrispettivi”).

- textbox **Importo**
- button **Salva**

Se la UI cambia, aggiorna `src/fiscozen/selectors.js` dopo:

```bash
npx playwright codegen --user-data-dir=./data/browser-profile \
  "https://app.fiscozen.it/app/corrispettivi/2026-07-02/modifica"
```

---

## 10. WSL vs Windows

- Da WSL2 usa Chromium Linux di Playwright, non `chrome.exe`
- Serve WSLg per vedere la finestra
- OAuth: se `localhost:8080` non torna al processo, usa `--url` come sopra
- Pulsante Salva tagliato: ingrandire la finestra; lo script scrolla da solo

---

## 11. Problemi comuni

| Problema | Cosa fare |
|----------|-----------|
| `Missing GOOGLE_SHEET_ID` / `GOOGLE_SHEET_TAB` | Compila `.env` da `.env.example` |
| `Google Sheets auth not configured` | Path client/token in `.env`, poi `npm run google-auth` |
| `Executable doesn't exist` | `npx playwright install chromium` |
| `remote-debugging-pipe` | Non usare Chrome Windows da WSL |
| Sessione Fiscozen morta | `npm run login -- --reset` |
| Importo o giorno sbagliato | `npm run inspect`; controlla `created_at`, `TIMEZONE`, `total` |
| Token Google scaduto | `npm run google-auth` di nuovo |

---

## 12. Cosa non committare

- `.env`
- `.secrets/` (client OAuth, token, service account)
- `data/browser-profile/` (cookie Fiscozen = accesso all’account)
- `data/state.json`

Copiare questi file su un altro PC evita un nuovo SMS / un nuovo consenso Google, ma trattali come password.
