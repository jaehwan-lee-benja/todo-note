-- todos 테이블에 section_type 컬럼 추가
-- 방안 2: 복합 키 기반 정렬 구조 개선

-- 1. section_type 컬럼 추가
ALTER TABLE todos ADD COLUMN IF NOT EXISTS section_type TEXT;

-- 2. section_type에 CHECK 제약 조건 추가 (유효한 값만 허용)
ALTER TABLE todos ADD CONSTRAINT check_section_type
  CHECK (section_type IN ('routine', 'pending_routine', 'normal', 'custom'));

-- 3. 기존 데이터 변환
-- 3-1. 루틴 투두 (routine_id가 있고 is_pending_routine이 false)
UPDATE todos
SET section_type = 'routine'
WHERE routine_id IS NOT NULL
  AND (is_pending_routine IS NULL OR is_pending_routine = false)
  AND section_type IS NULL;

-- 3-2. 미정 루틴 투두 (is_pending_routine이 true)
UPDATE todos
SET section_type = 'pending_routine'
WHERE is_pending_routine = true
  AND section_type IS NULL;

-- 3-3. 사용자 정의 섹션 투두 (section_id가 있음)
UPDATE todos
SET section_type = 'custom'
WHERE section_id IS NOT NULL
  AND section_type IS NULL;

-- 3-4. 일반 투두 (routine_id도 없고 section_id도 없음)
UPDATE todos
SET section_type = 'normal'
WHERE routine_id IS NULL
  AND (section_id IS NULL OR section_id = '')
  AND (is_pending_routine IS NULL OR is_pending_routine = false)
  AND section_type IS NULL;

-- 4. 복합 인덱스 생성 (성능 최적화)
-- section_type, section_id, order_index 순으로 정렬하는 인덱스
CREATE INDEX IF NOT EXISTS idx_todos_section_order
ON todos(section_type, section_id, order_index)
WHERE deleted = false;

-- 5. 기존 인덱스 확인용 (참고)
-- CREATE INDEX IF NOT EXISTS idx_todos_section_id ON todos(section_id);
-- CREATE INDEX IF NOT EXISTS idx_todos_routine_id ON todos(routine_id);

-- 6. 검증 쿼리 (주석 해제하여 사용)
-- SELECT
--   section_type,
--   COUNT(*) as count,
--   COUNT(CASE WHEN section_type IS NULL THEN 1 END) as null_count
-- FROM todos
-- WHERE deleted = false
-- GROUP BY section_type;

-- 7. 정렬 테스트 쿼리 (주석 해제하여 사용)
-- SELECT
--   id,
--   text,
--   section_type,
--   section_id,
--   routine_id,
--   order_index
-- FROM todos
-- WHERE deleted = false
-- ORDER BY
--   CASE section_type
--     WHEN 'routine' THEN 1
--     WHEN 'pending_routine' THEN 2
--     WHEN 'normal' THEN 3
--     WHEN 'custom' THEN 4
--     ELSE 5
--   END,
--   section_id NULLS FIRST,
--   order_index;
