"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const GOLD_PER_TODO = 200;
const GOLD_PER_HABIT_POSITIVE = 100;
const GOLD_PER_HABIT_NEGATIVE = 50;
const HABIT_DAILY_GOLD_CAP = 1000;

// ── 투두 생성 ──
export async function createTodo(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
    repeat_days: repeatDays ? JSON.parse(repeatDays) : null,
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
  const { data: { user } } = await supabase.auth.getUser();
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
      repeat_days: repeatDays ? JSON.parse(repeatDays) : null,
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
  const { data: { user } } = await supabase.auth.getUser();
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

// ── 일반 투두 완료 토글 ──
export async function toggleTodo(todoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const today = new Date().toISOString().split("T")[0];

  // 기존 레코드 확인
  const { data: record } = await supabase
    .from("daily_records")
    .select("id, is_completed, gold_earned")
    .eq("todo_id", todoId)
    .eq("record_date", today)
    .single();

  // 골드 상한 체크 (일일 목표 개수까지만)
  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_goal")
    .eq("id", user.id)
    .single();

  const dailyGoal = profile?.daily_goal || 0;

  if (record) {
    // 토글: 완료 ↔ 미완료
    const newCompleted = !record.is_completed;
    let goldDelta = 0;

    if (newCompleted) {
      // 완료 시 골드 지급 체크
      const { data: todayRecords } = await supabase
        .from("daily_records")
        .select("is_completed, gold_earned, todos(type)")
        .eq("user_id", user.id)
        .eq("record_date", today);

      const completedTodoCount = (todayRecords || []).filter(
        (r: any) => r.is_completed && r.todos?.type !== "habit"
      ).length;

      if (completedTodoCount < dailyGoal) {
        goldDelta = GOLD_PER_TODO;
      }
    } else {
      // 완료 취소 시 골드 회수
      goldDelta = -record.gold_earned;
    }

    await supabase
      .from("daily_records")
      .update({
        is_completed: newCompleted,
        gold_earned: newCompleted ? (goldDelta > 0 ? GOLD_PER_TODO : 0) : 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);

    if (goldDelta !== 0) {
      await supabase.rpc("add_gold", { p_user_id: user.id, p_amount: goldDelta });
    }

    // 완료 후 현재 달성 수 계산
    const { data: afterRecords } = await supabase
      .from("daily_records")
      .select("is_completed, todos(type)")
      .eq("user_id", user.id)
      .eq("record_date", today);
    const afterCompleted = (afterRecords || []).filter(
      (r: any) => r.is_completed && r.todos?.type !== "habit"
    ).length;

    revalidatePath("/todo");
    return {
      success: true,
      completed: newCompleted,
      gold: goldDelta,
      completedCount: afterCompleted,
      dailyGoal,
    };
  } else {
    // 새 레코드 생성 (완료)
    const { data: todayRecords } = await supabase
      .from("daily_records")
      .select("is_completed, todos(type)")
      .eq("user_id", user.id)
      .eq("record_date", today);

    const completedTodoCount = (todayRecords || []).filter(
      (r: any) => r.is_completed && r.todos?.type !== "habit"
    ).length;

    const gold = completedTodoCount < dailyGoal ? GOLD_PER_TODO : 0;

    await supabase.from("daily_records").insert({
      user_id: user.id,
      todo_id: todoId,
      record_date: today,
      is_completed: true,
      gold_earned: gold,
    });

    if (gold > 0) {
      await supabase.rpc("add_gold", { p_user_id: user.id, p_amount: gold });
    }

    revalidatePath("/todo");
    return {
      success: true,
      completed: true,
      gold,
      completedCount: completedTodoCount + 1,
      dailyGoal,
    };
  }
}

// ── 루프 카운트 증가 ──
export async function incrementLoop(todoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const today = new Date().toISOString().split("T")[0];

  const { data: todo } = await supabase
    .from("todos")
    .select("target_count")
    .eq("id", todoId)
    .single();

  if (!todo) return { error: "투두를 찾을 수 없습니다." };

  const { data: record } = await supabase
    .from("daily_records")
    .select("id, current_count, is_completed")
    .eq("todo_id", todoId)
    .eq("record_date", today)
    .single();

  if (record?.is_completed) return { error: "이미 완료되었습니다." };

  const newCount = (record?.current_count || 0) + 1;
  const isCompleted = newCount >= (todo.target_count || 1);

  // 완료 시 골드 체크
  let gold = 0;
  if (isCompleted) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_goal")
      .eq("id", user.id)
      .single();

    const { data: todayRecords } = await supabase
      .from("daily_records")
      .select("is_completed, todos(type)")
      .eq("user_id", user.id)
      .eq("record_date", today);

    const completedCount = (todayRecords || []).filter(
      (r: any) => r.is_completed && r.todos?.type !== "habit"
    ).length;

    if (completedCount < (profile?.daily_goal || 0)) {
      gold = GOLD_PER_TODO;
    }
  }

  if (record) {
    await supabase
      .from("daily_records")
      .update({
        current_count: newCount,
        is_completed: isCompleted,
        gold_earned: gold,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);
  } else {
    await supabase.from("daily_records").insert({
      user_id: user.id,
      todo_id: todoId,
      record_date: today,
      current_count: newCount,
      is_completed: isCompleted,
      gold_earned: gold,
    });
  }

  if (gold > 0) {
    await supabase.rpc("add_gold", { p_user_id: user.id, p_amount: gold });
  }

  const { data: profile } = !isCompleted ? { data: null } : await supabase
    .from("profiles")
    .select("daily_goal")
    .eq("id", user.id)
    .single();

  const { data: afterRecords } = await supabase
    .from("daily_records")
    .select("is_completed, todos(type)")
    .eq("user_id", user.id)
    .eq("record_date", today);
  const afterCompleted = (afterRecords || []).filter(
    (r: any) => r.is_completed && r.todos?.type !== "habit"
  ).length;

  revalidatePath("/todo");
  return {
    success: true,
    completed: isCompleted,
    gold,
    completedCount: afterCompleted,
    dailyGoal: profile?.daily_goal || 0,
  };
}

// ── 습관 기록 ──
export async function recordHabit(todoId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const today = new Date().toISOString().split("T")[0];

  const { data: todo } = await supabase
    .from("todos")
    .select("habit_type")
    .eq("id", todoId)
    .single();

  if (!todo) return { error: "습관을 찾을 수 없습니다." };

  // 일일 습관 골드 상한 체크
  const { data: dailyHabitGold } = await supabase.rpc("get_daily_habit_gold", {
    p_user_id: user.id,
    p_date: today,
  });

  const goldPerAction = todo.habit_type === "positive"
    ? GOLD_PER_HABIT_POSITIVE
    : GOLD_PER_HABIT_NEGATIVE;

  const remainingCap = HABIT_DAILY_GOLD_CAP - (dailyHabitGold || 0);
  const gold = Math.min(goldPerAction, Math.max(0, remainingCap));

  const { data: record } = await supabase
    .from("daily_records")
    .select("id, current_count, gold_earned")
    .eq("todo_id", todoId)
    .eq("record_date", today)
    .single();

  if (record) {
    await supabase
      .from("daily_records")
      .update({
        current_count: record.current_count + 1,
        gold_earned: record.gold_earned + gold,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.id);
  } else {
    await supabase.from("daily_records").insert({
      user_id: user.id,
      todo_id: todoId,
      record_date: today,
      current_count: 1,
      gold_earned: gold,
    });
  }

  if (gold > 0) {
    await supabase.rpc("add_gold", { p_user_id: user.id, p_amount: gold });
  }

  // 습관 일일 골드 누적 조회
  const { data: totalHabitGold } = await supabase.rpc("get_daily_habit_gold", {
    p_user_id: user.id,
    p_date: today,
  });

  revalidatePath("/todo");
  return {
    success: true,
    gold,
    habitDailyGold: totalHabitGold || 0,
    habitDailyCap: HABIT_DAILY_GOLD_CAP,
  };
}

// ── 태그 생성 ──
export async function createTag(name: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
  const { data: { user } } = await supabase.auth.getUser();
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

// ── 일일 목표 설정 ──
export async function setDailyGoal(goal: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  if (![1, 5, 10, 20].includes(goal)) return { error: "잘못된 목표입니다." };

  const { error } = await supabase
    .from("profiles")
    .update({ daily_goal: goal, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: "설정에 실패했습니다." };
  revalidatePath("/todo");
  return { success: true };
}
