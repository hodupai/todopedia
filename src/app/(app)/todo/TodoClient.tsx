"use client";

import { useEffect, useState, useCallback } from "react";
import {
  createTodo,
  updateTodo,
  deleteTodo,
  toggleTodo,
  incrementLoop,
  recordHabit,
  setDailyGoal,
  createTag,
  ensureDailyRecords,
  getTodoPageData,
} from "./actions";
import { startGuardian, postDailyGoalWall } from "../guardian/actions";
import PartyTab from "./PartyTab";
import { useGold } from "@/components/GoldProvider";
import { useToast } from "@/components/Toast";

type Todo = {
  id: string;
  type: "normal" | "loop" | "habit";
  title: string;
  tag_id: string | null;
  is_important: boolean;
  repeat_type: "daily" | "weekly" | "monthly" | null;
  repeat_days: number[] | null;
  target_count: number | null;
  habit_type: "positive" | "negative" | null;
  tags?: { name: string; color: string } | null;
};

type DailyRecord = {
  todo_id: string;
  is_completed: boolean;
  current_count: number;
};

type Tag = {
  id: string;
  name: string;
  color: string;
};

const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

function formatRepeat(type: string, days: number[] | null): string {
  if (type === "daily") return "매일";
  if (type === "weekly" && days) return `매주 ${days.map((d) => DAY_NAMES[d]).join(", ")}`;
  if (type === "monthly" && days) return `매달 ${days.join(", ")}일`;
  return "";
}

// 픽셀 아이콘 헬퍼
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <img
      src={`/ui/icons/${name}.png`}
      alt=""
      className="pixel-art"
      style={{ width: size, height: size }}
    />
  );
}

// 픽셀 토글 (체크박스 대체)
function PixelToggle({
  checked,
  onChange,
  label,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-center gap-2 font-pixel text-sm text-theme"
    >
      <Icon name={checked ? "checkbox-on" : "checkbox-off"} size={20} />
      {icon && <span>{icon}</span>}
      {label}
    </button>
  );
}

const TABS = ["할 일", "습관", "파티"] as const;

export type TodoPageInitial = {
  dailyGoal: number;
  todos: Todo[];
  records: DailyRecord[];
  tags: Tag[];
  hasGuardian: boolean;
  needsDailyGoalPrompt: boolean;
};

