"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserFromSession } from "@/lib/supabase/auth";

export type SettingsProfile = {
  username: string;
  nickname: string;
  title: string | null;
  created_at: string;
};

export type SettingsInviteCode = {
  code: string;
  used_by: string | null;
};

export type SettingsAchievement = {
  id: number;
  key: string;
  name: string;
  description: string;
  category: string;
  title_text: string | null;
  title_image: string | null;
  unlocked: boolean;
};

export type SettingsPageData = {
  profile: SettingsProfile | null;
  inviteCodes: SettingsInviteCode[];
  achievements: SettingsAchievement[];
  claimableKeys: string[];
};

export async function getSettingsPageData(): Promise<SettingsPageData> {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) {
    return { profile: null, inviteCodes: [], achievements: [], claimableKeys: [] };
  }

  const [
    { data: checkResult },
    { data: profileData },
    { data: codes },
    { data: allAchievements },
    { data: userAchievements },
  ] = await Promise.all([
    supabase.rpc("check_achievements", { p_user_id: user.id }),
    supabase.from("profiles").select("username, nickname, title, created_at").eq("id", user.id).single(),
    supabase.from("invite_codes").select("code, used_by").eq("owner_id", user.id),
    supabase.from("achievements").select("*").order("sort_order"),
    supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
  ]);

  const claimableKeys: string[] = checkResult?.claimable || [];
  const claimableSet = new Set(claimableKeys);
  const unlockedSet = new Set((userAchievements || []).map((ua: { achievement_id: number }) => ua.achievement_id));

  const achievements: SettingsAchievement[] = (allAchievements || [])
    .map((a: SettingsAchievement) => ({ ...a, unlocked: unlockedSet.has(a.id) }))
    .sort((a: SettingsAchievement, b: SettingsAchievement) => {
      const aOrder = claimableSet.has(a.key) ? 0 : a.unlocked ? 1 : 2;
      const bOrder = claimableSet.has(b.key) ? 0 : b.unlocked ? 1 : 2;
      return aOrder - bOrder;
    });

  return {
    profile: profileData || null,
    inviteCodes: codes || [],
    achievements,
    claimableKeys,
  };
}

export async function claimAchievement(key: string) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("claim_achievement", {
    p_user_id: user.id,
    p_achievement_key: key,
  });
  if (error) return { error: "달성에 실패했습니다." };
  return { success: true, data };
}

export async function setTitle(title: string | null) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  await supabase.rpc("set_title", { p_user_id: user.id, p_title: title });
  return { success: true };
}

// ── 피드백 제출 ──
export async function submitFeedback(input: {
  category: "bug" | "suggestion" | "other";
  content: string;
  userAgent?: string;
  pagePath?: string;
}) {
  const supabase = await createClient();
  const user = await getUserFromSession(supabase);
  if (!user) return { error: "인증이 필요합니다." };

  const trimmed = input.content.trim();
  if (!trimmed) return { error: "내용을 입력해주세요." };
  if (trimmed.length > 2000) return { error: "내용이 너무 길어요. (최대 2000자)" };
  if (!["bug", "suggestion", "other"].includes(input.category)) {
    return { error: "잘못된 카테고리입니다." };
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    category: input.category,
    content: trimmed,
    user_agent: input.userAgent || null,
    page_path: input.pagePath || null,
  });

  if (error) return { error: "전송에 실패했습니다." };
  return { success: true };
}
