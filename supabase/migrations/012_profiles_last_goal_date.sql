-- 매일 첫 접속 시 일일 목표 재설정 모달용
-- 마지막으로 일일 목표를 설정한 날짜. 오늘과 다르면 모달을 띄운다.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_goal_date DATE DEFAULT NULL;