function recordsToMap(arr: DailyRecord[]): Record<string, DailyRecord> {
  const m: Record<string, DailyRecord> = {};
  for (const r of arr) m[r.todo_id] = r;
  return m;
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
  const { setGold } = useGold();
  const toast = useToast();

  const fetchData = useCallback(async () => {
    const data = await getTodoPageData();
    setDailyGoalState(data.dailyGoal);
    setTodos(data.todos as Todo[]);
    setTags(data.tags as Tag[]);
    setRecords(recordsToMap(data.records as DailyRecord[]));
    if (data.dailyGoal === 0 && !data.hasGuardian) setShowGuardianStartModal(true);
  }, []);

  // 마운트 시: 반복 투두 오늘치 레코드 생성 (세션당 1회). 생성된 게 있으면 데이터 재조회.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `ensureDaily:${new Date().toISOString().split("T")[0]}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    ensureDailyRecords().then(() => fetchData());
  }, [fetchData]);

  const allTodoItems = todos.filter((t) => t.type !== "habit");
  const todoItems = allTodoItems
    .filter((t) => !filterTagId || t.tag_id === filterTagId)
    .sort((a, b) => {
      const aDone = records[a.id]?.is_completed ? 1 : 0;
      const bDone = records[b.id]?.is_completed ? 1 : 0;
      return aDone - bDone;
    });
  const habitItems = todos.filter((t) => t.type === "habit").filter((t) => !filterTagId || t.tag_id === filterTagId);
  const completedCount = allTodoItems.filter(
    (t) => records[t.id]?.is_completed
  ).length;

  const handleToggle = async (id: string) => {
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
    }
    if (result.success && result.completed) {
      const remaining = Math.max(0, (result.dailyGoal || 0) - (result.completedCount || 0));
      const goldText = result.gold > 0 ? `+${result.gold} 💰` : "";
      toast.show(
        `투두 완료! ${goldText}`,
        remaining > 0 ? `오늘 골드 잔여 기회: ${remaining}회` : "오늘 골드 기회를 모두 사용했어요"
      );
      if (result.completedCount === result.dailyGoal) {
        setTimeout(() => toast.show("🎉 일일 목표 달성!", undefined, "top-center"), 500);
        postDailyGoalWall();
      }
    } else if (result.success && !result.completed) {
      if (result.gold < 0) {
        toast.show(`투두 취소 (${result.gold} 💰)`);
      }
    }
  };

  const handleIncrement = async (id: string) => {
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
    }
    if (result.success && result.completed) {
      const remaining = Math.max(0, (result.dailyGoal || 0) - (result.completedCount || 0));
      const goldText = result.gold > 0 ? `+${result.gold} 💰` : "";
      toast.show(
        `루프 퀘스트 완료! ${goldText}`,
        remaining > 0 ? `오늘 골드 잔여 기회: ${remaining}회` : "오늘 골드 기회를 모두 사용했어요"
      );
      if (result.completedCount === result.dailyGoal) {
        setTimeout(() => toast.show("🎉 일일 목표 달성!", undefined, "top-center"), 500);
        postDailyGoalWall();
      }
    }
  };

  const handleHabit = async (id: string) => {
    const result = await recordHabit(id);
    if (result.success) {
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
          <PartyTab />
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
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center"
          >
            <Icon name="add" size={24} />
          </button>
        </div>

        <div className="mt-3 space-y-2 overflow-y-auto scrollbar-hide">
          {tab === "할 일" ? (
            todoItems.length === 0 ? (
              <EmptyState icon="📝" text="아직 할 일이 없어요" />
            ) : (
              todoItems.map((todo) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  record={records[todo.id]}
                  onToggle={handleToggle}
                  onIncrement={handleIncrement}
                  onEdit={setEditTodo}
                  onDelete={handleDelete}
                />
              ))
            )
          ) : habitItems.length === 0 ? (
            <EmptyState icon="🔄" text="아직 습관이 없어요" />
          ) : (
            habitItems.map((todo) => (
              <HabitItem
                key={todo.id}
                todo={todo}
                record={records[todo.id]}
                onRecord={handleHabit}
                onEdit={setEditTodo}
                onDelete={handleDelete}
              />
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
          onClose={() => setEditTodo(null)}
          onUpdated={fetchData}
        />
      )}
    </div>
  );
}

// ── 빈 상태 ──
function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <span className="text-3xl">{icon}</span>
      <p className="font-pixel mt-2 text-sm text-theme-muted">{text}</p>
    </div>
  );
}

