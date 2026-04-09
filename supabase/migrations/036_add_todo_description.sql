-- 투두/파티 투두 상세 내역 필드 추가 (최대 500자, 줄바꿈만 지원, plain text)

ALTER TABLE public.todos ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.party_todos ADD COLUMN IF NOT EXISTS description TEXT;

-- 파티 투두 RPC 시그니처 확장 (description 추가)
CREATE OR REPLACE FUNCTION public.create_party_todo(
  p_user_id UUID, p_party_id UUID, p_title TEXT,
  p_target_count INTEGER DEFAULT 1,
  p_repeat_type TEXT DEFAULT NULL, p_repeat_days INTEGER[] DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_party parties%ROWTYPE; v_todo_id UUID;
BEGIN
  SELECT * INTO v_party FROM parties WHERE id = p_party_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'party_not_found'; END IF;

  IF v_party.type = 'collaborative' AND v_party.leader_id != p_user_id THEN
    RAISE EXCEPTION 'not_leader';
  END IF;

  IF v_party.type = 'individual' THEN p_target_count := 1; END IF;

  INSERT INTO party_todos (party_id, created_by, title, target_count, repeat_type, repeat_days, description)
  VALUES (p_party_id, p_user_id, p_title, p_target_count, p_repeat_type, p_repeat_days, NULLIF(TRIM(p_description), ''))
  RETURNING id INTO v_todo_id;

  INSERT INTO party_activity_log (party_id, user_id, action, content)
  VALUES (p_party_id, p_user_id, 'created_todo', p_title);

  RETURN json_build_object('success', true, 'todo_id', v_todo_id);
END; $$;

CREATE OR REPLACE FUNCTION public.update_party_todo(
  p_user_id UUID,
  p_party_todo_id UUID,
  p_title TEXT,
  p_target_count INTEGER DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_todo party_todos%ROWTYPE;
BEGIN
  SELECT * INTO v_todo FROM party_todos WHERE id = p_party_todo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'todo_not_found'; END IF;
  IF v_todo.created_by != p_user_id THEN RAISE EXCEPTION 'not_creator'; END IF;

  UPDATE party_todos
  SET title = p_title,
      target_count = COALESCE(p_target_count, target_count),
      description = NULLIF(TRIM(p_description), '')
  WHERE id = p_party_todo_id;

  RETURN json_build_object('success', true);
END; $$;
