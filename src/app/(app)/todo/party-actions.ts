"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserFromSession } from "@/lib/supabase/auth";
import { kstToday } from "@/lib/date";

export type Party = {
  id: string;
  name: string;
  type: "individual" | "collaborative";
  leader_id: string;
  members: { user_id: string; nickname: string; status: string }[];
};

export type PartyTodo = {
  id: string;
  party_id: string;
  title: string;
  target_count: number;
  repeat_type: string | null;
  repeat_days: number[] | null;
  created_by: string;
};

export type PartyRecord = {
  party_todo_id: string;
  user_id: string;
  is_completed: boolean;
};

export type PartyLog = {
  content: string;
  created_at: string;
};

// ── 내 파티 목록 ──
export async function getMyParties(): Promise<Party[]> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return [];

  const { data: memberships } = await supabase
    .from("party_members")
    .select("party_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!memberships || memberships.length === 0) return [];

  const partyIds = memberships.map((m: any) => m.party_id);
  const { data: parties } = await supabase
    .from("parties")
    .select("id, name, type, leader_id")
    .in("id", partyIds);

  if (!parties) return [];

  const { data: allMembers } = await supabase
    .from("party_members")
    .select("party_id, user_id, status, profiles:user_id(nickname)")
    .in("party_id", partyIds)
    .eq("status", "active");

  const membersByParty = new Map<string, { user_id: string; nickname: string; status: string }[]>();
  (allMembers || []).forEach((m: any) => {
    const list = membersByParty.get(m.party_id) || [];
    list.push({ user_id: m.user_id, nickname: (m.profiles as any)?.nickname || "???", status: m.status });
    membersByParty.set(m.party_id, list);
  });

  return parties.map((party: any) => ({
    ...party,
    members: membersByParty.get(party.id) || [],
  }));
}

// ── 현재 유저 ID ──
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  return user?.id || null;
}

// ── 파티 탭 초기 데이터 (parties + userId 한 번에) ──
export async function getPartyTabData(): Promise<{ parties: Party[]; userId: string | null }> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { parties: [], userId: null };

  const { data: memberships } = await supabase
    .from("party_members")
    .select("party_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!memberships || memberships.length === 0) return { parties: [], userId: user.id };

  const partyIds = memberships.map((m: { party_id: string }) => m.party_id);
  const [{ data: parties }, { data: allMembers }] = await Promise.all([
    supabase.from("parties").select("id, name, type, leader_id").in("id", partyIds),
    supabase
      .from("party_members")
      .select("party_id, user_id, status, profiles:user_id(nickname)")
      .in("party_id", partyIds)
      .eq("status", "active"),
  ]);

  if (!parties) return { parties: [], userId: user.id };

  const membersByParty = new Map<string, { user_id: string; nickname: string; status: string }[]>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (allMembers || []).forEach((m: any) => {
    const list = membersByParty.get(m.party_id) || [];
    list.push({ user_id: m.user_id, nickname: (m.profiles as any)?.nickname || "???", status: m.status });
    membersByParty.set(m.party_id, list);
  });

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parties: parties.map((party: any) => ({
      ...party,
      members: membersByParty.get(party.id) || [],
    })),
    userId: user.id,
  };
}

// ── 파티 투두 + 오늘 기록 ──
export async function getPartyTodos(partyId: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { todos: [] as PartyTodo[], records: {} as Record<string, PartyRecord[]> };

  const today = kstToday();

  const { data: todos } = await supabase
    .from("party_todos")
    .select("id, party_id, title, target_count, repeat_type, repeat_days, created_by")
    .eq("party_id", partyId)
    .order("created_at");

  const todoIds = (todos || []).map((t: any) => t.id);
  const records: Record<string, PartyRecord[]> = {};

  if (todoIds.length > 0) {
    const { data: recs } = await supabase
      .from("party_daily_records")
      .select("party_todo_id, user_id, is_completed")
      .in("party_todo_id", todoIds)
      .eq("record_date", today);

    (recs || []).forEach((r: any) => {
      if (!records[r.party_todo_id]) records[r.party_todo_id] = [];
      records[r.party_todo_id].push(r);
    });
  }

  return { todos: (todos as PartyTodo[]) || [], records };
}

// ── 파티 활동 기록 (최근 10건) ──
export async function getPartyLogs(partyId: string): Promise<PartyLog[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("party_activity_log")
    .select("content, created_at")
    .eq("party_id", partyId)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data as PartyLog[]) || [];
}

// ── 파티 투두 생성 ──
export async function createPartyTodo(
  partyId: string, title: string, targetCount: number = 1,
  repeatType?: string, repeatDays?: number[]
) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("create_party_todo", {
    p_user_id: user.id, p_party_id: partyId, p_title: title,
    p_target_count: targetCount,
    p_repeat_type: repeatType || null, p_repeat_days: repeatDays || null,
  });
  if (error) {
    if (error.message.includes("not_leader")) return { error: "파티장만 투두를 만들 수 있어요." };
    return { error: "투두 생성에 실패했습니다." };
  }
  return { success: true, data };
}

// ── 파티 투두 수정 ──
export async function updatePartyTodo(partyTodoId: string, title: string, targetCount?: number) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { error } = await supabase.rpc("update_party_todo", {
    p_user_id: user.id,
    p_party_todo_id: partyTodoId,
    p_title: title,
    p_target_count: targetCount ?? null,
  });
  if (error) {
    if (error.message.includes("not_creator")) return { error: "만든 사람만 수정할 수 있어요." };
    return { error: "수정에 실패했습니다." };
  }
  return { success: true };
}

// ── 파티 투두 삭제 ──
export async function deletePartyTodo(partyTodoId: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { error } = await supabase.rpc("delete_party_todo", {
    p_user_id: user.id,
    p_party_todo_id: partyTodoId,
  });
  if (error) {
    if (error.message.includes("not_creator")) return { error: "만든 사람만 삭제할 수 있어요." };
    return { error: "삭제에 실패했습니다." };
  }
  return { success: true };
}

// ── 파티 투두 완료 ──
export async function completePartyTodo(partyTodoId: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("complete_party_todo", {
    p_user_id: user.id, p_party_todo_id: partyTodoId,
  });
  if (error) {
    if (error.message.includes("already_completed")) return { error: "오늘 이미 완료했어요." };
    return { error: "완료에 실패했습니다." };
  }
  return { success: true, data };
}
