-- 관리자 식별 테이블 + is_admin() 헬퍼 + feedback 테이블 어드민 정책

CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_users_select_self ON public.admin_users
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

-- INSERT/UPDATE/DELETE는 service_role로만 수행.

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = COALESCE(p_user_id, auth.uid())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;

CREATE POLICY feedback_select_admin ON public.feedback
  FOR SELECT USING (public.is_admin());

CREATE POLICY feedback_update_admin ON public.feedback
  FOR UPDATE USING (public.is_admin());
