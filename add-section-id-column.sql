-- todos 테이블에 section_id 컬럼 추가
-- 사용자 정의 섹션 기능 지원

ALTER TABLE todos ADD COLUMN IF NOT EXISTS section_id TEXT;

-- 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_todos_section_id ON todos(section_id);

-- 기존 데이터는 section_id가 NULL로 남음 (일반 투두로 처리)
-- 루틴 투두는 routine_id로 구분하고, 일반 투두는 section_id가 NULL
