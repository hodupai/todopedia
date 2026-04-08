"use client";

import { useEffect, useState, useCallback } from "react";
import {
  deleteTodo,
  toggleTodo,
  incrementLoop,
  recordHabit,
  setDailyGoal,
  ensureDailyRecords,
  getTodoPageData,
  reorderTodos,
} from "./actions";
import { postDailyGoalWall } from "../guardian/actions";
import { hapticTap, hapticSuccess, hapticCelebrate } from "@/lib/haptic";
import { spawnParticleFromTodoId } from "@/lib/particles";
import PartyTab from "./PartyTab";
import { useGold } from "@/components/GoldProvider";
import { useToast } from "@/components/Toast";
import { kstToday } from "@/lib/date";

import {
  Icon,
  EmptyState,
  type Todo,
  type DailyRecord,
  type Tag,
} from "./todo-shared";
import TodoItem from "./TodoItem";
import HabitItem from "./HabitItem";
import {
  GuardianStartModal,
  CreateModal,
  EditModal,
  DailyGoalModal,
} from "./TodoModals";

const TABS = ["할 일", "습관", "파티"] as const;

export type TodoPageInitial = {
  dailyGoal: number;
  todos: Todo[];
  records: DailyRecord[];
  tags: Tag[];
  hasGuardian: boolean;
  needsDailyGoalPrompt: boolean;
  lastActiveDate: string | null;
  partyCompletedToday: number;
};

function recordsToMap(arr: DailyRecord[]): Record<string, DailyRecord> {
  const m: Record<string, DailyRecord> = {};
  for (const r of arr) m[r.todo_id] = r;
  return m;
}

// localStorage/sessionStorage에 쌓인 어제 이전의 키들을 정리
function cleanupOldStorageKeys() {
  if (typeof window === "undefined") return;
  const today = kstToday();
  const prefixes = ["dailyGoalCelebrated:", "ensureDaily:", "streakBreakNotified:"];
  for (const storage of [localStorage, sessionStorage]) {
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (!key) continue;
        for (const prefix of prefixes) {
          if (key.startsWith(prefix) && key !== prefix + today) {
            toRemove.push(key);
          }
        }
      }
      toRemove.forEach((k) => storage.removeItem(k));
    } catch {
      // 무시
    }
  }
}

