"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { THEMES, DEFAULT_THEME, type ThemeConfig } from "@/lib/themes";

const ThemeContext = createContext<{
  theme: ThemeConfig;
  setThemeId: (id: string) => void;
}>({
  theme: THEMES[DEFAULT_THEME],
  setThemeId: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyThemeVars(theme: ThemeConfig) {
  const root = document.documentElement;
  const { assets, colors } = theme;

  root.style.setProperty("--theme-frame", `url("${assets.frame}")`);
  root.style.setProperty("--theme-input", `url("${assets.input}")`);
  root.style.setProperty("--theme-button", `url("${assets.button}")`);
  root.style.setProperty("--theme-button-hover", `url("${assets.buttonHover}")`);
  root.style.setProperty("--theme-banner", `url("${assets.banner}")`);

  root.style.setProperty("--theme-bg", colors.bg);
  root.style.setProperty("--theme-bg-translucent", colors.bgTranslucent);
  root.style.setProperty("--theme-text", colors.panelText);
  root.style.setProperty("--theme-text-muted", colors.panelTextMuted);
  root.style.setProperty("--theme-placeholder", colors.placeholder);
  root.style.setProperty("--theme-accent", colors.accent);
  root.style.setProperty("--theme-gold", colors.gold);
  root.style.setProperty("--theme-header-bg", colors.headerBg);
  root.style.setProperty("--theme-header-text", colors.headerText);
  root.style.setProperty("--theme-nav-bg", colors.navBg);
  root.style.setProperty("--theme-nav-text", colors.navText);
  root.style.setProperty("--theme-nav-text-active", colors.navTextActive);
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState(DEFAULT_THEME);
  const theme = THEMES[themeId] ?? THEMES[DEFAULT_THEME];

  useEffect(() => {
    applyThemeVars(theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}
