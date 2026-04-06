-- ============================================================
-- 009: Party System (파티 퀘스트)
-- 각자/다같이 파티 + 파티 투두 + 활동 기록
-- ============================================================

-- ── 파티 ──
CREATE TABLE public.parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('individual','collaborative')),
  leader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parties_select_member" ON public.parties FOR SELECT USING (
  EXISTS (SELECT 1 FROM party_members pm WHERE pm.party_id = id AND pm.user_id = auth.uid())
);

-- ── 파티원 ──
CREATE TABLE public.party_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active')),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(party_id, user_id)
);

ALTER TABLE public.party_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "party_members_select_own" ON public.party_members FOR SELECT USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM party_members pm2 WHERE pm2.party_id = party_id AND pm2.user_id = auth.uid() AND pm2.status = 'active'
  )
);

-- ── 파티 투두 ──
CREATE TABLE public.party_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_count INTEGER NOT NULL DEFAULT 1,  -- 다같이: 목표 횟수, 각자: 항상 1
  repeat_type TEXT CHECK (repeat_type IN ('daily','weekly','monthly')),
  repeat_days INTEGER[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.party_todos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "party_todos_select_member" ON public.party_todos FOR SELECT USING (
  EXISTS (SELECT 1 FROM party_members pm WHERE pm.party_id = party_id AND pm.user_id = auth.uid() AND pm.status = 'active')
);

-- ── 파티 일일 기록 ──
CREATE TABLE public.party_daily_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_todo_id UUID NOT NULL REFERENCES public.party_todos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  gold_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(party_todo_id, user_id, record_date)
);

ALTER TABLE public.party_daily_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "party_daily_records_select" ON public.party_daily_records FOR SELECT USING (
  auth.uid() = user_id
);

-- ── 파티 활동 기록 ──
CREATE TABLE public.party_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- 'completed', 'contributed', 'joined', 'left', 'kicked', 'created_todo'
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.party_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "party_activity_log_select_member" ON public.party_activity_log FOR SELECT USING (
  EXISTS (SELECT 1 FROM party_members pm WHERE pm.party_id = party_id AND pm.user_id = auth.uid() AND pm.status = 'active')
);

CREATE INDEX party_activity_log_party ON public.party_activity_log(party_id, created_at DESC);

-- ============================================================
-- RPC Functions
-- ============================================================

