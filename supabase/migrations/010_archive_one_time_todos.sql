-- ============================================
-- 일회성 투두 완료 시 archive (목록에서 제거)
-- ============================================
-- repeat_type IS NULL 인 normal/loop 투두는 완료 시 archived_at을 세팅하여
-- 목록 쿼리에서 제외한다. daily_records는 그대로 남아 통계가 유지된다.

ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

-- 목록 조회 인덱스 (archived_at IS NULL 필터링용)
CREATE INDEX IF NOT EXISTS idx_todos_user_active
  ON public.todos(user_id)
  WHERE archived_at IS NULL;
