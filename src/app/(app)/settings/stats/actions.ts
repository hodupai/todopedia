"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserFromSession } from "@/lib/supabase/auth";

export type DayStat = {
  date: string;
  completed: number;
  gold: number;
  care: number;
};

export type DayDetailItem = {
  kind: "todo" | "loop" | "habit_pos" | "habit_neg" | "party";
  title: string;
  count?: number;
  gold: number;
  time: string; // ISO timestamp
};

export type DayDetail = {
  date: string;
  items: DayDetailItem[];
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

// ── 최근 N일 세부 내역 (일반/루프/습관/파티) ──
export async function getRecentDayDetails(days: number = 30): Promise<DayDetail[]> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return [];

  // KST 기준 오늘
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = kstNow.toISOString().split("T")[0];
  const since = new Date(kstNow);
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().split("T")[0];

  const [{ data: records }, { data: partyRecords }] = await Promise.all([
    supabase
      .from("daily_records")
      .select("record_date, is_completed, current_count, gold_earned, updated_at, todos!inner(title, type, habit_type)")
      .eq("user_id", user.id)
      .gte("record_date", sinceStr)
      .lte("record_date", todayStr)
      .order("updated_at", { ascending: false }),
    supabase
      .from("party_daily_records")
      .select("record_date, gold_earned, created_at, is_completed, party_todos!inner(title, parties!inner(name))")
      .eq("user_id", user.id)
      .eq("is_completed", true)
      .gte("record_date", sinceStr)
      .lte("record_date", todayStr),
  ]);

  const dayMap: Record<string, DayDetailItem[]> = {};
  const push = (date: string, item: DayDetailItem) => {
    if (!dayMap[date]) dayMap[date] = [];
    dayMap[date].push(item);
  };

  (records || []).forEach((r: any) => {
    const todo = r.todos;
    if (!todo) return;
    if (todo.type === "habit") {
      if (!r.current_count || r.current_count <= 0) return;
      push(r.record_date, {
        kind: todo.habit_type === "negative" ? "habit_neg" : "habit_pos",
        title: todo.title,
        count: r.current_count,
        gold: r.gold_earned || 0,
        time: r.updated_at,
      });
    } else {
      if (!r.is_completed) return;
      push(r.record_date, {
        kind: todo.type === "loop" ? "loop" : "todo",
        title: todo.title,
        gold: r.gold_earned || 0,
        time: r.updated_at,
      });
    }
  });

  (partyRecords || []).forEach((r: any) => {
    const pt = r.party_todos;
    if (!pt) return;
    const partyName = pt.parties?.name || "파티";
    push(r.record_date, {
      kind: "party",
      title: `[${partyName}] ${pt.title}`,
      gold: r.gold_earned || 0,
      time: r.created_at,
    });
  });

  // 날짜 내림차순, 각 날 내부 시간 내림차순
  const result: DayDetail[] = Object.keys(dayMap)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) => ({
      date,
      items: dayMap[date].sort((a, b) => (a.time < b.time ? 1 : -1)),
    }));

  return result;
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
    const today = (() => {
      const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
      return d.toISOString().split("T")[0];
    })();

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
