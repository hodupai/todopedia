"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { THEMES, DEFAULT_THEME, type ThemeConfig } from "@/lib/themes";
import { createClient } from "@/lib/supabase/client";
import { getUserFromSession } from "@/lib/supabase/auth";

export type ThemeInitial = {
  themeId?: string | null;
  bgKey?: string | null;
  fontFamily?: string | null;
  fontImportUrl?: string | null;
  fontFaceCss?: string | null;
};

const ThemeContext = createContext<{
  theme: ThemeConfig;
  setThemeId: (id: string) => void;
  bgKey: string;
  setBgKey: (key: string) => void;
  fontFamily: string;
  setFontFamily: (f: string) => void;
  refreshBg: () => void;
}>({
  theme: THEMES[DEFAULT_THEME],
  setThemeId: () => {},
  bgKey: "pixel_forest1",
  setBgKey: () => {},
  fontFamily: '"DungGeunMo", monospace',
  setFontFamily: () => {},
  refreshBg: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyThemeVars(theme: ThemeConfig) {
  const root = document.documentElement;
  const { assets, colors, flat } = theme;

  if (flat || !assets) {
    root.style.setProperty("--theme-frame", "none");
    root.style.setProperty("--theme-input", "none");
    root.style.setProperty("--theme-button", "none");
    root.style.setProperty("--theme-button-hover", "none");
    root.style.setProperty("--theme-banner", "none");
    root.dataset.themeFlat = "true";
  } else {
    root.style.setProperty("--theme-frame", `url("${assets.frame}")`);
    root.style.setProperty("--theme-input", `url("${assets.input}")`);
    root.style.setProperty("--theme-button", `url("${assets.button}")`);
    root.style.setProperty("--theme-button-hover", `url("${assets.buttonHover}")`);
    root.style.setProperty("--theme-banner", `url("${assets.banner}")`);
    delete root.dataset.themeFlat;
  }

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

function injectFontAssets(importUrl?: string | null, faceCss?: string | null) {
  if (typeof document === "undefined") return;
  if (importUrl) {
    const id = `theme-font-link-${importUrl}`;
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = importUrl;
      document.head.appendChild(link);
    }
  }
  if (faceCss) {
    // 해시 대신 내용 길이+첫 32자로 고유 id (간단 dedupe)
    const id = `theme-font-style-${faceCss.length}-${faceCss.slice(0, 32).replace(/\W/g, "")}`;
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = faceCss;
      document.head.appendChild(style);
    }
  }
}

export default function ThemeProvider({
  initial,
  children,
}: {
  initial?: ThemeInitial;
  children: React.ReactNode;
}) {
  const [themeId, setThemeId] = useState(
    initial?.themeId && THEMES[initial.themeId] ? initial.themeId : DEFAULT_THEME
  );
  const [bgKey, setBgKey] = useState(initial?.bgKey || "pixel_forest1");
  const [fontFamily, setFontFamily] = useState(
    initial?.fontFamily || '"DungGeunMo", monospace'
  );
  const theme = THEMES[themeId] ?? THEMES[DEFAULT_THEME];

  // 초기 폰트 에셋 주입 (마운트 시 1회)
  useEffect(() => {
    injectFontAssets(initial?.fontImportUrl, initial?.fontFaceCss);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshBg = useCallback(async () => {
    const supabase = createClient();
    const user = await getUserFromSession(supabase);
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("active_bg, active_theme, active_font")
      .eq("id", user.id)
      .single();

    if (data?.active_bg) setBgKey(data.active_bg);
    if (data?.active_theme && THEMES[data.active_theme]) setThemeId(data.active_theme);

    if (data?.active_font && data.active_font !== "dunggeunmo") {
      const { data: fontData } = await supabase
        .from("shop_fonts")
        .select("font_family, import_url, font_face_css")
        .eq("font_key", data.active_font)
        .single();

      if (fontData) {
        injectFontAssets(fontData.import_url, fontData.font_face_css);
        setFontFamily(fontData.font_family);
      }
    } else if (data?.active_font === "dunggeunmo") {
      setFontFamily('"DungGeunMo", monospace');
    }
  }, []);

  useEffect(() => {
    applyThemeVars(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-pixel", fontFamily);
  }, [fontFamily]);

  return (
    <ThemeContext.Provider value={{ theme, setThemeId, bgKey, setBgKey, fontFamily, setFontFamily, refreshBg }}>
      {children}
    </ThemeContext.Provider>
  );
}
