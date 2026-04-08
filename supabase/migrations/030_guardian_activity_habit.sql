-- 가디 페이지 "오늘의 기록"에 습관(habit) 활동 추가
-- daily_records의 habit 타입 + current_count != 0 인 행을 표시

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

  SELECT COALESCE(json_agg(DISTINCT cl.category), '[]'::json) INTO v_care
  FROM care_log cl
  WHERE cl.user_id = p_user_id AND cl.used_date = v_today;

  SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.time DESC), '[]'::json) INTO v_activity
  FROM (
    -- 일반/루프 투두 완료
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

    -- 습관 기록 (긍정/부정)
    SELECT CASE WHEN t.habit_type = 'positive' THEN 'habit_pos' ELSE 'habit_neg' END,
           t.title || ' (' ||
             CASE WHEN t.habit_type = 'positive' THEN '+' ELSE '-' END ||
             dr.current_count::text || ')',
           COALESCE(dr.gold_earned, 0),
           dr.updated_at
    FROM daily_records dr
    JOIN todos t ON t.id = dr.todo_id
    WHERE dr.user_id = p_user_id
      AND dr.record_date = v_today
      AND t.type = 'habit'
      AND dr.current_count > 0

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
