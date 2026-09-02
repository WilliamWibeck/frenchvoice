export const THEME_KEY = "frenchvoice-theme";

export function loadTheme() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "soir" || stored === "salon") return stored;
  } catch {
    /* ignore */
  }
  return "salon";
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function applyTheme(theme) {
  const next = theme === "soir" ? "soir" : "salon";
  document.documentElement.dataset.theme = next;
  document.documentElement.style.colorScheme = next === "soir" ? "dark" : "light";
}
