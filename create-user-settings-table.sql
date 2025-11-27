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

-- 기본 섹션 순서 삽입 (선택사항)
INSERT INTO user_settings (setting_key, setting_value)
VALUES ('section_order', '["memo", "routine", "normal", "key-thoughts"]')
ON CONFLICT (setting_key) DO NOTHING;
