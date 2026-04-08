-- 버그: record_guardian_growth가 호출될 때마다 guardian_daily_growth.growth_points를
-- 완료카운트 기반으로 재계산해 ON CONFLICT DO UPDATE로 덮어써서, use_care_item이
-- +1로 누적시킨 돌봄 성장치가 사라짐.
--
-- 수정: 일별 care_log 카운트를 함께 조회해 growth_points 공식에 포함.
--   growth_points = LEAST(completed/goal * 10, 10) + care_count_of_day

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
  v_care_today INTEGER;
  v_goal INTEGER;
  v_current_goal INTEGER;
  v_today_growth NUMERIC;
  v_total_goal BIGINT;
  v_total_completed BIGINT;
  v_total_care BIGINT;
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

  IF p_date > v_guardian.end_date AND v_guardian.status = 'growing' THEN
    UPDATE active_guardians SET status = 'ready', updated_at = now()
    WHERE id = v_guardian.id;
    v_guardian.status := 'ready';
  END IF;

  IF v_guardian.status = 'ready' AND p_date > v_guardian.end_date THEN
    SELECT COALESCE(SUM(growth_points), 0),
           COALESCE(SUM(daily_goal), 0),
           COALESCE(SUM(completed_count), 0)
    INTO v_total, v_total_goal, v_total_completed
    FROM guardian_daily_growth WHERE guardian_id = v_guardian.id;

    SELECT COUNT(*) INTO v_total_care FROM care_log
    WHERE user_id = p_user_id
      AND used_date >= v_guardian.start_date
      AND used_date <= v_guardian.end_date;

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
      'total_completed', v_total_completed,
      'total_care', v_total_care
    );
  END IF;

  SELECT daily_goal INTO v_current_goal FROM profiles WHERE id = p_user_id;
  v_current_goal := COALESCE(v_current_goal, 1);

  v_expected_count := GREATEST(LEAST(p_date, v_guardian.end_date) - v_guardian.start_date, 0);
  SELECT COUNT(*) INTO v_existing_count FROM guardian_daily_growth
  WHERE guardian_id = v_guardian.id
    AND record_date >= v_guardian.start_date
    AND record_date < LEAST(p_date, v_guardian.end_date + 1);

  IF v_existing_count < v_expected_count THEN
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

      SELECT COALESCE(COUNT(*), 0) INTO v_care_today FROM care_log
      WHERE user_id = p_user_id AND used_date = v_day;

      v_goal := v_current_goal;
      IF v_goal > 0 THEN
        v_growth := LEAST(ROUND(v_completed::NUMERIC / v_goal * 10, 2), 10);
      ELSE
        v_growth := 0;
      END IF;
      v_growth := v_growth + v_care_today;

      INSERT INTO guardian_daily_growth (guardian_id, user_id, record_date, growth_points, daily_goal, completed_count)
      VALUES (v_guardian.id, p_user_id, v_day, v_growth, v_goal, v_completed)
      ON CONFLICT (guardian_id, record_date) DO UPDATE SET growth_points = v_growth, daily_goal = v_goal, completed_count = v_completed;
    END LOOP;
  END IF;

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

    SELECT COALESCE(COUNT(*), 0) INTO v_care_today FROM care_log
    WHERE user_id = p_user_id AND used_date = p_date;

    v_goal := v_current_goal;
    IF v_goal > 0 THEN
      v_growth := LEAST(ROUND(v_completed::NUMERIC / v_goal * 10, 2), 10);
    ELSE
      v_growth := 0;
    END IF;
    v_growth := v_growth + v_care_today;
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

  SELECT COUNT(*) INTO v_total_care FROM care_log
  WHERE user_id = p_user_id
    AND used_date >= v_guardian.start_date
    AND used_date <= v_guardian.end_date;

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
    'total_completed', v_total_completed,
    'total_care', v_total_care
  );
END;
$$;
