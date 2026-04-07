-- 파티 투두 완료도 가디 성장치 / 일일 완료 개수에 포함
-- 각자(individual): 본인이 완료한 건
-- 다함께(collaborative): 본인이 기여한 건 (목표 달성 여부 무관)

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

  SELECT daily_goal INTO v_current_goal FROM profiles WHERE id = p_user_id;
  v_current_goal := COALESCE(v_current_goal, 1);

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

    -- 파티 완료 합산: 각자/다함께 모두, 본인 행이 있으면 카운트
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

  -- 오늘
  v_today_growth := 0;
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
