-- 주요 생각정리 마이그레이션 롤백 스크립트
-- 새 테이블(key_thought_blocks)에서 기존 방식(user_settings JSON)으로 되돌리기

-- ========================================
-- 1. 개별 블럭을 JSON 트리 구조로 변환하는 함수
-- ========================================
CREATE OR REPLACE FUNCTION blocks_to_json_tree(
  p_user_id UUID,
  p_parent_id TEXT
) RETURNS JSONB AS $$
DECLARE
  result JSONB := '[]'::JSONB;
  block_record RECORD;
  block_json JSONB;
  children_json JSONB;
BEGIN
  -- 해당 부모의 자식 블럭들을 position 순서대로 조회
  FOR block_record IN
    SELECT block_id, content, type, is_open
    FROM key_thought_blocks
    WHERE user_id = p_user_id
      AND (
        (p_parent_id IS NULL AND parent_id IS NULL) OR
        (parent_id = p_parent_id)
      )
    ORDER BY position
  LOOP
    -- 하위 블럭들 재귀 조회
    children_json := blocks_to_json_tree(p_user_id, block_record.block_id);

    -- 블럭 JSON 생성
    block_json := jsonb_build_object(
      'id', block_record.block_id,
      'content', block_record.content,
      'type', block_record.type,
      'isOpen', block_record.is_open,
      'children', children_json
    );

    -- 결과 배열에 추가
    result := result || block_json;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. 전체 사용자 롤백 함수
