"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUserFromSession } from "@/lib/supabase/auth";

// 골드/상한 상수는 RPC(complete_todo, complete_loop, record_habit) 내부에서 관리

// ── 투두 생성 ──
export async function createTodo(formData: FormData) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const title = formData.get("title") as string;
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
  const tagId = formData.get("tagId") as string | null;
  const isImportant = formData.get("isImportant") === "true";
  const repeatType = formData.get("repeatType") as string | null;
  const repeatDays = formData.get("repeatDays") as string | null;

  if (!title?.trim()) return { error: "제목을 입력해주세요." };

  const { error } = await supabase
    .from("todos")
    .update({
      title: title.trim(),
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

  revalidatePath("/todo");
  return {
    success: true,
    completed: data.completed,
    gold: data.gold,
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

  revalidatePath("/todo");
  return {
    success: true,
    completed: data.completed,
    gold: data.gold,
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

  revalidatePath("/todo");
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

  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = new Date().getDay(); // 0=일 ~ 6=토
  const dayOfMonth = new Date().getDate(); // 1~31

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
    return { dailyGoal: 0, todos: [], records: [], tags: [], hasGuardian: true, needsDailyGoalPrompt: false };
  }

  const today = new Date().toISOString().split("T")[0];

  const [{ data: profile }, { data: todosData }, { data: recordsData }, { data: tagsData }] =
    await Promise.all([
      supabase.from("profiles").select("daily_goal, last_goal_date").eq("id", user.id).single(),
      supabase.from("todos").select("*, tags(name, color)").eq("user_id", user.id).is("archived_at", null).order("is_important", { ascending: false }).order("created_at", { ascending: true }),
      supabase.from("daily_records").select("todo_id, is_completed, current_count").eq("user_id", user.id).eq("record_date", today),
      supabase.from("tags").select("id, name, color").eq("user_id", user.id).order("created_at"),
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

  // 오늘 첫 접속이면(또는 한 번도 설정 안 했으면) 일일 목표 모달 prompt
  // 단, 가디언 시작 모달이 뜰 조건(dailyGoal=0 && !hasGuardian)이면 그게 우선이므로 이 prompt는 false
  const needsDailyGoalPrompt =
    dailyGoal > 0 && lastGoalDate !== today && !(dailyGoal === 0 && !hasGuardian);

  return {
    dailyGoal,
    todos: todosData || [],
    records: recordsData || [],
    tags: tagsData || [],
    hasGuardian,
    needsDailyGoalPrompt,
  };
}

// ── 일일 목표 설정 ──
export async function setDailyGoal(goal: number) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  if (![1, 5, 10, 20].includes(goal)) return { error: "잘못된 목표입니다." };

  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("profiles")
    .update({ daily_goal: goal, last_goal_date: today, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: "설정에 실패했습니다." };
  revalidatePath("/todo");
  return { success: true };
}
