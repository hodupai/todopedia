"use client";

import { useState, useTransition } from "react";
import {
  type AdminDashboard,
  type AdminFeedback,
  type AdminUserRow,
  type AdminUserDetail,
  searchUsers,
  getUserDetail,
  grantGold,
  setFeedbackResolved,
  resetUserPassword,
  deleteUserAccount,
  listFeedback,
} from "./actions";

const TABS = ["대시보드", "사용자", "피드백"] as const;
type Tab = (typeof TABS)[number];

const CATEGORY_LABEL = {
  bug: "🐛 버그",
  suggestion: "💡 건의",
  other: "💬 기타",
} as const;

export default function AdminClient({
  initialDashboard,
  initialFeedback,
}: {
  initialDashboard: AdminDashboard;
  initialFeedback: AdminFeedback[];
}) {
  const [tab, setTab] = useState<Tab>("대시보드");
  const [dashboard] = useState(initialDashboard);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [showResolved, setShowResolved] = useState(false);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSearch = (q: string) => {
    startTransition(async () => {
      const result = await searchUsers(q);
      setUsers(result);
    });
  };

  const handleSelectUser = (id: string) => {
    startTransition(async () => {
      const detail = await getUserDetail(id);
      setSelectedUser(detail);
    });
  };

  const refreshFeedback = (resolved: boolean) => {
    startTransition(async () => {
      const data = await listFeedback(resolved);
      setFeedback(data);
    });
  };

  return (
    <div className="space-y-6">
      {/* 탭 */}
      <div className="flex gap-2 border-b border-neutral-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm transition ${
              tab === t
                ? "border-b-2 border-amber-500 text-amber-500"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 대시보드 */}
      {tab === "대시보드" && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Stat label="총 유저" value={dashboard.totalUsers} />
          <Stat label="오늘 가입" value={dashboard.todayJoined} />
          <Stat label="오늘 액티브" value={dashboard.todayActive} />
          <Stat label="총 골드 보유량" value={dashboard.totalGoldIssued.toLocaleString()} />
          <Stat
            label="미해결 피드백"
            value={dashboard.pendingFeedback}
            highlight={dashboard.pendingFeedback > 0}
          />
        </div>
      )}

      {/* 사용자 */}
      {tab === "사용자" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
              placeholder="아이디 또는 닉네임 검색 (빈칸 = 최근 50명)"
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm"
            />
            <button
              onClick={() => handleSearch(query)}
              disabled={pending}
              className="rounded bg-amber-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              검색
            </button>
          </div>

          {users.length > 0 && (
            <div className="rounded border border-neutral-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-neutral-400">
                  <tr>
                    <th className="px-3 py-2 text-left">아이디</th>
                    <th className="px-3 py-2 text-left">닉네임</th>
                    <th className="px-3 py-2 text-right">골드</th>
                    <th className="px-3 py-2 text-left">가입일</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-t border-neutral-800 hover:bg-neutral-900">
                      <td className="px-3 py-2">
                        {u.username}
                        {u.is_admin && (
                          <span className="ml-2 rounded bg-amber-900 px-1.5 py-0.5 text-[10px] text-amber-300">
                            ADMIN
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">{u.nickname}</td>
                      <td className="px-3 py-2 text-right">{u.gold.toLocaleString()}</td>
                      <td className="px-3 py-2 text-neutral-400">
                        {new Date(u.created_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleSelectUser(u.id)}
                          className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
                        >
                          상세
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 피드백 */}
      {tab === "피드백" && (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-neutral-400">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => {
                setShowResolved(e.target.checked);
                refreshFeedback(e.target.checked);
              }}
            />
            해결된 항목도 표시
          </label>

          {feedback.length === 0 ? (
            <p className="text-neutral-500 text-sm py-8 text-center">피드백이 없습니다.</p>
          ) : (
            feedback.map((f) => (
              <div
                key={f.id}
                className={`rounded border p-4 ${
                  f.resolved ? "border-neutral-800 opacity-60" : "border-neutral-700 bg-neutral-900"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-neutral-400">
                      <span>{CATEGORY_LABEL[f.category]}</span>
                      <span>·</span>
                      <span>
                        {f.nickname} ({f.username})
                      </span>
                      <span>·</span>
                      <span>{new Date(f.created_at).toLocaleString("ko-KR")}</span>
                      {f.page_path && (
                        <>
                          <span>·</span>
                          <span className="text-amber-500">{f.page_path}</span>
                        </>
                      )}
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{f.content}</p>
                    {f.user_agent && (
                      <p className="text-[10px] text-neutral-600 truncate">{f.user_agent}</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      startTransition(async () => {
                        const r = await setFeedbackResolved(f.id, !f.resolved);
                        if (!r.error) refreshFeedback(showResolved);
                      });
                    }}
                    className="rounded bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
                  >
                    {f.resolved ? "되돌리기" : "해결됨"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 유저 상세 모달 */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onChanged={() => {
            handleSearch(query);
            handleSelectUser(selectedUser.id);
          }}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded border p-4 ${
        highlight ? "border-amber-600 bg-amber-950/30" : "border-neutral-800 bg-neutral-900"
      }`}
    >
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function UserDetailModal({
  user,
  onClose,
  onChanged,
}: {
  user: AdminUserDetail;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [goldAmount, setGoldAmount] = useState("");
  const [goldReason, setGoldReason] = useState("");
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleGrantGold = () => {
    const amount = parseInt(goldAmount, 10);
    if (Number.isNaN(amount)) {
      setError("숫자를 입력해주세요.");
      return;
    }
    startTransition(async () => {
      setError(null);
      const r = await grantGold(user.id, amount, goldReason);
      if (r.error) {
        setError(r.error);
        return;
      }
      setGoldAmount("");
      setGoldReason("");
      onChanged();
    });
  };

  const handleResetPassword = () => {
    if (!confirm(`${user.username}의 비밀번호를 초기화하시겠습니까?`)) return;
    startTransition(async () => {
      setError(null);
      const r = await resetUserPassword(user.id);
      if (r.error) {
        setError(r.error);
        return;
      }
      setResetResult(r.tempPassword || null);
    });
  };

  const handleDelete = () => {
    if (!confirm(`정말로 ${user.username} 계정을 삭제하시겠습니까?\n모든 데이터가 영구 삭제됩니다.`)) return;
    if (!confirm("진짜 마지막 확인입니다. 되돌릴 수 없습니다.")) return;
    startTransition(async () => {
      setError(null);
      const r = await deleteUserAccount(user.id);
      if (r.error) {
        setError(r.error);
        return;
      }
      onChanged();
      onClose();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded border border-neutral-700 bg-neutral-950 p-6 space-y-5"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {user.nickname}{" "}
              <span className="text-sm font-normal text-neutral-400">({user.username})</span>
              {user.is_admin && (
                <span className="ml-2 rounded bg-amber-900 px-1.5 py-0.5 text-[10px] text-amber-300">
                  ADMIN
                </span>
              )}
            </h2>
            <p className="text-xs text-neutral-500 mt-1">{user.id}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-100">
            ✕
          </button>
        </div>

        {/* 정보 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <Field label="골드" value={user.gold.toLocaleString()} />
          <Field label="가입일" value={new Date(user.created_at).toLocaleDateString("ko-KR")} />
          <Field
            label="마지막 활동"
            value={user.lastActiveDate ? new Date(user.lastActiveDate).toLocaleDateString("ko-KR") : "-"}
          />
          <Field label="일일 목표" value={user.daily_goal || "-"} />
          <Field label="완료 투두 (전체)" value={user.totalCompletedTodos} />
          <Field label="수집 가디언" value={user.totalGuardians} />
          <Field label="타이틀" value={user.title || "-"} />
          <Field label="테마" value={user.active_theme || "-"} />
          <Field label="폰트" value={user.active_font || "-"} />
        </div>

        {error && (
          <div className="rounded border border-red-700 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* 골드 지급 */}
        <section className="space-y-2 rounded border border-neutral-800 p-4">
          <h3 className="text-sm font-semibold text-neutral-300">💰 골드 지급/회수</h3>
          <div className="flex gap-2">
            <input
              type="number"
              value={goldAmount}
              onChange={(e) => setGoldAmount(e.target.value)}
              placeholder="금액 (음수 = 회수)"
              className="w-32 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
            />
            <input
              type="text"
              value={goldReason}
              onChange={(e) => setGoldReason(e.target.value)}
              placeholder="사유 (선택)"
              className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5 text-sm"
            />
            <button
              onClick={handleGrantGold}
              disabled={pending}
              className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
            >
              지급
            </button>
          </div>
        </section>

        {/* 비밀번호 초기화 */}
        <section className="space-y-2 rounded border border-neutral-800 p-4">
          <h3 className="text-sm font-semibold text-neutral-300">🔑 비밀번호 초기화</h3>
          {resetResult ? (
            <div className="space-y-2">
              <p className="text-xs text-neutral-400">새 임시 비밀번호 (이 화면에서만 1회 표시):</p>
              <div className="flex gap-2">
                <code className="flex-1 rounded border border-amber-600 bg-amber-950/30 px-3 py-2 text-sm font-mono text-amber-200">
                  {resetResult}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(resetResult);
                  }}
                  className="rounded bg-neutral-800 px-3 py-2 text-xs"
                >
                  복사
                </button>
                <button
                  onClick={() => setResetResult(null)}
                  className="rounded bg-neutral-800 px-3 py-2 text-xs"
                >
                  닫기
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleResetPassword}
              disabled={pending}
              className="rounded bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-50"
            >
              임시 비밀번호 발급
            </button>
          )}
        </section>

        {/* 계정 삭제 */}
        <section className="space-y-2 rounded border border-red-900 bg-red-950/20 p-4">
          <h3 className="text-sm font-semibold text-red-400">⚠️ 계정 삭제 (위험)</h3>
          <p className="text-xs text-neutral-400">
            모든 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다.
          </p>
          <button
            onClick={handleDelete}
            disabled={pending || user.is_admin}
            className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium hover:bg-red-600 disabled:opacity-50"
          >
            {user.is_admin ? "어드민 계정은 삭제 불가" : "계정 영구 삭제"}
          </button>
        </section>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}