-- ========================================
CREATE OR REPLACE FUNCTION rollback_all_key_thoughts()
RETURNS TABLE(
  user_id UUID,
  blocks_count INTEGER,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  user_record RECORD;
  blocks_tree JSONB;
  blocks_count_val INTEGER;
BEGIN
  -- key_thought_blocks에 데이터가 있는 모든 사용자 조회
  FOR user_record IN
    SELECT DISTINCT ktb.user_id
    FROM key_thought_blocks ktb
  LOOP
    BEGIN
      -- 블럭 트리 생성
      blocks_tree := blocks_to_json_tree(user_record.user_id, NULL);

      -- 블럭 수 계산
      WITH RECURSIVE count_blocks AS (
        SELECT jsonb_array_elements(blocks_tree) AS block
        UNION ALL
        SELECT jsonb_array_elements(cb.block->'children')
        FROM count_blocks cb
        WHERE cb.block->'children' IS NOT NULL
          AND jsonb_array_length(cb.block->'children') > 0
      )
      SELECT COUNT(*) INTO blocks_count_val FROM count_blocks;

      -- user_settings에 저장 (UPDATE or INSERT)
      INSERT INTO user_settings (user_id, setting_key, setting_value)
      VALUES (user_record.user_id, 'key_thoughts_blocks', blocks_tree::TEXT)
      ON CONFLICT (user_id, setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        updated_at = NOW();

      -- 결과 반환
      user_id := user_record.user_id;
      blocks_count := blocks_count_val;
      success := true;
      error_message := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      user_id := user_record.user_id;
      blocks_count := 0;
      success := false;
      error_message := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. 단일 사용자 롤백 함수
-- ========================================
CREATE OR REPLACE FUNCTION rollback_user_key_thoughts(p_user_id UUID)
RETURNS TABLE(
  blocks_count INTEGER,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  blocks_tree JSONB;
  blocks_count_val INTEGER;
BEGIN
  BEGIN
    -- 블럭 트리 생성
    blocks_tree := blocks_to_json_tree(p_user_id, NULL);

    -- 블럭이 없으면 에러
    IF jsonb_array_length(blocks_tree) = 0 THEN
      blocks_count := 0;
      success := false;
      error_message := 'No blocks found for user';
      RETURN NEXT;
      RETURN;
    END IF;

    -- 블럭 수 계산
    WITH RECURSIVE count_blocks AS (
      SELECT jsonb_array_elements(blocks_tree) AS block
      UNION ALL
      SELECT jsonb_array_elements(cb.block->'children')
      FROM count_blocks cb
      WHERE cb.block->'children' IS NOT NULL
        AND jsonb_array_length(cb.block->'children') > 0
    )
    SELECT COUNT(*) INTO blocks_count_val FROM count_blocks;

    -- user_settings에 저장
    INSERT INTO user_settings (user_id, setting_key, setting_value)
    VALUES (p_user_id, 'key_thoughts_blocks', blocks_tree::TEXT)
    ON CONFLICT (user_id, setting_key)
    DO UPDATE SET
      setting_value = EXCLUDED.setting_value,
      updated_at = NOW();

    blocks_count := blocks_count_val;
    success := true;
    error_message := NULL;
    RETURN NEXT;

  EXCEPTION WHEN OTHERS THEN
    blocks_count := 0;
    success := false;
    error_message := SQLERRM;
    RETURN NEXT;
  END;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. 완전 롤백 (테이블 및 함수 제거)
-- ========================================
CREATE OR REPLACE FUNCTION complete_rollback()
RETURNS TEXT AS $$
BEGIN
  -- 1. 모든 블럭 데이터를 user_settings로 백업
  PERFORM rollback_all_key_thoughts();

  -- 2. 테이블 삭제
  DROP TABLE IF EXISTS key_thought_blocks CASCADE;

  -- 3. 마이그레이션 함수들 제거
  DROP FUNCTION IF EXISTS migrate_blocks_recursive(UUID, JSONB, TEXT, INTEGER) CASCADE;
  DROP FUNCTION IF EXISTS migrate_all_key_thoughts() CASCADE;
  DROP FUNCTION IF EXISTS migrate_user_key_thoughts(UUID) CASCADE;
  DROP FUNCTION IF EXISTS validate_migration(UUID) CASCADE;

  -- 4. 롤백 함수들도 제거 (자기 자신 포함)
  DROP FUNCTION IF EXISTS blocks_to_json_tree(UUID, TEXT) CASCADE;
  DROP FUNCTION IF EXISTS rollback_all_key_thoughts() CASCADE;
  DROP FUNCTION IF EXISTS rollback_user_key_thoughts(UUID) CASCADE;
  DROP FUNCTION IF EXISTS complete_rollback() CASCADE;

  RETURN 'Complete rollback successful. All data backed up to user_settings.';
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 5. 롤백 검증 함수
-- ========================================
CREATE OR REPLACE FUNCTION verify_rollback(p_user_id UUID)
RETURNS TABLE(
  check_name TEXT,
  original_count INTEGER,
  restored_count INTEGER,
  match BOOLEAN,
  details TEXT
) AS $$
DECLARE
  blocks_in_table INTEGER;
  blocks_in_json INTEGER;
  restored_json JSONB;
BEGIN
  -- key_thought_blocks 테이블의 블럭 수
  SELECT COUNT(*)
  INTO blocks_in_table
  FROM key_thought_blocks
  WHERE user_id = p_user_id;

  -- user_settings에 복구된 JSON의 블럭 수
  SELECT setting_value::JSONB
  INTO restored_json
  FROM user_settings
  WHERE user_id = p_user_id
    AND setting_key = 'key_thoughts_blocks';

  WITH RECURSIVE count_blocks AS (
    SELECT jsonb_array_elements(restored_json) AS block
    UNION ALL
    SELECT jsonb_array_elements(cb.block->'children')
    FROM count_blocks cb
    WHERE cb.block->'children' IS NOT NULL
      AND jsonb_array_length(cb.block->'children') > 0
  )
  SELECT COUNT(*)
  INTO blocks_in_json
  FROM count_blocks;

  -- 블럭 수 비교
  check_name := 'Block count';
  original_count := blocks_in_table;
  restored_count := blocks_in_json;
  match := (blocks_in_table = blocks_in_json);
  details := format('Table: %s, JSON: %s', blocks_in_table, blocks_in_json);
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 사용 예시 (주석)
-- ========================================
-- -- 특정 사용자만 롤백 (테이블 데이터를 JSON으로 변환하여 user_settings에 저장)
-- SELECT * FROM rollback_user_key_thoughts('user-uuid-here');
--
-- -- 전체 사용자 롤백
-- SELECT * FROM rollback_all_key_thoughts();
--
-- -- 롤백 검증
-- SELECT * FROM verify_rollback('user-uuid-here');
--
-- -- 완전 롤백 (테이블 및 함수 모두 제거, user_settings에 데이터 백업)
-- SELECT complete_rollback();
--
-- ⚠️ 주의: complete_rollback()은 모든 마이그레이션 관련 오브젝트를 제거합니다.
-- 실행 전 반드시 데이터 백업을 확인하세요!
