"use server";

import { createClient } from "@/lib/supabase/server";

export type WallPost = {
  id: string;
  user_id: string;
  nickname: string;
  type: string;
  content: {
    guardian_name?: string;
    rarity?: string;
    asset_key?: string;
    period_days?: number;
    date?: string;
  };
  heart_count: number;
  hearted: boolean;
  created_at: string;
};

// ── 담벼락 조회 ──
export async function getWallPosts(limit = 50, offset = 0): Promise<WallPost[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase.rpc("get_wall_posts", {
    p_user_id: user.id,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) return [];
  return (data as WallPost[]) || [];
}

// ── 하트 ──
export async function heartPost(postId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("heart_post", {
    p_user_id: user.id,
    p_post_id: postId,
  });

  if (error) {
    if (error.message.includes("cannot_heart_own_post")) return { error: "내 글에는 하트를 누를 수 없어요." };
    if (error.message.includes("already_hearted")) return { error: "이미 하트를 눌렀어요." };
    return { error: "하트에 실패했습니다." };
  }

  return { success: true, data };
}
