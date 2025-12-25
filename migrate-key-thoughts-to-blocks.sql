-- 기존 user_settings의 key_thoughts_blocks (JSON) 데이터를
-- 새로운 key_thought_blocks 테이블로 마이그레이션

-- ========================================
-- 1. 재귀 함수: JSON 배열을 개별 블럭으로 변환
-- ========================================
CREATE OR REPLACE FUNCTION migrate_blocks_recursive(
  p_user_id UUID,
  p_blocks JSONB,
  p_parent_id TEXT,
  p_depth INTEGER
) RETURNS VOID AS $$
DECLARE
  block JSONB;
  v_block_id TEXT;
  v_block_content TEXT;
  v_block_type TEXT;
  v_block_is_open BOOLEAN;
  v_position INTEGER := 0;
BEGIN
  -- blocks 배열의 각 요소를 순회
  FOR block IN SELECT * FROM jsonb_array_elements(p_blocks)
  LOOP
    -- 블럭 정보 추출
    v_block_id := block->>'id';
    v_block_content := COALESCE(block->>'content', '');
    v_block_type := COALESCE(block->>'type', 'toggle');
    v_block_is_open := COALESCE((block->>'isOpen')::BOOLEAN, true);

    -- 블럭 삽입
    INSERT INTO key_thought_blocks (
      user_id,
      block_id,
      content,
      type,
      parent_id,
      position,
      depth,
      is_open
    ) VALUES (
      p_user_id,
      v_block_id,
      v_block_content,
      v_block_type,
      p_parent_id,
      v_position,
      p_depth,
      v_block_is_open
    )
    ON CONFLICT (user_id, block_id) DO UPDATE
    SET
      content = EXCLUDED.content,
      type = EXCLUDED.type,
      parent_id = EXCLUDED.parent_id,
      position = EXCLUDED.position,
      depth = EXCLUDED.depth,
      is_open = EXCLUDED.is_open,
      updated_at = NOW();

    -- children이 있으면 재귀 호출
    IF block->'children' IS NOT NULL AND jsonb_array_length(block->'children') > 0 THEN
      PERFORM migrate_blocks_recursive(
        p_user_id,
        block->'children',
        v_block_id,
        p_depth + 1
      );
    END IF;

    v_position := v_position + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 2. 메인 마이그레이션 함수
