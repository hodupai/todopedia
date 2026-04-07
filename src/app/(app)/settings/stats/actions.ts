"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserFromSession } from "@/lib/supabase/auth";

export type DayStat = {
  date: string;
  completed: number;
  gold: number;
  care: number;
};

export type OverallStats = {
  totalTodos: number;
  totalGold: number;
  totalGuardians: number;
  totalItems: number;
  totalCare: number;
  totalHearts: number;
  joinDate: string;
  streakDays: number;
};

// ── 월별 일별 통계 ──
export async function getMonthlyStats(year: number, month: number): Promise<DayStat[]> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return [];

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  // 투두 완료 + 골드
  const { data: records } = await supabase
    .from("daily_records")
    .select("record_date, is_completed, gold_earned")
    .eq("user_id", user.id)
    .gte("record_date", startDate)
    .lt("record_date", endDate);

  // 돌봄
  const { data: cares } = await supabase
    .from("care_log")
    .select("used_date")
    .eq("user_id", user.id)
    .gte("used_date", startDate)
    .lt("used_date", endDate);

  // 날짜별 집계
  const dayMap: Record<string, DayStat> = {};

  (records || []).forEach((r: any) => {
    const d = r.record_date;
    if (!dayMap[d]) dayMap[d] = { date: d, completed: 0, gold: 0, care: 0 };
    if (r.is_completed) dayMap[d].completed++;
    dayMap[d].gold += r.gold_earned || 0;
  });

  (cares || []).forEach((c: any) => {
    const d = c.used_date;
    if (!dayMap[d]) dayMap[d] = { date: d, completed: 0, gold: 0, care: 0 };
    dayMap[d].care++;
  });

  return Object.values(dayMap);
}

// ── 전체 통계 ──
export async function getOverallStats(): Promise<OverallStats> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { totalTodos: 0, totalGold: 0, totalGuardians: 0, totalItems: 0, totalCare: 0, totalHearts: 0, joinDate: "", streakDays: 0 };

  const [
    { count: totalTodos },
    { data: goldData },
    { count: totalGuardians },
    { count: totalItems },
    { count: totalCare },
    { count: totalHearts },
    { data: profileData },
  ] = await Promise.all([
    supabase.from("daily_records").select("*", { count: "exact", head: true }).eq("user_id", user.id).eq("is_completed", true),
    supabase.from("daily_records").select("gold_earned").eq("user_id", user.id),
    supabase.from("collection").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("item_collection").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("care_log").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("wall_hearts").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("profiles").select("created_at, gold").eq("id", user.id).single(),
  ]);

  const totalGold = (goldData || []).reduce((sum: number, r: any) => sum + (r.gold_earned || 0), 0);

  // 연속 접속일 계산 (최근부터 거슬러 올라가며)
  const { data: activeDays } = await supabase
    .from("daily_records")
    .select("record_date")
    .eq("user_id", user.id)
    .order("record_date", { ascending: false });

  let streakDays = 0;
  if (activeDays && activeDays.length > 0) {
    const uniqueDates = [...new Set(activeDays.map((d: any) => d.record_date))].sort().reverse();
    const today = new Date().toISOString().split("T")[0];

    for (let i = 0; i < uniqueDates.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split("T")[0];

      if (uniqueDates[i] === expectedStr) {
        streakDays++;
      } else {
        break;
      }
    }
  }

  return {
    totalTodos: totalTodos || 0,
    totalGold,
    totalGuardians: totalGuardians || 0,
    totalItems: totalItems || 0,
    totalCare: totalCare || 0,
    totalHearts: totalHearts || 0,
    joinDate: profileData?.created_at || "",
    streakDays,
  };
}