// 일일 목표 달성 축하 — 하루에 한 번만 발생
function celebrateDailyGoalOnce(onCelebrate: () => void) {
  if (typeof window === "undefined") return;
  const today = kstToday();
  const key = `dailyGoalCelebrated:${today}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, "1");
  try {
    localStorage.setItem(key, "1");
  } catch {}
  onCelebrate();
}

// 완료 토스트 메시지 — 크리티컬/콤보/잭팟에 따라 톤 변화
function buildCompleteToast(args: {
  completed: boolean;
  gold: number;
  crit: boolean;
  combo: number;
  comboBonus: number;
  isLoop?: boolean;
}): { title: string; subtitle?: string } {
  const { gold, crit, combo, comboBonus, isLoop } = args;
  const baseLabel = isLoop ? "루프 퀘스트 완료!" : "투두 완료!";

  // 잭팟: 일일 기회 끝났는데 크리티컬 터짐 (gold > 0 && crit && combo == 0)
  if (crit && combo === 0 && gold > 0) {
    return { title: `✨ 잭팟! +${gold}G`, subtitle: "기회가 끝났는데 골드가 터졌어요!" };
  }
  // 크리티컬 (eligible 안에서)
  if (crit && gold > 0) {
    if (comboBonus > 0) {
      return { title: `💥 크리티컬! +${gold}G`, subtitle: `🔥 콤보 x${combo} (+${comboBonus})` };
    }
    return { title: `💥 크리티컬! +${gold}G` };
  }
  // 콤보만
  if (comboBonus > 0 && gold > 0) {
    return { title: `🔥 콤보 x${combo}! +${gold}G` };
  }
  // 일반 골드
  if (gold > 0) {
    return { title: `${baseLabel} +${gold}G` };
  }
  // 골드 없음 (기회 소진)
  return { title: baseLabel };
}

function alreadyCelebratedToday(): boolean {
  if (typeof window === "undefined") return false;
  const today = kstToday();
  const key = `dailyGoalCelebrated:${today}`;
  if (sessionStorage.getItem(key)) return true;
  try {
    if (localStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      return true;
    }
  } catch {}
  return false;
}

export default function TodoClient({ initial }: { initial: TodoPageInitial }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("할 일");
  const [todos, setTodos] = useState<Todo[]>(initial.todos);
  const [records, setRecords] = useState<Record<string, DailyRecord>>(() => recordsToMap(initial.records));
  const [dailyGoal, setDailyGoalState] = useState<number>(initial.dailyGoal);
  const [showGuardianStartModal, setShowGuardianStartModal] = useState(
    initial.dailyGoal === 0 && !initial.hasGuardian
  );
  const [showDailyGoalModal, setShowDailyGoalModal] = useState(initial.needsDailyGoalPrompt);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTodo, setEditTodo] = useState<Todo | null>(null);
  const [tags, setTags] = useState<Tag[]>(initial.tags);
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [partyCompletedCount, setPartyCompletedCount] = useState<number>(initial.partyCompletedToday);
  const { setGold, setStreak } = useGold();
  const toast = useToast();

  const fetchData = useCallback(async () => {
    const data = await getTodoPageData();
    setDailyGoalState(data.dailyGoal);
    setTodos(data.todos as Todo[]);
    setTags(data.tags as Tag[]);
    setRecords(recordsToMap(data.records as DailyRecord[]));
    setPartyCompletedCount(data.partyCompletedToday || 0);
    if (data.dailyGoal === 0 && !data.hasGuardian) setShowGuardianStartModal(true);
  }, []);

  // 마운트 시: storage 키 정리 + 반복 투두 오늘치 레코드 + streak 끊김 감지
  useEffect(() => {
    if (typeof window === "undefined") return;
    cleanupOldStorageKeys();

    const today = kstToday();
    const yesterday = (() => {
      const d = new Date(Date.now() - 86400000 + 9 * 60 * 60 * 1000);
      return d.toISOString().split("T")[0];
    })();
    const streakKey = `streakBreakNotified:${today}`;
    if (
      initial.lastActiveDate &&
      initial.lastActiveDate < yesterday &&
      !sessionStorage.getItem(streakKey)
    ) {
      sessionStorage.setItem(streakKey, "1");
      setTimeout(() => {
        toast.show(
          "😢 streak이 끊겼어요",
          "오늘 1개만 완료해도 새로 시작!",
          "top-center"
        );
      }, 800);
    }

    const key = `ensureDaily:${today}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    ensureDailyRecords().then(() => fetchData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);

  const allTodoItems = todos.filter((t) => t.type !== "habit");
  const todoItemsBase = allTodoItems.filter((t) => !filterTagId || t.tag_id === filterTagId);
  const todoItems = reorderMode
    ? todoItemsBase
    : [...todoItemsBase].sort((a, b) => {
        const aDone = records[a.id]?.is_completed ? 1 : 0;
        const bDone = records[b.id]?.is_completed ? 1 : 0;
        return aDone - bDone;
      });
  const habitItems = todos.filter((t) => t.type === "habit").filter((t) => !filterTagId || t.tag_id === filterTagId);

  // 순서 편집: 같은 type 그룹 내에서 위/아래로 이동 후 서버에 sort_order 일괄 저장
  const moveTodo = async (id: string, dir: -1 | 1) => {
    const isHabit = todos.find((t) => t.id === id)?.type === "habit";
    const groupIds = todos
      .filter((t) => (isHabit ? t.type === "habit" : t.type !== "habit"))
      .map((t) => t.id);
    const idx = groupIds.indexOf(id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= groupIds.length) return;
    [groupIds[idx], groupIds[swap]] = [groupIds[swap], groupIds[idx]];

    // 로컬 todos 재정렬: 그룹 내 순서를 새 groupIds로 반영
    const orderMap = new Map(groupIds.map((tid, i) => [tid, i]));
    setTodos((prev) => {
      const next = [...prev];
      next.sort((a, b) => {
        const aIn = orderMap.has(a.id);
        const bIn = orderMap.has(b.id);
        if (aIn && bIn) return (orderMap.get(a.id)! - orderMap.get(b.id)!);
        return 0;
      });
      // stable sort: 같은 그룹만 비교, 다른 그룹은 원위치 유지
      // 위 sort는 그룹 외 항목 사이엔 0 반환하므로 안정 정렬에 의해 원순서 보존
      return next;
    });
    hapticTap();
    await reorderTodos(groupIds);
  };
  const completedCount =
    allTodoItems.filter((t) => records[t.id]?.is_completed).length +
    partyCompletedCount;

  const handleToggle = async (id: string) => {
    const wasFirstCompletionToday = completedCount === 0;
    const result = await toggleTodo(id);
    if (result.success) {
      setRecords((prev) => ({
        ...prev,
        [id]: {
          todo_id: id,
          is_completed: !!result.completed,
          current_count: prev[id]?.current_count ?? 0,
        },
      }));
      if (result.gold) setGold((g: number) => g + result.gold);
      if (result.completed && wasFirstCompletionToday) setStreak((s) => s + 1);
    }
    if (result.success && result.completed) {
      hapticSuccess();
      spawnParticleFromTodoId(id);
      const t = buildCompleteToast({
        completed: !!result.completed,
        gold: result.gold || 0,
        crit: !!result.crit,
        combo: result.combo || 0,
        comboBonus: result.comboBonus || 0,
      });
      toast.show(t.title, t.subtitle);
      if (result.completedCount === result.dailyGoal && !alreadyCelebratedToday()) {
        celebrateDailyGoalOnce(() => {
          hapticCelebrate();
          setTimeout(() => toast.show("🎉 일일 목표 달성!", undefined, "top-center"), 500);
          postDailyGoalWall();
        });
      }
    } else if (result.success && !result.completed) {
      hapticTap();
      // 취소 시 토스트 표시 안 함 (마이너스 골드 노출이 짜증 유발)
    }
  };

  const handleIncrement = async (id: string) => {
    const wasFirstCompletionToday = completedCount === 0;
    const result = await incrementLoop(id);
    if (result.success) {
      setRecords((prev) => ({
        ...prev,
        [id]: {
          todo_id: id,
          is_completed: !!result.completed,
          current_count: (prev[id]?.current_count ?? 0) + 1,
        },
      }));
      if (result.gold) setGold((g) => g + result.gold);
      if (result.completed && wasFirstCompletionToday) setStreak((s) => s + 1);
    }
    if (result.success && result.completed) {
      hapticSuccess();
      spawnParticleFromTodoId(id);
      const t = buildCompleteToast({
        completed: !!result.completed,
        gold: result.gold || 0,
        crit: !!result.crit,
        combo: result.combo || 0,
        comboBonus: result.comboBonus || 0,
        isLoop: true,
      });
      toast.show(t.title, t.subtitle);
      if (result.completedCount === result.dailyGoal && !alreadyCelebratedToday()) {
        celebrateDailyGoalOnce(() => {
          hapticCelebrate();
          setTimeout(() => toast.show("🎉 일일 목표 달성!", undefined, "top-center"), 500);
          postDailyGoalWall();
        });
      }
    } else if (result.success) {
      hapticTap();
    }
  };

  const handleHabit = async (id: string) => {
    const result = await recordHabit(id);
    if (result.success) {
      hapticTap();
      spawnParticleFromTodoId(id);
      setRecords((prev) => ({
        ...prev,
        [id]: {
          todo_id: id,
          is_completed: prev[id]?.is_completed ?? false,
          current_count: (prev[id]?.current_count ?? 0) + 1,
        },
      }));
      if (result.gold) setGold((g) => g + result.gold);
    }
    if (result.success) {
      const goldText = result.gold > 0 ? `+${result.gold} 💰` : "상한 도달";
      toast.show(
        `습관 기록! ${goldText}`,
        `오늘 습관 골드: ${result.habitDailyGold}/${result.habitDailyCap}`
      );
    }
  };

  const handleDelete = async (id: string) => {
    await deleteTodo(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
    setRecords((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleGuardianStarted = async (goal: number) => {
    // 가디 시작 시 startGuardian이 daily_goal을 세팅하지만 last_goal_date는 안 세팅하므로,
    // setDailyGoal을 호출해서 오늘 모달이 다시 뜨지 않게 함.
    await setDailyGoal(goal);
    setDailyGoalState(goal);
    setShowGuardianStartModal(false);
    setShowDailyGoalModal(false);
    fetchData();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4">
      {/* 일일 목표 진행률 */}
      <div className="pixel-panel p-4">
        <div className="flex items-center justify-between font-pixel">
          <span className="text-base text-theme">오늘의 목표</span>
          <span className="text-sm text-theme-muted">
            {completedCount} / {dailyGoal}
          </span>
        </div>
        <div className="pixel-input mt-2 h-4 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: dailyGoal > 0 ? `${Math.min((completedCount / dailyGoal) * 100, 100)}%` : "0%",
              backgroundColor: "var(--theme-accent)",
            }}
          />
        </div>
      </div>

      {/* 서브탭 */}
      <div className="-mt-1 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="pixel-button flex-1 py-2 font-pixel text-sm"
            style={{ opacity: tab === t ? 1 : 0.5, color: "var(--theme-text)" }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* 파티 탭 */}
      {tab === "파티" && (
        <div className="pixel-panel flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hide p-4">
          <PartyTab onPartyComplete={() => setPartyCompletedCount((c) => c + 1)} />
        </div>
      )}

      {/* 태그 필터 */}
      {tab !== "파티" && tags.length > 0 && (
        <div className="flex gap-3 overflow-x-auto px-1 scrollbar-hide">
          <button
            onClick={() => setFilterTagId(null)}
            className="shrink-0 font-pixel text-sm"
            style={{
              color: filterTagId === null ? "var(--theme-text)" : "var(--theme-placeholder)",
            }}
          >
            전체
          </button>
          {tags.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilterTagId(filterTagId === t.id ? null : t.id)}
              className="shrink-0 font-pixel text-sm"
              style={{
                color: filterTagId === t.id ? t.color : "var(--theme-placeholder)",
              }}
            >
              #{t.name}
            </button>
          ))}
        </div>
      )}

      {/* 투두 리스트 */}
      {tab !== "파티" && <div className="pixel-panel flex min-h-0 flex-1 flex-col p-4">
        <div className="flex shrink-0 items-center justify-between">
          <h2 className="font-pixel text-base text-theme">
            {tab === "할 일" ? "할 일 목록" : "습관 트래커"}
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setReorderMode((v) => !v)}
              className="font-pixel text-xs"
              style={{ color: reorderMode ? "var(--theme-accent)" : "var(--theme-placeholder)" }}
            >
              {reorderMode ? "완료" : "순서"}
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center"
            >
              <Icon name="add" size={24} />
            </button>
          </div>
        </div>

        <div className="mt-3 space-y-2 overflow-y-auto scrollbar-hide pb-20">
          {tab === "할 일" ? (
            todoItems.length === 0 ? (
              <EmptyState
                icon="📝"
                text="아직 할 일이 없어요"
                ctaLabel="+ 첫 할 일 만들기"
                onCta={() => setShowCreateModal(true)}
              />
            ) : (
              todoItems.map((todo, i) => (
                <div key={todo.id} className="flex items-center gap-2">
                  {reorderMode && (
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        onClick={() => moveTodo(todo.id, -1)}
                        disabled={i === 0}
                        className="pixel-button px-2 py-0.5 font-pixel text-[10px] text-theme disabled:opacity-30"
                      >▲</button>
                      <button
                        onClick={() => moveTodo(todo.id, 1)}
                        disabled={i === todoItems.length - 1}
                        className="pixel-button px-2 py-0.5 font-pixel text-[10px] text-theme disabled:opacity-30"
                      >▼</button>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <TodoItem
                      todo={todo}
                      record={records[todo.id]}
                      onToggle={handleToggle}
                      onIncrement={handleIncrement}
                      onEdit={setEditTodo}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              ))
            )
          ) : habitItems.length === 0 ? (
            <EmptyState
              icon="🔄"
              text="아직 습관이 없어요"
              ctaLabel="+ 첫 습관 만들기"
              onCta={() => setShowCreateModal(true)}
            />
          ) : (
            habitItems.map((todo, i) => (
              <div key={todo.id} className="flex items-center gap-2">
                {reorderMode && (
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      onClick={() => moveTodo(todo.id, -1)}
                      disabled={i === 0}
                      className="pixel-button px-2 py-0.5 font-pixel text-[10px] text-theme disabled:opacity-30"
                    >▲</button>
                    <button
                      onClick={() => moveTodo(todo.id, 1)}
                      disabled={i === habitItems.length - 1}
                      className="pixel-button px-2 py-0.5 font-pixel text-[10px] text-theme disabled:opacity-30"
                    >▼</button>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <HabitItem
                    todo={todo}
                    record={records[todo.id]}
                    onRecord={handleHabit}
                    onEdit={setEditTodo}
                    onDelete={handleDelete}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>}

      {showGuardianStartModal && (
        <GuardianStartModal onStarted={handleGuardianStarted} />
      )}
      {!showGuardianStartModal && showDailyGoalModal && (
        <DailyGoalModal
          current={dailyGoal}
          onConfirm={async (g) => {
            const r = await setDailyGoal(g);
            if (r.error) {
              toast.show(r.error);
              return;
            }
            setDailyGoalState(g);
            setShowDailyGoalModal(false);
            toast.show(`오늘 목표: ${g}개`);
          }}
        />
      )}
      {showCreateModal && (
        <CreateModal
          defaultType={tab === "습관" ? "habit" : "normal"}
          tags={tags}
          onClose={() => setShowCreateModal(false)}
          onCreated={fetchData}
        />
      )}
      {editTodo && (
        <EditModal
          todo={editTodo}
          tags={tags}
          onClose={() => setEditTodo(null)}
          onUpdated={fetchData}
        />
      )}
    </div>
  );
}
