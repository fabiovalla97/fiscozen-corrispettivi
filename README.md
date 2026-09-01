# Corrispettivi Fiscozen da un foglio di incassi

Se hai una **ditta individuale** (spesso in forfettario) e vendi online — abbonamenti, prodotti digitali, e-commerce, pagamenti con **Stripe** o strumenti simili — di solito **non emetti una fattura elettronica per ogni incasso**. Quei pagamenti vanno dichiarati come **corrispettivi** sul calendario di Fiscozen, un giorno alla volta, a mano.

Fiscozen **non offre un’API pubblica**. A fine mese copiare importi e date dal gestionale (o da un export) è lento e facile sbagliare il giorno o il totale.

Questo script fa quella parte ripetitiva: legge gli incassi da un **Google Sheet**, li somma **per giorno**, apre la pagina Fiscozen di quel giorno e compila il campo **Importo**. Tu controlli; se vuoi, può anche cliccare **Salva**.

Non è un prodotto ufficiale Fiscozen, non chiude il mese al posto tuo e non sostituisce il commercialista. Se Fiscozen cambia la schermata, i selettori vanno aggiornati. Gli importi restano tua responsabilità.

## Come si usa, in tre passi

1. Metti gli incassi in un **Google Sheet** con le colonne del modello (non l’export grezzo di Stripe: è già il formato “incassi da dichiarare come corrispettivi”).
2. Per partire in fretta puoi importare [`examples/sheet-template.csv`](examples/sheet-template.csv) in Fogli Google (**File → Importa**) e sostituire le righe di esempio con i tuoi dati.
3. Lo script legge il foglio, aggrega per giorno e apre Fiscozen.

```
Incassi (es. Stripe)  →  Google Sheet (colonne del template)  →  questo script  →  Fiscozen, un giorno alla volta
```

Installazione, autenticazione Google, login Fiscozen, variabili d’ambiente, comandi e troubleshooting sono in **[AGENTS.md](AGENTS.md)** — è il file da dare a un’AI (o da seguire tu) per far funzionare tutto.

## Licenza e disclaimer

[MIT](LICENSE): puoi scaricare, usare e modificare liberamente.

Il software è fornito “così com’è”. Non è consulenza fiscale. Verifica sempre i corrispettivi sul sito Fiscozen prima di chiudere il periodo.
