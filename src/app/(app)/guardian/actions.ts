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

export type ActivityLog = {
  type: "todo" | "care" | "buy_item" | "buy_potion" | "heart_given" | "heart_received";
  title: string;
  gold: number;
  time: string;
};

// ── 오늘 활동 기록 ──
export async function getTodayActivity(): Promise<ActivityLog[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const today = new Date().toISOString().split("T")[0];
  const logs: ActivityLog[] = [];

  // 1. 완료된 투두
  const { data: records } = await supabase
    .from("daily_records")
    .select("is_completed, gold_earned, updated_at, todos(title, type)")
    .eq("user_id", user.id)
    .eq("record_date", today)
    .eq("is_completed", true);

  (records || []).forEach((r: any) => {
    if (r.todos?.type !== "habit") {
      logs.push({
        type: "todo",
        title: r.todos?.title || "투두",
        gold: r.gold_earned || 0,
        time: r.updated_at,
      });
    }
  });

  // 2. 돌봄 기록
  const { data: cares } = await supabase
    .from("care_log")
    .select("created_at, item_types(name)")
    .eq("user_id", user.id)
    .eq("used_date", today);

  (cares || []).forEach((c: any) => {
    logs.push({
      type: "care",
      title: c.item_types?.name || "아이템",
      gold: 0,
      time: c.created_at,
    });
  });

  // 3. 하트 준 기록
  const { data: heartsGiven } = await supabase
    .from("wall_hearts")
    .select("created_at, wall_posts(user_id, profiles:user_id(nickname))")
    .eq("user_id", user.id)
    .gte("created_at", today + "T00:00:00+09:00")
    .lt("created_at", today + "T00:00:00+09:00");

  // 하트는 날짜 필터가 어려우니 오늘 생성된 것만
  const todayStart = new Date(today + "T00:00:00+09:00").toISOString();
  const { data: heartsGivenToday } = await supabase
    .from("wall_hearts")
    .select("created_at")
    .eq("user_id", user.id)
    .gte("created_at", todayStart);

  (heartsGivenToday || []).forEach((h: any) => {
    logs.push({
      type: "heart_given",
      title: "하트를 보냈어요",
      gold: 10,
      time: h.created_at,
    });
  });

  // 4. 하트 받은 기록
  const { data: myPosts } = await supabase
    .from("wall_posts")
    .select("id")
    .eq("user_id", user.id);

  if (myPosts && myPosts.length > 0) {
    const postIds = myPosts.map((p: any) => p.id);
    const { data: heartsReceived } = await supabase
      .from("wall_hearts")
      .select("created_at, user_id, profiles:user_id(nickname)")
      .in("post_id", postIds)
      .gte("created_at", todayStart);

    (heartsReceived || []).forEach((h: any) => {
      logs.push({
        type: "heart_received",
        title: `${(h.profiles as any)?.nickname || "누군가"}에게 하트를 받았어요`,
        gold: 10,
        time: h.created_at,
      });
    });
  }

  // 시간순 정렬 (최신 먼저)
  logs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return logs;
}

// ── 일일 목표 달성 담벼락 게시 ──
export async function postDailyGoalWall() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.rpc("post_daily_goal_wall", { p_user_id: user.id });
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
