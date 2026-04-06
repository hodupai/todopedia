-- ============================================================
-- 005: Guardian System (가디 시스템)
-- 시즌별 가디언 도감 + 성장 + 가챠 진화
-- ============================================================

-- ── 시즌 테이블 ──
CREATE TABLE public.seasons (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,                -- e.g. "시즌 1"
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons_select_all" ON public.seasons FOR SELECT USING (true);

INSERT INTO public.seasons (id, name, is_active) VALUES (1, '시즌 1', true);

-- ── 가디언 타입 (시즌별 정적 데이터) ──
CREATE TABLE public.guardian_types (
  id SERIAL PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES public.seasons(id),
  name TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('normal','rare','epic','unique')),
  asset_key TEXT NOT NULL,           -- e.g. "char_01" → /ui/guardi/guardian/char_01.png
  description TEXT DEFAULT '',
  UNIQUE(season_id, asset_key)
);

ALTER TABLE public.guardian_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guardian_types_select_all" ON public.guardian_types FOR SELECT USING (true);

-- 시즌 1 가디언 14종 시드
INSERT INTO public.guardian_types (season_id, name, rarity, asset_key) VALUES
  -- Normal 5종
  (1, '풀잎 가디언',   'normal', 'char_01'),
  (1, '돌멩이 가디언', 'normal', 'char_02'),
  (1, '물방울 가디언', 'normal', 'char_03'),
  (1, '모래 가디언',   'normal', 'char_04'),
  (1, '나뭇잎 가디언', 'normal', 'char_05'),
  -- Rare 4종
  (1, '불꽃 가디언',   'rare',   'char_06'),
  (1, '얼음 가디언',   'rare',   'char_07'),
  (1, '번개 가디언',   'rare',   'char_08'),
  (1, '바람 가디언',   'rare',   'char_09'),
  -- Epic 3종
  (1, '용암 가디언',   'epic',   'char_10'),
  (1, '폭풍 가디언',   'epic',   'char_11'),
  (1, '심해 가디언',   'epic',   'char_12'),
  -- Unique 2종
  (1, '태양 가디언',   'unique', 'char_13'),
  (1, '달빛 가디언',   'unique', 'char_14');

-- ── 활성 가디 (유저당 1마리) ──
CREATE TABLE public.active_guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  season_id INTEGER NOT NULL REFERENCES public.seasons(id),
  period_days INTEGER NOT NULL CHECK (period_days IN (3,7,10,15,30)),
  daily_goal INTEGER NOT NULL CHECK (daily_goal IN (1,5,10,20)),
  egg_image TEXT NOT NULL,           -- "07.png" (랜덤 01~50)
  total_growth NUMERIC(7,2) NOT NULL DEFAULT 0,
  max_growth INTEGER GENERATED ALWAYS AS (period_days * 10) STORED,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'growing' CHECK (status IN ('growing','ready')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT one_active_per_user UNIQUE (user_id)
);

ALTER TABLE public.active_guardians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active_guardians_select_own" ON public.active_guardians
  FOR SELECT USING (auth.uid() = user_id);

-- ── 일별 성장 기록 ──
CREATE TABLE public.guardian_daily_growth (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES public.active_guardians(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  growth_points NUMERIC(4,2) NOT NULL DEFAULT 0 CHECK (growth_points >= 0 AND growth_points <= 14),
  daily_goal INTEGER NOT NULL DEFAULT 1,
  completed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guardian_id, record_date)
);

ALTER TABLE public.guardian_daily_growth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guardian_daily_growth_select_own" ON public.guardian_daily_growth
  FOR SELECT USING (auth.uid() = user_id);

-- ── 도감 (시즌별, 중복 허용) ──
CREATE TABLE public.collection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guardian_type_id INTEGER NOT NULL REFERENCES public.guardian_types(id),
  season_id INTEGER NOT NULL REFERENCES public.seasons(id),
  period_days INTEGER NOT NULL,
  achievement_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_growth NUMERIC(7,2) NOT NULL DEFAULT 0,
  is_duplicate BOOLEAN NOT NULL DEFAULT false,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.collection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "collection_select_own" ON public.collection
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- RPC Functions
-- ============================================================

