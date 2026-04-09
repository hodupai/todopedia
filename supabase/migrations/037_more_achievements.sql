-- 업적 20개 추가 + check_achievements RPC 확장 + gold_total 누적 버그 수정
--
-- gold_total은 기존에 profiles.gold (현재 잔액)을 봤지만 description은 "누적"이라고
-- 하고 있었음. daily_records.gold_earned의 양수 합으로 변경.
--
-- 신규 condition_type:
--   streak_days   — get_user_streak (연속 출석일)
--   habit_count   — 습관 daily_records.current_count 합산
--   heart_count   — wall_hearts 누적 (heart_first는 1회 단발 유지)
--   party_join    — party_members active
--   wall_post_first — wall_posts 작성 수

ALTER TABLE achievements DROP CONSTRAINT achievements_category_check;
ALTER TABLE achievements ADD CONSTRAINT achievements_category_check
  CHECK (category = ANY (ARRAY['general','guardian','item','todo','social','streak','habit']));

CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_achievement RECORD;
  v_count BIGINT;
  v_claimable TEXT[] := '{}';
BEGIN
  FOR v_achievement IN SELECT * FROM achievements ORDER BY sort_order LOOP
    IF EXISTS (SELECT 1 FROM user_achievements WHERE user_id = p_user_id AND achievement_id = v_achievement.id) THEN
      CONTINUE;
    END IF;

    v_count := 0;

    CASE v_achievement.condition_type
      WHEN 'signup' THEN
        IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN v_count := 1; END IF;
      WHEN 'admin' THEN CONTINUE;
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
      ELSE CONTINUE;
    END CASE;

    IF v_count >= v_achievement.condition_value THEN
      v_claimable := array_append(v_claimable, v_achievement.key);
    END IF;
  END LOOP;

  RETURN json_build_object('claimable', v_claimable);
END; $function$;

INSERT INTO achievements (key, name, description, category, condition_type, condition_value, sort_order) VALUES
  ('streak_3', '꾸준함의 시작', '3일 연속 출석했어요', 'streak', 'streak_days', 3, 50),
  ('streak_7', '일주일 챔피언', '7일 연속 출석했어요', 'streak', 'streak_days', 7, 51),
  ('streak_30', '한달 마스터', '30일 연속 출석했어요', 'streak', 'streak_days', 30, 52),
  ('streak_100', '백일 전설', '100일 연속 출석했어요', 'streak', 'streak_days', 100, 53),
  ('habit_10', '습관의 씨앗', '습관을 10회 기록했어요', 'habit', 'habit_count', 10, 60),
  ('habit_100', '습관의 힘', '습관을 100회 기록했어요', 'habit', 'habit_count', 100, 61),
  ('habit_500', '습관 마스터', '습관을 500회 기록했어요', 'habit', 'habit_count', 500, 62),
  ('todo_1000', '투두 천재', '투두를 1,000개 완료했어요', 'todo', 'todo_count', 1000, 33),
  ('todo_3000', '투두 신', '투두를 3,000개 완료했어요', 'todo', 'todo_count', 3000, 34),
  ('evolve_3', '초보 육성자', '가디언을 3회 진화시켰어요', 'guardian', 'evolve_count', 3, 14),
  ('evolve_5', '성장 가속', '가디언을 5회 진화시켰어요', 'guardian', 'evolve_count', 5, 15),
  ('evolve_25', '전설의 육성자', '가디언을 25회 진화시켰어요', 'guardian', 'evolve_count', 25, 16),
  ('item_200', '박물관장', '아이템 도감 200개를 채웠어요', 'item', 'item_collect', 200, 26),
  ('gold_100k', '거상', '누적 100,000G을 벌었어요', 'social', 'gold_total', 100000, 42),
  ('gold_500k', '재벌', '누적 500,000G을 벌었어요', 'social', 'gold_total', 500000, 43),
  ('gold_1m', '백만장자', '누적 1,000,000G을 벌었어요', 'social', 'gold_total', 1000000, 44),
  ('heart_10', '온정', '하트를 10회 보냈어요', 'social', 'heart_count', 10, 45),
  ('heart_100', '사랑꾼', '하트를 100회 보냈어요', 'social', 'heart_count', 100, 46),
  ('party_join', '함께하는 즐거움', '첫 파티에 가입했어요', 'social', 'party_join', 1, 47),
  ('wall_post_first', '작가의 시작', '첫 담벼락 글을 남겼어요', 'social', 'wall_post_first', 1, 48);
