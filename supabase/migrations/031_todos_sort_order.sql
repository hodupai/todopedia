-- todos에 sort_order 추가 (수동 정렬 지원)
ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

-- 기존 행 백필: user_id별로 created_at 순으로 1,2,3...
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM public.todos
)
UPDATE public.todos t
SET sort_order = ranked.rn
FROM ranked
WHERE t.id = ranked.id;

-- 인덱스 (정렬 가속)
CREATE INDEX IF NOT EXISTS idx_todos_user_sort ON public.todos(user_id, sort_order);

-- INSERT 시 sort_order가 0(기본)이면 자동으로 max+1 할당
CREATE OR REPLACE FUNCTION public.todos_assign_sort_order()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sort_order IS NULL OR NEW.sort_order = 0 THEN
    SELECT COALESCE(MAX(sort_order), 0) + 1 INTO NEW.sort_order
    FROM public.todos
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_todos_assign_sort_order ON public.todos;
CREATE TRIGGER trg_todos_assign_sort_order
  BEFORE INSERT ON public.todos
  FOR EACH ROW
  EXECUTE FUNCTION public.todos_assign_sort_order();
