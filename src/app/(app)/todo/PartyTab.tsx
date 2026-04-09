"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getPartyTabData, getPartyTodos, getPartyLogs,
  createPartyTodo, completePartyTodo, updatePartyTodo, deletePartyTodo,
} from "./party-actions";
import type { Party, PartyTodo, PartyRecord, PartyLog } from "./party-actions";
import { useGold } from "@/components/GoldProvider";
import { useToast } from "@/components/Toast";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function PartyTab({ onPartyComplete }: { onPartyComplete?: () => void } = {}) {
  const [parties, setParties] = useState<Party[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { parties: p, userId: uid } = await getPartyTabData();
    setParties(p);
    setUserId(uid);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return <div className="flex justify-center py-8"><p className="font-pixel text-xs text-theme-muted">로딩 중...</p></div>;
  }

  if (parties.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <span className="text-3xl">⚔️</span>
        <p className="font-pixel text-sm text-theme-muted">파티가 없어요</p>
        <a
          href="/village/party"
          className="pixel-button px-4 py-2 font-pixel text-xs text-theme"
        >
          파티관리소로 이동
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {parties.map((party) => (
        <PartySection key={party.id} party={party} userId={userId} onRefresh={loadData} onPartyComplete={onPartyComplete} />
      ))}
    </div>
  );
}

