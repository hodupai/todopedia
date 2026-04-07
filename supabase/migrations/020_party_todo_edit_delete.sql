-- 파티 투두 수정/삭제 (생성자만)

CREATE OR REPLACE FUNCTION public.update_party_todo(
  p_user_id UUID,
  p_party_todo_id UUID,
  p_title TEXT,
  p_target_count INTEGER DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_todo party_todos%ROWTYPE;
BEGIN
  SELECT * INTO v_todo FROM party_todos WHERE id = p_party_todo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'todo_not_found'; END IF;
  IF v_todo.created_by != p_user_id THEN RAISE EXCEPTION 'not_creator'; END IF;

  UPDATE party_todos
  SET title = p_title,
      target_count = COALESCE(p_target_count, target_count)
  WHERE id = p_party_todo_id;

  RETURN json_build_object('success', true);
END; $$;

CREATE OR REPLACE FUNCTION public.delete_party_todo(
  p_user_id UUID,
  p_party_todo_id UUID
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_todo party_todos%ROWTYPE;
BEGIN
  SELECT * INTO v_todo FROM party_todos WHERE id = p_party_todo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'todo_not_found'; END IF;
  IF v_todo.created_by != p_user_id THEN RAISE EXCEPTION 'not_creator'; END IF;

  DELETE FROM party_todos WHERE id = p_party_todo_id;

  RETURN json_build_object('success', true);
END; $$;
