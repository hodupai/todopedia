"use server";

import { createClient } from "@/lib/supabase/server";

export type CareStatus = {
  food: boolean;
  play: boolean;
  hygiene: boolean;
  sleep: boolean;
};

export type OwnedCareItem = {
  id: number;
  name: string;
  asset_key: string;
  quantity: number;
  category: string;
};

// ── 활성 가디 조회 ──
export async function getActiveGuardian() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("active_guardians")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return data;
}

// ── 가디 시작 ──
export async function startGuardian(periodDays: number, dailyGoal: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("start_guardian", {
    p_user_id: user.id,
    p_period_days: periodDays,
    p_daily_goal: dailyGoal,
  });

  if (error) {
    if (error.message.includes("guardian_already_active")) {
      return { error: "이미 키우는 가디가 있어요." };
    }
    return { error: "가디 시작에 실패했습니다." };
  }

  return { success: true, data };
}

// ── 성장치 기록 ──
export async function recordGrowth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc("record_guardian_growth", {
    p_user_id: user.id,
  });

  if (error) return null;
  return data;
}

// ── 진화 (가챠) ──
export async function evolveGuardian(potionTypeId?: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("evolve_guardian", {
    p_user_id: user.id,
    p_potion_type_id: potionTypeId ?? null,
  });

  if (error) {
    if (error.message.includes("no_ready_guardian")) {
      return { error: "진화 가능한 가디가 없어요." };
    }
    if (error.message.includes("potion_not_in_inventory")) {
      return { error: "포션이 없어요." };
    }
    return { error: "진화에 실패했습니다." };
  }

  return { success: true, data };
}

export type OwnedPotion = {
  id: number;
  name: string;
  description: string;
  asset_key: string;
  quantity: number;
  normal_guarantee: boolean;
  rare_mult: number;
  epic_mult: number;
  unique_mult: number;
};

// ── 소지 포션 목록 ──
export async function getOwnedPotions(): Promise<OwnedPotion[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("potion_inventory")
    .select("quantity, potion_types(*)")
    .eq("user_id", user.id)
    .gt("quantity", 0);

  if (!data) return [];

  return data.map((d: any) => ({
    id: d.potion_types.id,
    name: d.potion_types.name,
    description: d.potion_types.description,
    asset_key: d.potion_types.asset_key,
    quantity: d.quantity,
    normal_guarantee: d.potion_types.normal_guarantee,
    rare_mult: Number(d.potion_types.rare_mult),
    epic_mult: Number(d.potion_types.epic_mult),
    unique_mult: Number(d.potion_types.unique_mult),
  }));
}

// ── 오늘 돌봄 현황 ──
export async function getTodayCare(): Promise<CareStatus> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { food: false, play: false, hygiene: false, sleep: false };

  const { data } = await supabase.rpc("get_today_care", { p_user_id: user.id });
  const cared = new Set((data || []).map((d: any) => d.category));

  return {
    food: cared.has("food"),
    play: cared.has("play"),
    hygiene: cared.has("hygiene"),
    sleep: cared.has("sleep"),
  };
}

// ── 카테고리별 소지 아이템 목록 ──
export async function getOwnedItemsByCategory(category: string): Promise<OwnedCareItem[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("inventory")
    .select("quantity, item_types(id, name, asset_key, category)")
    .eq("user_id", user.id)
    .gt("quantity", 0);

  if (!data) return [];

  return data
    .filter((d: any) => d.item_types?.category === category)
    .map((d: any) => ({
      id: d.item_types.id,
      name: d.item_types.name,
      asset_key: d.item_types.asset_key,
      quantity: d.quantity,
      category: d.item_types.category,
    }));
}

// ── 아이템 사용 (돌보기) ──
export async function useCareItem(itemTypeId: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("use_care_item", {
    p_user_id: user.id,
    p_item_type_id: itemTypeId,
  });

  if (error) {
    if (error.message.includes("already_cared_today")) return { error: "오늘 이미 돌봤어요!" };
    if (error.message.includes("not_in_inventory")) return { error: "아이템이 없어요." };
    if (error.message.includes("no_active_guardian")) return { error: "키우는 가디가 없어요." };
    return { error: "사용에 실패했습니다." };
  }

  return { success: true, data };
}
