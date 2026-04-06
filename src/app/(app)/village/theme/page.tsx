"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getBackgrounds, getActiveBg, buyBackground, setActiveBg,
  getThemes, getActiveTheme, buyTheme, setActiveTheme,
  getFonts, getActiveFont, buyFont, setActiveFont,
} from "./actions";
import type { ShopBackground, ShopTheme, ShopFont } from "./actions";
import { THEMES } from "@/lib/themes";
import { useGold } from "@/components/GoldProvider";
import { useToast } from "@/components/Toast";
import { useTheme } from "@/components/ThemeProvider";

const TABS = ["배경화면", "테마", "폰트"] as const;

export default function ThemeShopPage() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("배경화면");

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="pixel-button px-3 py-1 font-pixel text-xs text-theme">←</button>
        <h1 className="font-pixel text-sm text-theme">테마샵</h1>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pixel-button py-2 font-pixel text-xs ${tab === t ? "text-theme" : "text-theme-muted"}`}
            style={tab === t ? { opacity: 1 } : { opacity: 0.5 }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "배경화면" && <BackgroundTab />}
      {tab === "테마" && <ThemeTab />}
      {tab === "폰트" && <FontTab />}
    </div>
  );
}

function BackgroundTab() {
  const [backgrounds, setBackgrounds] = useState<ShopBackground[]>([]);
  const [activeBg, setActiveBgState] = useState("pixel_forest1");
  const [selected, setSelected] = useState<ShopBackground | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const { gold, refresh: refreshGold } = useGold();
  const { show: showToast } = useToast();
  const { refreshBg } = useTheme();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [bgs, active] = await Promise.all([getBackgrounds(), getActiveBg()]);
    setBackgrounds(bgs);
    setActiveBgState(active);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBuy = async (bg: ShopBackground) => {
    if (gold < bg.price) { showToast("골드가 부족해요!"); return; }
    setBuying(true);
    const r = await buyBackground(bg.id);
    if (r.error) showToast(r.error);
    else { showToast(`${bg.name} 구매!`, `-${bg.price}G`); refreshGold(); loadData(); }
    setBuying(false);
    setSelected(null);
  };

  const handleApply = async (bg: ShopBackground) => {
    const r = await setActiveBg(bg.asset_key);
    if (r.error) showToast(r.error);
    else { showToast(`${bg.name} 적용!`); setActiveBgState(bg.asset_key); refreshBg(); loadData(); }
    setSelected(null);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><p className="font-pixel text-xs text-theme-muted">로딩 중...</p></div>;
  }

  return (
    <>
      <div className="pixel-panel flex-1 overflow-y-auto scrollbar-hide p-3">
        <div className="grid grid-cols-2 gap-3">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => setSelected(bg)}
              className="pixel-input overflow-hidden"
              style={{ aspectRatio: "16/9" }}
            >
              <div className="relative h-full w-full">
                <img
                  src={`/ui/${bg.asset_key}.jpg`}
                  alt={bg.name}
                  className="h-full w-full object-cover"
                />
                {/* 현재 적용 중 뱃지 */}
                {activeBg === bg.asset_key && (
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 font-pixel text-[10px]"
                    style={{ backgroundColor: "var(--theme-accent)", color: "#fff", borderRadius: "2px" }}>
                    적용중
                  </span>
                )}
                {/* 하단 이름+가격 */}
                <div className="absolute bottom-0 inset-x-0 px-2 py-1"
                  style={{ background: "linear-gradient(transparent, rgba(0,0,0,0.7))" }}>
                  <p className="font-pixel text-xs text-white">{bg.name}</p>
                  {!bg.owned && (
                    <p className="font-pixel text-[10px]" style={{ color: "#f1c40f" }}>{bg.price}G</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 상세 모달 */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setSelected(null)}>
          <div className="pixel-panel w-full max-w-[320px] p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            {/* 미리보기 */}
            <div className="pixel-input overflow-hidden" style={{ aspectRatio: "16/9" }}>
              <img
                src={`/ui/${selected.asset_key}.jpg`}
                alt={selected.name}
                className="h-full w-full object-cover"
              />
            </div>
            <p className="font-pixel text-sm text-theme text-center">{selected.name}</p>

            {selected.owned ? (
              <div className="flex gap-2">
                {activeBg === selected.asset_key ? (
                  <p className="flex-1 text-center font-pixel text-xs text-theme-muted py-2">현재 적용 중</p>
                ) : (
                  <button
                    onClick={() => handleApply(selected)}
                    className="pixel-button flex-1 py-2 font-pixel text-xs text-theme"
                  >적용</button>
                )}
                <button onClick={() => setSelected(null)}
                  className="pixel-button flex-1 py-2 font-pixel text-xs text-theme-muted">닫기</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handleBuy(selected)}
                  disabled={buying}
                  className="pixel-button flex-1 py-2 font-pixel text-xs text-theme"
                >
                  {buying ? "구매 중..." : `${selected.price}G 구매`}
                </button>
                <button onClick={() => setSelected(null)}
                  className="pixel-button flex-1 py-2 font-pixel text-xs text-theme-muted">닫기</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── 테마 탭 ──
function ThemeTab() {
  const [themes, setThemesState] = useState<ShopTheme[]>([]);
  const [activeThemeKey, setActiveThemeKey] = useState("paper");
  const [selected, setSelected] = useState<ShopTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const { gold, refresh: refreshGold } = useGold();
  const { show: showToast } = useToast();
  const { setThemeId, refreshBg } = useTheme();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [t, active] = await Promise.all([getThemes(), getActiveTheme()]);
    setThemesState(t);
    setActiveThemeKey(active);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBuy = async (theme: ShopTheme) => {
    if (gold < theme.price) { showToast("골드가 부족해요!"); return; }
    setBuying(true);
    const r = await buyTheme(theme.id);
    if (r.error) showToast(r.error);
    else { showToast(`${theme.name} 테마 구매!`, `-${theme.price}G`); refreshGold(); loadData(); }
    setBuying(false);
    setSelected(null);
  };

  const handleApply = async (theme: ShopTheme) => {
    const r = await setActiveTheme(theme.theme_key);
    if (r.error) showToast(r.error);
    else {
      showToast(`${theme.name} 테마 적용!`);
      setActiveThemeKey(theme.theme_key);
      setThemeId(theme.theme_key);
      loadData();
    }
    setSelected(null);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><p className="font-pixel text-xs text-theme-muted">로딩 중...</p></div>;
  }

  return (
    <>
      <div className="pixel-panel flex-1 overflow-y-auto scrollbar-hide p-3">
        <div className="space-y-3">
          {themes.map((theme) => {
            const config = THEMES[theme.theme_key];
            return (
              <button
                key={theme.id}
                onClick={() => setSelected(theme)}
                className="pixel-input flex w-full items-center gap-3 p-3"
              >
                {/* 미리보기 색상 */}
                <div
                  className="h-12 w-12 shrink-0 rounded"
                  style={{
                    backgroundColor: config?.colors.bg || "#ccc",
                    border: `2px solid ${config?.colors.accent || "#999"}`,
                  }}
                />
                <div className="flex-1 text-left">
                  <p className="font-pixel text-sm text-theme">{theme.name}</p>
                  {activeThemeKey === theme.theme_key && (
                    <span className="font-pixel text-xs" style={{ color: "var(--theme-accent)" }}>적용중</span>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {theme.owned ? (
                    <span className="font-pixel text-xs text-theme-muted">보유</span>
                  ) : (
                    <span className="font-pixel text-xs" style={{ color: "var(--theme-gold)" }}>{theme.price}G</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 상세 모달 */}
      {selected && (() => {
        const config = THEMES[selected.theme_key];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
            onClick={() => setSelected(null)}>
            <div className="pixel-panel w-full max-w-[320px] p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <p className="font-pixel text-sm text-theme text-center">{selected.name} 테마</p>

              {/* 색상 미리보기 */}
              {config && (
                <div className="rounded overflow-hidden" style={{ backgroundColor: config.colors.bg, border: `2px solid ${config.colors.accent}` }}>
                  <div className="px-3 py-2" style={{ backgroundColor: config.colors.headerBg }}>
                    <span style={{ color: config.colors.headerText, fontFamily: "var(--font-pixel)", fontSize: 12 }}>헤더 미리보기</span>
                  </div>
                  <div className="px-3 py-3">
                    <p style={{ color: config.colors.panelText, fontFamily: "var(--font-pixel)", fontSize: 12 }}>본문 텍스트</p>
                    <p style={{ color: config.colors.panelTextMuted, fontFamily: "var(--font-pixel)", fontSize: 10 }}>보조 텍스트</p>
                  </div>
                  <div className="px-3 py-2" style={{ backgroundColor: config.colors.navBg }}>
                    <span style={{ color: config.colors.navTextActive, fontFamily: "var(--font-pixel)", fontSize: 10 }}>네비게이션</span>
                  </div>
                </div>
              )}

              {selected.owned ? (
                <div className="flex gap-2">
                  {activeThemeKey === selected.theme_key ? (
                    <p className="flex-1 text-center font-pixel text-xs text-theme-muted py-2">현재 적용 중</p>
                  ) : (
                    <button onClick={() => handleApply(selected)} className="pixel-button flex-1 py-2 font-pixel text-xs text-theme">적용</button>
                  )}
                  <button onClick={() => setSelected(null)} className="pixel-button flex-1 py-2 font-pixel text-xs text-theme-muted">닫기</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => handleBuy(selected)} disabled={buying}
                    className="pixel-button flex-1 py-2 font-pixel text-xs text-theme">
                    {buying ? "구매 중..." : `${selected.price}G 구매`}
                  </button>
                  <button onClick={() => setSelected(null)} className="pixel-button flex-1 py-2 font-pixel text-xs text-theme-muted">닫기</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </>
  );
}

// ── 폰트 탭 ──
function FontTab() {
  const [fonts, setFonts] = useState<ShopFont[]>([]);
  const [activeFontKey, setActiveFontKey] = useState("dunggeunmo");
  const [selected, setSelected] = useState<ShopFont | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const { gold, refresh: refreshGold } = useGold();
  const { show: showToast } = useToast();
  const { setFontFamily, refreshBg } = useTheme();

  const loadData = useCallback(async () => {
    setLoading(true);
    const [f, active] = await Promise.all([getFonts(), getActiveFont()]);
    setFonts(f);
    setActiveFontKey(active);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBuy = async (font: ShopFont) => {
    if (gold < font.price) { showToast("골드가 부족해요!"); return; }
    setBuying(true);
    const r = await buyFont(font.id);
    if (r.error) showToast(r.error);
    else { showToast(`${font.name} 구매!`, `-${font.price}G`); refreshGold(); loadData(); }
    setBuying(false);
    setSelected(null);
  };

  const handleApply = async (font: ShopFont) => {
    const r = await setActiveFont(font.font_key);
    if (r.error) { showToast(r.error); return; }

    // 폰트 CSS 동적 로드
    if (font.import_url) {
      const existing = document.querySelector(`link[href="${font.import_url}"]`);
      if (!existing) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = font.import_url;
        document.head.appendChild(link);
      }
    }
    if (font.font_face_css) {
      const style = document.createElement("style");
      style.textContent = font.font_face_css;
      document.head.appendChild(style);
    }

    setFontFamily(font.font_family);
    setActiveFontKey(font.font_key);
    showToast(`${font.name} 폰트 적용!`);
    setSelected(null);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><p className="font-pixel text-xs text-theme-muted">로딩 중...</p></div>;
  }

  return (
    <>
      <div className="pixel-panel flex-1 overflow-y-auto scrollbar-hide p-3">
        <div className="space-y-3">
          {fonts.map((font) => (
            <button
              key={font.id}
              onClick={() => setSelected(font)}
              className="pixel-input flex w-full items-center gap-3 p-3"
            >
              <div className="flex-1 text-left">
                <p className="font-pixel text-sm text-theme">{font.name}</p>
                <p className="text-xs text-theme-muted" style={{ fontFamily: font.font_family }}>
                  가나다라 ABCD 1234
                </p>
                {activeFontKey === font.font_key && (
                  <span className="font-pixel text-xs" style={{ color: "var(--theme-accent)" }}>적용중</span>
                )}
              </div>
              <div className="shrink-0 text-right">
                {font.owned ? (
                  <span className="font-pixel text-xs text-theme-muted">보유</span>
                ) : (
                  <span className="font-pixel text-xs" style={{ color: "var(--theme-gold)" }}>{font.price}G</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setSelected(null)}>
          <div className="pixel-panel w-full max-w-[320px] p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="font-pixel text-sm text-theme text-center">{selected.name}</p>
            <div className="pixel-input p-3">
              <p className="text-sm text-theme" style={{ fontFamily: selected.font_family }}>
                가나다라마바사 아자차카타파하
              </p>
              <p className="text-sm text-theme-muted mt-1" style={{ fontFamily: selected.font_family }}>
                ABCDEFG abcdefg 0123456789
              </p>
            </div>

            {selected.owned ? (
              <div className="flex gap-2">
                {activeFontKey === selected.font_key ? (
                  <p className="flex-1 text-center font-pixel text-xs text-theme-muted py-2">현재 적용 중</p>
                ) : (
                  <button onClick={() => handleApply(selected)} className="pixel-button flex-1 py-2 font-pixel text-xs text-theme">적용</button>
                )}
                <button onClick={() => setSelected(null)} className="pixel-button flex-1 py-2 font-pixel text-xs text-theme-muted">닫기</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => handleBuy(selected)} disabled={buying}
                  className="pixel-button flex-1 py-2 font-pixel text-xs text-theme">
                  {buying ? "구매 중..." : `${selected.price}G 구매`}
                </button>
                <button onClick={() => setSelected(null)} className="pixel-button flex-1 py-2 font-pixel text-xs text-theme-muted">닫기</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