-- 한국 시간 기준 오늘 날짜 헬퍼
CREATE OR REPLACE FUNCTION public.kst_today()
RETURNS DATE
LANGUAGE sql
IMMUTABLE
AS $$ SELECT (now() AT TIME ZONE 'Asia/Seoul')::DATE; $$;

-- ── 가디 시작 ──
CREATE OR REPLACE FUNCTION public.start_guardian(
  p_user_id UUID,
  p_period_days INTEGER,
  p_daily_goal INTEGER
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_egg TEXT;
  v_today DATE;
  v_end DATE;
  v_season_id INTEGER;
  v_guardian active_guardians%ROWTYPE;
BEGIN
  IF p_period_days NOT IN (3,7,10,15,30) THEN
    RAISE EXCEPTION 'invalid_period';
  END IF;
  IF p_daily_goal NOT IN (1,5,10,20) THEN
    RAISE EXCEPTION 'invalid_daily_goal';
  END IF;
  IF EXISTS (SELECT 1 FROM active_guardians WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'guardian_already_active';
  END IF;

  -- 현재 활성 시즌
  SELECT id INTO v_season_id FROM seasons WHERE is_active = true LIMIT 1;
  IF v_season_id IS NULL THEN
    RAISE EXCEPTION 'no_active_season';
  END IF;

  v_today := kst_today();
  v_egg := LPAD((floor(random() * 50) + 1)::TEXT, 2, '0') || '.png';
  v_end := v_today + (p_period_days - 1);

  INSERT INTO active_guardians (user_id, season_id, period_days, daily_goal, egg_image, start_date, end_date)
  VALUES (p_user_id, v_season_id, p_period_days, p_daily_goal, v_egg, v_today, v_end)
  RETURNING * INTO v_guardian;

  -- 프로필 daily_goal도 업데이트
  UPDATE profiles SET daily_goal = p_daily_goal, updated_at = now() WHERE id = p_user_id;

  RETURN json_build_object(
    'id', v_guardian.id,
    'egg_image', v_guardian.egg_image,
    'period_days', v_guardian.period_days,
    'daily_goal', v_guardian.daily_goal,
    'start_date', v_guardian.start_date,
    'end_date', v_guardian.end_date,
    'season_id', v_guardian.season_id
  );
END;
$$;

-- ── 성장치 기록 (오늘 + 빠진 날 백필) ──
CREATE OR REPLACE FUNCTION public.record_guardian_growth(
  p_user_id UUID,
  p_date DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guardian active_guardians%ROWTYPE;
  v_growth NUMERIC;
  v_total NUMERIC;
  v_day DATE;
  v_completed INTEGER;
  v_goal INTEGER;
  v_current_goal INTEGER;
  v_today_growth NUMERIC;
  v_total_goal BIGINT;
  v_total_completed BIGINT;
BEGIN
  IF p_date IS NULL THEN
    p_date := kst_today();
  END IF;

  SELECT * INTO v_guardian FROM active_guardians
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'no_active_guardian');
  END IF;

  -- 기간 종료 체크
  IF p_date > v_guardian.end_date AND v_guardian.status = 'growing' THEN
    UPDATE active_guardians SET status = 'ready', updated_at = now()
    WHERE id = v_guardian.id;
    v_guardian.status := 'ready';
  END IF;

  -- 현재 profiles.daily_goal 조회
  SELECT daily_goal INTO v_current_goal FROM profiles WHERE id = p_user_id;
  v_current_goal := COALESCE(v_current_goal, 1);

  -- 백필: 과거 빠진 날 기록 (오늘 제외)
  FOR v_day IN
    SELECT d::DATE FROM generate_series(v_guardian.start_date, LEAST(p_date, v_guardian.end_date), '1 day') d
    WHERE d::DATE != p_date
    AND NOT EXISTS (
      SELECT 1 FROM guardian_daily_growth
      WHERE guardian_id = v_guardian.id AND record_date = d::DATE
    )
  LOOP
    SELECT COALESCE(COUNT(*) FILTER (WHERE dr.is_completed AND t.type != 'habit'), 0)
    INTO v_completed
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id AND dr.record_date = v_day;

    v_goal := v_current_goal;
    IF v_goal > 0 THEN
      v_growth := LEAST(ROUND(v_completed::NUMERIC / v_goal * 10, 2), 10);
    ELSE
      v_growth := 0;
    END IF;

    INSERT INTO guardian_daily_growth (guardian_id, user_id, record_date, growth_points, daily_goal, completed_count)
    VALUES (v_guardian.id, p_user_id, v_day, v_growth, v_goal, v_completed)
    ON CONFLICT (guardian_id, record_date) DO UPDATE SET growth_points = v_growth, daily_goal = v_goal, completed_count = v_completed;
  END LOOP;

  -- 오늘은 항상 갱신 (기간 내인 경우)
  v_today_growth := 0;
  IF p_date >= v_guardian.start_date AND p_date <= v_guardian.end_date THEN
    SELECT COALESCE(COUNT(*) FILTER (WHERE dr.is_completed AND t.type != 'habit'), 0)
    INTO v_completed
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id AND dr.record_date = p_date;

    v_goal := v_current_goal;
    IF v_goal > 0 THEN
      v_growth := LEAST(ROUND(v_completed::NUMERIC / v_goal * 10, 2), 10);
    ELSE
      v_growth := 0;
    END IF;
    v_today_growth := v_growth;

    INSERT INTO guardian_daily_growth (guardian_id, user_id, record_date, growth_points, daily_goal, completed_count)
    VALUES (v_guardian.id, p_user_id, p_date, v_growth, v_goal, v_completed)
    ON CONFLICT (guardian_id, record_date) DO UPDATE SET growth_points = v_growth, daily_goal = v_goal, completed_count = v_completed;
  END IF;

  -- 총 성장치 재계산
  SELECT COALESCE(SUM(growth_points), 0) INTO v_total
  FROM guardian_daily_growth WHERE guardian_id = v_guardian.id;

  -- 총 목표/달성 집계
  SELECT COALESCE(SUM(daily_goal), 0), COALESCE(SUM(completed_count), 0)
  INTO v_total_goal, v_total_completed
  FROM guardian_daily_growth WHERE guardian_id = v_guardian.id;

  UPDATE active_guardians SET total_growth = v_total, updated_at = now()
  WHERE id = v_guardian.id;

  RETURN json_build_object(
    'status', v_guardian.status,
    'total_growth', v_total,
    'max_growth', v_guardian.max_growth,
    'period_days', v_guardian.period_days,
    'start_date', v_guardian.start_date,
    'end_date', v_guardian.end_date,
    'egg_image', v_guardian.egg_image,
    'daily_goal', v_current_goal,
    'today_growth', v_today_growth,
    'today_completed', v_completed,
    'total_goal', v_total_goal,
    'total_completed', v_total_completed
  );
END;
$$;

-- ── 가챠 진화 ──
CREATE OR REPLACE FUNCTION public.evolve_guardian(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guardian active_guardians%ROWTYPE;
  v_achievement NUMERIC;
  v_care_bonus NUMERIC;
  v_roll NUMERIC;
  v_rarity TEXT;
  v_type_id INTEGER;
  v_is_dup BOOLEAN;
  v_dup_gold INTEGER;
  v_type guardian_types%ROWTYPE;
  v_p_unique NUMERIC;
  v_p_epic NUMERIC;
  v_p_rare NUMERIC;
  v_mult NUMERIC;
  v_care_mult NUMERIC;
BEGIN
  SELECT * INTO v_guardian FROM active_guardians
  WHERE user_id = p_user_id AND status = 'ready';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no_ready_guardian';
  END IF;

  -- 달성률 (100% 상한)
  v_achievement := CASE
    WHEN v_guardian.max_growth = 0 THEN 0
    ELSE LEAST(ROUND(v_guardian.total_growth / v_guardian.max_growth * 100, 2), 100)
  END;

  -- 돌봄 보너스 (max_growth 초과분)
  v_care_bonus := GREATEST(0, v_guardian.total_growth - v_guardian.max_growth);

  -- 기간별 기본 확률
  CASE v_guardian.period_days
    WHEN 3  THEN v_p_unique := 1;  v_p_epic := 4;  v_p_rare := 15;
    WHEN 7  THEN v_p_unique := 2;  v_p_epic := 7;  v_p_rare := 20;
    WHEN 10 THEN v_p_unique := 3;  v_p_epic := 10; v_p_rare := 25;
    WHEN 15 THEN v_p_unique := 5;  v_p_epic := 14; v_p_rare := 30;
    WHEN 30 THEN v_p_unique := 8;  v_p_epic := 20; v_p_rare := 35;
  END CASE;

  -- 달성률 보정 (0.5 ~ 1.5배)
  v_mult := 0.5 + (v_achievement / 100.0);
  v_p_unique := v_p_unique * v_mult;
  v_p_epic   := v_p_epic * v_mult;
  v_p_rare   := v_p_rare * v_mult;

  -- 돌봄 보너스 보정 (유니크 확률에만 적용, 노말이 줄어듦)
  v_care_mult := 1 + (v_care_bonus / 100.0);
  v_p_unique := v_p_unique * v_care_mult;

  -- 가챠 롤
  v_roll := random() * 100;

  IF v_roll < v_p_unique THEN
    v_rarity := 'unique';
  ELSIF v_roll < v_p_unique + v_p_epic THEN
    v_rarity := 'epic';
  ELSIF v_roll < v_p_unique + v_p_epic + v_p_rare THEN
    v_rarity := 'rare';
  ELSE
    v_rarity := 'normal';
  END IF;

  -- 해당 레어도에서 랜덤 가디언 선택 (같은 시즌)
  SELECT id INTO v_type_id FROM guardian_types
  WHERE rarity = v_rarity AND season_id = v_guardian.season_id
  ORDER BY random() LIMIT 1;

  -- 중복 체크
  SELECT EXISTS(
    SELECT 1 FROM collection WHERE user_id = p_user_id AND guardian_type_id = v_type_id
  ) INTO v_is_dup;

  -- 중복 골드 보상 (기간 * 100)
  v_dup_gold := 0;
  IF v_is_dup THEN
    v_dup_gold := v_guardian.period_days * 100;
    PERFORM add_gold(p_user_id, v_dup_gold);
  END IF;

  -- 도감 등록
  INSERT INTO collection (user_id, guardian_type_id, season_id, period_days, achievement_rate, total_growth, is_duplicate)
  VALUES (p_user_id, v_type_id, v_guardian.season_id, v_guardian.period_days, v_achievement, v_guardian.total_growth, v_is_dup);

  SELECT * INTO v_type FROM guardian_types WHERE id = v_type_id;

  -- 활성 가디 삭제
  DELETE FROM active_guardians WHERE id = v_guardian.id;

  RETURN json_build_object(
    'guardian_type_id', v_type.id,
    'name', v_type.name,
    'rarity', v_type.rarity,
    'asset_key', v_type.asset_key,
    'achievement_rate', v_achievement,
    'care_bonus', v_care_bonus,
    'is_duplicate', v_is_dup,
    'duplicate_gold', v_dup_gold,
    'period_days', v_guardian.period_days
  );
END;
$$;

-- ── 컬렉션 조회 ──
CREATE OR REPLACE FUNCTION public.get_collection(p_user_id UUID, p_season_id INTEGER DEFAULT NULL)
RETURNS TABLE(
  id UUID, guardian_type_id INTEGER, name TEXT, rarity TEXT,
  asset_key TEXT, period_days INTEGER, achievement_rate NUMERIC,
  is_duplicate BOOLEAN, acquired_at TIMESTAMPTZ, season_id INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.guardian_type_id, gt.name, gt.rarity,
         gt.asset_key, c.period_days, c.achievement_rate,
         c.is_duplicate, c.acquired_at, c.season_id
  FROM collection c
  JOIN guardian_types gt ON gt.id = c.guardian_type_id
  WHERE c.user_id = p_user_id
    AND (p_season_id IS NULL OR c.season_id = p_season_id)
  ORDER BY c.acquired_at DESC;
$$;

-- ── 컬렉션 요약 (시즌별) ──
CREATE OR REPLACE FUNCTION public.get_collection_summary(p_user_id UUID, p_season_id INTEGER DEFAULT NULL)
RETURNS TABLE(collected BIGINT, total BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(DISTINCT c.guardian_type_id) FROM collection c
     JOIN guardian_types gt ON gt.id = c.guardian_type_id
     WHERE c.user_id = p_user_id
       AND (p_season_id IS NULL OR c.season_id = p_season_id)),
    (SELECT COUNT(*) FROM guardian_types
     WHERE p_season_id IS NULL OR season_id = p_season_id);
$$;
