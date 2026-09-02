import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { applyTheme, loadTheme, saveTheme } from "../lib/theme.js";

const ThemeContext = createContext({
  theme: "salon",
  setTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(loadTheme);

  useEffect(() => {
    applyTheme(theme);
    saveTheme(theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next) => setThemeState(next === "soir" ? "soir" : "salon"),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-toggle" role="group" aria-label="Thème">
      <button
        type="button"
        className={theme === "salon" ? "on" : ""}
        aria-pressed={theme === "salon"}
        onClick={() => setTheme("salon")}
      >
        Salon
      </button>
      <button
        type="button"
        className={theme === "soir" ? "on" : ""}
        aria-pressed={theme === "soir"}
        onClick={() => setTheme("soir")}
      >
        Soir
      </button>
    </div>
  );
}
