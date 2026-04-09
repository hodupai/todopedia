"use client";

// 투두 페이지 공용 타입 / 헬퍼 / 서브컴포넌트
// (TodoClient.tsx의 비대화 방지를 위해 분리)

export type Todo = {
  id: string;
  type: "normal" | "loop" | "habit";
  title: string;
  description: string | null;
  tag_id: string | null;
  is_important: boolean;
  repeat_type: "daily" | "weekly" | "monthly" | null;
  repeat_days: number[] | null;
  target_count: number | null;
  habit_type: "positive" | "negative" | null;
  sort_order: number;
  tags?: { name: string; color: string } | null;
};

export type DailyRecord = {
  todo_id: string;
  is_completed: boolean;
  current_count: number;
};

export type Tag = {
  id: string;
  name: string;
  color: string;
};

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export function formatRepeat(type: string, days: number[] | null): string {
  if (type === "daily") return "매일";
  if (type === "weekly" && days) return `매주 ${days.map((d) => DAY_NAMES[d]).join(", ")}`;
  if (type === "monthly" && days) return `매달 ${days.join(", ")}일`;
  return "";
}

// 픽셀 아이콘 헬퍼
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
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
export function PixelToggle({
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

// 빈 상태
export function EmptyState({
  icon,
  text,
  ctaLabel,
  onCta,
}: {
  icon: string;
  text: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <span className="text-3xl">{icon}</span>
      <p className="font-pixel text-sm text-theme-muted">{text}</p>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="pixel-button px-4 py-2 font-pixel text-xs text-theme"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
