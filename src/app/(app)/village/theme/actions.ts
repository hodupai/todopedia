"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserFromSession } from "@/lib/supabase/auth";

// ── 테마 ──
export type ShopTheme = {
  id: number;
  theme_key: string;
  name: string;
  price: number;
  is_default: boolean;
  owned: boolean;
};

export async function getThemes(): Promise<ShopTheme[]> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return [];

  const { data: themes } = await supabase.from("shop_themes").select("*").order("price");
  const { data: owned } = await supabase.from("owned_themes").select("theme_id").eq("user_id", user.id);
  const ownedSet = new Set((owned || []).map((o: any) => o.theme_id));

  return (themes || []).map((t: any) => ({ ...t, owned: ownedSet.has(t.id) }));
}

export async function getActiveTheme(): Promise<string> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return "paper";
  const { data } = await supabase.from("profiles").select("active_theme").eq("id", user.id).single();
  return data?.active_theme || "paper";
}

export async function buyTheme(themeId: number) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };
  const { data, error } = await supabase.rpc("buy_theme", { p_user_id: user.id, p_theme_id: themeId });
  if (error) {
    if (error.message.includes("already_owned")) return { error: "이미 소유하고 있어요." };
    if (error.message.includes("not_enough_gold")) return { error: "골드가 부족해요." };
    return { error: "구매에 실패했습니다." };
  }
  return { success: true, data };
}

export async function setActiveTheme(themeKey: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };
  const { error } = await supabase.rpc("set_active_theme", { p_user_id: user.id, p_theme_key: themeKey });
  if (error) return { error: "적용에 실패했습니다." };
  return { success: true };
}

// ── 폰트 ──
export type ShopFont = {
  id: number;
  font_key: string;
  name: string;
  font_family: string;
  import_url: string | null;
  font_face_css: string | null;
  price: number;
  is_default: boolean;
  owned: boolean;
};

export async function getFonts(): Promise<ShopFont[]> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return [];
  const { data: fonts } = await supabase.from("shop_fonts").select("*").order("price");
  const { data: owned } = await supabase.from("owned_fonts").select("font_id").eq("user_id", user.id);
  const ownedSet = new Set((owned || []).map((o: any) => o.font_id));
  return (fonts || []).map((f: any) => ({ ...f, owned: ownedSet.has(f.id) }));
}

export async function getActiveFont(): Promise<string> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return "dunggeunmo";
  const { data } = await supabase.from("profiles").select("active_font").eq("id", user.id).single();
  return data?.active_font || "dunggeunmo";
}

export async function buyFont(fontId: number) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };
  const { data, error } = await supabase.rpc("buy_font", { p_user_id: user.id, p_font_id: fontId });
  if (error) {
    if (error.message.includes("already_owned")) return { error: "이미 소유하고 있어요." };
    if (error.message.includes("not_enough_gold")) return { error: "골드가 부족해요." };
    return { error: "구매에 실패했습니다." };
  }
  return { success: true, data };
}

export async function setActiveFont(fontKey: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };
  const { error } = await supabase.rpc("set_active_font", { p_user_id: user.id, p_font_key: fontKey });
  if (error) return { error: "적용에 실패했습니다." };
  return { success: true };
}

export type ShopBackground = {
  id: number;
  name: string;
  asset_key: string;
  price: number;
  is_default: boolean;
  owned: boolean;
};

// ── 배경 목록 (소유 여부 포함) ──
export async function getBackgrounds(): Promise<ShopBackground[]> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return [];

  const { data: bgs } = await supabase
    .from("shop_backgrounds")
    .select("*")
    .order("price");

  const { data: owned } = await supabase
    .from("owned_backgrounds")
    .select("background_id")
    .eq("user_id", user.id);

  const ownedSet = new Set((owned || []).map((o: any) => o.background_id));

  return (bgs || []).map((bg: any) => ({
    ...bg,
    owned: ownedSet.has(bg.id),
  }));
}

// ── 현재 활성 배경 ──
export async function getActiveBg(): Promise<string> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return "pixel_forest1";

  const { data } = await supabase
    .from("profiles")
    .select("active_bg")
    .eq("id", user.id)
    .single();

  return data?.active_bg || "pixel_forest1";
}

// ── 배경 구매 ──
export async function buyBackground(backgroundId: number) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("buy_background", {
    p_user_id: user.id,
    p_background_id: backgroundId,
  });

  if (error) {
    if (error.message.includes("already_owned")) return { error: "이미 소유하고 있어요." };
    if (error.message.includes("not_enough_gold")) return { error: "골드가 부족해요." };
    return { error: "구매에 실패했습니다." };
  }
  return { success: true, data };
}

// ── 배경 적용 ──
export async function setActiveBg(assetKey: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { error } = await supabase.rpc("set_active_bg", {
    p_user_id: user.id,
    p_asset_key: assetKey,
  });

  if (error) return { error: "적용에 실패했습니다." };
  return { success: true };
}
