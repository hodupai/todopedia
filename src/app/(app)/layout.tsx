import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import ThemeProvider, { type ThemeInitial } from "@/components/ThemeProvider";
import GoldProvider from "@/components/GoldProvider";
import ToastProvider from "@/components/Toast";
import BgImage from "@/components/BgImage";
import { createClient } from "@/lib/supabase/server";
import { getUserFromSession } from "@/lib/supabase/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 미들웨어가 이미 인증을 검증했으므로 세션에서 user를 꺼내고 (네트워크 X)
  // 프로필을 한 번만 조회해서 두 Provider에 초기값으로 주입
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);

  let initialGold = 0;
  let initialStreak = 0;
  let themeInitial: ThemeInitial = {};

  if (user) {
    const [{ data: profile }, { data: streakData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("gold, active_bg, active_theme, active_font")
        .eq("id", user.id)
        .single(),
      supabase.rpc("get_user_streak", { p_user_id: user.id }),
    ]);

    if (typeof streakData === "number") initialStreak = streakData;

    if (profile) {
      initialGold = profile.gold ?? 0;
      themeInitial = {
        themeId: profile.active_theme,
        bgKey: profile.active_bg,
      };

      if (profile.active_font && profile.active_font !== "dunggeunmo") {
        const { data: fontData } = await supabase
          .from("shop_fonts")
          .select("font_family, import_url, font_face_css")
          .eq("font_key", profile.active_font)
          .single();
        if (fontData) {
          themeInitial.fontFamily = fontData.font_family;
          themeInitial.fontImportUrl = fontData.import_url;
          themeInitial.fontFaceCss = fontData.font_face_css;
        }
      }
    }
  }

  return (
    <ThemeProvider initial={themeInitial}>
      <GoldProvider initialGold={initialGold} initialStreak={initialStreak}>
        <ToastProvider>
          <div className="pixel-panel relative flex flex-1 flex-col overflow-hidden">
            <BgImage />
            <Header />
            <main
              className="flex flex-1 flex-col overflow-y-auto scrollbar-hide"
              style={{
                backgroundColor: "var(--theme-bg-translucent)",
                viewTransitionName: "main-content",
              }}
            >
              {children}
            </main>
            <BottomNav />
          </div>
        </ToastProvider>
      </GoldProvider>
    </ThemeProvider>
  );
}
