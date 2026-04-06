"use server";

import { createClient } from "@/lib/supabase/server";

export type ShopItem = {
  id: number;
  category: string;
  name: string;
  price: number;
  asset_key: string;
  owned: number;       // 소지 수량
  collected: boolean;  // 도감 등록 여부
};

// ── 상점 아이템 목록 (카테고리별, 소지/도감 포함) ──
export async function getShopItems(category: string): Promise<ShopItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: items } = await supabase
    .from("item_types")
    .select("id, category, name, price, asset_key")
    .eq("category", category)
    .order("price");

  if (!items) return [];

  // 인벤토리 조회
  const { data: inv } = await supabase
    .from("inventory")
    .select("item_type_id, quantity")
    .eq("user_id", user.id);

  const invMap = new Map((inv || []).map((i: any) => [i.item_type_id, i.quantity]));

  // 도감 조회
  const { data: coll } = await supabase
    .from("item_collection")
    .select("item_type_id")
    .eq("user_id", user.id);

  const collSet = new Set((coll || []).map((c: any) => c.item_type_id));

  return items.map((item: any) => ({
    ...item,
    owned: invMap.get(item.id) || 0,
    collected: collSet.has(item.id),
  }));
}

// ── 아이템 구매 ──
export async function buyItem(itemTypeId: number, quantity: number = 1) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("buy_item", {
    p_user_id: user.id,
    p_item_type_id: itemTypeId,
    p_quantity: quantity,
  });

  if (error) {
    if (error.message.includes("not_enough_gold")) {
      return { error: "골드가 부족합니다." };
    }
    return { error: "구매에 실패했습니다." };
  }

  return { success: true, data };
}
