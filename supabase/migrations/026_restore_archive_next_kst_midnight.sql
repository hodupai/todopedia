-- 024/025에서 archived_at = now()로 되돌렸던 걸 다시 next_kst_midnight()으로 (016 동작 복구).
-- (027에서 동일 로직 + FOUND 버그 수정 + KST 타임존 통일이 다시 적용되므로 027이 진실의 원천)
-- 이 파일은 history 보존용. 실제 함수 정의는 027 참조.

-- 027에 의해 superseded됨
SELECT 1;
