-- 헤더에 노출할 연속 접속(streak) 일수 계산 함수
-- "오늘부터 거꾸로 daily_records가 존재하는 연속 일수"
-- 오늘 아직 기록이 없으면 어제부터 카운트 (오늘 아직 안 한 사용자도 streak 유지)
CREATE OR REPLACE FUNCTION public.get_user_streak(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak INT := 0;
  v_check_date DATE := CURRENT_DATE;
BEGIN
  LOOP
    IF EXISTS (
      SELECT 1 FROM daily_records
      WHERE user_id = p_user_id AND record_date = v_check_date
    ) THEN
      v_streak := v_streak + 1;
      v_check_date := v_check_date - INTERVAL '1 day';
    ELSE
      IF v_check_date = CURRENT_DATE AND v_streak = 0 THEN
        v_check_date := v_check_date - INTERVAL '1 day';
      ELSE
        EXIT;
      END IF;
    END IF;
  END LOOP;

  RETURN v_streak;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_streak(UUID) TO authenticated;
