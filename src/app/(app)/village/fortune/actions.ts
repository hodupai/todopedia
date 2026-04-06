"use server";

import { createClient } from "@/lib/supabase/server";

export type PotionItem = {
  id: number;
  name: string;
  description: string;
  price: number;
  asset_key: string;
  normal_guarantee: boolean;
  rare_mult: number;
  epic_mult: number;
  unique_mult: number;
  owned: number;
};

// ── 포션 목록 (소지 수량 포함) ──
export async function getPotions(): Promise<PotionItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: potions } = await supabase
    .from("potion_types")
    .select("*")
    .order("price");

  if (!potions) return [];

  const { data: inv } = await supabase
    .from("potion_inventory")
    .select("potion_type_id, quantity")
    .eq("user_id", user.id);

  const invMap = new Map((inv || []).map((i: any) => [i.potion_type_id, i.quantity]));

  return potions.map((p: any) => ({
    ...p,
    owned: invMap.get(p.id) || 0,
  }));
}

// ── 포션 구매 ──
export async function buyPotion(potionTypeId: number, quantity: number = 1) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("buy_potion", {
    p_user_id: user.id,
    p_potion_type_id: potionTypeId,
    p_quantity: quantity,
  });

  if (error) {
    if (error.message.includes("not_enough_gold")) return { error: "골드가 부족합니다." };
    return { error: "구매에 실패했습니다." };
  }

  return { success: true, data };
}
