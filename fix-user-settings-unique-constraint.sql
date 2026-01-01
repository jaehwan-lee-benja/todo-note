-- user_settings 테이블의 UNIQUE 제약조건 수정
-- setting_key만 유니크 → (user_id, setting_key) 조합이 유니크로 변경

-- 1. 기존 UNIQUE 제약조건 제거
ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS user_settings_setting_key_key;

-- 2. 기존 인덱스 제거
DROP INDEX IF EXISTS idx_user_settings_key;

-- 3. 새로운 복합 UNIQUE 제약조건 추가
ALTER TABLE user_settings ADD CONSTRAINT user_settings_user_setting_unique
  UNIQUE (user_id, setting_key);

-- 4. 새로운 복합 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_user_settings_user_key ON user_settings(user_id, setting_key);

-- 5. 기존 전역 section_order 데이터 삭제 (각 사용자가 자신의 설정을 갖도록)
-- DELETE FROM user_settings WHERE setting_key = 'section_order' AND user_id IS NULL;
