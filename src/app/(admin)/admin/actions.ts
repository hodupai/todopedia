"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient, requireAdmin } from "@/lib/supabase/admin";

// ── 권한 가드 ──
async function ensureAdmin() {
  const admin = await requireAdmin();
  if (!admin) throw new Error("forbidden");
  return admin;
}

// ── 대시보드 통계 ──
export type AdminDashboard = {
  totalUsers: number;
  todayJoined: number;
  todayActive: number;
  totalGoldIssued: number;
  pendingFeedback: number;
};

export async function getAdminDashboard(): Promise<AdminDashboard> {
  await ensureAdmin();
  const sb = createAdminClient();

  const todayKstStart = new Date();
  todayKstStart.setUTCHours(15, 0, 0, 0); // UTC 15:00 = KST 00:00
  // 만약 현재가 UTC 15시 이전이면 어제 15시로
  if (new Date().getUTCHours() < 15) {
    todayKstStart.setUTCDate(todayKstStart.getUTCDate() - 1);
  }
  const todayKstStartIso = todayKstStart.toISOString();

  const [
    { count: totalUsers },
    { count: todayJoined },
    { data: activeRows },
    { data: goldRows },
    { count: pendingFeedback },
  ] = await Promise.all([
    sb.from("profiles").select("*", { count: "exact", head: true }),
    sb.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", todayKstStartIso),
    sb.from("daily_records").select("user_id").gte("created_at", todayKstStartIso),
    sb.from("profiles").select("gold"),
    sb.from("feedback").select("*", { count: "exact", head: true }).eq("resolved", false),
  ]);

  const todayActive = new Set((activeRows || []).map((r: { user_id: string }) => r.user_id)).size;
  const totalGoldIssued = (goldRows || []).reduce(
    (sum: number, r: { gold: number | null }) => sum + (r.gold || 0),
    0
  );

  return {
    totalUsers: totalUsers || 0,
    todayJoined: todayJoined || 0,
    todayActive,
    totalGoldIssued,
    pendingFeedback: pendingFeedback || 0,
  };
}

// ── 유저 검색 ──
export type AdminUserRow = {
  id: string;
  username: string;
  nickname: string;
  gold: number;
  created_at: string;
  is_admin: boolean;
};

export async function searchUsers(query: string): Promise<AdminUserRow[]> {
  await ensureAdmin();
  const sb = createAdminClient();

  const trimmed = query.trim();
  let req = sb
    .from("profiles")
    .select("id, username, nickname, gold, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (trimmed) {
    req = req.or(`username.ilike.%${trimmed}%,nickname.ilike.%${trimmed}%`);
  }

  const { data: users } = await req;
  if (!users) return [];

  const userIds = users.map((u) => u.id);
  const { data: admins } = await sb
    .from("admin_users")
    .select("user_id")
    .in("user_id", userIds);
  const adminSet = new Set((admins || []).map((a: { user_id: string }) => a.user_id));

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    nickname: u.nickname,
    gold: u.gold || 0,
    created_at: u.created_at,
    is_admin: adminSet.has(u.id),
  }));
}

