"use server";

import { createClient } from "@/lib/supabase/server";

export type Party = {
  id: string;
  name: string;
  type: "individual" | "collaborative";
  leader_id: string;
  members: { user_id: string; nickname: string; status: string }[];
};

export type PendingInvite = {
  party_id: string;
  party_name: string;
  party_type: string;
  leader_nickname: string;
};

// ── 내 파티 목록 ──
export async function getMyParties(): Promise<Party[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

  const result: Party[] = [];
  for (const party of parties) {
    const { data: members } = await supabase
      .from("party_members")
      .select("user_id, status, profiles:user_id(nickname)")
      .eq("party_id", party.id);

    result.push({
      ...party,
      members: (members || []).map((m: any) => ({
        user_id: m.user_id,
        nickname: (m.profiles as any)?.nickname || "???",
        status: m.status,
      })),
    });
  }
  return result;
}

// ── 대기 중인 초대 ──
export async function getPendingInvites(): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("party_members")
    .select("party_id, parties(name, type, leader_id, profiles:leader_id(nickname))")
    .eq("user_id", user.id)
    .eq("status", "pending");

  if (!data) return [];
  return data.map((d: any) => ({
    party_id: d.party_id,
    party_name: d.parties?.name || "",
    party_type: d.parties?.type || "",
    leader_nickname: (d.parties?.profiles as any)?.nickname || "???",
  }));
}

// ── 파티 생성 ──
export async function createParty(name: string, type: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: "인증이 필요합니다." };

    const { data, error } = await supabase.rpc("create_party", {
      p_user_id: user.id, p_name: name, p_type: type,
    });
    if (error) {
      if (error.message.includes("max_parties")) return { error: "파티는 최대 5개까지예요." };
      return { error: `파티 생성 실패: ${error.message}` };
    }
    return { success: true, data };
  } catch (e: any) {
    return { error: `예외 발생: ${e?.message || String(e)}` };
  }
}

// ── 초대 ──
export async function inviteToParty(partyId: string, nickname: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const { data, error } = await supabase.rpc("invite_to_party", {
    p_user_id: user.id, p_party_id: partyId, p_nickname: nickname,
  });
  if (error) {
    if (error.message.includes("user_not_found")) return { error: "해당 ID의 유저를 찾을 수 없어요." };
    if (error.message.includes("already_member")) return { error: "이미 파티원이에요." };
    if (error.message.includes("not_leader")) return { error: "파티장만 초대할 수 있어요." };
    return { error: "초대에 실패했습니다." };
  }
  return { success: true };
}

// ── 초대 수락/거절 ──
export async function acceptInvite(partyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };
  const { error } = await supabase.rpc("accept_party_invite", { p_user_id: user.id, p_party_id: partyId });
  if (error) return { error: "수락에 실패했습니다." };
  return { success: true };
}

export async function declineInvite(partyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };
  const { error } = await supabase.rpc("decline_party_invite", { p_user_id: user.id, p_party_id: partyId });
  if (error) return { error: "거절에 실패했습니다." };
  return { success: true };
}

// ── 탈퇴 ──
export async function leaveParty(partyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };
  const { error } = await supabase.rpc("leave_party", { p_user_id: user.id, p_party_id: partyId });
  if (error) {
    if (error.message.includes("leader_cannot_leave")) return { error: "파티장은 탈퇴할 수 없어요." };
    return { error: "탈퇴에 실패했습니다." };
  }
  return { success: true };
}

// ── 파티 삭제 (파티장만) ──
export async function deleteParty(partyId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };

  const { error } = await supabase.rpc("delete_party", {
    p_user_id: user.id, p_party_id: partyId,
  });
  if (error) {
    if (error.message.includes("not_leader")) return { error: "파티장만 삭제할 수 있어요." };
    return { error: "삭제에 실패했습니다." };
  }
  return { success: true };
}

// ── 추방 ──
export async function kickMember(partyId: string, targetId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "인증이 필요합니다." };
  const { error } = await supabase.rpc("kick_party_member", {
    p_user_id: user.id, p_party_id: partyId, p_target_id: targetId,
  });
  if (error) return { error: "추방에 실패했습니다." };
  return { success: true };
}
