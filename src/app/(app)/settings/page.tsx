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

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const { show: showToast } = useToast();

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: profileData }, { data: codes }] = await Promise.all([
      supabase.from("profiles").select("username, nickname, title, created_at").eq("id", user.id).single(),
      supabase.from("invite_codes").select("code, used_by").eq("owner_id", user.id),
    ]);

    if (profileData) setProfile(profileData);
    setInviteCodes(codes || []);
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

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="font-pixel text-sm text-theme-muted">로딩 중...</p>
      </div>
    );
  }

  const availableCodes = inviteCodes.filter((c) => !c.used_by);
  const usedCodes = inviteCodes.filter((c) => c.used_by);

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
        <h2 className="font-pixel text-sm text-theme">타이틀</h2>
        <div className="mt-3 flex items-center justify-between">
          <span className="font-pixel text-xs text-theme-muted">현재 타이틀</span>
          <span className="font-pixel text-xs text-theme">{profile?.title || "없음"}</span>
        </div>
      </div>

      {/* 업적 */}
      <div className="pixel-panel p-4">
        <h2 className="font-pixel text-sm text-theme">업적</h2>
        <div className="mt-3 flex flex-col items-center py-4">
          <span className="text-2xl">🏆</span>
          <p className="font-pixel mt-2 text-xs text-theme-muted">준비 중이에요</p>
        </div>
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
            <p className="font-pixel text-xs text-theme-muted mt-2">
              사용됨 {usedCodes.length}장
            </p>
          )}
        </div>
      </div>

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
    </div>
  );
}
