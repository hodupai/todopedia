-- get_user_streak: CURRENT_DATE(UTC)로 인한 KST 경계 버그 + 미완료 레코드도 카운트되는 문제 수정.
-- 1) kst_today() 사용
-- 2) is_completed=true 인 레코드만 카운트 (ensureDailyRecords가 미완료 레코드를 만들기 때문에
--    기존 함수는 "앱을 켠 날" 수를 세고 있었음 → 실제로는 줄어든 적이 없어 보이지만
--    오늘 아직 안 한 사용자에게 streak이 안 올라가는 식으로도 비치지 않음.
--    의도: "오늘부터 거꾸로 실제로 투두를 완료한 연속 일수")

CREATE OR REPLACE FUNCTION public.get_user_streak(p_user_id UUID)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streak INT := 0;
  v_today DATE := kst_today();
  v_check_date DATE := kst_today();
BEGIN
  LOOP
    IF EXISTS (
      SELECT 1 FROM daily_records
      WHERE user_id = p_user_id
        AND record_date = v_check_date
        AND is_completed = true
    ) THEN
      v_streak := v_streak + 1;
      v_check_date := v_check_date - INTERVAL '1 day';
    ELSE
      IF v_check_date = v_today AND v_streak = 0 THEN
        v_check_date := v_check_date - INTERVAL '1 day';
      ELSE
        EXIT;
      END IF;
    END IF;
  END LOOP;

  RETURN v_streak;
END;
$$;
