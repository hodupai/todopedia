-- 성능 최적화 3종:
--
-- 1. complete_todo/complete_loop: 골드cap 판정 + completedCount 리턴에
--    동일 쿼리를 2회 실행하던 것을 1회로. 완료 시 +1, 취소 시 -1 산술.
--
-- 2. check_achievements: 루프 내에서 condition_type마다 개별 COUNT 실행
--    → 루프 진입 전 모든 카운트를 1회씩 사전 계산. 37개 업적 루프 시
--    기존 최대 37*14=518 쿼리 → 10+37(행비교)으로 감소.
--
-- 3. reorder_todos: N개 투두 = N회 개별 UPDATE → unnest 1회 배치.

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

  SELECT COUNT(*) INTO v_completed_count
  FROM daily_records dr
  JOIN todos t ON t.id = dr.todo_id
  WHERE dr.user_id = p_user_id AND dr.record_date = v_today
    AND dr.is_completed = true AND t.type <> 'habit';

  SELECT COUNT(*) INTO v_party_completed
  FROM party_daily_records
  WHERE user_id = p_user_id AND record_date = v_today AND is_completed = true;

  IF v_new_completed THEN
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

  RETURN json_build_object(
    'success', true,
    'completed', v_new_completed,
    'gold', v_gold_delta,
    'baseGold', v_base_gold,
    'comboBonus', v_combo_bonus,
    'crit', v_is_crit,
    'combo', v_combo,
    'completedCount', v_completed_count + v_party_completed + CASE WHEN v_new_completed THEN 1 ELSE -1 END,
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

  RETURN json_build_object(
    'success', true,
    'completed', v_is_completed,
    'gold', v_gold,
    'baseGold', v_base_gold,
    'comboBonus', v_combo_bonus,
    'crit', v_is_crit,
    'combo', v_combo,
    'completedCount', COALESCE(v_completed_count, 0) + COALESCE(v_party_completed, 0) + CASE WHEN v_is_completed THEN 1 ELSE 0 END,
    'dailyGoal', COALESCE(v_daily_goal, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_todos(p_user_id UUID, p_ids UUID[])
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE todos t
  SET sort_order = sub.new_order
  FROM (SELECT id, ROW_NUMBER() OVER () AS new_order FROM unnest(p_ids) AS id) sub
  WHERE t.id = sub.id AND t.user_id = p_user_id;

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_achievement RECORD;
  v_claimable TEXT[] := '{}';
  v_todo_count BIGINT;
  v_guardian_collect BIGINT;
  v_evolve_count BIGINT;
  v_item_collect BIGINT;
  v_heart_count BIGINT;
  v_gold_total BIGINT;
  v_streak BIGINT;
  v_habit_count BIGINT;
  v_party_count BIGINT;
  v_wall_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_todo_count FROM daily_records WHERE user_id = p_user_id AND is_completed = true;
  SELECT COUNT(DISTINCT guardian_type_id) INTO v_guardian_collect FROM collection WHERE user_id = p_user_id AND season_id = 1;
  SELECT COUNT(*) INTO v_evolve_count FROM collection WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_item_collect FROM item_collection WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_heart_count FROM wall_hearts WHERE user_id = p_user_id;
  SELECT COALESCE(SUM(GREATEST(gold_earned, 0)), 0) INTO v_gold_total FROM daily_records WHERE user_id = p_user_id;
  SELECT COALESCE((get_user_streak(p_user_id))::int, 0) INTO v_streak;
  SELECT COALESCE(SUM(dr.current_count), 0) INTO v_habit_count
    FROM daily_records dr JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id AND t.type = 'habit';
  SELECT COUNT(*) INTO v_party_count FROM party_members WHERE user_id = p_user_id AND status = 'active';
  SELECT COUNT(*) INTO v_wall_count FROM wall_posts WHERE user_id = p_user_id;

  FOR v_achievement IN
    SELECT a.* FROM achievements a
    WHERE NOT EXISTS (SELECT 1 FROM user_achievements ua WHERE ua.user_id = p_user_id AND ua.achievement_id = a.id)
    ORDER BY a.sort_order
  LOOP
    CASE v_achievement.condition_type
      WHEN 'signup' THEN
        v_claimable := array_append(v_claimable, v_achievement.key);
        CONTINUE;
      WHEN 'admin' THEN CONTINUE;
      WHEN 'todo_count' THEN
        IF v_todo_count >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      WHEN 'guardian_collect' THEN
        IF v_guardian_collect >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      WHEN 'evolve_count' THEN
        IF v_evolve_count >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      WHEN 'item_collect' THEN
        IF v_item_collect >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      WHEN 'heart_first' THEN
        IF v_heart_count >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      WHEN 'heart_count' THEN
        IF v_heart_count >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      WHEN 'gold_total' THEN
        IF v_gold_total >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      WHEN 'streak_days' THEN
        IF v_streak >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      WHEN 'habit_count' THEN
        IF v_habit_count >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      WHEN 'party_join' THEN
        IF v_party_count >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      WHEN 'wall_post_first' THEN
        IF v_wall_count >= v_achievement.condition_value THEN v_claimable := array_append(v_claimable, v_achievement.key); END IF;
      ELSE NULL;
    END CASE;
  END LOOP;

  RETURN json_build_object('claimable', v_claimable);
END; $function$;
