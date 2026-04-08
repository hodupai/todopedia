"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import InstallAppButton from "@/components/InstallAppButton";
import {
  getSettingsPageData,
  claimAchievement,
  setTitle as setTitleAction,
  submitFeedback,
  deleteOwnAccount,
  type SettingsPageData,
  type SettingsProfile,
  type SettingsInviteCode,
  type SettingsAchievement,
} from "./actions";

type Profile = SettingsProfile;
type InviteCode = SettingsInviteCode;
type Achievement = SettingsAchievement;

export default function SettingsClient({ initial }: { initial: SettingsPageData }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(initial.profile);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>(initial.inviteCodes);
  const [achievements, setAchievements] = useState<Achievement[]>(initial.achievements);
  const [showTitles, setShowTitles] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showCodes, setShowCodes] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const { show: showToast } = useToast();

  const [claimableKeys, setClaimableKeys] = useState<Set<string>>(new Set(initial.claimableKeys));

  const loadData = useCallback(async () => {
    const data = await getSettingsPageData();
    setProfile(data.profile);
    setInviteCodes(data.inviteCodes);
    setAchievements(data.achievements);
    setClaimableKeys(new Set(data.claimableKeys));
  }, []);

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
    const result = await claimAchievement(key);
    if (result.error) {
      showToast(result.error);
      return;
    }
    const data = result.data;
    showToast(`🏆 ${data.name} 달성!`, data.title_text ? `타이틀 "${data.title_text}" 획득!` : undefined);
    loadData();
  };

  const handleSetTitle = async (title: string | null) => {
    await setTitleAction(title);
    setProfile((p) => p ? { ...p, title } : p);
    showToast(title ? `타이틀 "${title}" 적용!` : "타이틀 해제!");
  };

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
        <button
          onClick={() => setShowTitles(!showTitles)}
          className="flex w-full items-center justify-between"
        >
          <h2 className="font-pixel text-sm text-theme">타이틀</h2>
          <div className="flex items-center gap-2">
            <span className="font-pixel text-xs" style={{ color: "var(--theme-accent)" }}>
              {profile?.title || "없음"}
            </span>
            <span className="font-pixel text-xs text-theme-muted">{showTitles ? "▲" : "▼"}</span>
          </div>
        </button>
        {showTitles && (
          <div className="mt-3 space-y-2">
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
                <span className="font-pixel text-xs text-theme">
                  {profile?.title === (a.title_text || a.key) ? "✓" : "변경"}
                </span>
              </button>
            ))}
            {titleAchievements.length === 0 && (
              <p className="font-pixel text-xs text-theme-muted text-center py-2">업적을 달성하면 타이틀을 얻을 수 있어요</p>
            )}
          </div>
        )}
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
                    &ldquo;{a.title_text}&rdquo;
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
        <button
          onClick={() => setShowCodes(!showCodes)}
          className="flex w-full items-center justify-between"
        >
          <h2 className="font-pixel text-sm text-theme">초대코드</h2>
          <div className="flex items-center gap-2">
            <span className="font-pixel text-xs text-theme-muted">
              {availableCodes.length}장
            </span>
            <span className="font-pixel text-xs text-theme-muted">{showCodes ? "▲" : "▼"}</span>
          </div>
        </button>
        {showCodes && (
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
            {usedCodes.map((c) => (
              <div key={c.code} className="pixel-input flex items-center justify-between p-2" style={{ opacity: 0.6 }}>
                <span className="font-pixel text-xs text-theme-muted line-through">{c.code}</span>
                <span className="font-pixel text-xs text-theme-muted">
                  {c.used_by_nickname ?? "사용됨"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 통계 */}
      <button
        onClick={() => router.push("/settings/stats")}
        className="pixel-button py-2.5 font-pixel text-xs text-theme"
      >
        통계
      </button>

      {/* 관리자 페이지 (어드민에게만 노출) */}
      {initial.isAdmin && (
        <button
          onClick={() => router.push("/admin")}
          className="pixel-button py-2.5 font-pixel text-xs text-theme"
          style={{ color: "var(--theme-accent)" }}
        >
          🔧 관리자 페이지
        </button>
      )}

      {/* 건의/버그 제보 */}
      <button
        onClick={() => setShowFeedback(true)}
        className="pixel-button py-2.5 font-pixel text-xs text-theme"
      >
        💌 건의/버그 제보
      </button>

      {/* 홈 화면에 추가 (PWA 설치) */}
      <InstallAppButton />

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

      {/* 회원 탈퇴 */}
      <button
        onClick={() => setShowWithdraw(true)}
        className="pixel-button py-2.5 font-pixel text-xs"
        style={{ color: "var(--theme-accent)", opacity: 0.7 }}
      >
        회원 탈퇴
      </button>

      {showWithdraw && profile && (
        <WithdrawModal
          username={profile.username}
          onClose={() => setShowWithdraw(false)}
          onDeleted={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push("/login");
          }}
        />
      )}

      {showFeedback && (
        <FeedbackModal
          onClose={() => setShowFeedback(false)}
          onSent={() => {
            setShowFeedback(false);
            showToast("피드백을 보냈어요", "소중한 의견 감사합니다 💌");
          }}
        />
      )}
    </div>
  );
}

// 피드백 작성 모달
function FeedbackModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [category, setCategory] = useState<"bug" | "suggestion" | "other">("suggestion");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!content.trim()) {
      setError("내용을 입력해주세요.");
      return;
    }
    setSubmitting(true);
    const result = await submitFeedback({
      category,
      content,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      pagePath: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSent();
  };

  const CATS: { key: "bug" | "suggestion" | "other"; label: string; icon: string }[] = [
    { key: "bug", label: "버그", icon: "🐛" },
    { key: "suggestion", label: "건의", icon: "💡" },
    { key: "other", label: "기타", icon: "💬" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="pixel-panel w-full max-w-sm space-y-3 p-5"
      >
        <h3 className="font-pixel text-sm text-theme text-center">건의/버그 제보</h3>

        {/* 카테고리 */}
        <div className="grid grid-cols-3 gap-2">
          {CATS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCategory(c.key)}
              className="pixel-button flex flex-col items-center gap-0.5 py-2 font-pixel text-xs"
              style={{
                opacity: category === c.key ? 1 : 0.5,
                color: "var(--theme-text)",
              }}
            >
              <span className="text-base">{c.icon}</span>
              <span>{c.label}</span>
            </button>
          ))}
        </div>

        {/* 내용 */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
          rows={6}
          placeholder="자유롭게 작성해주세요. 어떤 화면에서 어떻게 했을 때 무슨 일이 일어났는지 적어주시면 큰 도움이 됩니다."
          className="pixel-input w-full p-2 font-pixel text-xs text-theme placeholder:text-theme-muted"
          style={{ resize: "none", backgroundColor: "transparent" }}
        />
        <p className="font-pixel text-[10px] text-theme-muted text-right">
          {content.length}/2000
        </p>

        {error && (
          <p className="font-pixel text-xs" style={{ color: "var(--theme-accent)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="pixel-button flex-1 py-2 font-pixel text-xs text-theme"
          >
            {submitting ? "보내는 중..." : "보내기"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="pixel-button flex-1 py-2 font-pixel text-xs text-theme-muted"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}

// 회원 탈퇴 모달 — 본인 username을 정확히 입력해야 진행
function WithdrawModal({
  username,
  onClose,
  onDeleted,
}: {
  username: string;
  onClose: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== username) {
      setError("아이디가 일치하지 않습니다.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await deleteOwnAccount(confirmText);
    if (result.error) {
      setError(result.error);
      setSubmitting(false);
      return;
    }
    await onDeleted();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="pixel-panel w-full max-w-sm space-y-3 p-5"
      >
        <h3 className="font-pixel text-sm text-center" style={{ color: "var(--theme-accent)" }}>
          ⚠️ 회원 탈퇴
        </h3>

        <div className="space-y-2 font-pixel text-xs text-theme-muted">
          <p>탈퇴하면 다음 데이터가 <strong className="text-theme">영구 삭제</strong>됩니다:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>모든 투두/습관/기록</li>
            <li>가디언/도감/아이템</li>
            <li>골드, 업적, 타이틀</li>
            <li>담벼락 게시물 및 받은 하트</li>
            <li>참여 중인 파티 (혼자 만든 경우)</li>
          </ul>
          <p className="text-theme-muted pt-1">되돌릴 수 없습니다.</p>
        </div>

        <div className="space-y-1">
          <label className="font-pixel text-xs text-theme-muted">
            확인을 위해 본인 아이디 <span style={{ color: "var(--theme-accent)" }}>{username}</span>를 입력해주세요
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={username}
            autoComplete="off"
            className="pixel-input w-full px-2 py-2 font-pixel text-xs text-theme"
            style={{ backgroundColor: "transparent" }}
          />
        </div>

        {error && (
          <p className="font-pixel text-xs" style={{ color: "var(--theme-accent)" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting || confirmText !== username}
            className="pixel-button flex-1 py-2 font-pixel text-xs disabled:opacity-40"
            style={{ color: "var(--theme-accent)" }}
          >
            {submitting ? "삭제 중..." : "탈퇴하기"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="pixel-button flex-1 py-2 font-pixel text-xs text-theme"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
