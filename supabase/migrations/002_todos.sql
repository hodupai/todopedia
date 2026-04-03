-- ============================================
-- TAGS (유저별 태그)
-- ============================================
CREATE TABLE public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#b06820',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_select_own" ON public.tags
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tags_insert_own" ON public.tags
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tags_update_own" ON public.tags
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tags_delete_own" ON public.tags
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- TODOS (투두 본체)
-- ============================================
-- type: 'normal' (일반), 'loop' (루프), 'habit' (습관)
-- habit_type: 'positive', 'negative' (습관 전용)
CREATE TABLE public.todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'normal' CHECK (type IN ('normal', 'loop', 'habit')),
  title TEXT NOT NULL,
  tag_id UUID REFERENCES public.tags(id) ON DELETE SET NULL,
  is_important BOOLEAN NOT NULL DEFAULT false,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  target_count INTEGER DEFAULT NULL CHECK (target_count IS NULL OR target_count >= 1),
  habit_type TEXT DEFAULT NULL CHECK (habit_type IS NULL OR habit_type IN ('positive', 'negative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 루프는 target_count 필수
  CONSTRAINT loop_requires_target CHECK (
    type != 'loop' OR target_count IS NOT NULL
  ),
  -- 습관은 habit_type 필수 + 항상 반복
  CONSTRAINT habit_requires_type CHECK (
    type != 'habit' OR (habit_type IS NOT NULL AND is_recurring = true)
  )
);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "todos_select_own" ON public.todos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "todos_insert_own" ON public.todos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "todos_update_own" ON public.todos
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "todos_delete_own" ON public.todos
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- DAILY_RECORDS (날짜별 투두 진행 기록)
-- ============================================
CREATE TABLE public.daily_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  todo_id UUID NOT NULL REFERENCES public.todos(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  current_count INTEGER NOT NULL DEFAULT 0,
  gold_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(todo_id, record_date)
);

ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_records_select_own" ON public.daily_records
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_records_insert_own" ON public.daily_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "daily_records_update_own" ON public.daily_records
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- 일일 목표 선택지 변경 (1/5/10/20)
-- ============================================
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_daily_goal_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_daily_goal_check
  CHECK (daily_goal IN (0, 1, 5, 10, 20));

-- 0 = 미선택 (모달로 선택 유도)
ALTER TABLE public.profiles
  ALTER COLUMN daily_goal SET DEFAULT 0;

-- ============================================
-- 오늘의 습관 골드 합계 조회 함수
-- ============================================
CREATE OR REPLACE FUNCTION public.get_daily_habit_gold(p_user_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(dr.gold_earned), 0)::INTEGER
  FROM daily_records dr
  JOIN todos t ON t.id = dr.todo_id
  WHERE dr.user_id = p_user_id
    AND dr.record_date = p_date
    AND t.type = 'habit';
$$;

-- ============================================
-- 오늘의 투두 달성 현황 조회 함수
-- ============================================
CREATE OR REPLACE FUNCTION public.get_daily_progress(p_user_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(completed_count INTEGER, daily_goal INTEGER, gold_earned INTEGER, growth_points INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH todo_stats AS (
    SELECT
      COUNT(*) FILTER (WHERE dr.is_completed) AS done,
      p.daily_goal AS goal,
      COALESCE(SUM(dr.gold_earned) FILTER (WHERE t.type != 'habit'), 0) AS todo_gold
    FROM profiles p
    LEFT JOIN todos t ON t.user_id = p.id AND t.type != 'habit'
    LEFT JOIN daily_records dr ON dr.todo_id = t.id AND dr.record_date = p_date
    WHERE p.id = p_user_id
    GROUP BY p.daily_goal
  )
  SELECT
    done::INTEGER,
    goal::INTEGER,
    todo_gold::INTEGER,
    CASE
      WHEN goal = 0 THEN 0
      ELSE LEAST(ROUND(done::NUMERIC / goal * 10), 10)::INTEGER
    END
  FROM todo_stats;
$$;
