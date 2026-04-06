"use server";

import { createClient } from "@/lib/supabase/server";

export type CollectionItem = {
  id: string;
  guardian_type_id: number;
  name: string;
  rarity: string;
  asset_key: string;
  period_days: number;
  achievement_rate: number;
  is_duplicate: boolean;
  acquired_at: string;
  season_id: number;
};

export type GuardianType = {
  id: number;
  season_id: number;
  name: string;
  rarity: string;
  asset_key: string;
};

// ── 시즌별 가디언 타입 전체 목록 ──
export async function getGuardianTypes(seasonId: number = 1) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guardian_types")
    .select("id, season_id, name, rarity, asset_key")
    .eq("season_id", seasonId)
    .order("id");

  return (data as GuardianType[]) || [];
}

// ── 내 컬렉션 ──
export async function getCollection(seasonId?: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_collection", {
    p_user_id: user.id,
    p_season_id: seasonId ?? null,
  });

  if (error) return [];
  return (data as CollectionItem[]) || [];
}

// ── 컬렉션 요약 ──
// ── 아이템 도감 데이터 ──
export type ItemType = {
  id: number;
  category: string;
  name: string;
  price: number;
  asset_key: string;
  description: string;
};

export async function getItemTypes(category: string): Promise<ItemType[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("item_types")
    .select("id, category, name, price, asset_key, description")
    .eq("category", category)
    .order("id");

  return (data as ItemType[]) || [];
}

export async function getItemCollection(): Promise<Set<number>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from("item_collection")
    .select("item_type_id")
    .eq("user_id", user.id);

  return new Set((data || []).map((d: any) => d.item_type_id));
}

export async function getItemCollectionSummary() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase.rpc("get_item_collection_summary", {
    p_user_id: user.id,
  });

  return data || [];
}

export async function getCollectionSummary(seasonId?: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { collected: 0, total: 0 };

  const { data, error } = await supabase.rpc("get_collection_summary", {
    p_user_id: user.id,
    p_season_id: seasonId ?? null,
  });

  if (error) return { collected: 0, total: 0 };
  return data?.[0] || { collected: 0, total: 0 };
}
