"use client";

import { useState } from "react";
import { Icon, type Todo, type DailyRecord } from "./todo-shared";

export default function HabitItem({
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
    <div data-todo-id={todo.id} className="pixel-input flex items-center gap-2 px-3 py-2">
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
