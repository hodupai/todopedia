"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserFromSession } from "@/lib/supabase/auth";
import { kstToday } from "@/lib/date";

// 골드/상한 상수는 RPC(complete_todo, complete_loop, record_habit) 내부에서 관리

// ── 투두 생성 ──
export async function createTodo(formData: FormData) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const type = (formData.get("type") as string) || "normal";
  const tagId = formData.get("tagId") as string | null;
  const isImportant = formData.get("isImportant") === "true";
  const repeatType = formData.get("repeatType") as string | null;
  const repeatDays = formData.get("repeatDays") as string | null;
  const targetCount = formData.get("targetCount") as string | null;
  const habitType = formData.get("habitType") as string | null;

  if (!title?.trim()) return { error: "제목을 입력해주세요." };

  const { error } = await supabase.from("todos").insert({
    user_id: user.id,
    title: title.trim(),
    description: description?.trim() ? description.trim().slice(0, 500) : null,
    type,
    tag_id: tagId || null,
    is_important: isImportant,
    repeat_type: type === "habit" ? "daily" : (repeatType || null),
    repeat_days: repeatDays ? (() => { try { return JSON.parse(repeatDays); } catch { return null; } })() : null,
    target_count: type === "loop" ? Number(targetCount) || 1 : null,
    habit_type: type === "habit" ? (habitType || "positive") : null,
  });

  if (error) return { error: "투두 생성에 실패했습니다." };
  revalidatePath("/todo");
  return { success: true };
}

// ── 투두 수정 ──
export async function updateTodo(formData: FormData) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const id = formData.get("id") as string;
  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const tagId = formData.get("tagId") as string | null;
  const isImportant = formData.get("isImportant") === "true";
  const repeatType = formData.get("repeatType") as string | null;
  const repeatDays = formData.get("repeatDays") as string | null;

  if (!title?.trim()) return { error: "제목을 입력해주세요." };

  const { error } = await supabase
    .from("todos")
    .update({
      title: title.trim(),
      description: description?.trim() ? description.trim().slice(0, 500) : null,
      tag_id: tagId || null,
      is_important: isImportant,
      repeat_type: repeatType || null,
      repeat_days: repeatDays ? (() => { try { return JSON.parse(repeatDays); } catch { return null; } })() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "수정에 실패했습니다." };
  revalidatePath("/todo");
  return { success: true };
}