-- ========================================
CREATE OR REPLACE FUNCTION migrate_all_key_thoughts()
RETURNS TABLE(
  user_id UUID,
  blocks_migrated INTEGER,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  user_record RECORD;
  blocks_json JSONB;
  blocks_count INTEGER;
BEGIN
  -- 모든 사용자의 key_thoughts_blocks 설정 조회
  FOR user_record IN
    SELECT us.user_id, us.setting_value
    FROM user_settings us
    WHERE us.setting_key = 'key_thoughts_blocks'
      AND us.setting_value IS NOT NULL
      AND us.setting_value != 'null'
  LOOP
    BEGIN
      -- JSON 파싱
      blocks_json := user_record.setting_value::JSONB;

      -- 배열이 아니면 스킵
      IF jsonb_typeof(blocks_json) != 'array' THEN
        user_id := user_record.user_id;
        blocks_migrated := 0;
        success := false;
        error_message := 'Invalid JSON format (not an array)';
        RETURN NEXT;
        CONTINUE;
      END IF;

      -- 재귀적으로 블럭 삽입
      PERFORM migrate_blocks_recursive(
        user_record.user_id,
        blocks_json,
        NULL,  -- parent_id (최상위)
        0      -- depth
      );

      -- 삽입된 블럭 수 확인
      SELECT COUNT(*)
      INTO blocks_count
      FROM key_thought_blocks ktb
      WHERE ktb.user_id = user_record.user_id;

      -- 결과 반환
      user_id := user_record.user_id;
      blocks_migrated := blocks_count;
      success := true;
      error_message := NULL;
      RETURN NEXT;

    EXCEPTION WHEN OTHERS THEN
      -- 오류 발생 시 롤백하고 다음 사용자로
      user_id := user_record.user_id;
      blocks_migrated := 0;
      success := false;
      error_message := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 3. 단일 사용자 마이그레이션 함수
-- ========================================
CREATE OR REPLACE FUNCTION migrate_user_key_thoughts(p_user_id UUID)
RETURNS TABLE(
  blocks_migrated INTEGER,
  success BOOLEAN,
  error_message TEXT
) AS $$
DECLARE
  blocks_json JSONB;
  blocks_count INTEGER;
  setting_value_text TEXT;
BEGIN
  BEGIN
    -- 해당 사용자의 key_thoughts_blocks 설정 조회
    SELECT us.setting_value
    INTO setting_value_text
    FROM user_settings us
    WHERE us.user_id = p_user_id
      AND us.setting_key = 'key_thoughts_blocks'
      AND us.setting_value IS NOT NULL
      AND us.setting_value != 'null';

    IF setting_value_text IS NULL THEN
      blocks_migrated := 0;
      success := false;
      error_message := 'No key_thoughts_blocks found for user';
      RETURN NEXT;
      RETURN;
    END IF;

    -- JSON 파싱
    blocks_json := setting_value_text::JSONB;

    -- 배열이 아니면 에러
    IF jsonb_typeof(blocks_json) != 'array' THEN
      blocks_migrated := 0;
      success := false;
      error_message := 'Invalid JSON format (not an array)';
      RETURN NEXT;
      RETURN;
    END IF;

    -- 기존 블럭 삭제 (재마이그레이션 시)
    DELETE FROM key_thought_blocks WHERE user_id = p_user_id;

    -- 재귀적으로 블럭 삽입
    PERFORM migrate_blocks_recursive(
      p_user_id,
      blocks_json,
      NULL,  -- parent_id
      0      -- depth
    );

    -- 삽입된 블럭 수 확인
    SELECT COUNT(*)
    INTO blocks_count
    FROM key_thought_blocks ktb
    WHERE ktb.user_id = p_user_id;

    blocks_migrated := blocks_count;
    success := true;
    error_message := NULL;
    RETURN NEXT;

  EXCEPTION WHEN OTHERS THEN
    blocks_migrated := 0;
    success := false;
    error_message := SQLERRM;
    RETURN NEXT;
  END;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 4. 마이그레이션 검증 함수
-- ========================================
CREATE OR REPLACE FUNCTION validate_migration(p_user_id UUID)
RETURNS TABLE(
  check_name TEXT,
  original_count INTEGER,
  migrated_count INTEGER,
  match BOOLEAN,
  details TEXT
) AS $$
DECLARE
  original_json JSONB;
  original_blocks_count INTEGER;
  migrated_blocks_count INTEGER;
BEGIN
  -- 원본 JSON 가져오기
  SELECT setting_value::JSONB
  INTO original_json
  FROM user_settings
  WHERE user_id = p_user_id
    AND setting_key = 'key_thoughts_blocks';

  -- 원본 블럭 수 계산 (재귀적으로)
  WITH RECURSIVE count_blocks AS (
    SELECT jsonb_array_elements(original_json) AS block
    UNION ALL
    SELECT jsonb_array_elements(cb.block->'children')
    FROM count_blocks cb
    WHERE cb.block->'children' IS NOT NULL
      AND jsonb_array_length(cb.block->'children') > 0
  )
  SELECT COUNT(*)
  INTO original_blocks_count
  FROM count_blocks;

  -- 마이그레이션된 블럭 수
  SELECT COUNT(*)
  INTO migrated_blocks_count
  FROM key_thought_blocks
  WHERE user_id = p_user_id;

  -- 블럭 수 비교
  check_name := 'Block count';
  original_count := original_blocks_count;
  migrated_count := migrated_blocks_count;
  match := (original_blocks_count = migrated_blocks_count);
  details := format('Original: %s, Migrated: %s', original_blocks_count, migrated_blocks_count);
  RETURN NEXT;

  -- 최상위 블럭 수 비교
  SELECT jsonb_array_length(original_json)
  INTO original_count;

  SELECT COUNT(*)
  INTO migrated_count
  FROM key_thought_blocks
  WHERE user_id = p_user_id AND parent_id IS NULL;

  check_name := 'Root block count';
  match := (original_count = migrated_count);
  details := format('Original: %s, Migrated: %s', original_count, migrated_count);
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 사용 예시 (주석)
-- ========================================
-- -- 전체 사용자 마이그레이션
-- SELECT * FROM migrate_all_key_thoughts();
--
-- -- 특정 사용자만 마이그레이션
-- SELECT * FROM migrate_user_key_thoughts('user-uuid-here');
--
-- -- 마이그레이션 검증
-- SELECT * FROM validate_migration('user-uuid-here');
