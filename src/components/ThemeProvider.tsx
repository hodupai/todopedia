"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { THEMES, DEFAULT_THEME, type ThemeConfig } from "@/lib/themes";
import { createClient } from "@/lib/supabase/client";

const ThemeContext = createContext<{
  theme: ThemeConfig;
  setThemeId: (id: string) => void;
  bgKey: string;
  setBgKey: (key: string) => void;
  refreshBg: () => void;
}>({
  theme: THEMES[DEFAULT_THEME],
  setThemeId: () => {},
  bgKey: "pixel_forest1",
  setBgKey: () => {},
  refreshBg: () => {},
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
  const [bgKey, setBgKey] = useState("pixel_forest1");
  const theme = THEMES[themeId] ?? THEMES[DEFAULT_THEME];

  const refreshBg = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("active_bg, active_theme")
      .eq("id", user.id)
      .single();

    if (data?.active_bg) setBgKey(data.active_bg);
    if (data?.active_theme && THEMES[data.active_theme]) setThemeId(data.active_theme);
  }, []);

  useEffect(() => {
    applyThemeVars(theme);
  }, [theme]);

  useEffect(() => {
    refreshBg();
  }, [refreshBg]);

  return (
    <ThemeContext.Provider value={{ theme, setThemeId, bgKey, setBgKey, refreshBg }}>
      {children}
    </ThemeContext.Provider>
  );
}
