-- 가디 페이지 진입 1 RTT 최적화
-- 1) record_guardian_growth fast-path 추가
-- 2) get_guardian_page_data: growth + care + activity 합본 RPC

-- ── 1. record_guardian_growth fast-path ──
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
  v_party_completed INTEGER;
  v_goal INTEGER;
  v_current_goal INTEGER;
  v_today_growth NUMERIC;
  v_total_goal BIGINT;
  v_total_completed BIGINT;
  v_existing_count INTEGER;
  v_expected_count INTEGER;
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

  -- ── FAST PATH: 종료된 가디는 누적값만 조회해 즉시 return ──
  IF v_guardian.status = 'ready' AND p_date > v_guardian.end_date THEN
    SELECT COALESCE(SUM(growth_points), 0),
           COALESCE(SUM(daily_goal), 0),
           COALESCE(SUM(completed_count), 0)
    INTO v_total, v_total_goal, v_total_completed
    FROM guardian_daily_growth WHERE guardian_id = v_guardian.id;

    RETURN json_build_object(
      'status', v_guardian.status,
      'total_growth', v_total,
      'max_growth', v_guardian.max_growth,
      'period_days', v_guardian.period_days,
      'start_date', v_guardian.start_date,
      'end_date', v_guardian.end_date,
      'egg_image', v_guardian.egg_image,
      'daily_goal', COALESCE((SELECT daily_goal FROM profiles WHERE id = p_user_id), 1),
      'today_growth', 0,
      'today_completed', 0,
      'total_goal', v_total_goal,
      'total_completed', v_total_completed
    );
  END IF;

  SELECT daily_goal INTO v_current_goal FROM profiles WHERE id = p_user_id;
  v_current_goal := COALESCE(v_current_goal, 1);

  -- ── FAST PATH: 백필 완료 여부 체크해서 LOOP 스킵 ──
  -- 기대값 = (LEAST(p_date, end_date) - start_date) 일수 (오늘 제외)
  v_expected_count := GREATEST(LEAST(p_date, v_guardian.end_date) - v_guardian.start_date, 0);
  SELECT COUNT(*) INTO v_existing_count FROM guardian_daily_growth
  WHERE guardian_id = v_guardian.id
    AND record_date >= v_guardian.start_date
    AND record_date < LEAST(p_date, v_guardian.end_date + 1);

  IF v_existing_count < v_expected_count THEN
    -- 백필
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

      SELECT COALESCE(COUNT(*), 0) INTO v_party_completed
      FROM party_daily_records pdr
      JOIN party_todos pt ON pt.id = pdr.party_todo_id
      WHERE pdr.user_id = p_user_id AND pdr.record_date = v_day;

      v_completed := v_completed + v_party_completed;

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
  END IF;

  -- 오늘
  v_today_growth := 0;
  v_completed := 0;
  IF p_date >= v_guardian.start_date AND p_date <= v_guardian.end_date THEN
    SELECT COALESCE(COUNT(*) FILTER (WHERE dr.is_completed AND t.type != 'habit'), 0)
    INTO v_completed
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id AND dr.record_date = p_date;

    SELECT COALESCE(COUNT(*), 0) INTO v_party_completed
    FROM party_daily_records pdr
    JOIN party_todos pt ON pt.id = pdr.party_todo_id
    WHERE pdr.user_id = p_user_id AND pdr.record_date = p_date;

    v_completed := v_completed + v_party_completed;

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

  SELECT COALESCE(SUM(growth_points), 0) INTO v_total
  FROM guardian_daily_growth WHERE guardian_id = v_guardian.id;

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

-- ── 2. 가디 페이지 합본 RPC ──
CREATE OR REPLACE FUNCTION public.get_guardian_page_data(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_growth JSON;
  v_status TEXT;
  v_care JSON;
  v_activity JSON;
  v_today DATE;
  v_today_start TIMESTAMPTZ;
BEGIN
  v_today := kst_today();
  v_today_start := (v_today::TIMESTAMP) AT TIME ZONE 'Asia/Seoul';

  v_growth := public.record_guardian_growth(p_user_id, v_today);
  v_status := v_growth->>'status';

  IF v_status = 'no_active_guardian' OR v_status = 'ready' THEN
    RETURN json_build_object(
      'growth', v_growth,
      'care', '[]'::json,
      'activity', '[]'::json
    );
  END IF;

  -- care: 오늘 사용한 카테고리 배열
  SELECT COALESCE(json_agg(DISTINCT cl.category), '[]'::json) INTO v_care
  FROM care_log cl
  WHERE cl.user_id = p_user_id AND cl.used_date = v_today;

  -- activity: 5개 소스 union → time desc 정렬
  SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.time DESC), '[]'::json) INTO v_activity
  FROM (
    -- 일반 투두
    SELECT 'todo'::TEXT AS type,
           t.title AS title,
           COALESCE(dr.gold_earned, 0) AS gold,
           dr.updated_at AS time
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id
      AND dr.record_date = v_today
      AND dr.is_completed
      AND t.type != 'habit'

    UNION ALL

    -- 돌봄
    SELECT 'care'::TEXT,
           it.name,
           0,
           cl.created_at
    FROM care_log cl
    JOIN item_types it ON it.id = cl.item_type_id
    WHERE cl.user_id = p_user_id AND cl.used_date = v_today

    UNION ALL

    -- 파티 투두
    SELECT 'todo'::TEXT,
           '[' || p.name || '] ' || pt.title,
           COALESCE(pdr.gold_earned, 0),
           pdr.created_at
    FROM party_daily_records pdr
    JOIN party_todos pt ON pt.id = pdr.party_todo_id
    JOIN parties p ON p.id = pt.party_id
    WHERE pdr.user_id = p_user_id
      AND pdr.record_date = v_today
      AND pdr.is_completed

    UNION ALL

    -- 하트 보냄
    SELECT 'heart_given'::TEXT,
           '하트를 보냈어요',
           10,
           wh.created_at
    FROM wall_hearts wh
    WHERE wh.user_id = p_user_id
      AND wh.created_at >= v_today_start

    UNION ALL

    -- 하트 받음
    SELECT 'heart_received'::TEXT,
           COALESCE(pr.nickname, '누군가') || '에게 하트를 받았어요',
           10,
           wh.created_at
    FROM wall_hearts wh
    JOIN wall_posts wp ON wp.id = wh.post_id
    LEFT JOIN profiles pr ON pr.id = wh.user_id
    WHERE wp.user_id = p_user_id
      AND wh.user_id != p_user_id
      AND wh.created_at >= v_today_start
  ) x;

  RETURN json_build_object(
    'growth', v_growth,
    'care', v_care,
    'activity', v_activity
  );
END;
$$;
