-- ============================================
-- PROFILES
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  title TEXT DEFAULT NULL,
  daily_goal INTEGER NOT NULL DEFAULT 5 CHECK (daily_goal >= 1 AND daily_goal <= 30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 닉네임 공개 조회용 (담벼락 등)
CREATE POLICY "profiles_select_public"
  ON public.profiles FOR SELECT
  USING (true);

-- ============================================
-- INVITE CODES
-- ============================================
CREATE TABLE public.invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  used_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- 자기 초대코드 조회
CREATE POLICY "invite_codes_select_own"
  ON public.invite_codes FOR SELECT
  USING (auth.uid() = owner_id);

-- 초대코드 검증용 (미사용 코드 조회 - 회원가입 시)
CREATE POLICY "invite_codes_select_available"
  ON public.invite_codes FOR SELECT
  USING (used_by IS NULL);

-- ============================================
-- 회원가입 처리 함수 (서버사이드)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_signup(
  p_user_id UUID,
  p_username TEXT,
  p_nickname TEXT,
  p_invite_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite_owner UUID;
BEGIN
  -- 1. 초대코드 검증
  SELECT owner_id INTO v_invite_owner
  FROM public.invite_codes
  WHERE code = p_invite_code AND used_by IS NULL;

  IF v_invite_owner IS NULL THEN
    RAISE EXCEPTION 'invalid_invite_code';
  END IF;

  -- 2. 프로필 생성
  INSERT INTO public.profiles (id, username, nickname)
  VALUES (p_user_id, p_username, p_nickname);

  -- 3. 초대코드 사용 처리
  UPDATE public.invite_codes
  SET used_by = p_user_id, used_at = now()
  WHERE code = p_invite_code;

  -- 4. 신규 유저에게 초대코드 3장 발급
  INSERT INTO public.invite_codes (code, owner_id)
  VALUES
    (upper(substr(md5(random()::text), 1, 3) || '-' || substr(md5(random()::text), 1, 4)), p_user_id),
    (upper(substr(md5(random()::text), 1, 3) || '-' || substr(md5(random()::text), 1, 4)), p_user_id),
    (upper(substr(md5(random()::text), 1, 3) || '-' || substr(md5(random()::text), 1, 4)), p_user_id);
END;
$$;

-- ============================================
-- 관리자 시드 계정용 함수 (초대코드 없이 가입)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_admin_signup(
  p_user_id UUID,
  p_username TEXT,
  p_nickname TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, nickname, role)
  VALUES (p_user_id, p_username, p_nickname, 'admin');

  -- 관리자에게 초대코드 10장 발급
  FOR i IN 1..10 LOOP
    INSERT INTO public.invite_codes (code, owner_id)
    VALUES (upper(substr(md5(random()::text), 1, 3) || '-' || substr(md5(random()::text), 1, 4)), p_user_id);
  END LOOP;
END;
$$;

-- ============================================
-- 닉네임 중복 확인용 함수 (비인증 상태에서 호출)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_nickname_available(p_nickname TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE nickname = p_nickname
  );
$$;

-- 아이디 중복 확인용 함수
CREATE OR REPLACE FUNCTION public.is_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE username = p_username
  );
$$;