// ── 유저 상세 ──
export type AdminUserDetail = {
  id: string;
  username: string;
  nickname: string;
  gold: number;
  created_at: string;
  daily_goal: number | null;
  title: string | null;
  active_theme: string | null;
  active_font: string | null;
  is_admin: boolean;
  totalCompletedTodos: number;
  totalGuardians: number;
  lastActiveDate: string | null;
};

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  await ensureAdmin();
  const sb = createAdminClient();

  const [
    { data: profile },
    { data: adminRow },
    { count: totalCompletedTodos },
    { count: totalGuardians },
    { data: lastRecord },
  ] = await Promise.all([
    sb.from("profiles").select("*").eq("id", userId).single(),
    sb.from("admin_users").select("user_id").eq("user_id", userId).maybeSingle(),
    sb.from("daily_records").select("*", { count: "exact", head: true }).eq("user_id", userId).eq("is_completed", true),
    sb.from("collection").select("*", { count: "exact", head: true }).eq("user_id", userId),
    sb.from("daily_records").select("record_date").eq("user_id", userId).order("record_date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!profile) return null;

  return {
    id: profile.id,
    username: profile.username,
    nickname: profile.nickname,
    gold: profile.gold || 0,
    created_at: profile.created_at,
    daily_goal: profile.daily_goal,
    title: profile.title,
    active_theme: profile.active_theme,
    active_font: profile.active_font,
    is_admin: !!adminRow,
    totalCompletedTodos: totalCompletedTodos || 0,
    totalGuardians: totalGuardians || 0,
    lastActiveDate: lastRecord?.record_date || null,
  };
}

// ── 골드 지급 ──
export async function grantGold(userId: string, amount: number, reason: string) {
  await ensureAdmin();
  if (!Number.isInteger(amount) || amount === 0) {
    return { error: "유효한 금액을 입력해주세요." };
  }
  if (Math.abs(amount) > 1_000_000) {
    return { error: "한 번에 최대 1,000,000G까지 지급 가능합니다." };
  }

  const sb = createAdminClient();
  const { data: profile } = await sb.from("profiles").select("gold").eq("id", userId).single();
  if (!profile) return { error: "사용자를 찾을 수 없습니다." };

  const newGold = Math.max(0, (profile.gold || 0) + amount);
  const { error } = await sb.from("profiles").update({ gold: newGold }).eq("id", userId);
  if (error) return { error: "지급에 실패했습니다." };

  // 활동 로그처럼 사용자에게 알리고 싶다면 wall_posts에 system 메시지 추가 가능
  // 지금은 단순 지급만.
  void reason; // 필요 시 admin_log 테이블에 기록

  revalidatePath("/admin");
  return { success: true, newGold };
}

// ── 피드백 목록 ──
export type AdminFeedback = {
  id: string;
  user_id: string;
  username: string;
  nickname: string;
  category: "bug" | "suggestion" | "other";
  content: string;
  user_agent: string | null;
  page_path: string | null;
  resolved: boolean;
  created_at: string;
};

export async function listFeedback(showResolved = false): Promise<AdminFeedback[]> {
  await ensureAdmin();
  const sb = createAdminClient();

  let req = sb
    .from("feedback")
    .select("*, profiles!feedback_user_id_fkey(username, nickname)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!showResolved) {
    req = req.eq("resolved", false);
  }

  const { data } = await req;
  if (!data) return [];

  return data.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (f: any) => ({
      id: f.id,
      user_id: f.user_id,
      username: f.profiles?.username || "?",
      nickname: f.profiles?.nickname || "?",
      category: f.category,
      content: f.content,
      user_agent: f.user_agent,
      page_path: f.page_path,
      resolved: f.resolved,
      created_at: f.created_at,
    })
  );
}

export async function setFeedbackResolved(id: string, resolved: boolean) {
  await ensureAdmin();
  const sb = createAdminClient();
  const { error } = await sb.from("feedback").update({ resolved }).eq("id", id);
  if (error) return { error: "처리에 실패했습니다." };
  revalidatePath("/admin");
  return { success: true };
}

// ── 비밀번호 초기화 ──
function generateTempPassword(length = 12): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;

  // 각 카테고리에서 최소 1개 보장 + 나머지는 전체에서 랜덤
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];
  const rest = Array.from({ length: length - required.length }, () =>
    all[Math.floor(Math.random() * all.length)]
  );
  // 셔플
  const arr = [...required, ...rest];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join("");
}

export async function resetUserPassword(userId: string) {
  await ensureAdmin();
  const sb = createAdminClient();

  const tempPassword = generateTempPassword(12);
  const { error } = await sb.auth.admin.updateUserById(userId, {
    password: tempPassword,
  });

  if (error) return { error: "비밀번호 초기화에 실패했습니다." };

  return { success: true, tempPassword };
}

// ── 계정 삭제 ──
export async function deleteUserAccount(userId: string) {
  await ensureAdmin();

  // 본인 계정은 삭제 못하게 보호
  const me = await requireAdmin();
  if (me?.userId === userId) {
    return { error: "본인 계정은 어드민 페이지에서 삭제할 수 없습니다." };
  }

  const sb = createAdminClient();
  const { error } = await sb.auth.admin.deleteUser(userId);
  if (error) return { error: "삭제에 실패했습니다." };

  // profiles는 ON DELETE CASCADE로 자동 정리됨 (auth.users → profiles FK)
  revalidatePath("/admin");
  return { success: true };
}
