-- ============================================
-- 핫 액션을 PL/pgSQL RPC로 통합 (라운드트립 6+회 → 1회)
-- ============================================
-- complete_todo, complete_loop, record_habit:
-- 기존 server action이 6~9개의 순차 쿼리를 했지만, 이제 1번의 RPC로 처리.
-- 모든 로직(골드 지급, 일일 상한, 일회성 archive 등)을 SQL 안에서 수행.

-- ── 일반 투두 토글 ──
CREATE OR REPLACE FUNCTION public.complete_todo(p_user_id UUID, p_todo_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todo todos%ROWTYPE;
  v_record daily_records%ROWTYPE;
  v_today DATE := CURRENT_DATE;
  v_daily_goal INT;
  v_completed_count INT;
  v_new_completed BOOLEAN;
  v_gold_delta INT := 0;
  v_is_one_time BOOLEAN;
  v_after_completed INT;
BEGIN
  SELECT * INTO v_todo FROM todos WHERE id = p_todo_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'todo_not_found');
  END IF;

  v_is_one_time := (v_todo.type <> 'habit' AND v_todo.repeat_type IS NULL);

  SELECT daily_goal INTO v_daily_goal FROM profiles WHERE id = p_user_id;
  v_daily_goal := COALESCE(v_daily_goal, 0);

  SELECT * INTO v_record FROM daily_records
    WHERE todo_id = p_todo_id AND record_date = v_today;

  IF FOUND THEN
    -- 토글
    v_new_completed := NOT v_record.is_completed;

    IF v_new_completed THEN
      SELECT COUNT(*) INTO v_completed_count
      FROM daily_records dr
      JOIN todos t ON t.id = dr.todo_id
      WHERE dr.user_id = p_user_id AND dr.record_date = v_today
        AND dr.is_completed = true AND t.type <> 'habit';
      IF v_completed_count < v_daily_goal THEN
        v_gold_delta := 200;
      END IF;
    ELSE
      v_gold_delta := -COALESCE(v_record.gold_earned, 0);
    END IF;

    UPDATE daily_records
      SET is_completed = v_new_completed,
          gold_earned = CASE WHEN v_new_completed AND v_gold_delta > 0 THEN 200 ELSE 0 END,
          updated_at = now()
      WHERE id = v_record.id;
  ELSE
    -- 새 레코드 (완료)
    v_new_completed := true;
    SELECT COUNT(*) INTO v_completed_count
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id AND dr.record_date = v_today
      AND dr.is_completed = true AND t.type <> 'habit';
    IF v_completed_count < v_daily_goal THEN
      v_gold_delta := 200;
    END IF;

    INSERT INTO daily_records (user_id, todo_id, record_date, is_completed, gold_earned)
    VALUES (p_user_id, p_todo_id, v_today, true, v_gold_delta);
  END IF;

  -- 골드 적용
  IF v_gold_delta <> 0 THEN
    UPDATE profiles SET gold = GREATEST(0, gold + v_gold_delta) WHERE id = p_user_id;
  END IF;

  -- 일회성 완료 → archive
  IF v_is_one_time AND v_new_completed THEN
    UPDATE todos SET archived_at = now() WHERE id = p_todo_id AND user_id = p_user_id;
  END IF;

  -- 완료 후 누적
  SELECT COUNT(*) INTO v_after_completed
  FROM daily_records dr
  JOIN todos t ON t.id = dr.todo_id
  WHERE dr.user_id = p_user_id AND dr.record_date = v_today
    AND dr.is_completed = true AND t.type <> 'habit';

  RETURN json_build_object(
    'success', true,
    'completed', v_new_completed,
    'gold', v_gold_delta,
    'completedCount', v_after_completed,
    'dailyGoal', v_daily_goal
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_todo(UUID, UUID) TO authenticated;

-- ── 루프 카운트 증가 ──
CREATE OR REPLACE FUNCTION public.complete_loop(p_user_id UUID, p_todo_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todo todos%ROWTYPE;
  v_record daily_records%ROWTYPE;
  v_today DATE := CURRENT_DATE;
  v_new_count INT;
  v_is_completed BOOLEAN;
  v_gold INT := 0;
  v_daily_goal INT;
  v_completed_count INT;
  v_after_completed INT;
BEGIN
  SELECT * INTO v_todo FROM todos WHERE id = p_todo_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'todo_not_found');
  END IF;

  SELECT * INTO v_record FROM daily_records
    WHERE todo_id = p_todo_id AND record_date = v_today;

  IF FOUND AND v_record.is_completed THEN
    RETURN json_build_object('error', 'already_completed');
  END IF;

  v_new_count := COALESCE(v_record.current_count, 0) + 1;
  v_is_completed := v_new_count >= COALESCE(v_todo.target_count, 1);

  IF v_is_completed THEN
    SELECT daily_goal INTO v_daily_goal FROM profiles WHERE id = p_user_id;
    v_daily_goal := COALESCE(v_daily_goal, 0);
    SELECT COUNT(*) INTO v_completed_count
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id AND dr.record_date = v_today
      AND dr.is_completed = true AND t.type <> 'habit';
    IF v_completed_count < v_daily_goal THEN
      v_gold := 200;
    END IF;
  END IF;

  IF FOUND THEN
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

  IF v_gold > 0 THEN
    UPDATE profiles SET gold = gold + v_gold WHERE id = p_user_id;
  END IF;

  -- 일회성 루프 완료 → archive
  IF v_is_completed AND v_todo.repeat_type IS NULL THEN
    UPDATE todos SET archived_at = now() WHERE id = p_todo_id AND user_id = p_user_id;
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
    'completedCount', v_after_completed,
    'dailyGoal', COALESCE(v_daily_goal, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_loop(UUID, UUID) TO authenticated;

-- ── 습관 기록 ──
CREATE OR REPLACE FUNCTION public.record_habit(p_user_id UUID, p_todo_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_todo todos%ROWTYPE;
  v_record daily_records%ROWTYPE;
  v_today DATE := CURRENT_DATE;
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

  -- 오늘 습관으로 받은 골드 합계
  SELECT COALESCE(SUM(dr.gold_earned), 0) INTO v_daily_habit_gold
  FROM daily_records dr
  JOIN todos t ON t.id = dr.todo_id
  WHERE dr.user_id = p_user_id AND dr.record_date = v_today AND t.type = 'habit';

  v_remaining_cap := 1000 - v_daily_habit_gold;
  v_gold := LEAST(v_gold_per_action, GREATEST(0, v_remaining_cap));

  SELECT * INTO v_record FROM daily_records
    WHERE todo_id = p_todo_id AND record_date = v_today;

  IF FOUND THEN
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

GRANT EXECUTE ON FUNCTION public.record_habit(UUID, UUID) TO authenticated;
