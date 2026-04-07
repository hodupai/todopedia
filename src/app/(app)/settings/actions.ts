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
