-- ============================================================
-- 008: Wall System (담벼락)
-- 자동 게시 + 하트 시스템
-- ============================================================

-- ── 담벼락 포스트 ──
CREATE TABLE public.wall_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('daily_goal','evolution','achievement')),
  content JSONB NOT NULL DEFAULT '{}',
  heart_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wall_posts ENABLE ROW LEVEL SECURITY;
-- 모든 유저가 볼 수 있음
CREATE POLICY "wall_posts_select_all" ON public.wall_posts FOR SELECT USING (true);

CREATE INDEX wall_posts_created_at ON public.wall_posts(created_at DESC);

-- ── 하트 ──
CREATE TABLE public.wall_hearts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.wall_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.wall_hearts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wall_hearts_select_all" ON public.wall_hearts FOR SELECT USING (true);

-- ── 담벼락 게시 ──
CREATE OR REPLACE FUNCTION public.create_wall_post(
  p_user_id UUID,
  p_type TEXT,
  p_content JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post_id UUID;
BEGIN
  INSERT INTO wall_posts (user_id, type, content)
  VALUES (p_user_id, p_type, p_content)
  RETURNING id INTO v_post_id;
  RETURN v_post_id;
END;
$$;

-- ── 하트 누르기 ──
CREATE OR REPLACE FUNCTION public.heart_post(p_user_id UUID, p_post_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post wall_posts%ROWTYPE;
  v_already BOOLEAN;
BEGIN
  SELECT * INTO v_post FROM wall_posts WHERE id = p_post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'post_not_found'; END IF;

  -- 자기 포스트에 하트 불가
  IF v_post.user_id = p_user_id THEN
    RAISE EXCEPTION 'cannot_heart_own_post';
  END IF;

  -- 중복 체크
  SELECT EXISTS(
    SELECT 1 FROM wall_hearts WHERE post_id = p_post_id AND user_id = p_user_id
  ) INTO v_already;

  IF v_already THEN
    RAISE EXCEPTION 'already_hearted';
  END IF;

  -- 하트 추가
  INSERT INTO wall_hearts (post_id, user_id) VALUES (p_post_id, p_user_id);

  -- 카운트 증가
  UPDATE wall_posts SET heart_count = heart_count + 1 WHERE id = p_post_id;

  -- 양쪽 +10G
  PERFORM add_gold(p_user_id, 10);
  PERFORM add_gold(v_post.user_id, 10);

  RETURN json_build_object(
    'success', true,
    'post_owner_id', v_post.user_id,
    'gold_each', 10
  );
END;
$$;

-- ── 담벼락 조회 (최신순, 하트 여부 포함) ──
CREATE OR REPLACE FUNCTION public.get_wall_posts(p_user_id UUID, p_limit INTEGER DEFAULT 20, p_offset INTEGER DEFAULT 0)
RETURNS TABLE(
  id UUID, user_id UUID, nickname TEXT,
  type TEXT, content JSONB, heart_count INTEGER,
  hearted BOOLEAN, created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wp.id, wp.user_id, p.nickname,
    wp.type, wp.content, wp.heart_count,
    EXISTS(SELECT 1 FROM wall_hearts wh WHERE wh.post_id = wp.id AND wh.user_id = p_user_id) AS hearted,
    wp.created_at
  FROM wall_posts wp
  JOIN profiles p ON p.id = wp.user_id
  ORDER BY wp.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
