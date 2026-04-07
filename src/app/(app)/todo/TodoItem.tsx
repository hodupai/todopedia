"use client";

import { useState } from "react";
import { Icon, formatRepeat, type Todo, type DailyRecord } from "./todo-shared";

export default function TodoItem({
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleLoopClick = () => {
    if (isCompleted) return;
    onIncrement(todo.id);
  };

  return (
    <>
      <div
        data-todo-id={todo.id}
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
                  onClick={() => { setShowDeleteConfirm(true); setShowMenu(false); }}
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

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6">
          <div className="pixel-panel w-full max-w-xs space-y-4 p-6 text-center">
            <p className="font-pixel text-sm text-theme">
              &ldquo;{todo.title}&rdquo;을(를) 삭제할까요?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { onDelete(todo.id); setShowDeleteConfirm(false); }}
                className="pixel-button flex-1 py-2 font-pixel text-sm"
                style={{ color: "#c44" }}
              >
                삭제
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="pixel-button flex-1 py-2 font-pixel text-sm text-theme-muted"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