-- ── 파티 생성 ──
CREATE OR REPLACE FUNCTION public.create_party(p_user_id UUID, p_name TEXT, p_type TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_party_count INTEGER;
  v_party_id UUID;
BEGIN
  IF p_type NOT IN ('individual','collaborative') THEN RAISE EXCEPTION 'invalid_type'; END IF;

  SELECT COUNT(*) INTO v_party_count FROM party_members
  WHERE user_id = p_user_id AND status = 'active';
  IF v_party_count >= 5 THEN RAISE EXCEPTION 'max_parties_reached'; END IF;

  INSERT INTO parties (name, type, leader_id) VALUES (p_name, p_type, p_user_id) RETURNING id INTO v_party_id;
  INSERT INTO party_members (party_id, user_id, status, joined_at) VALUES (v_party_id, p_user_id, 'active', now());

  RETURN json_build_object('success', true, 'party_id', v_party_id);
END; $$;

-- ── 파티원 초대 (닉네임으로) ──
CREATE OR REPLACE FUNCTION public.invite_to_party(p_user_id UUID, p_party_id UUID, p_nickname TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_party parties%ROWTYPE;
  v_target_id UUID;
  v_target_count INTEGER;
BEGIN
  SELECT * INTO v_party FROM parties WHERE id = p_party_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'party_not_found'; END IF;
  IF v_party.leader_id != p_user_id THEN RAISE EXCEPTION 'not_leader'; END IF;

  SELECT id INTO v_target_id FROM profiles WHERE nickname = p_nickname;
  IF NOT FOUND THEN RAISE EXCEPTION 'user_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM party_members WHERE party_id = p_party_id AND user_id = v_target_id) THEN
    RAISE EXCEPTION 'already_member';
  END IF;

  SELECT COUNT(*) INTO v_target_count FROM party_members WHERE user_id = v_target_id AND status = 'active';
  IF v_target_count >= 5 THEN RAISE EXCEPTION 'target_max_parties'; END IF;

  INSERT INTO party_members (party_id, user_id, status) VALUES (p_party_id, v_target_id, 'pending');
  RETURN json_build_object('success', true, 'invited_user', p_nickname);
END; $$;

-- ── 초대 수락 ──
CREATE OR REPLACE FUNCTION public.accept_party_invite(p_user_id UUID, p_party_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_party_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_party_count FROM party_members WHERE user_id = p_user_id AND status = 'active';
  IF v_party_count >= 5 THEN RAISE EXCEPTION 'max_parties_reached'; END IF;

  UPDATE party_members SET status = 'active', joined_at = now()
  WHERE party_id = p_party_id AND user_id = p_user_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;

  INSERT INTO party_activity_log (party_id, user_id, action, content)
  VALUES (p_party_id, p_user_id, 'joined', '파티에 참가했습니다');

  RETURN json_build_object('success', true);
END; $$;

-- ── 초대 거절 ──
CREATE OR REPLACE FUNCTION public.decline_party_invite(p_user_id UUID, p_party_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM party_members WHERE party_id = p_party_id AND user_id = p_user_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  RETURN json_build_object('success', true);
END; $$;

-- ── 파티원 추방 (파티장만) ──
CREATE OR REPLACE FUNCTION public.kick_party_member(p_user_id UUID, p_party_id UUID, p_target_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_party parties%ROWTYPE; v_nickname TEXT;
BEGIN
  SELECT * INTO v_party FROM parties WHERE id = p_party_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'party_not_found'; END IF;
  IF v_party.leader_id != p_user_id THEN RAISE EXCEPTION 'not_leader'; END IF;
  IF p_target_id = p_user_id THEN RAISE EXCEPTION 'cannot_kick_self'; END IF;

  DELETE FROM party_members WHERE party_id = p_party_id AND user_id = p_target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'member_not_found'; END IF;

  SELECT nickname INTO v_nickname FROM profiles WHERE id = p_target_id;
  INSERT INTO party_activity_log (party_id, user_id, action, content)
  VALUES (p_party_id, p_target_id, 'kicked', v_nickname || '님이 추방되었습니다');

  RETURN json_build_object('success', true);
END; $$;

-- ── 파티 탈퇴 ──
CREATE OR REPLACE FUNCTION public.leave_party(p_user_id UUID, p_party_id UUID)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_party parties%ROWTYPE; v_nickname TEXT;
BEGIN
  SELECT * INTO v_party FROM parties WHERE id = p_party_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'party_not_found'; END IF;
  IF v_party.leader_id = p_user_id THEN RAISE EXCEPTION 'leader_cannot_leave'; END IF;

  DELETE FROM party_members WHERE party_id = p_party_id AND user_id = p_user_id;
  SELECT nickname INTO v_nickname FROM profiles WHERE id = p_user_id;
  INSERT INTO party_activity_log (party_id, user_id, action, content)
  VALUES (p_party_id, p_user_id, 'left', v_nickname || '님이 파티를 떠났습니다');

  RETURN json_build_object('success', true);
END; $$;

-- ── 파티 투두 생성 ──
CREATE OR REPLACE FUNCTION public.create_party_todo(
  p_user_id UUID, p_party_id UUID, p_title TEXT,
  p_target_count INTEGER DEFAULT 1,
  p_repeat_type TEXT DEFAULT NULL, p_repeat_days INTEGER[] DEFAULT NULL
)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_party parties%ROWTYPE; v_todo_id UUID;
BEGIN
  SELECT * INTO v_party FROM parties WHERE id = p_party_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'party_not_found'; END IF;

  -- 다같이 파티는 파티장만 투두 생성 가능
  IF v_party.type = 'collaborative' AND v_party.leader_id != p_user_id THEN
    RAISE EXCEPTION 'not_leader';
  END IF;

  -- 각자 파티는 target_count 항상 1
  IF v_party.type = 'individual' THEN p_target_count := 1; END IF;

  INSERT INTO party_todos (party_id, created_by, title, target_count, repeat_type, repeat_days)
  VALUES (p_party_id, p_user_id, p_title, p_target_count, p_repeat_type, p_repeat_days)
  RETURNING id INTO v_todo_id;

  INSERT INTO party_activity_log (party_id, user_id, action, content)
  VALUES (p_party_id, p_user_id, 'created_todo', p_title);

  RETURN json_build_object('success', true, 'todo_id', v_todo_id);
END; $$;

-- ── 파티 투두 완료/기여 ──
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
BEGIN
  v_today := kst_today();

  SELECT * INTO v_todo FROM party_todos WHERE id = p_party_todo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'todo_not_found'; END IF;

  SELECT * INTO v_party FROM parties WHERE id = v_todo.party_id;

  -- 이미 오늘 기여했는지 체크
  IF EXISTS (
    SELECT 1 FROM party_daily_records
    WHERE party_todo_id = p_party_todo_id AND user_id = p_user_id AND record_date = v_today
  ) THEN
    RAISE EXCEPTION 'already_completed_today';
  END IF;

  SELECT nickname INTO v_nickname FROM profiles WHERE id = p_user_id;

  IF v_party.type = 'individual' THEN
    -- 각자 파티: 본인만 완료
    INSERT INTO party_daily_records (party_todo_id, user_id, record_date, is_completed)
    VALUES (p_party_todo_id, p_user_id, v_today, true);

    -- 골드 체크 (일일 목표 기준)
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

  ELSE
    -- 다같이 파티: 기여
    INSERT INTO party_daily_records (party_todo_id, user_id, record_date, is_completed)
    VALUES (p_party_todo_id, p_user_id, v_today, false);

    INSERT INTO party_activity_log (party_id, user_id, action, content)
    VALUES (v_todo.party_id, p_user_id, 'contributed', v_nickname || '님이 ' || v_todo.title || '에 기여했습니다');

    -- 오늘 기여 수 확인
    SELECT COUNT(*) INTO v_total_today FROM party_daily_records
    WHERE party_todo_id = p_party_todo_id AND record_date = v_today;

    -- 목표 달성 시 전원 골드 지급
    IF v_total_today >= v_todo.target_count THEN
      v_all_done := true;

      UPDATE party_daily_records SET is_completed = true
      WHERE party_todo_id = p_party_todo_id AND record_date = v_today;

      -- 기여한 전원에게 골드 (각자의 일일 목표 체크)
      DECLARE
        v_member RECORD;
        v_member_goal INTEGER;
        v_member_done INTEGER;
        v_member_gold INTEGER;
      BEGIN
        FOR v_member IN
          SELECT pdr.user_id FROM party_daily_records pdr
          WHERE pdr.party_todo_id = p_party_todo_id AND pdr.record_date = v_today
        LOOP
          SELECT daily_goal INTO v_member_goal FROM profiles WHERE id = v_member.user_id;
          SELECT COUNT(*) INTO v_member_done FROM daily_records
          WHERE user_id = v_member.user_id AND record_date = v_today AND is_completed = true;

          v_member_gold := 0;
          IF v_member_done < COALESCE(v_member_goal, 0) THEN
            v_member_gold := 200;
          END IF;

          UPDATE party_daily_records SET gold_earned = v_member_gold
          WHERE party_todo_id = p_party_todo_id AND user_id = v_member.user_id AND record_date = v_today;

          IF v_member_gold > 0 THEN PERFORM add_gold(v_member.user_id, v_member_gold); END IF;
        END LOOP;
      END;

      INSERT INTO party_activity_log (party_id, user_id, action, content)
      VALUES (v_todo.party_id, p_user_id, 'completed', v_todo.title || ' 목표를 달성했습니다! 🎉');
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'gold', v_gold,
    'all_done', v_all_done,
    'party_type', v_party.type
  );
END; $$;
