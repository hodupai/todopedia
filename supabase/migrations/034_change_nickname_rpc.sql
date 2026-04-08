-- 닉네임 변경 RPC: 2000G 차감 + 유니크 체크 + 원자적 업데이트
CREATE OR REPLACE FUNCTION public.change_nickname(
  p_user_id UUID,
  p_nickname TEXT,
  p_cost INT DEFAULT 2000
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gold INT;
  v_current TEXT;
  v_exists BOOLEAN;
BEGIN
  p_nickname := TRIM(p_nickname);
  IF p_nickname IS NULL OR LENGTH(p_nickname) = 0 THEN
    RETURN json_build_object('error', 'empty_nickname');
  END IF;
  IF LENGTH(p_nickname) > 20 THEN
    RETURN json_build_object('error', 'too_long');
  END IF;

  SELECT gold, nickname INTO v_gold, v_current
  FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'profile_not_found');
  END IF;

  IF v_current = p_nickname THEN
    RETURN json_build_object('error', 'same_nickname');
  END IF;
  IF v_gold < p_cost THEN
    RETURN json_build_object('error', 'insufficient_gold');
  END IF;

  SELECT EXISTS(SELECT 1 FROM profiles WHERE nickname = p_nickname) INTO v_exists;
  IF v_exists THEN
    RETURN json_build_object('error', 'nickname_taken');
  END IF;

  UPDATE profiles
    SET nickname = p_nickname,
        gold = gold - p_cost,
        updated_at = now()
    WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'nickname', p_nickname, 'gold', v_gold - p_cost);
END;
$$;
