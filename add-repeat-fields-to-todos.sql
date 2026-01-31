-- =====================================================
-- todos 테이블에 반복 필드 추가
-- 기존 routines 테이블의 기능을 todos에 통합
-- =====================================================

-- 1. 반복 타입 필드 추가
-- 'none': 반복 없음 (일반 투두)
-- 'daily': 매일
-- 'weekdays': 평일만 (월-금)
-- 'weekends': 주말만 (토-일)
-- 'weekly': 특정 요일 선택
ALTER TABLE todos ADD COLUMN IF NOT EXISTS repeat_type TEXT DEFAULT 'none';

-- 2. 반복 요일 필드 추가 (weekly 타입일 때 사용)
-- 예: ["mon", "wed", "fri"]
ALTER TABLE todos ADD COLUMN IF NOT EXISTS repeat_days JSONB DEFAULT '[]';

-- 3. 반복 시작 날짜
ALTER TABLE todos ADD COLUMN IF NOT EXISTS repeat_start_date DATE;

-- 4. 반복 종료 날짜 (선택적)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS repeat_end_date DATE;

-- 5. 완료된 날짜 배열 (반복 투두에서 각 날짜별 완료 상태 추적)
-- 예: ["2025-01-28", "2025-01-29"]
ALTER TABLE todos ADD COLUMN IF NOT EXISTS completed_dates JSONB DEFAULT '[]';

-- 6. sections 테이블 FK를 위한 새 컬럼 추가
ALTER TABLE todos ADD COLUMN IF NOT EXISTS new_section_id UUID;

-- 7. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_todos_repeat_type ON todos(repeat_type) WHERE repeat_type != 'none';
CREATE INDEX IF NOT EXISTS idx_todos_new_section_id ON todos(new_section_id);
CREATE INDEX IF NOT EXISTS idx_todos_repeat_start ON todos(repeat_start_date) WHERE repeat_type != 'none';

-- 8. repeat_type 값 검증
ALTER TABLE todos DROP CONSTRAINT IF EXISTS check_repeat_type;
ALTER TABLE todos ADD CONSTRAINT check_repeat_type
  CHECK (repeat_type IN ('none', 'daily', 'weekdays', 'weekends', 'weekly'));

-- 9. FK 제약 조건 (sections 테이블 생성 후 실행)
-- ALTER TABLE todos ADD CONSTRAINT fk_todos_section
--   FOREIGN KEY (new_section_id) REFERENCES sections(id) ON DELETE SET NULL;
