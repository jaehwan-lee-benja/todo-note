-- 주요 생각정리 블럭에 TODO 체크박스 및 메모 기능 추가

-- 1. 컬럼 추가
ALTER TABLE key_thought_blocks
ADD COLUMN IF NOT EXISTS is_todo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS memo TEXT DEFAULT '';

-- 2. 코멘트 추가
COMMENT ON COLUMN key_thought_blocks.is_todo IS 'TODO 체크박스 활성화 여부';
COMMENT ON COLUMN key_thought_blocks.is_completed IS 'TODO 완료 상태';
COMMENT ON COLUMN key_thought_blocks.memo IS '블럭에 첨부된 메모 (Google Sheets 스타일)';

-- 3. 인덱스 추가 (완료되지 않은 TODO 블럭 빠르게 조회)
CREATE INDEX IF NOT EXISTS idx_blocks_user_todo
ON key_thought_blocks(user_id, is_todo, is_completed)
WHERE is_todo = true;
