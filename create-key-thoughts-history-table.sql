-- 주요 생각정리 버전 히스토리 테이블 생성
CREATE TABLE IF NOT EXISTS key_thoughts_history (
  id BIGSERIAL PRIMARY KEY,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

-- 인덱스 생성 (빠른 조회를 위해)
CREATE INDEX IF NOT EXISTS idx_key_thoughts_history_created_at
ON key_thoughts_history(created_at DESC);

-- RLS (Row Level Security) 활성화 - 모든 사용자가 자신의 데이터만 볼 수 있도록
ALTER TABLE key_thoughts_history ENABLE ROW LEVEL SECURITY;

-- 정책 생성: 모든 사용자가 읽고 쓸 수 있도록 (단일 사용자 앱이므로)
CREATE POLICY "Enable all access for all users"
ON key_thoughts_history
FOR ALL
USING (true)
WITH CHECK (true);
