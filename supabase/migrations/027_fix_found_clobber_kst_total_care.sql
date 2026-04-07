-- 1) FOUND 변수 클로버 버그 수정 (SELECT COUNT INTO가 FOUND를 TRUE로 덮어써서
--    daily_records가 INSERT되지 않던 치명적 버그) — v_record_found BOOLEAN으로 즉시 캡처
-- 2) CURRENT_DATE → kst_today() 통일 (timezone 일관성)
-- 3) record_guardian_growth에 total_care 추가 (care_log count, 활성 가디 기간 내)

CREATE OR REPLACE FUNCTION public.complete_todo(p_user_id UUID, p_todo_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todo todos%ROWTYPE;
  v_record daily_records%ROWTYPE;
  v_record_found BOOLEAN;
  v_today DATE := kst_today();
  v_daily_goal INT;
  v_completed_count INT;
  v_new_completed BOOLEAN;
  v_base_gold INT := 0;
  v_combo_bonus INT := 0;
  v_gold_delta INT := 0;
  v_is_one_time BOOLEAN;
  v_after_completed INT;
  v_is_crit BOOLEAN := false;
  v_combo INT := 0;
  v_last_complete TIMESTAMPTZ;
  v_eligible_for_gold BOOLEAN := false;
BEGIN
  SELECT * INTO v_todo FROM todos WHERE id = p_todo_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'todo_not_found');
  END IF;

  v_is_one_time := (v_todo.type <> 'habit' AND v_todo.repeat_type IS NULL);

  SELECT daily_goal, combo_count, last_complete_at
  INTO v_daily_goal, v_combo, v_last_complete
  FROM profiles WHERE id = p_user_id;
  v_daily_goal := COALESCE(v_daily_goal, 0);

  SELECT * INTO v_record FROM daily_records
    WHERE todo_id = p_todo_id AND record_date = v_today;
  v_record_found := FOUND;  -- ★ FOUND 즉시 캡처 (이후 쿼리들이 FOUND를 덮어쓰므로)

  IF v_record_found THEN
    v_new_completed := NOT v_record.is_completed;
  ELSE
    v_new_completed := true;
  END IF;

  IF v_new_completed THEN
    SELECT COUNT(*) INTO v_completed_count
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id AND dr.record_date = v_today
      AND dr.is_completed = true AND t.type <> 'habit';
    v_eligible_for_gold := (v_completed_count < v_daily_goal);

    IF v_eligible_for_gold THEN
      IF random() < 0.05 THEN
        v_is_crit := true;
        v_base_gold := 500;
      ELSE
        v_base_gold := 200;
      END IF;

      IF v_last_complete IS NOT NULL AND v_last_complete > now() - INTERVAL '5 minutes' THEN
        v_combo := v_combo + 1;
      ELSE
        v_combo := 1;
      END IF;

      IF v_combo >= 3 THEN
        v_combo_bonus := 100;
      END IF;

      v_gold_delta := v_base_gold + v_combo_bonus;
    ELSE
      -- 일일 기회 소진 후: 3% 잭팟
      IF random() < 0.03 THEN
        v_is_crit := true;
        v_base_gold := 500;
        v_gold_delta := 500;
      END IF;
    END IF;
  ELSE
    v_gold_delta := -COALESCE(v_record.gold_earned, 0);
    v_combo := 0;
  END IF;

  IF v_record_found THEN
    UPDATE daily_records
      SET is_completed = v_new_completed,
          gold_earned = CASE WHEN v_new_completed THEN v_gold_delta ELSE 0 END,
          updated_at = now()
      WHERE id = v_record.id;
  ELSE
    INSERT INTO daily_records (user_id, todo_id, record_date, is_completed, gold_earned)
    VALUES (p_user_id, p_todo_id, v_today, true, v_gold_delta);
  END IF;

  IF v_new_completed THEN
    UPDATE profiles
      SET gold = GREATEST(0, gold + v_gold_delta),
          combo_count = v_combo,
          last_complete_at = CASE WHEN v_eligible_for_gold THEN now() ELSE last_complete_at END
      WHERE id = p_user_id;
  ELSE
    UPDATE profiles
      SET gold = GREATEST(0, gold + v_gold_delta),
          combo_count = 0
      WHERE id = p_user_id;
  END IF;

  -- 일회성 완료 → 다음 KST 자정에 archive
  IF v_is_one_time AND v_new_completed THEN
    UPDATE todos SET archived_at = next_kst_midnight() WHERE id = p_todo_id AND user_id = p_user_id;
  END IF;
  IF v_is_one_time AND NOT v_new_completed THEN
    UPDATE todos SET archived_at = NULL WHERE id = p_todo_id AND user_id = p_user_id;
  END IF;

  SELECT COUNT(*) INTO v_after_completed
  FROM daily_records dr
  JOIN todos t ON t.id = dr.todo_id
  WHERE dr.user_id = p_user_id AND dr.record_date = v_today
    AND dr.is_completed = true AND t.type <> 'habit';

  RETURN json_build_object(
    'success', true,
    'completed', v_new_completed,
    'gold', v_gold_delta,
    'baseGold', v_base_gold,
    'comboBonus', v_combo_bonus,
    'crit', v_is_crit,
    'combo', v_combo,
    'completedCount', v_after_completed,
    'dailyGoal', v_daily_goal
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_loop(p_user_id UUID, p_todo_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todo todos%ROWTYPE;
  v_record daily_records%ROWTYPE;
  v_record_found BOOLEAN;
  v_today DATE := kst_today();
  v_new_count INT;
  v_is_completed BOOLEAN;
  v_base_gold INT := 0;
  v_combo_bonus INT := 0;
  v_gold INT := 0;
  v_daily_goal INT;
  v_completed_count INT;
  v_after_completed INT;
  v_is_crit BOOLEAN := false;
  v_combo INT := 0;
  v_last_complete TIMESTAMPTZ;
  v_eligible BOOLEAN := false;
BEGIN
  SELECT * INTO v_todo FROM todos WHERE id = p_todo_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'todo_not_found');
  END IF;

  SELECT * INTO v_record FROM daily_records
    WHERE todo_id = p_todo_id AND record_date = v_today;
  v_record_found := FOUND;

  IF v_record_found AND v_record.is_completed THEN
    RETURN json_build_object('error', 'already_completed');
  END IF;

  v_new_count := COALESCE(v_record.current_count, 0) + 1;
  v_is_completed := v_new_count >= COALESCE(v_todo.target_count, 1);

  IF v_is_completed THEN
    SELECT daily_goal, combo_count, last_complete_at
    INTO v_daily_goal, v_combo, v_last_complete
    FROM profiles WHERE id = p_user_id;
    v_daily_goal := COALESCE(v_daily_goal, 0);

    SELECT COUNT(*) INTO v_completed_count
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id AND dr.record_date = v_today
      AND dr.is_completed = true AND t.type <> 'habit';

    v_eligible := (v_completed_count < v_daily_goal);

    IF v_eligible THEN
      IF random() < 0.05 THEN
        v_is_crit := true;
        v_base_gold := 500;
      ELSE
        v_base_gold := 200;
      END IF;

      IF v_last_complete IS NOT NULL AND v_last_complete > now() - INTERVAL '5 minutes' THEN
        v_combo := v_combo + 1;
      ELSE
        v_combo := 1;
      END IF;

      IF v_combo >= 3 THEN
        v_combo_bonus := 100;
      END IF;

      v_gold := v_base_gold + v_combo_bonus;
    ELSE
      IF random() < 0.03 THEN
        v_is_crit := true;
        v_base_gold := 500;
        v_gold := 500;
      END IF;
    END IF;
  END IF;

  IF v_record_found THEN
    UPDATE daily_records
      SET current_count = v_new_count,
          is_completed = v_is_completed,
          gold_earned = v_gold,
          updated_at = now()
      WHERE id = v_record.id;
  ELSE
    INSERT INTO daily_records (user_id, todo_id, record_date, current_count, is_completed, gold_earned)
    VALUES (p_user_id, p_todo_id, v_today, v_new_count, v_is_completed, v_gold);
  END IF;

  IF v_is_completed AND v_gold > 0 THEN
    UPDATE profiles
      SET gold = gold + v_gold,
          combo_count = CASE WHEN v_eligible THEN v_combo ELSE combo_count END,
          last_complete_at = CASE WHEN v_eligible THEN now() ELSE last_complete_at END
      WHERE id = p_user_id;
  END IF;

  IF v_is_completed AND v_todo.repeat_type IS NULL THEN
    UPDATE todos SET archived_at = next_kst_midnight() WHERE id = p_todo_id AND user_id = p_user_id;
  END IF;

  IF v_is_completed THEN
    SELECT COUNT(*) INTO v_after_completed
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id AND dr.record_date = v_today
      AND dr.is_completed = true AND t.type <> 'habit';
  ELSE
    v_after_completed := 0;
  END IF;

  RETURN json_build_object(
    'success', true,
    'completed', v_is_completed,
    'gold', v_gold,
    'baseGold', v_base_gold,
    'comboBonus', v_combo_bonus,
    'crit', v_is_crit,
    'combo', v_combo,
    'completedCount', v_after_completed,
    'dailyGoal', COALESCE(v_daily_goal, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_habit(p_user_id UUID, p_todo_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todo todos%ROWTYPE;
  v_record daily_records%ROWTYPE;
  v_record_found BOOLEAN;
  v_today DATE := kst_today();
  v_gold_per_action INT;
  v_daily_habit_gold INT;
  v_remaining_cap INT;
  v_gold INT;
  v_total_habit_gold INT;
BEGIN
  SELECT * INTO v_todo FROM todos WHERE id = p_todo_id AND user_id = p_user_id;
  IF NOT FOUND OR v_todo.type <> 'habit' THEN
    RETURN json_build_object('error', 'habit_not_found');
  END IF;

  v_gold_per_action := CASE WHEN v_todo.habit_type = 'positive' THEN 100 ELSE 50 END;

  SELECT COALESCE(SUM(dr.gold_earned), 0) INTO v_daily_habit_gold
  FROM daily_records dr
  JOIN todos t ON t.id = dr.todo_id
  WHERE dr.user_id = p_user_id AND dr.record_date = v_today AND t.type = 'habit';

  v_remaining_cap := 1000 - v_daily_habit_gold;
  v_gold := LEAST(v_gold_per_action, GREATEST(0, v_remaining_cap));

  SELECT * INTO v_record FROM daily_records
    WHERE todo_id = p_todo_id AND record_date = v_today;
  v_record_found := FOUND;

  IF v_record_found THEN
    UPDATE daily_records
      SET current_count = v_record.current_count + 1,
          gold_earned = v_record.gold_earned + v_gold,
          updated_at = now()
      WHERE id = v_record.id;
  ELSE
    INSERT INTO daily_records (user_id, todo_id, record_date, current_count, gold_earned)
    VALUES (p_user_id, p_todo_id, v_today, 1, v_gold);
  END IF;

  IF v_gold > 0 THEN
    UPDATE profiles SET gold = gold + v_gold WHERE id = p_user_id;
  END IF;

  v_total_habit_gold := v_daily_habit_gold + v_gold;

  RETURN json_build_object(
    'success', true,
    'gold', v_gold,
    'habitDailyGold', v_total_habit_gold,
    'habitDailyCap', 1000
  );
END;
$$;

-- record_guardian_growth: total_care 추가
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
