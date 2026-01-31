-- =====================================================
-- sections 테이블 생성
-- 기본 섹션과 사용자 정의 섹션을 통합 관리
-- =====================================================

-- 1. sections 테이블 생성
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📋',
  is_default BOOLEAN DEFAULT FALSE,    -- 기본 섹션 여부 (사용자당 1개만)
  is_system BOOLEAN DEFAULT FALSE,     -- 시스템 섹션 (삭제 불가: 타임라인, 일반)
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted BOOLEAN DEFAULT FALSE
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sections_user_id ON sections(user_id);
CREATE INDEX IF NOT EXISTS idx_sections_order ON sections(user_id, order_index) WHERE deleted = FALSE;

-- 3. 사용자별 기본 섹션은 1개만 허용
CREATE UNIQUE INDEX IF NOT EXISTS idx_sections_default_unique
  ON sections(user_id) WHERE is_default = TRUE AND deleted = FALSE;

-- 4. RLS 정책 설정
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 섹션만 조회 가능
CREATE POLICY "Users can view own sections"
  ON sections FOR SELECT
  USING (auth.uid() = user_id);

-- 사용자는 자신의 섹션만 생성 가능
CREATE POLICY "Users can insert own sections"
  ON sections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 사용자는 자신의 섹션만 수정 가능
CREATE POLICY "Users can update own sections"
  ON sections FOR UPDATE
  USING (auth.uid() = user_id);

-- 사용자는 자신의 섹션만 삭제 가능
CREATE POLICY "Users can delete own sections"
  ON sections FOR DELETE
  USING (auth.uid() = user_id);

-- 5. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sections_updated_at_trigger
  BEFORE UPDATE ON sections
  FOR EACH ROW
  EXECUTE FUNCTION update_sections_updated_at();
