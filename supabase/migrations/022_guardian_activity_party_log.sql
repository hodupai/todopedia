-- 가디 페이지 "오늘의 기록"에 파티 활동 로그(가입/생성/타인의 완료 등) 포함
-- party_activity_log를 활용해 누가 가입했는지, 누가 투두를 만들었는지 등을 표시

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

  -- activity: 여러 소스 union → time desc 정렬
  SELECT COALESCE(json_agg(row_to_json(x) ORDER BY x.time DESC), '[]'::json) INTO v_activity
  FROM (
    -- 일반 투두 (본인)
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

    -- 본인의 파티 투두 완료 (골드 표시 위해 별도 소스 유지)
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

    -- 파티 활동 로그: 본인이 속한 파티의 오늘 이벤트
    -- (본인의 completed/contributed는 위에서 이미 표시했으므로 제외)
    SELECT 'party'::TEXT,
           '[' || p.name || '] ' || pal.content,
           0,
           pal.created_at
    FROM party_activity_log pal
    JOIN parties p ON p.id = pal.party_id
    JOIN party_members pm ON pm.party_id = pal.party_id
                          AND pm.user_id = p_user_id
                          AND pm.status = 'active'
    WHERE pal.created_at >= v_today_start
      AND NOT (pal.user_id = p_user_id AND pal.action IN ('completed', 'contributed'))

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

    -- 하트 받음 (본인 글에 타인이 누른 것)
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
