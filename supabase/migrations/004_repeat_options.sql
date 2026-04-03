-- 기존 is_recurring을 repeat_type + repeat_days로 대체
ALTER TABLE public.todos
  ADD COLUMN repeat_type TEXT DEFAULT NULL
    CHECK (repeat_type IS NULL OR repeat_type IN ('daily', 'weekly', 'monthly')),
  ADD COLUMN repeat_days INTEGER[] DEFAULT NULL;

-- 기존 is_recurring=true 데이터를 daily로 마이그레이션
UPDATE public.todos
SET repeat_type = 'daily'
WHERE is_recurring = true;

-- is_recurring 컬럼 제거
ALTER TABLE public.todos DROP COLUMN is_recurring;

-- 습관 constraint 업데이트 (is_recurring 대신 repeat_type)
ALTER TABLE public.todos DROP CONSTRAINT IF EXISTS habit_requires_type;
ALTER TABLE public.todos ADD CONSTRAINT habit_requires_type CHECK (
  type != 'habit' OR (habit_type IS NOT NULL AND repeat_type = 'daily')
);
