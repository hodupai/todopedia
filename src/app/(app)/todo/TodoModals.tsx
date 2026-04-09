"use client";

import { useState } from "react";
import { Icon, PixelToggle, DAY_NAMES, type Todo, type Tag } from "./todo-shared";
import { createTodo, updateTodo, createTag } from "./actions";
import { startGuardian } from "../guardian/actions";

// ── 가디 시작 모달 (기간 + 일일 목표 선택) ──
export function GuardianStartModal({ onStarted }: { onStarted: (goal: number) => void }) {
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
export function CreateModal({
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
          <input
            name="title"
            type="text"
            required
            autoFocus
            className="pixel-input w-full bg-transparent px-3 py-2.5 font-pixel text-base text-theme placeholder:text-theme-muted focus:outline-none"
            placeholder={type === "habit" ? "습관 이름" : "할 일 입력"}
          />

          <textarea
            name="description"
            maxLength={500}
            rows={2}
            className="pixel-input w-full resize-none bg-transparent px-3 py-2 font-pixel text-sm text-theme placeholder:text-theme-muted focus:outline-none"
            placeholder="상세 내역 (선택, 최대 500자)"
          />

          {error && (
            <p className="font-pixel text-center text-sm text-red-600">{error}</p>
          )}

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

          <div className="flex items-center justify-center">
            <PixelToggle
              checked={isImportant}
              onChange={setIsImportant}
              label="중요"
              icon="⭐"
            />
          </div>

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
export function EditModal({
  todo,
  tags,
  onClose,
  onUpdated,
}: {
  todo: Todo;
  tags: Tag[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [isImportant, setIsImportant] = useState(todo.is_important);
  const [repeatType, setRepeatType] = useState<string | null>(todo.repeat_type);
  const [repeatDays, setRepeatDays] = useState<number[]>(todo.repeat_days || []);
  const [selectedTagId, setSelectedTagId] = useState<string | null>(todo.tag_id);
  const [newTagName, setNewTagName] = useState("");
  const [localTags, setLocalTags] = useState<Tag[]>(tags);
  const [error, setError] = useState("");

  const handleSubmit = async (formData: FormData) => {
    formData.set("id", todo.id);
    formData.set("isImportant", String(isImportant));
    if (selectedTagId) formData.set("tagId", selectedTagId);
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

          <textarea
            name="description"
            maxLength={500}
            rows={2}
            defaultValue={todo.description ?? ""}
            className="pixel-input w-full resize-none bg-transparent px-3 py-2 font-pixel text-sm text-theme placeholder:text-theme-muted focus:outline-none"
            placeholder="상세 내역 (선택, 최대 500자)"
          />

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
export function DailyGoalModal({
  current,
  onConfirm,
}: {
  current: number;
  onConfirm: (goal: number) => void | Promise<void>;
}) {
  const validCurrent = [1, 5, 10, 20].includes(current) ? current : null;
  const [goal, setGoal] = useState<number>(validCurrent ?? 5);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (g: number) => {
    setSubmitting(true);
    await onConfirm(g);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
      <div className="pixel-panel w-full max-w-sm space-y-4 p-6">
        <div className="flex flex-col items-center gap-2">
          <h2 className="font-pixel text-center text-base text-theme">오늘의 목표</h2>
          <p className="font-pixel text-center text-xs text-theme-muted">
            오늘 완료할 투두 개수를 정해주세요
          </p>
        </div>

        {validCurrent !== null && (
          <button
            onClick={() => submit(validCurrent)}
            disabled={submitting}
            className="pixel-button w-full py-3 font-pixel text-sm"
            style={{ color: "var(--theme-accent)" }}
          >
            어제와 동일 ({validCurrent}개)
          </button>
        )}

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
          onClick={() => submit(goal)}
          disabled={submitting}
          className="pixel-button w-full py-3 font-pixel text-sm text-theme"
        >
          {submitting ? "저장 중..." : "확인"}
        </button>
      </div>
    </div>
  );
}
