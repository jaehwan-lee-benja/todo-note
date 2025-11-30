-- user_settings 테이블 생성
-- 사용자 설정을 key-value 형태로 저장

CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(setting_key);

-- RLS (Row Level Security) 설정
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 정책 생성
CREATE POLICY "Anyone can read user settings"
  ON user_settings FOR SELECT
  USING (true);

-- 모든 사용자가 추가할 수 있도록 정책 생성
CREATE POLICY "Anyone can insert user settings"
  ON user_settings FOR INSERT
  WITH CHECK (true);

-- 모든 사용자가 수정할 수 있도록 정책 생성
CREATE POLICY "Anyone can update user settings"
  ON user_settings FOR UPDATE
  USING (true);

-- 모든 사용자가 삭제할 수 있도록 정책 생성
CREATE POLICY "Anyone can delete user settings"
  ON user_settings FOR DELETE
  USING (true);

-- 기본 섹션 순서 삽입 (선택사항)
INSERT INTO user_settings (setting_key, setting_value)
VALUES ('section_order', '["memo", "routine", "normal", "key-thoughts"]')
ON CONFLICT (setting_key) DO NOTHING;