function PartySection({ party, userId, onRefresh, onPartyComplete }: { party: Party; userId: string | null; onRefresh: () => void; onPartyComplete?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [todos, setTodos] = useState<PartyTodo[]>([]);
  const [records, setRecords] = useState<Record<string, PartyRecord[]>>({});
  const [logs, setLogs] = useState<PartyLog[]>([]);
  const [showAddTodo, setShowAddTodo] = useState(false);
  const { refresh: refreshGold } = useGold();
  const { show: showToast } = useToast();

  const loadPartyData = useCallback(async () => {
    if (!expanded) return;
    const [td, lg] = await Promise.all([getPartyTodos(party.id), getPartyLogs(party.id)]);
    setTodos(td.todos);
    setRecords(td.records);
    setLogs(lg);
  }, [expanded, party.id]);

  useEffect(() => { loadPartyData(); }, [loadPartyData]);

  const handleComplete = async (todoId: string) => {
    const r = await completePartyTodo(todoId);
    if (r.error) { showToast(r.error); return; }
    if (r.data?.gold > 0) showToast("투두 완료!", `+${r.data.gold}G`);
    else if (r.data?.all_done) showToast("🎉 목표 달성!");
    else showToast("기여 완료!");
    refreshGold();
    // 일일 완료 카운트 반영: 각자/다함께 모두 기여 즉시 카운트
    // (DB에서도 contribution 즉시 is_completed=true로 기록됨)
    onPartyComplete?.();
    loadPartyData();
  };

  const handleDelete = async (todoId: string) => {
    const r = await deletePartyTodo(todoId);
    if (r.error) { showToast(r.error); return; }
    loadPartyData();
  };

  const handleUpdate = async (todoId: string, title: string, targetCount?: number, description?: string) => {
    const r = await updatePartyTodo(todoId, title, targetCount, description);
    if (r.error) { showToast(r.error); return false; }
    loadPartyData();
    return true;
  };

  return (
    <div className="pixel-panel p-3">
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-pixel text-xs">{party.type === "individual" ? "👤" : "👥"}</span>
          <span className="font-pixel text-sm text-theme">{party.name}</span>
          <span className="font-pixel text-[10px] text-theme-muted">{party.type === "individual" ? "(각자)" : "(다함께)"}</span>
        </div>
        <span className="font-pixel text-xs text-theme-muted">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {/* 투두 목록 */}
          {todos.length === 0 && (
            <p className="font-pixel text-xs text-theme-muted text-center py-2">투두가 없어요</p>
          )}
          {(() => {
            const nicknameById = new Map(party.members.map((m) => [m.user_id, m.nickname]));
            const isDone = (todo: PartyTodo) => {
              const recs = records[todo.id] || [];
              if (party.type === "individual") return recs.length > 0;
              return recs.length >= todo.target_count;
            };
            const sorted = [...todos].sort((a, b) => Number(isDone(a)) - Number(isDone(b)));
            return sorted.map((todo) => {
              const recs = records[todo.id] || [];
              const todayCount = recs.length;
              const myDone = recs.length > 0;
              const done = isDone(todo);
              const creatorNickname = nicknameById.get(todo.created_by);
              const isCreator = todo.created_by === userId;

              return (
                <div
                  key={todo.id}
                  className="pixel-input flex items-center gap-2 p-2"
                  style={{ opacity: done ? 0.5 : 1 }}
                >
                  <button
                    onClick={() => !myDone && handleComplete(todo.id)}
                    className="shrink-0 font-pixel text-sm"
                    style={{ opacity: myDone ? 0.4 : 1 }}
                  >
                    {myDone ? "✅" : "⬜"}
                  </button>
                  <div className="flex-1 min-w-0">
                    {party.type === "individual" && creatorNickname && (
                      <p className="font-pixel text-[10px] text-theme-muted truncate">
                        {creatorNickname}
                      </p>
                    )}
                    <p className="font-pixel text-xs text-theme truncate">{todo.title}</p>
                    {todo.description && (
                      <p className="font-pixel text-[11px] text-theme-muted whitespace-pre-wrap break-words">
                        {todo.description}
                      </p>
                    )}
                    {party.type === "collaborative" && (
                      <p className="font-pixel text-xs text-theme-muted">
                        {todayCount}/{todo.target_count}
                      </p>
                    )}
                  </div>
                  {isCreator && (
                    <PartyTodoMenu
                      todo={todo}
                      isCollaborative={party.type === "collaborative"}
                      onDelete={() => handleDelete(todo.id)}
                      onUpdate={(title, tc, desc) => handleUpdate(todo.id, title, tc, desc)}
                    />
                  )}
                </div>
              );
            });
          })()}

          {/* 투두 추가: 각자=전원, 다같이=파티장만 */}
          {(party.type === "individual" || party.leader_id === userId) && (
            <>
              <button
                onClick={() => setShowAddTodo(true)}
                className="pixel-button w-full py-1.5 font-pixel text-xs text-theme-muted"
              >+ 투두 추가</button>

              {showAddTodo && (
                <AddTodoForm
                  party={party}
                  onClose={() => setShowAddTodo(false)}
                  onCreated={() => { setShowAddTodo(false); loadPartyData(); }}
                />
              )}
            </>
          )}

          {/* 활동 기록 */}
          {logs.length > 0 && (
            <div className="pt-2" style={{ borderTop: "1px dashed var(--theme-placeholder)" }}>
              <p className="font-pixel text-xs text-theme-muted mb-1">기록</p>
              <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-hide">
                {logs.map((log, i) => (
                  <div key={i} className="flex justify-between font-pixel text-xs">
                    <span className="text-theme truncate flex-1">{log.content}</span>
                    <span className="text-theme-muted shrink-0 ml-2">{timeAgo(log.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PartyTodoMenu({
  todo,
  isCollaborative,
  onDelete,
  onUpdate,
}: {
  todo: PartyTodo;
  isCollaborative: boolean;
  onDelete: () => void;
  onUpdate: (title: string, targetCount?: number, description?: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [description, setDescription] = useState(todo.description ?? "");
  const [targetCount, setTargetCount] = useState(todo.target_count);

  const submit = async () => {
    if (!title.trim()) return;
    const ok = await onUpdate(title.trim(), isCollaborative ? targetCount : undefined, description);
    if (ok) { setEditing(false); setOpen(false); }
  };

  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen(!open)} className="px-1 font-pixel text-theme-muted">⋮</button>
      {open && !editing && (
        <div className="pixel-panel absolute right-0 top-6 z-10 flex flex-col gap-1 p-2">
          <button
            onClick={() => { setEditing(true); }}
            className="font-pixel text-xs text-theme whitespace-nowrap px-2 py-1"
          >수정</button>
          <button
            onClick={() => { onDelete(); setOpen(false); }}
            className="font-pixel text-xs whitespace-nowrap px-2 py-1"
            style={{ color: "#c44" }}
          >삭제</button>
        </div>
      )}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="pixel-panel w-full max-w-xs space-y-3 p-4">
            <h3 className="font-pixel text-xs text-theme">파티 투두 수정</h3>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="pixel-input w-full bg-transparent px-2 py-1.5 font-pixel text-xs text-theme focus:outline-none"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="상세 내역 (선택, 최대 500자)"
              className="pixel-input w-full resize-none bg-transparent px-2 py-1.5 font-pixel text-xs text-theme placeholder:text-theme-muted focus:outline-none"
            />
            {isCollaborative && (
              <div className="flex items-center gap-2">
                <span className="font-pixel text-xs text-theme-muted">목표</span>
                <input
                  type="number" min="1" value={targetCount}
                  onChange={(e) => setTargetCount(Math.max(1, Number(e.target.value)))}
                  className="pixel-input w-16 bg-transparent text-center font-pixel text-xs text-theme focus:outline-none"
                />
                <span className="font-pixel text-xs text-theme-muted">회</span>
              </div>
            )}
            <div className="flex gap-1">
              <button onClick={submit} className="pixel-button flex-1 py-1 font-pixel text-xs text-theme">저장</button>
              <button onClick={() => { setEditing(false); setOpen(false); }} className="pixel-button flex-1 py-1 font-pixel text-xs text-theme-muted">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddTodoForm({ party, onClose, onCreated }: { party: Party; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetCount, setTargetCount] = useState(party.members.length);
  const { show: showToast } = useToast();

  const handleSubmit = async () => {
    if (!title.trim()) return;
    const r = await createPartyTodo(
      party.id, title.trim(),
      party.type === "collaborative" ? targetCount : 1,
      undefined, undefined,
      description
    );
    if (r.error) showToast(r.error);
    else onCreated();
  };

  return (
    <div className="pixel-input p-2 space-y-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="할 일 입력"
        className="pixel-input w-full bg-transparent px-2 py-1.5 font-pixel text-xs text-theme placeholder:text-theme-muted focus:outline-none"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        maxLength={500}
        rows={2}
        placeholder="상세 내역 (선택, 최대 500자)"
        className="pixel-input w-full resize-none bg-transparent px-2 py-1.5 font-pixel text-xs text-theme placeholder:text-theme-muted focus:outline-none"
      />
      {party.type === "collaborative" && (
        <div className="flex items-center gap-2">
          <span className="font-pixel text-xs text-theme-muted">목표</span>
          <input
            type="number" min="1" value={targetCount}
            onChange={(e) => setTargetCount(Math.max(1, Number(e.target.value)))}
            className="pixel-input w-16 bg-transparent text-center font-pixel text-xs text-theme focus:outline-none"
          />
          <span className="font-pixel text-xs text-theme-muted">회</span>
        </div>
      )}
      <div className="flex gap-1">
        <button onClick={handleSubmit} className="pixel-button flex-1 py-1 font-pixel text-xs text-theme">추가</button>
        <button onClick={onClose} className="pixel-button flex-1 py-1 font-pixel text-xs text-theme-muted">취소</button>
      </div>
    </div>
  );
}
