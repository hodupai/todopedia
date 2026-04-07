-- 인앱 피드백 (건의/버그 제보) 테이블
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bug', 'suggestion', 'other')),
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  user_agent TEXT,
  page_path TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_insert_own ON public.feedback
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY feedback_select_own ON public.feedback
  FOR SELECT USING ((SELECT auth.uid()) = user_id);
