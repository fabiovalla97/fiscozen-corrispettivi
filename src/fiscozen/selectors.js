/**
 * Fiscozen day-edit flow (recorded via Playwright codegen).
 *
 * Direct navigation: /app/corrispettivi/YYYY-MM-DD/modifica → Importo → Salva
 */
export const selectors = {
  login: {
    emailInput: 'input[type="email"]',
    passwordInput: 'input[type="password"]',
    submitButton: 'button[type="submit"]',
  },
  dayPage: {
    azioniButton: { role: "button", name: "Azioni corrispettivi" },
    modificaLink: { role: "link", name: "Modifica" },
  },
  editForm: {
    importoInput: { role: "textbox", name: "Importo" },
    salvaButton: { role: "button", name: "Salva" },
    annullaButton: { role: "button", name: "Annulla" },
  },
};

export const urls = {
  login: "/login",
  corrispettiviDay: (date) => `/app/corrispettivi/${date}`,
};