// ── 투두 삭제 ──
export async function deleteTodo(id: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { error } = await supabase
    .from("todos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "삭제에 실패했습니다." };
  revalidatePath("/todo");
  return { success: true };
}

// ── 일반 투두 완료 토글 (RPC 1회) ──
export async function toggleTodo(todoId: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("complete_todo", {
    p_user_id: user.id,
    p_todo_id: todoId,
  });

  if (error) return { error: "처리에 실패했습니다." };
  if (data?.error) return { error: data.error };

  // revalidatePath 제거: 클라가 optimistic update 하므로 서버 재실행 불필요
  return {
    success: true,
    completed: data.completed,
    gold: data.gold,
    crit: !!data.crit,
    combo: data.combo as number,
    comboBonus: (data.comboBonus as number) || 0,
    completedCount: data.completedCount,
    dailyGoal: data.dailyGoal,
  };
}


// ── 루프 카운트 증가 (RPC 1회) ──
export async function incrementLoop(todoId: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("complete_loop", {
    p_user_id: user.id,
    p_todo_id: todoId,
  });

  if (error) return { error: "처리에 실패했습니다." };
  if (data?.error === "already_completed") return { error: "이미 완료되었습니다." };
  if (data?.error) return { error: "처리에 실패했습니다." };

  return {
    success: true,
    completed: data.completed,
    gold: data.gold,
    crit: !!data.crit,
    combo: data.combo as number,
    comboBonus: (data.comboBonus as number) || 0,
    completedCount: data.completedCount,
    dailyGoal: data.dailyGoal,
  };
}

// ── 습관 기록 (RPC 1회) ──
export async function recordHabit(todoId: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("record_habit", {
    p_user_id: user.id,
    p_todo_id: todoId,
  });

  if (error) return { error: "처리에 실패했습니다." };
  if (data?.error) return { error: "처리에 실패했습니다." };

  return {
    success: true,
    gold: data.gold,
    habitDailyGold: data.habitDailyGold,
    habitDailyCap: data.habitDailyCap,
  };
}

// ── 태그 생성 ──
export async function createTag(name: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const colors = ["#b06820", "#2a7a4b", "#4a6fa5", "#8b4a8b", "#a05050", "#5a8a5a"];
  const color = colors[Math.floor(Math.random() * colors.length)];

  const { data, error } = await supabase
    .from("tags")
    .insert({ user_id: user.id, name: name.trim(), color })
    .select()
    .single();

  if (error) return { error: "태그 생성에 실패했습니다." };
  revalidatePath("/todo");
  return { success: true, tag: data };
}

// ── 반복 투두 오늘치 레코드 생성 ──
export async function ensureDailyRecords() {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return;

  // KST 기준 오늘. dayOfWeek/dayOfMonth도 KST.
  const today = kstToday();
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dayOfWeek = kstNow.getUTCDay();
  const dayOfMonth = kstNow.getUTCDate();

  // 반복 투두 중 오늘 해당하는 것 조회
  const { data: repeatingTodos } = await supabase
    .from("todos")
    .select("id, repeat_type, repeat_days")
    .eq("user_id", user.id)
    .not("repeat_type", "is", null);

  if (!repeatingTodos || repeatingTodos.length === 0) return;

  // 오늘 이미 레코드가 있는 todo_id 목록
  const { data: existingRecords } = await supabase
    .from("daily_records")
    .select("todo_id")
    .eq("user_id", user.id)
    .eq("record_date", today);

  const existingIds = new Set((existingRecords || []).map((r: any) => r.todo_id));

  const toCreate: { user_id: string; todo_id: string; record_date: string }[] = [];

  for (const todo of repeatingTodos) {
    if (existingIds.has(todo.id)) continue;

    let shouldCreate = false;
    if (todo.repeat_type === "daily") {
      shouldCreate = true;
    } else if (todo.repeat_type === "weekly" && todo.repeat_days) {
      shouldCreate = todo.repeat_days.includes(dayOfWeek);
    } else if (todo.repeat_type === "monthly" && todo.repeat_days) {
      // 매달 n일, 마지막 날 처리
      const lastDay = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
      shouldCreate = todo.repeat_days.some((d: number) =>
        d === dayOfMonth || (d > lastDay && dayOfMonth === lastDay)
      );
    }

    if (shouldCreate) {
      toCreate.push({ user_id: user.id, todo_id: todo.id, record_date: today });
    }
  }

  if (toCreate.length > 0) {
    await supabase.from("daily_records").insert(toCreate);
  }
}

// ── 투두 페이지 초기 데이터 (server prefetch용) ──
export async function getTodoPageData() {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) {
    return { dailyGoal: 0, todos: [], records: [], tags: [], hasGuardian: true, needsDailyGoalPrompt: false, lastActiveDate: null, partyCompletedToday: 0 };
  }

  const today = kstToday();

  const [{ data: profile }, { data: todosData }, { data: recordsData }, { data: tagsData }, { data: lastRecord }, { count: partyCompletedToday }] =
    await Promise.all([
      supabase.from("profiles").select("daily_goal, last_goal_date").eq("id", user.id).single(),
      // archived_at: null이면 활성, 미래(=다음 KST 자정)면 오늘 하루는 보임
      supabase.from("todos").select("*, tags(name, color)").eq("user_id", user.id).or(`archived_at.is.null,archived_at.gt.${new Date().toISOString()}`).order("is_important", { ascending: false }).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      supabase.from("daily_records").select("todo_id, is_completed, current_count").eq("user_id", user.id).eq("record_date", today),
      supabase.from("tags").select("id, name, color").eq("user_id", user.id).order("created_at"),
      // 가장 최근에 활동한 날짜 (오늘 제외)
      supabase.from("daily_records").select("record_date").eq("user_id", user.id).lt("record_date", today).order("record_date", { ascending: false }).limit(1).maybeSingle(),
      // 오늘 완료한 파티 투두 수
      supabase.from("party_daily_records").select("party_todo_id", { count: "exact", head: true }).eq("user_id", user.id).eq("record_date", today).eq("is_completed", true),
    ]);

  const dailyGoal = profile?.daily_goal || 0;
  const lastGoalDate = profile?.last_goal_date || null;

  let hasGuardian = true;
  if (dailyGoal === 0) {
    const { data: guardian } = await supabase
      .from("active_guardians")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    hasGuardian = !!guardian;
  }

  const needsDailyGoalPrompt =
    dailyGoal > 0 && lastGoalDate !== today && !(dailyGoal === 0 && !hasGuardian);

  return {
    dailyGoal,
    todos: todosData || [],
    records: recordsData || [],
    tags: tagsData || [],
    hasGuardian,
    needsDailyGoalPrompt,
    lastActiveDate: lastRecord?.record_date || null,
    partyCompletedToday: partyCompletedToday || 0,
  };
}

