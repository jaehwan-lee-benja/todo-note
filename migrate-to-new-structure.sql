-- =====================================================
-- 기존 루틴/섹션 → 새로운 구조 마이그레이션
-- 실행 순서: create-sections-table.sql → add-repeat-fields-to-todos.sql → 이 파일
-- =====================================================

-- =====================================================
-- STEP 1: 기존 사용자별 기본 섹션 생성
-- =====================================================

-- 1.1 기존 사용자 목록 추출 및 기본 섹션 생성
INSERT INTO sections (user_id, name, icon, is_default, is_system, order_index)
SELECT DISTINCT
  user_id,
  '타임라인',
  '⏰',
  FALSE,
  TRUE,
  0
FROM todos
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sections s
    WHERE s.user_id = todos.user_id AND s.name = '타임라인'
  );

INSERT INTO sections (user_id, name, icon, is_default, is_system, order_index)
SELECT DISTINCT
  user_id,
  '일반',
  '✅',
  TRUE,  -- 기본 섹션
  TRUE,
  1
FROM todos
WHERE user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sections s
    WHERE s.user_id = todos.user_id AND s.name = '일반'
  );

-- =====================================================
-- STEP 2: 기존 custom 섹션 마이그레이션 (user_settings에서)
-- =====================================================

-- user_settings의 custom_sections를 sections 테이블로 이전
-- 이 부분은 애플리케이션 코드에서 처리 권장 (JSON 파싱 필요)

-- =====================================================
-- STEP 3: routines 테이블 → todos 반복 필드 마이그레이션
-- =====================================================

-- 3.1 routines 테이블에서 반복 정보를 todos로 복사
UPDATE todos t
SET
  repeat_type = CASE
    WHEN r.days = '[]'::jsonb OR r.days IS NULL THEN 'daily'  -- 빈 배열 = 매일
    WHEN jsonb_array_length(r.days) = 5
      AND r.days @> '["mon","tue","wed","thu","fri"]'::jsonb THEN 'weekdays'
    WHEN jsonb_array_length(r.days) = 2
      AND r.days @> '["sat","sun"]'::jsonb THEN 'weekends'
    ELSE 'weekly'
  END,
  repeat_days = COALESCE(r.days, '[]'::jsonb),
  repeat_start_date = r.start_date
FROM routines r
WHERE t.routine_id = r.id
  AND t.routine_id IS NOT NULL;

-- =====================================================
-- STEP 4: section_type → new_section_id 매핑
-- =====================================================

-- 4.1 normal 섹션 투두들의 new_section_id 설정
UPDATE todos t
SET new_section_id = s.id
FROM sections s
WHERE t.user_id = s.user_id
  AND s.name = '일반'
  AND s.is_system = TRUE
  AND (t.section_type = 'normal' OR t.section_type IS NULL)
  AND t.routine_id IS NULL
  AND t.new_section_id IS NULL;

-- 4.2 routine/pending_routine 섹션 투두들도 '일반' 섹션으로 이동
-- (이제 반복은 repeat_type으로 구분)
UPDATE todos t
SET new_section_id = s.id
FROM sections s
WHERE t.user_id = s.user_id
  AND s.name = '일반'
  AND s.is_system = TRUE
  AND t.section_type IN ('routine', 'pending_routine')
  AND t.new_section_id IS NULL;

-- 4.3 timeline 투두들은 타임라인 섹션으로 (scheduled_time 있는 투두)
-- 타임라인은 특수 섹션이므로 별도 처리 필요 시 여기서 처리

-- =====================================================
-- STEP 5: completed_dates 초기화 (완료된 반복 투두)
-- =====================================================

-- 완료된 반복 투두의 경우, visible_dates 중 completed=true인 날짜들을 completed_dates로
-- 현재 구조에서는 단일 completed 필드이므로,
-- completed=true인 투두의 경우 현재 날짜를 completed_dates에 추가
UPDATE todos
SET completed_dates = jsonb_build_array(date::text)
WHERE completed = TRUE
  AND repeat_type != 'none'
  AND date IS NOT NULL
  AND (completed_dates IS NULL OR completed_dates = '[]'::jsonb);

-- =====================================================
-- STEP 6: 검증 쿼리
-- =====================================================

-- 마이그레이션 결과 확인
-- SELECT
--   repeat_type,
--   COUNT(*) as count
-- FROM todos
-- WHERE repeat_type != 'none'
-- GROUP BY repeat_type;

-- SELECT
--   s.name,
--   COUNT(t.id) as todo_count
-- FROM sections s
-- LEFT JOIN todos t ON t.new_section_id = s.id
-- GROUP BY s.name;
