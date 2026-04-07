"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getMyParties, getPendingInvites, createParty, inviteToParty,
  acceptInvite, declineInvite, leaveParty, kickMember, deleteParty,
} from "../party-actions";
import type { Party, PendingInvite } from "../party-actions";
import { useToast } from "@/components/Toast";

export default function PartyClient({
  initialParties,
  initialInvites,
}: {
  initialParties: Party[];
  initialInvites: PendingInvite[];
}) {
  const router = useRouter();
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [invites, setInvites] = useState<PendingInvite[]>(initialInvites);
  const [showCreate, setShowCreate] = useState(false);
  const { show: showToast } = useToast();

  const loadData = useCallback(async () => {
    const [p, inv] = await Promise.all([getMyParties(), getPendingInvites()]);
    setParties(p);
    setInvites(inv);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="pixel-button px-3 py-1 font-pixel text-xs text-theme">←</button>
        <h1 className="font-pixel text-sm text-theme">파티관리소</h1>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide space-y-3">
        {/* 대기 중인 초대 */}
        {invites.length > 0 && (
          <div className="pixel-panel p-3">
            <h3 className="font-pixel text-xs text-theme-muted mb-2">파티 초대</h3>
            {invites.map((inv) => (
              <div key={inv.party_id} className="pixel-input flex items-center justify-between p-2 mb-1">
                <div>
                  <p className="font-pixel text-xs text-theme">{inv.party_name}</p>
                  <p className="font-pixel text-xs text-theme-muted">
                    {inv.leader_nickname} · {inv.party_type === "individual" ? "각자" : "다같이"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={async () => {
                      const r = await acceptInvite(inv.party_id);
                      if (r.error) showToast(r.error);
                      else { showToast("파티에 참가했어요!"); loadData(); }
                    }}
                    className="pixel-button px-2 py-1 font-pixel text-xs text-theme"
                  >수락</button>
                  <button
                    onClick={async () => { await declineInvite(inv.party_id); loadData(); }}
                    className="pixel-button px-2 py-1 font-pixel text-xs text-theme-muted"
                  >거절</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 파티 목록 */}
        {parties.map((party) => (
          <PartyCard key={party.id} party={party} onRefresh={loadData} />
        ))}

        {parties.length === 0 && invites.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-8">
            <span className="text-3xl">⚔️</span>
            <p className="font-pixel text-sm text-theme-muted">아직 파티가 없어요</p>
            <button
              onClick={() => setShowCreate(true)}
              className="pixel-button px-4 py-2 font-pixel text-xs text-theme"
            >
              + 첫 파티 만들기
            </button>
          </div>
        )}
      </div>

      {/* 파티 생성 */}
      {parties.length < 5 && (
        <button
          onClick={() => setShowCreate(true)}
          className="pixel-button py-2 font-pixel text-xs text-theme"
        >+ 파티 만들기</button>
      )}

      {showCreate && (
        <CreatePartyModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadData(); }}
        />
      )}
    </div>
  );
}

// ── 파티 카드 ──
function PartyCard({ party, onRefresh }: { party: Party; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteNick, setInviteNick] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { show: showToast } = useToast();

  const handleInvite = async () => {
    if (!inviteNick.trim()) return;
    const r = await inviteToParty(party.id, inviteNick.trim());
    if (r.error) showToast(r.error);
    else { showToast(`${inviteNick} 초대 완료!`); setInviteNick(""); setShowInvite(false); onRefresh(); }
  };

  const handleLeave = async () => {
    const r = await leaveParty(party.id);
    if (r.error) showToast(r.error);
    else onRefresh();
  };

  const handleDelete = async () => {
    const r = await deleteParty(party.id);
    if (r.error) showToast(r.error);
    else { showToast("파티가 삭제되었어요."); onRefresh(); }
  };

  const handleKick = async (targetId: string, nickname: string) => {
    const r = await kickMember(party.id, targetId);
    if (r.error) showToast(r.error);
    else { showToast(`${nickname} 추방됨`); onRefresh(); }
  };

  return (
    <div className="pixel-panel p-3">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-xs">{party.type === "individual" ? "👤" : "👥"}</span>
          <span className="font-pixel text-sm text-theme">{party.name}</span>
          <span className="font-pixel text-xs text-theme-muted">{party.members.filter(m => m.status === 'active').length}명</span>
        </div>
        <span className="font-pixel text-xs text-theme-muted">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          <p className="font-pixel text-xs text-theme-muted">
            {party.type === "individual" ? "각자 파티" : "다같이 파티"}
          </p>

          {/* 멤버 */}
          <div className="space-y-1">
            {party.members.filter(m => m.status === 'active').map((m) => (
              <div key={m.user_id} className="flex items-center justify-between">
                <span className="font-pixel text-xs text-theme">
                  {m.nickname}{m.user_id === party.leader_id ? " 👑" : ""}
                </span>
                {m.user_id !== party.leader_id && (
                  <button
                    onClick={() => handleKick(m.user_id, m.nickname)}
                    className="font-pixel text-xs text-theme-muted"
                  >추방</button>
                )}
              </div>
            ))}
            {/* 대기 중 */}
            {party.members.filter(m => m.status === 'pending').map((m) => (
              <div key={m.user_id} className="flex items-center justify-between">
                <span className="font-pixel text-xs text-theme-muted">{m.nickname} (대기중)</span>
              </div>
            ))}
          </div>

          {/* 초대 */}
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="pixel-button w-full py-1.5 font-pixel text-xs text-theme-muted"
          >+ 파티원 초대</button>

          {showInvite && (
            <div className="flex gap-1">
              <input
                value={inviteNick}
                onChange={(e) => setInviteNick(e.target.value)}
                placeholder="로그인 ID 입력"
                className="pixel-input flex-1 bg-transparent px-2 py-1.5 font-pixel text-xs text-theme placeholder:text-theme-muted focus:outline-none"
              />
              <button onClick={handleInvite} className="pixel-button px-3 py-1.5 font-pixel text-xs text-theme">초대</button>
            </div>
          )}

          {/* 탈퇴/삭제 */}
          <div className="flex gap-4">
            <button onClick={handleLeave} className="font-pixel text-xs text-theme-muted">파티 탈퇴</button>
            <button onClick={() => setShowDeleteConfirm(true)} className="font-pixel text-xs" style={{ color: "#c0392b" }}>파티 삭제</button>
          </div>

          {showDeleteConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={() => setShowDeleteConfirm(false)}>
              <div className="pixel-panel w-full max-w-[280px] p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
                <p className="font-pixel text-sm text-theme text-center">정말로 삭제할까요?</p>
                <p className="font-pixel text-xs text-theme-muted text-center">
                  파티의 모든 투두와 기록이 사라져요.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => { handleDelete(); setShowDeleteConfirm(false); }} className="pixel-button flex-1 py-2 font-pixel text-xs" style={{ color: "#c0392b" }}>삭제</button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="pixel-button flex-1 py-2 font-pixel text-xs text-theme-muted">취소</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 파티 생성 모달 ──
function CreatePartyModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"individual" | "collaborative">("individual");
  const [submitting, setSubmitting] = useState(false);
  const { show: showToast } = useToast();

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    const r = await createParty(name.trim(), type);
    if (r.error) showToast(r.error);
    else { showToast("파티가 만들어졌어요!"); onCreated(); }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6" onClick={onClose}>
      <div className="pixel-panel w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-pixel text-sm text-theme text-center">파티 만들기</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="파티 이름"
          className="pixel-input w-full bg-transparent px-3 py-2 font-pixel text-sm text-theme placeholder:text-theme-muted focus:outline-none"
        />
        <div className="flex gap-2">
          {(["individual", "collaborative"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="pixel-button flex-1 py-2 font-pixel text-xs"
              style={{ opacity: type === t ? 1 : 0.4, color: "var(--theme-text)" }}
            >
              {t === "individual" ? "👤 각자" : "👥 다같이"}
            </button>
          ))}
        </div>
        <p className="font-pixel text-xs text-theme-muted text-center">
          {type === "individual" ? "각자 할일을 만들고 각자 완료" : "파티장이 할일을 만들고 다같이 힘을 모아 완료"}
        </p>
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={submitting} className="pixel-button flex-1 py-2 font-pixel text-sm text-theme">
            {submitting ? "생성 중..." : "만들기"}
          </button>
          <button onClick={onClose} className="pixel-button flex-1 py-2 font-pixel text-sm text-theme-muted">취소</button>
        </div>
      </div>
    </div>
  );
}