// ── 투두 아이템 (일반/루프) ──
function TodoItem({
  todo,
  record,
  onToggle,
  onIncrement,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  record?: DailyRecord;
  onToggle: (id: string) => void;
  onIncrement: (id: string) => void;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
}) {
  const isCompleted = record?.is_completed || false;
  const [showMenu, setShowMenu] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLoopClick = () => {
    if (isCompleted) return;
    setShowConfirm(true);
  };

  const confirmIncrement = () => {
    onIncrement(todo.id);
    setShowConfirm(false);
  };

  return (
    <>
      <div
        className="pixel-input flex flex-col gap-1 px-3 py-2"
        style={{ opacity: isCompleted ? 0.5 : 1 }}
      >
        {/* 태그 행 */}
        {todo.tags && (
          <div className="pl-8">
            <span className="font-pixel text-xs" style={{ color: todo.tags.color }}>
              #{todo.tags.name}
            </span>
          </div>
        )}

        {/* 메인 행: 체크 + 별 + 제목 + 카운트 + 메뉴 */}
        <div className="flex items-center gap-2">
          {todo.type === "normal" ? (
            <button onClick={() => onToggle(todo.id)} className="shrink-0">
              <Icon name={isCompleted ? "checkbox-on" : "checkbox-off"} size={22} />
            </button>
          ) : (
            <button onClick={handleLoopClick} className="shrink-0" disabled={isCompleted}>
              <Icon name="checkmark" size={22} />
            </button>
          )}

          {todo.is_important && <Icon name="star" size={16} />}

          <span
            className="flex-1 font-pixel text-base text-theme"
            style={{ textDecoration: isCompleted ? "line-through" : "none" }}
          >
            {todo.title}
          </span>

          {todo.type === "loop" && (
            <span className="shrink-0 font-pixel text-sm text-theme-muted">
              {record?.current_count || 0}/{todo.target_count}
            </span>
          )}

          <div className="relative shrink-0">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="px-1 font-pixel text-theme-muted"
            >
              ⋮
            </button>
            {showMenu && (
              <div className="pixel-panel absolute right-0 top-6 z-10 flex flex-col gap-1 p-2">
                <button
                  onClick={() => { onEdit(todo); setShowMenu(false); }}
                  className="font-pixel text-sm text-theme whitespace-nowrap px-2 py-1"
                >
                  수정
                </button>
                <button
                  onClick={() => { onDelete(todo.id); setShowMenu(false); }}
                  className="font-pixel text-sm whitespace-nowrap px-2 py-1"
                  style={{ color: "#c44" }}
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 2행: 반복 정보 (우측정렬) */}
        {todo.repeat_type && (
          <div className="flex items-center justify-end gap-1">
            <Icon name="repeat" size={14} />
            <span className="font-pixel text-xs text-theme-muted">
              {formatRepeat(todo.repeat_type, todo.repeat_days)}
            </span>
          </div>
        )}
      </div>

      {/* 루프 확인 모달 */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="pixel-panel w-full max-w-xs space-y-4 p-6 text-center">
            <p className="font-pixel text-sm text-theme">
              "{todo.title}"을(를) 완료하셨습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmIncrement}
                className="pixel-button flex-1 py-2 font-pixel text-sm text-theme"
              >
                예
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="pixel-button flex-1 py-2 font-pixel text-sm text-theme-muted"
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── 습관 아이템 ──
function HabitItem({
  todo,
  record,
  onRecord,
  onEdit,
  onDelete,
}: {
  todo: Todo;
  record?: DailyRecord;
  onRecord: (id: string) => void;
  onEdit: (t: Todo) => void;
  onDelete: (id: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const count = record?.current_count || 0;

  const isPositive = todo.habit_type === "positive";

  return (
    <div className="pixel-input flex items-center gap-2 px-3 py-2">
      {/* 좌측: 타입 아이콘 */}
      <Icon name={isPositive ? "habit-good" : "habit-bad"} size={20} />

      {/* 중앙: 제목 + 메타 */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-1">
          {todo.is_important && <Icon name="star" size={14} />}
          <span className="font-pixel text-base text-theme">{todo.title}</span>
        </div>
        <div className="flex items-center gap-1">
          {todo.tags && (
            <span className="font-pixel text-sm" style={{ color: todo.tags.color }}>
              #{todo.tags.name}
            </span>
          )}
          <span className="font-pixel text-sm text-theme-muted">
            오늘 {count}회
          </span>
        </div>
      </div>

      {/* 우측: + 버튼 (색상 구분) */}
      <button
        onClick={() => onRecord(todo.id)}
        className="shrink-0 flex items-center justify-center p-1"
      >
        <Icon name="add" size={22} />
      </button>

      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="px-1 font-pixel text-theme-muted"
        >
          ⋮
        </button>
        {showMenu && (
          <div className="pixel-panel absolute right-0 top-6 z-10 flex flex-col gap-1 p-2">
            <button
              onClick={() => { onEdit(todo); setShowMenu(false); }}
              className="font-pixel text-xs text-theme whitespace-nowrap px-2 py-1"
            >
              수정
            </button>
            <button
              onClick={() => { onDelete(todo.id); setShowMenu(false); }}
              className="font-pixel text-xs whitespace-nowrap px-2 py-1"
              style={{ color: "#c44" }}
            >
              삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 가디 시작 모달 (기간 + 일일 목표 선택) ──
function GuardianStartModal({ onStarted }: { onStarted: (goal: number) => void }) {
  const [step, setStep] = useState<"period" | "goal">("period");
  const [period, setPeriod] = useState<number>(7);
  const [goal, setGoal] = useState<number>(5);
  const [submitting, setSubmitting] = useState(false);

  const PERIODS = [
    { value: 3, label: "3일", desc: "빠른 성장" },
    { value: 7, label: "7일", desc: "균형잡힌" },
    { value: 10, label: "10일", desc: "도전적인" },
    { value: 15, label: "15일", desc: "장기 육성" },
    { value: 30, label: "30일", desc: "최고 확률" },
  ];

  const handleConfirm = async () => {
    setSubmitting(true);
    const result = await startGuardian(period, goal);
    if (result.error) {
      setSubmitting(false);
      return;
    }
    onStarted(goal);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="pixel-panel w-full max-w-sm space-y-4 p-6">
        {step === "period" ? (
          <>
            <div className="flex flex-col items-center gap-2">
              <img
                src="/ui/icons/egg.png"
                alt=""
                className="pixel-art"
                style={{ width: 32, height: 32 }}
              />
              <h2 className="font-pixel text-center text-base text-theme">
                가디 육성을 시작하세요
              </h2>
              <p className="font-pixel text-center text-xs text-theme-muted">
                육성 기간을 선택해주세요
              </p>
            </div>
            <div className="space-y-2">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className="pixel-button flex w-full items-center justify-between px-4 py-3 font-pixel text-sm"
                  style={{
                    opacity: period === p.value ? 1 : 0.5,
                    color: "var(--theme-text)",
                  }}
                >
                  <span>{p.label}</span>
                  <span className="text-xs text-theme-muted">{p.desc}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep("goal")}
              className="pixel-button w-full py-3 font-pixel text-sm text-theme"
            >
              다음
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center gap-2">
              <h2 className="font-pixel text-center text-base text-theme">
                일일 목표를 선택하세요
              </h2>
              <p className="font-pixel text-center text-xs text-theme-muted">
                하루에 완료할 투두 개수를 정해주세요
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[1, 5, 10, 20].map((g) => (
                <button
                  key={g}
                  onClick={() => setGoal(g)}
                  className="pixel-button py-3 font-pixel text-sm"
                  style={{
                    opacity: goal === g ? 1 : 0.5,
                    color: "var(--theme-text)",
                  }}
                >
                  {g}개
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setStep("period")}
                className="pixel-button flex-1 py-3 font-pixel text-sm text-theme-muted"
              >
                이전
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="pixel-button flex-1 py-3 font-pixel text-sm text-theme"
              >
                {submitting ? "시작 중..." : "시작!"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── 투두 생성 모달 ──
function CreateModal({
  defaultType,
  tags,
  onClose,
  onCreated,
}: {
  defaultType: string;
  tags: Tag[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [showOptions, setShowOptions] = useState(false);
  const [type, setType] = useState(defaultType);
  const [targetCount, setTargetCount] = useState(1);
  const [habitType, setHabitType] = useState<"positive" | "negative">("positive");
  const [isImportant, setIsImportant] = useState(false);
  const [repeatType, setRepeatType] = useState<string | null>(null);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [localTags, setLocalTags] = useState<Tag[]>(tags);
  const [error, setError] = useState("");

  const handleSubmit = async (formData: FormData) => {
    formData.set("type", type);
    formData.set("isImportant", String(isImportant));
    if (type === "habit") {
      formData.set("repeatType", "daily");
    } else if (repeatType) {
      formData.set("repeatType", repeatType);
      if (repeatDays.length > 0) formData.set("repeatDays", JSON.stringify(repeatDays));
    }
    if (selectedTagId) formData.set("tagId", selectedTagId);
    if (type === "loop") formData.set("targetCount", String(targetCount));
    if (type === "habit") formData.set("habitType", habitType);

    const result = await createTodo(formData);
    if (result.error) {
      setError(result.error);
    } else {
      onCreated();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-16">
      <div className="pixel-panel w-full max-w-sm space-y-3 p-5">
        <form action={handleSubmit} className="space-y-3">
          {/* 제목 입력 */}
          <input
            name="title"
            type="text"
            required
            autoFocus
            className="pixel-input w-full bg-transparent px-3 py-2.5 font-pixel text-base text-theme placeholder:text-theme-muted focus:outline-none"
            placeholder={type === "habit" ? "습관 이름" : "할 일 입력"}
          />

          {error && (
            <p className="font-pixel text-center text-sm text-red-600">{error}</p>
          )}

          {/* 타입 */}
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-pixel text-sm text-theme-muted">타입</span>
            <div className="flex flex-1 gap-1">
              {[
                { value: "normal", label: "일반" },
                { value: "loop", label: "루프" },
                { value: "habit", label: "습관" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className="pixel-button flex-1 py-1.5 font-pixel text-sm"
                  style={{
                    opacity: type === t.value ? 1 : 0.4,
                    color: "var(--theme-text)",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 루프: 목표 횟수 */}
          {type === "loop" && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-pixel text-sm text-theme-muted">횟수</span>
              <div className="flex flex-1 items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setTargetCount(Math.max(1, targetCount - 1))}
                  className="pixel-button p-2"
                >
                  <Icon name="minus" size={18} />
                </button>
                <input
                  name="targetCount"
                  type="number"
                  min="1"
                  value={targetCount}
                  onChange={(e) => setTargetCount(Math.max(1, Number(e.target.value)))}
                  className="pixel-input w-20 bg-transparent text-center font-pixel text-base text-theme focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setTargetCount(targetCount + 1)}
                  className="pixel-button p-2"
                >
                  <Icon name="add" size={18} />
                </button>
              </div>
            </div>
          )}

          {/* 습관: positive/negative */}
          {type === "habit" && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 font-pixel text-sm text-theme-muted">유형</span>
              <div className="flex flex-1 gap-1">
                <button
                  type="button"
                  onClick={() => setHabitType("positive")}
                  className="pixel-button flex flex-1 items-center justify-center gap-1 py-1.5 font-pixel text-sm"
                  style={{ opacity: habitType === "positive" ? 1 : 0.4, color: "var(--theme-text)" }}
                >
                  <Icon name="habit-good" size={16} /> 좋은 습관
                </button>
                <button
                  type="button"
                  onClick={() => setHabitType("negative")}
                  className="pixel-button flex flex-1 items-center justify-center gap-1 py-1.5 font-pixel text-sm"
                  style={{ opacity: habitType === "negative" ? 1 : 0.4, color: "var(--theme-text)" }}
                >
                  <Icon name="habit-bad" size={16} /> 나쁜 습관
                </button>
              </div>
            </div>
          )}

          {/* 태그 */}
          <div className="flex items-start gap-2">
            <span className="shrink-0 pt-1 font-pixel text-sm text-theme-muted">태그</span>
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedTagId(null)}
                  className="pixel-button px-2 py-1 font-pixel text-sm"
                  style={{ opacity: selectedTagId === null ? 1 : 0.4, color: "var(--theme-text)" }}
                >
                  없음
                </button>
                {localTags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTagId(t.id)}
                    className="pixel-button px-2 py-1 font-pixel text-sm"
                    style={{ opacity: selectedTagId === t.id ? 1 : 0.4, color: t.color }}
                  >
                    #{t.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="새 태그"
                  className="pixel-input w-28 bg-transparent px-2 py-1 font-pixel text-sm text-theme placeholder:text-theme-muted focus:outline-none"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newTagName.trim()) return;
                    const result = await createTag(newTagName);
                    if (result.tag) {
                      setLocalTags([...localTags, result.tag]);
                      setSelectedTagId(result.tag.id);
                      setNewTagName("");
                    }
                  }}
                  className="pixel-button p-1"
                >
                  <Icon name="add" size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* 중요 */}
          <div className="flex items-center justify-center">
            <PixelToggle
              checked={isImportant}
              onChange={setIsImportant}
              label="중요"
              icon="⭐"
            />
          </div>

          {/* 반복 (습관 아닐 때만) */}
          {type !== "habit" && (
            <div className="flex items-start gap-2">
              <span className="shrink-0 pt-1 font-pixel text-sm text-theme-muted">반복</span>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex gap-1">
                  {[
                    { value: null, label: "없음" },
                    { value: "daily", label: "매일" },
                    { value: "weekly", label: "매주" },
                    { value: "monthly", label: "매달" },
                  ].map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => { setRepeatType(r.value); setRepeatDays([]); }}
                      className="pixel-button flex-1 py-1.5 font-pixel text-sm"
                      style={{ opacity: repeatType === r.value ? 1 : 0.4, color: "var(--theme-text)" }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {repeatType === "weekly" && (
                  <div className="flex gap-1">
                    {DAY_NAMES.map((name, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRepeatDays(
                          repeatDays.includes(i)
                            ? repeatDays.filter((d) => d !== i)
                            : [...repeatDays, i].sort()
                        )}
                        className="pixel-button flex-1 py-1.5 font-pixel text-sm"
                        style={{ opacity: repeatDays.includes(i) ? 1 : 0.3, color: "var(--theme-text)" }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                {repeatType === "monthly" && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setRepeatDays(
                          repeatDays.includes(d)
                            ? repeatDays.filter((v) => v !== d)
                            : [...repeatDays, d].sort((a, b) => a - b)
                        )}
                        className="pixel-button w-9 py-1 font-pixel text-xs"
                        style={{ opacity: repeatDays.includes(d) ? 1 : 0.3, color: "var(--theme-text)" }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 확인/취소 */}
          <div className="flex gap-2">
            <button
              type="submit"
              className="pixel-button flex-1 py-2.5 font-pixel text-base text-theme"
            >
              확인
            </button>
            <button
              type="button"
              onClick={onClose}
              className="pixel-button flex-1 py-2.5 font-pixel text-base text-theme-muted"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── 투두 수정 모달 ──
function EditModal({
  todo,
  onClose,
  onUpdated,
}: {
  todo: Todo;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [isImportant, setIsImportant] = useState(todo.is_important);
  const [repeatType, setRepeatType] = useState<string | null>(todo.repeat_type);
  const [repeatDays, setRepeatDays] = useState<number[]>(todo.repeat_days || []);
  const [error, setError] = useState("");

  const handleSubmit = async (formData: FormData) => {
    formData.set("id", todo.id);
    formData.set("isImportant", String(isImportant));
    if (repeatType) {
      formData.set("repeatType", repeatType);
      if (repeatDays.length > 0) formData.set("repeatDays", JSON.stringify(repeatDays));
    }
    const result = await updateTodo(formData);
    if (result.error) {
      setError(result.error);
    } else {
      onUpdated();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-20">
      <div className="pixel-panel w-full max-w-sm space-y-3 p-5">
        <h3 className="font-pixel text-sm text-theme">수정</h3>
        <form action={handleSubmit} className="space-y-3">
          <input
            name="title"
            type="text"
            required
            defaultValue={todo.title}
            className="pixel-input w-full bg-transparent px-3 py-2.5 font-pixel text-sm text-theme focus:outline-none"
          />

          <PixelToggle
            checked={isImportant}
            onChange={setIsImportant}
            label="중요"
            icon="⭐"
          />

          {todo.type !== "habit" && (
            <div className="flex items-start gap-2">
              <span className="shrink-0 pt-1 font-pixel text-sm text-theme-muted">반복</span>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex gap-1">
                  {[
                    { value: null, label: "없음" },
                    { value: "daily", label: "매일" },
                    { value: "weekly", label: "매주" },
                    { value: "monthly", label: "매달" },
                  ].map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => { setRepeatType(r.value); setRepeatDays([]); }}
                      className="pixel-button flex-1 py-1 font-pixel text-xs"
                      style={{ opacity: repeatType === r.value ? 1 : 0.4, color: "var(--theme-text)" }}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {repeatType === "weekly" && (
                  <div className="flex gap-1">
                    {DAY_NAMES.map((name, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setRepeatDays(
                          repeatDays.includes(i)
                            ? repeatDays.filter((d) => d !== i)
                            : [...repeatDays, i].sort()
                        )}
                        className="pixel-button flex-1 py-1.5 font-pixel text-sm"
                        style={{ opacity: repeatDays.includes(i) ? 1 : 0.3, color: "var(--theme-text)" }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                {repeatType === "monthly" && (
                  <div className="flex flex-wrap gap-1">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setRepeatDays(
                          repeatDays.includes(d)
                            ? repeatDays.filter((v) => v !== d)
                            : [...repeatDays, d].sort((a, b) => a - b)
                        )}
                        className="pixel-button w-9 py-1 font-pixel text-xs"
                        style={{ opacity: repeatDays.includes(d) ? 1 : 0.3, color: "var(--theme-text)" }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <p className="font-pixel text-center text-xs text-red-600">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              className="pixel-button flex-1 py-2 font-pixel text-sm text-theme"
            >
              저장
            </button>
            <button
              type="button"
              onClick={onClose}
              className="pixel-button flex-1 py-2 font-pixel text-sm text-theme-muted"
            >
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// 매일 첫 접속 시 일일 목표 재설정 모달
function DailyGoalModal({
  current,
  onConfirm,
}: {
  current: number;
  onConfirm: (goal: number) => void | Promise<void>;
}) {
  const [goal, setGoal] = useState<number>([1, 5, 10, 20].includes(current) ? current : 5);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="pixel-panel w-full max-w-sm space-y-4 p-6">
        <div className="flex flex-col items-center gap-2">
          <h2 className="font-pixel text-center text-base text-theme">오늘의 목표</h2>
          <p className="font-pixel text-center text-xs text-theme-muted">
            오늘 완료할 투두 개수를 정해주세요
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[1, 5, 10, 20].map((g) => (
            <button
              key={g}
              onClick={() => setGoal(g)}
              className="pixel-button py-3 font-pixel text-sm"
              style={{
                opacity: goal === g ? 1 : 0.5,
                color: "var(--theme-text)",
              }}
            >
              {g}개
            </button>
          ))}
        </div>
        <button
          onClick={async () => {
            setSubmitting(true);
            await onConfirm(goal);
            setSubmitting(false);
          }}
          disabled={submitting}
          className="pixel-button w-full py-3 font-pixel text-sm text-theme"
        >
          {submitting ? "저장 중..." : "확인"}
        </button>
      </div>
    </div>
  );
}
