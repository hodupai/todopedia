"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";

type Profile = {
  username: string;
  nickname: string;
  title: string | null;
  created_at: string;
};

type InviteCode = {
  code: string;
  used_by: string | null;
};

type Achievement = {
  id: number;
  key: string;
  name: string;
  description: string;
  category: string;
  title_text: string | null;
  title_image: string | null;
  unlocked: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [loading, setLoading] = useState(true);
  const { show: showToast } = useToast();

  const [claimableKeys, setClaimableKeys] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 업적 조건 체크 (달성 가능 목록)
    const { data: checkResult } = await supabase.rpc("check_achievements", { p_user_id: user.id });

    const [{ data: profileData }, { data: codes }, { data: allAchievements }, { data: userAchievements }] = await Promise.all([
      supabase.from("profiles").select("username, nickname, title, created_at").eq("id", user.id).single(),
      supabase.from("invite_codes").select("code, used_by").eq("owner_id", user.id),
      supabase.from("achievements").select("*").order("sort_order"),
      supabase.from("user_achievements").select("achievement_id").eq("user_id", user.id),
    ]);

    if (profileData) setProfile(profileData);
    setInviteCodes(codes || []);
    setClaimableKeys(new Set(checkResult?.claimable || []));

    const unlockedSet = new Set((userAchievements || []).map((ua: any) => ua.achievement_id));
    setAchievements(
      (allAchievements || []).map((a: any) => ({ ...a, unlocked: unlockedSet.has(a.id) }))
    );
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast("복사 완료!", code);
  };

  const handleClaim = async (key: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.rpc("claim_achievement", {
      p_user_id: user.id, p_achievement_key: key,
    });

    if (error) {
      showToast("달성에 실패했습니다.");
      return;
    }

    showToast(`🏆 ${data.name} 달성!`, data.title_text ? `타이틀 "${data.title_text}" 획득!` : undefined);
    loadData();
  };

  const handleSetTitle = async (title: string | null) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc("set_title", { p_user_id: user.id, p_title: title });
    setProfile((p) => p ? { ...p, title } : p);
    setShowTitleModal(false);
    showToast(title ? `타이틀 "${title}" 적용!` : "타이틀 해제!");
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="font-pixel text-sm text-theme-muted">로딩 중...</p>
      </div>
    );
  }

  const availableCodes = inviteCodes.filter((c) => !c.used_by);
  const usedCodes = inviteCodes.filter((c) => c.used_by);
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const titleAchievements = achievements.filter((a) => a.unlocked && (a.title_text || a.title_image));

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto scrollbar-hide p-4">
      {/* 프로필 */}
      <div className="pixel-panel p-4">
        <h2 className="font-pixel text-sm text-theme">프로필</h2>
        <div className="mt-3 space-y-2">
          <div className="flex justify-between font-pixel text-xs">
            <span className="text-theme-muted">아이디</span>
            <span className="text-theme">{profile?.username || "-"}</span>
          </div>
          <div className="flex justify-between font-pixel text-xs">
            <span className="text-theme-muted">닉네임</span>
            <span className="text-theme">{profile?.nickname || "-"}</span>
          </div>
          <div className="flex justify-between font-pixel text-xs">
            <span className="text-theme-muted">가입일</span>
            <span className="text-theme">
              {profile?.created_at ? new Date(profile.created_at).toLocaleDateString("ko-KR") : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* 타이틀 */}
      <div className="pixel-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-sm text-theme">타이틀</h2>
          <button
            onClick={() => setShowTitleModal(true)}
            className="pixel-button px-3 py-1 font-pixel text-xs text-theme-muted"
          >
            변경
          </button>
        </div>
        <div className="mt-3 flex items-center justify-center py-2">
          <span className="font-pixel text-sm" style={{ color: "var(--theme-accent)" }}>
            {profile?.title || "없음"}
          </span>
        </div>
      </div>

      {/* 업적 */}
      <div className="pixel-panel p-4">
        <button
          onClick={() => setShowAchievements(!showAchievements)}
          className="flex w-full items-center justify-between"
        >
          <h2 className="font-pixel text-sm text-theme">업적</h2>
          <span className="font-pixel text-xs text-theme-muted">
            {unlockedCount}/{achievements.length} {showAchievements ? "▲" : "▼"}
          </span>
        </button>

        {showAchievements && (
          <div className="mt-3 space-y-2">
            {achievements.map((a) => (
              <div
                key={a.id}
                className="pixel-input flex items-center gap-3 p-2"
                style={{ opacity: a.unlocked ? 1 : claimableKeys.has(a.key) ? 0.9 : 0.4 }}
              >
                <span className="text-lg shrink-0">{a.unlocked ? "🏆" : claimableKeys.has(a.key) ? "✨" : "🔒"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-pixel text-xs text-theme">{a.name}</p>
                  <p className="font-pixel text-xs text-theme-muted">{a.description}</p>
                </div>
                {a.unlocked && a.title_text && (
                  <span className="font-pixel text-xs shrink-0" style={{ color: "var(--theme-accent)" }}>
                    "{a.title_text}"
                  </span>
                )}
                {!a.unlocked && claimableKeys.has(a.key) && (
                  <button
                    onClick={() => handleClaim(a.key)}
                    className="pixel-button px-2 py-1 font-pixel text-xs shrink-0"
                    style={{ color: "var(--theme-accent)" }}
                  >
                    달성
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 초대코드 */}
      <div className="pixel-panel p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-pixel text-sm text-theme">초대코드</h2>
          <span className="font-pixel text-xs text-theme-muted">
            사용 가능 {availableCodes.length}장
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {availableCodes.length === 0 && usedCodes.length === 0 && (
            <p className="font-pixel text-xs text-theme-muted text-center py-2">초대코드가 없어요</p>
          )}
          {availableCodes.map((c) => (
            <div key={c.code} className="pixel-input flex items-center justify-between p-2">
              <span className="font-pixel text-xs text-theme">{c.code}</span>
              <button
                onClick={() => handleCopyCode(c.code)}
                className="pixel-button px-2 py-1 font-pixel text-xs text-theme-muted"
              >
                복사
              </button>
            </div>
          ))}
          {usedCodes.length > 0 && (
            <p className="font-pixel text-xs text-theme-muted mt-2">사용됨 {usedCodes.length}장</p>
          )}
        </div>
      </div>

      {/* 통계 */}
      <button className="pixel-button py-2.5 font-pixel text-xs text-theme-muted">
        통계 (준비 중)
      </button>

      {/* 개인정보 취급 방침 */}
      <button className="pixel-button py-2.5 font-pixel text-xs text-theme-muted">
        개인정보 취급 방침
      </button>

      {/* 로그아웃 */}
      <button
        onClick={handleLogout}
        className="pixel-button py-2.5 font-pixel text-sm text-theme-muted"
      >
        로그아웃
      </button>

      {/* 타이틀 변경 모달 */}
      {showTitleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setShowTitleModal(false)}>
          <div className="pixel-panel w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-pixel text-sm text-theme text-center">타이틀 변경</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-hide">
              <button
                onClick={() => handleSetTitle(null)}
                className="pixel-input flex w-full items-center justify-between p-2"
              >
                <span className="font-pixel text-xs text-theme-muted">없음</span>
                {!profile?.title && <span className="font-pixel text-xs text-theme">✓</span>}
              </button>
              {titleAchievements.map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSetTitle(a.title_text || a.key)}
                  className="pixel-input flex w-full items-center justify-between p-2"
                >
                  <span className="font-pixel text-xs" style={{ color: "var(--theme-accent)" }}>
                    {a.title_text || a.key}
                  </span>
                  {profile?.title === (a.title_text || a.key) && (
                    <span className="font-pixel text-xs text-theme">✓</span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTitleModal(false)}
              className="pixel-button w-full py-2 font-pixel text-xs text-theme-muted"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
