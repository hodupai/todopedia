-- claim_achievement RPC가 신규 condition_type을 모르고 unknown_condition 예외를
-- 던지던 버그 수정 (check_achievements와 동일한 분기로 통일).
-- gold_total 누적 계산 버그도 같이 수정.
--
-- 추가로 신규 업적 7개에 타이틀 부여 (claimers = 0):
--   streak_30, streak_100, habit_100, habit_500, todo_3000, evolve_25, gold_1m

CREATE OR REPLACE FUNCTION public.claim_achievement(p_user_id uuid, p_achievement_key text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_achievement achievements%ROWTYPE;
  v_count BIGINT;
  v_current_title TEXT;
BEGIN
  SELECT * INTO v_achievement FROM achievements WHERE key = p_achievement_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'achievement_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_id = v_achievement.id) THEN
    RAISE EXCEPTION 'already_claimed';
  END IF;

  v_count := 0;
  CASE v_achievement.condition_type
    WHEN 'signup' THEN
      IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN v_count := 1; END IF;
    WHEN 'admin' THEN RAISE EXCEPTION 'admin_only';
    WHEN 'guardian_collect' THEN
      SELECT COUNT(DISTINCT guardian_type_id) INTO v_count FROM collection WHERE user_id = p_user_id AND season_id = 1;
    WHEN 'evolve_count' THEN
      SELECT COUNT(*) INTO v_count FROM collection WHERE user_id = p_user_id;
    WHEN 'item_collect' THEN
      SELECT COUNT(*) INTO v_count FROM item_collection WHERE user_id = p_user_id;
    WHEN 'todo_count' THEN
      SELECT COUNT(*) INTO v_count FROM daily_records WHERE user_id = p_user_id AND is_completed = true;
    WHEN 'heart_first' THEN
      SELECT COUNT(*) INTO v_count FROM wall_hearts WHERE user_id = p_user_id;
    WHEN 'heart_count' THEN
      SELECT COUNT(*) INTO v_count FROM wall_hearts WHERE user_id = p_user_id;
    WHEN 'gold_total' THEN
      SELECT COALESCE(SUM(GREATEST(gold_earned, 0)), 0) INTO v_count FROM daily_records WHERE user_id = p_user_id;
    WHEN 'streak_days' THEN
      SELECT COALESCE((get_user_streak(p_user_id))::int, 0) INTO v_count;
    WHEN 'habit_count' THEN
      SELECT COALESCE(SUM(dr.current_count), 0) INTO v_count
      FROM daily_records dr
      JOIN todos t ON t.id = dr.todo_id
      WHERE dr.user_id = p_user_id AND t.type = 'habit';
    WHEN 'party_join' THEN
      SELECT COUNT(*) INTO v_count FROM party_members WHERE user_id = p_user_id AND status = 'active';
    WHEN 'wall_post_first' THEN
      SELECT COUNT(*) INTO v_count FROM wall_posts WHERE user_id = p_user_id;
    ELSE RAISE EXCEPTION 'unknown_condition';
  END CASE;

  IF v_count < v_achievement.condition_value THEN
    RAISE EXCEPTION 'condition_not_met';
  END IF;

  INSERT INTO user_achievements (user_id, achievement_id) VALUES (p_user_id, v_achievement.id);

  IF v_achievement.title_text IS NOT NULL THEN
    SELECT title INTO v_current_title FROM profiles WHERE id = p_user_id;
    IF v_current_title IS NULL THEN
      UPDATE profiles SET title = v_achievement.title_text, updated_at = now() WHERE id = p_user_id;
    END IF;
  END IF;

  PERFORM create_wall_post(p_user_id, 'achievement', json_build_object(
    'achievement_name', v_achievement.name, 'achievement_key', v_achievement.key
  )::jsonb);

  RETURN json_build_object('success', true, 'name', v_achievement.name, 'title_text', v_achievement.title_text);
END; $function$;

UPDATE achievements SET title_text = '꾸준한'    WHERE key = 'streak_30';
UPDATE achievements SET title_text = '백일의'    WHERE key = 'streak_100';
UPDATE achievements SET title_text = '습관러'    WHERE key = 'habit_100';
UPDATE achievements SET title_text = '습관신'    WHERE key = 'habit_500';
UPDATE achievements SET title_text = '투두신'    WHERE key = 'todo_3000';
UPDATE achievements SET title_text = '전설의'    WHERE key = 'evolve_25';
UPDATE achievements SET title_text = '백만장자'  WHERE key = 'gold_1m';
