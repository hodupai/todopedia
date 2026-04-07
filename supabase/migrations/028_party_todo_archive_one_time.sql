-- 일회성(repeat_type IS NULL) 파티 투두도 일반 투두처럼 완료 후 다음 KST 자정에 archive 되도록 수정.
-- 버그: 자정이 지나면 record_date 필터로 인해 완료 표시가 풀리고, 투두는 사라지지도 않았음.
--
-- 방침:
--   - "다같이(collaborative)" 파티: 목표 인원 도달(v_all_done)했을 때 archive.
--   - "각자(individual)" 파티: 본인이 완료하면 즉시 archive
--     (각자 파티의 일회성 투두는 본인 1회 완료가 곧 그 투두의 완료로 간주).
--
-- 클라이언트는 archived_at IS NULL OR archived_at > now() 인 todo만 보여 주고,
-- 일회성 투두의 완료 상태는 record_date 무관하게 “내가 한 번이라도 완료했는가”로 판단한다.

ALTER TABLE public.party_todos
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS party_todos_archived_at_idx
  ON public.party_todos(party_id, archived_at);

CREATE OR REPLACE FUNCTION public.complete_party_todo(p_user_id UUID, p_party_todo_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_todo party_todos%ROWTYPE;
  v_party parties%ROWTYPE;
  v_today DATE;
  v_gold INTEGER := 0;
  v_daily_goal INTEGER;
  v_completed_count INTEGER;
  v_total_today INTEGER;
  v_nickname TEXT;
  v_all_done BOOLEAN := false;
  v_is_one_time BOOLEAN;
BEGIN
  v_today := kst_today();

  SELECT * INTO v_todo FROM party_todos WHERE id = p_party_todo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'todo_not_found'; END IF;

  v_is_one_time := v_todo.repeat_type IS NULL;

  SELECT * INTO v_party FROM parties WHERE id = v_todo.party_id;

  -- 이미 오늘 기여했는지 체크 (반복 투두 기준)
  -- 일회성은 record_date 무관하게 1회만 가능
  IF v_is_one_time THEN
    IF EXISTS (
      SELECT 1 FROM party_daily_records
      WHERE party_todo_id = p_party_todo_id AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'already_completed_today';
    END IF;
  ELSE
    IF EXISTS (
      SELECT 1 FROM party_daily_records
      WHERE party_todo_id = p_party_todo_id AND user_id = p_user_id AND record_date = v_today
    ) THEN
      RAISE EXCEPTION 'already_completed_today';
    END IF;
  END IF;

  SELECT nickname INTO v_nickname FROM profiles WHERE id = p_user_id;

  IF v_party.type = 'individual' THEN
    INSERT INTO party_daily_records (party_todo_id, user_id, record_date, is_completed)
    VALUES (p_party_todo_id, p_user_id, v_today, true);

    SELECT daily_goal INTO v_daily_goal FROM profiles WHERE id = p_user_id;
    SELECT COUNT(*) INTO v_completed_count FROM daily_records
    WHERE user_id = p_user_id AND record_date = v_today AND is_completed = true;
    SELECT COUNT(*) INTO v_total_today FROM party_daily_records pdr
    JOIN party_todos pt ON pt.id = pdr.party_todo_id
    JOIN parties p ON p.id = pt.party_id AND p.type = 'individual'
    WHERE pdr.user_id = p_user_id AND pdr.record_date = v_today AND pdr.is_completed = true
    AND pdr.party_todo_id != p_party_todo_id;

    IF (v_completed_count + v_total_today) < COALESCE(v_daily_goal, 0) THEN
      v_gold := 200;
    END IF;

    UPDATE party_daily_records SET gold_earned = v_gold
    WHERE party_todo_id = p_party_todo_id AND user_id = p_user_id AND record_date = v_today;

    IF v_gold > 0 THEN PERFORM add_gold(p_user_id, v_gold); END IF;

    INSERT INTO party_activity_log (party_id, user_id, action, content)
    VALUES (v_todo.party_id, p_user_id, 'completed', v_nickname || '님이 ' || v_todo.title || '을(를) 완료했습니다');

    -- 각자 파티 + 일회성: 본인 완료 = 투두 완료 → 다음 KST 자정에 archive
    IF v_is_one_time THEN
      UPDATE party_todos SET archived_at = next_kst_midnight() WHERE id = p_party_todo_id;
      v_all_done := true;
    END IF;

  ELSE
    -- 다같이 파티: 기여
    INSERT INTO party_daily_records (party_todo_id, user_id, record_date, is_completed)
    VALUES (p_party_todo_id, p_user_id, v_today, false);

    INSERT INTO party_activity_log (party_id, user_id, action, content)
    VALUES (v_todo.party_id, p_user_id, 'contributed', v_nickname || '님이 ' || v_todo.title || '에 기여했습니다');

    -- 일회성: 전체 누적 기여 수 / 반복: 오늘 기여 수
    IF v_is_one_time THEN
      SELECT COUNT(*) INTO v_total_today FROM party_daily_records
      WHERE party_todo_id = p_party_todo_id;
    ELSE
      SELECT COUNT(*) INTO v_total_today FROM party_daily_records
      WHERE party_todo_id = p_party_todo_id AND record_date = v_today;
    END IF;

    IF v_total_today >= v_todo.target_count THEN
      v_all_done := true;

      IF v_is_one_time THEN
        UPDATE party_daily_records SET is_completed = true
        WHERE party_todo_id = p_party_todo_id;
      ELSE
        UPDATE party_daily_records SET is_completed = true
        WHERE party_todo_id = p_party_todo_id AND record_date = v_today;
      END IF;

      DECLARE
        v_member RECORD;
        v_member_goal INTEGER;
        v_member_done INTEGER;
        v_member_gold INTEGER;
      BEGIN
        FOR v_member IN
          SELECT DISTINCT pdr.user_id FROM party_daily_records pdr
          WHERE pdr.party_todo_id = p_party_todo_id
            AND (v_is_one_time OR pdr.record_date = v_today)
        LOOP
          SELECT daily_goal INTO v_member_goal FROM profiles WHERE id = v_member.user_id;
          SELECT COUNT(*) INTO v_member_done FROM daily_records
          WHERE user_id = v_member.user_id AND record_date = v_today AND is_completed = true;

          v_member_gold := 0;
          IF v_member_done < COALESCE(v_member_goal, 0) THEN
            v_member_gold := 200;
          END IF;

          UPDATE party_daily_records SET gold_earned = v_member_gold
          WHERE party_todo_id = p_party_todo_id AND user_id = v_member.user_id
            AND (v_is_one_time OR record_date = v_today);

          IF v_member_gold > 0 THEN PERFORM add_gold(v_member.user_id, v_member_gold); END IF;
        END LOOP;
      END;

      INSERT INTO party_activity_log (party_id, user_id, action, content)
      VALUES (v_todo.party_id, p_user_id, 'completed', v_todo.title || ' 목표를 달성했습니다! 🎉');

      -- 다같이 + 일회성: 목표 달성 시 다음 KST 자정에 archive
      IF v_is_one_time THEN
        UPDATE party_todos SET archived_at = next_kst_midnight() WHERE id = p_party_todo_id;
      END IF;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'gold', v_gold,
    'all_done', v_all_done,
    'party_type', v_party.type
  );
END; $$;
