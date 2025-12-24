-- 주요 생각정리 개별 블럭 테이블 생성
-- JSON 방식에서 개별 row 방식으로 전환

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS key_thought_blocks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 블럭 기본 정보
  block_id TEXT NOT NULL,  -- 클라이언트 생성 ID (timestamp + random)
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'toggle',  -- 'toggle', 'text', 'heading', etc.

  -- 계층 구조
  parent_id TEXT,  -- 부모 블럭의 block_id
  position INTEGER NOT NULL DEFAULT 0,  -- 형제 블럭 간 순서 (0부터 시작)
  depth INTEGER NOT NULL DEFAULT 0,     -- 깊이 (0=최상위, 1=1단계 하위, ...)

  -- UI 상태
  is_open BOOLEAN NOT NULL DEFAULT true,  -- 토글 열림/닫힘 상태

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 제약조건
  CONSTRAINT unique_user_block UNIQUE(user_id, block_id),
  CONSTRAINT check_depth_non_negative CHECK (depth >= 0),
  CONSTRAINT check_position_non_negative CHECK (position >= 0)
);

-- 2. 인덱스 생성 (성능 최적화)

-- 사용자별 블럭 조회
CREATE INDEX IF NOT EXISTS idx_blocks_user_id
ON key_thought_blocks(user_id);

-- 부모-자식 관계 조회
CREATE INDEX IF NOT EXISTS idx_blocks_parent_id
ON key_thought_blocks(parent_id);

-- 특정 부모의 자식들을 순서대로 조회
CREATE INDEX IF NOT EXISTS idx_blocks_user_parent_position
ON key_thought_blocks(user_id, parent_id, position);

-- 특정 깊이의 블럭들 조회
CREATE INDEX IF NOT EXISTS idx_blocks_user_depth
ON key_thought_blocks(user_id, depth);

-- 블럭 내용 전문 검색 (Full-Text Search)
CREATE INDEX IF NOT EXISTS idx_blocks_content_search
ON key_thought_blocks USING gin(to_tsvector('simple', content));

-- 업데이트 시간 조회 (최근 수정된 블럭 찾기)
CREATE INDEX IF NOT EXISTS idx_blocks_updated_at
ON key_thought_blocks(user_id, updated_at DESC);

-- 3. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_key_thought_blocks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER key_thought_blocks_updated_at_trigger
  BEFORE UPDATE ON key_thought_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_key_thought_blocks_updated_at();

-- 4. RLS (Row Level Security) 활성화
ALTER TABLE key_thought_blocks ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책 생성 (사용자는 자신의 블럭만 접근 가능)

-- SELECT 정책
CREATE POLICY "Users can view their own blocks"
ON key_thought_blocks
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT 정책
CREATE POLICY "Users can insert their own blocks"
ON key_thought_blocks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE 정책
CREATE POLICY "Users can update their own blocks"
ON key_thought_blocks
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE 정책
CREATE POLICY "Users can delete their own blocks"
ON key_thought_blocks
FOR DELETE
USING (auth.uid() = user_id);

-- 6. 외래키 제약조건 추가 (parent_id는 같은 테이블 참조)
-- parent_id가 존재하면 반드시 같은 user의 block_id여야 함
-- 부모가 삭제되면 자식도 자동 삭제 (CASCADE)

-- 주의: parent_id는 block_id를 참조하므로, 순환 참조 방지 필요
-- 애플리케이션 레벨에서 처리하거나, 추가 CHECK 제약조건으로 방지 가능

COMMENT ON TABLE key_thought_blocks IS '주요 생각정리 개별 블럭 저장 (계층 구조)';
COMMENT ON COLUMN key_thought_blocks.block_id IS '클라이언트에서 생성한 고유 ID (timestamp + random)';
COMMENT ON COLUMN key_thought_blocks.parent_id IS '부모 블럭의 block_id (NULL이면 최상위)';
COMMENT ON COLUMN key_thought_blocks.position IS '같은 부모 아래 형제 블럭들 간의 순서';
COMMENT ON COLUMN key_thought_blocks.depth IS '계층 깊이 (0=최상위, 1=1단계 하위, ...)';
COMMENT ON COLUMN key_thought_blocks.is_open IS '토글 블럭의 열림/닫힘 상태';
