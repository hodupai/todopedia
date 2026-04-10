-- complete_todo / complete_loop의 v_today를 CURRENT_DATE(UTC) → kst_today()(KST)로 통일.
-- 027에서 kst_today()로 수정했으나 033에서 재정의하면서 CURRENT_DATE로 회귀.
-- 이로 인해 UTC 0시 이후~KST 9시 이전 구간의 유저(미국 등)가
-- 투두를 완료해도 UTC 날짜로 record가 쓰여서,
-- KST 날짜 기준인 getTodoPageData/get_user_streak에서 못 찾는 버그.

CREATE OR REPLACE FUNCTION public.complete_todo(p_user_id UUID, p_todo_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todo todos%ROWTYPE;
  v_record daily_records%ROWTYPE;
  v_record_exists BOOLEAN;
  v_today DATE := kst_today();
  v_daily_goal INT;
  v_completed_count INT;
  v_party_completed INT;
  v_new_completed BOOLEAN;
  v_base_gold INT := 0;
  v_combo_bonus INT := 0;
  v_gold_delta INT := 0;
  v_is_one_time BOOLEAN;
  v_after_completed INT;
  v_after_party INT;
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
  v_record_exists := FOUND;

  IF v_record_exists THEN
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

    SELECT COUNT(*) INTO v_party_completed
    FROM party_daily_records
    WHERE user_id = p_user_id AND record_date = v_today AND is_completed = true;

    v_eligible_for_gold := ((v_completed_count + v_party_completed) < v_daily_goal);

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

  IF v_record_exists THEN
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

  IF v_is_one_time AND v_new_completed THEN
    UPDATE todos SET archived_at = now() WHERE id = p_todo_id AND user_id = p_user_id;
  END IF;

  SELECT COUNT(*) INTO v_after_completed
  FROM daily_records dr
  JOIN todos t ON t.id = dr.todo_id
  WHERE dr.user_id = p_user_id AND dr.record_date = v_today
    AND dr.is_completed = true AND t.type <> 'habit';

  SELECT COUNT(*) INTO v_after_party
  FROM party_daily_records
  WHERE user_id = p_user_id AND record_date = v_today AND is_completed = true;

  RETURN json_build_object(
    'success', true,
    'completed', v_new_completed,
    'gold', v_gold_delta,
    'baseGold', v_base_gold,
    'comboBonus', v_combo_bonus,
    'crit', v_is_crit,
    'combo', v_combo,
    'completedCount', v_after_completed + v_after_party,
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
  v_record_exists BOOLEAN;
  v_today DATE := kst_today();
  v_new_count INT;
  v_is_completed BOOLEAN;
  v_base_gold INT := 0;
  v_combo_bonus INT := 0;
  v_gold INT := 0;
  v_daily_goal INT;
  v_completed_count INT;
  v_party_completed INT;
  v_after_completed INT;
  v_after_party INT;
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
  v_record_exists := FOUND;

  IF v_record_exists AND v_record.is_completed THEN
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

    SELECT COUNT(*) INTO v_party_completed
    FROM party_daily_records
    WHERE user_id = p_user_id AND record_date = v_today AND is_completed = true;

    v_eligible := ((v_completed_count + v_party_completed) < v_daily_goal);

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

  IF v_record_exists THEN
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
    UPDATE todos SET archived_at = now() WHERE id = p_todo_id AND user_id = p_user_id;
  END IF;

  IF v_is_completed THEN
    SELECT COUNT(*) INTO v_after_completed
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id AND dr.record_date = v_today
      AND dr.is_completed = true AND t.type <> 'habit';

    SELECT COUNT(*) INTO v_after_party
    FROM party_daily_records
    WHERE user_id = p_user_id AND record_date = v_today AND is_completed = true;
  ELSE
    v_after_completed := 0;
    v_after_party := 0;
  END IF;

  RETURN json_build_object(
    'success', true,
    'completed', v_is_completed,
    'gold', v_gold,
    'baseGold', v_base_gold,
    'comboBonus', v_combo_bonus,
    'crit', v_is_crit,
    'combo', v_combo,
    'completedCount', v_after_completed + v_after_party,
    'dailyGoal', COALESCE(v_daily_goal, 0)
  );
END;
$$;
