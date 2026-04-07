-- 일회성 투두 완료 시 archive 시점 변경: "지금" → "다음 KST 자정"
-- 그날 하루는 목록에 보이고, 자정 지나면 자동으로 사라짐.
-- 쿼리는 archived_at IS NULL OR archived_at > now() 로 필터링.

CREATE OR REPLACE FUNCTION public.next_kst_midnight()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT ((kst_today() + 1)::TIMESTAMP) AT TIME ZONE 'Asia/Seoul';
$$;

-- complete_todo / complete_loop 함수는 014/013 마이그레이션에서 정의되었고
-- 이 마이그레이션에서 next_kst_midnight()를 호출하도록 본문이 갱신됨.
-- (실제 함수 본문은 mcp 마이그레이션 archive_at_next_kst_midnight 참고)

-- post_daily_goal_wall: timezone 비교 버그 수정 (KST DATE 기준으로 dedupe)
CREATE OR REPLACE FUNCTION public.post_daily_goal_wall(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE;
BEGIN
  v_today := kst_today();

  IF EXISTS (
    SELECT 1 FROM wall_posts
    WHERE user_id = p_user_id
      AND type = 'daily_goal'
      AND (created_at AT TIME ZONE 'Asia/Seoul')::DATE = v_today
  ) THEN
    RETURN;
  END IF;

  PERFORM create_wall_post(p_user_id, 'daily_goal', json_build_object(
    'date', v_today
  )::jsonb);
END;
$$;