// ── 최근 완료한 일회성 투두 (지난 7일) ──
export type ArchivedTodoRow = {
  id: string;
  title: string;
  type: "normal" | "loop";
  completed_date: string | null;
};

export async function getRecentArchivedTodos(): Promise<ArchivedTodoRow[]> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return [];

  // archived_at이 있는(=완료된 일회성) 투두 중 최근 7일 archived_at만
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: todos } = await supabase
    .from("todos")
    .select("id, title, type")
    .eq("user_id", user.id)
    .not("archived_at", "is", null)
    .gte("archived_at", sevenDaysAgo)
    .order("archived_at", { ascending: false })
    .limit(50);

  if (!todos || todos.length === 0) return [];

  // 각 투두의 가장 최근 완료된 daily_record 날짜 매핑
  const ids = todos.map((t) => t.id);
  const { data: records } = await supabase
    .from("daily_records")
    .select("todo_id, record_date")
    .in("todo_id", ids)
    .eq("is_completed", true)
    .order("record_date", { ascending: false });

  const completedMap = new Map<string, string>();
  (records || []).forEach((r: { todo_id: string; record_date: string }) => {
    if (!completedMap.has(r.todo_id)) completedMap.set(r.todo_id, r.record_date);
  });

  return todos.map((t) => ({
    id: t.id,
    title: t.title,
    type: t.type,
    completed_date: completedMap.get(t.id) || null,
  }));
}

// ── 완료된 일회성 투두 되돌리기 ──
export async function restoreArchivedTodo(todoId: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  // archived_at 해제 + 오늘의 daily_record를 미완료로 (있으면)
  const { error } = await supabase
    .from("todos")
    .update({ archived_at: null })
    .eq("id", todoId)
    .eq("user_id", user.id);

  if (error) return { error: "되돌리기에 실패했습니다." };

  // 오늘 daily_record가 있으면 미완료로 (골드 회수는 안 함 — 어드민 작업이 아니라 실수 복구이므로)
  const today = kstToday();
  await supabase
    .from("daily_records")
    .update({ is_completed: false, current_count: 0 })
    .eq("todo_id", todoId)
    .eq("user_id", user.id)
    .eq("record_date", today);

  revalidatePath("/todo");
  revalidatePath("/settings/stats");
  return { success: true };
}

// ── 투두 순서 일괄 변경 ──
export async function reorderTodos(orderedIds: string[]) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { success: true };

  // 한 번의 요청으로 처리: id별로 sort_order를 순차 업데이트
  // (개수가 많지 않으므로 Promise.all)
  const updates = orderedIds.map((id, i) =>
    supabase
      .from("todos")
      .update({ sort_order: i + 1 })
      .eq("id", id)
      .eq("user_id", user.id)
  );
  const results = await Promise.all(updates);
  if (results.some((r) => r.error)) return { error: "순서 변경에 실패했습니다." };

  revalidatePath("/todo");
  return { success: true };
}

// ── 일일 목표 설정 ──
export async function setDailyGoal(goal: number) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  if (![1, 5, 10, 20].includes(goal)) return { error: "잘못된 목표입니다." };

  const today = kstToday();
  const { error } = await supabase
    .from("profiles")
    .update({ daily_goal: goal, last_goal_date: today, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: "설정에 실패했습니다." };
  revalidatePath("/todo");
  return { success: true };
}
