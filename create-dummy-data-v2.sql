-- ==========================================
-- 더미 데이터 생성 SQL (DO 블록 없이)
-- 실행 시 20개의 투두 생성
-- ==========================================

-- 고유 세션 ID를 위한 임시 변수 (현재 시간 기반)
-- 실행할 때마다 다른 ID 생성됨

-- 투두 데이터 삽입 (20개)
-- session_id는 DUMMY-TEST로 고정 (삭제하기 쉽게)

-- 14일 페이지 (정상 생성) - 4개
INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-TEST] 더미: 14일생성-미완료-수정이력있음', '2025-11-14', false, '2025-11-14T09:00:00Z', 1001),
  ('[DUMMY-TEST] 더미: 14일생성-14일완료', '2025-11-14', true, '2025-11-14T09:10:00Z', 1002),
  ('[DUMMY-TEST] 더미: 14일생성-15일완료', '2025-11-14', true, '2025-11-14T09:20:00Z', 1003),
  ('[DUMMY-TEST] 더미: 14일생성-16일완료', '2025-11-14', true, '2025-11-14T09:30:00Z', 1004);

-- 15일 페이지 (정상 생성) - 3개
INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-TEST] 더미: 15일생성-미완료-수정이력있음', '2025-11-15', false, '2025-11-15T10:00:00Z', 1005),
  ('[DUMMY-TEST] 더미: 15일생성-15일완료', '2025-11-15', true, '2025-11-15T10:10:00Z', 1006),
  ('[DUMMY-TEST] 더미: 15일생성-16일완료', '2025-11-15', true, '2025-11-15T10:20:00Z', 1007);

-- 16일 페이지 (정상 생성) - 2개
INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-TEST] 더미: 16일생성-미완료', '2025-11-16', false, '2025-11-16T11:00:00Z', 1008),
  ('[DUMMY-TEST] 더미: 16일생성-16일완료', '2025-11-16', true, '2025-11-16T11:10:00Z', 1009);

-- 15일 페이지에 미리 작성 - 2개
INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-TEST] 더미: 14일생성-15일페이지-미완료', '2025-11-15', false, '2025-11-14T14:00:00Z', 1010),
  ('[DUMMY-TEST] 더미: 14일생성-15일페이지-15일완료', '2025-11-15', true, '2025-11-14T14:10:00Z', 1011);

-- 16일 페이지에 미리 작성 - 4개
INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-TEST] 더미: 15일생성-16일페이지-미완료', '2025-11-16', false, '2025-11-15T15:00:00Z', 1012),
  ('[DUMMY-TEST] 더미: 15일생성-16일페이지-16일완료', '2025-11-16', true, '2025-11-15T15:10:00Z', 1013),
  ('[DUMMY-TEST] 더미: 14일생성-16일페이지-미완료', '2025-11-16', false, '2025-11-14T15:00:00Z', 1014),
  ('[DUMMY-TEST] 더미: 14일생성-16일페이지-16일완료', '2025-11-16', true, '2025-11-14T15:10:00Z', 1015);

-- 17일 페이지에 미리 작성 (미래) - 3개
INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-TEST] 더미: 16일생성-17일페이지-미완료', '2025-11-17', false, '2025-11-16T16:00:00Z', 1016),
  ('[DUMMY-TEST] 더미: 15일생성-17일페이지-미완료', '2025-11-17', false, '2025-11-15T16:00:00Z', 1017),
  ('[DUMMY-TEST] 더미: 14일생성-17일페이지-미완료', '2025-11-17', false, '2025-11-14T16:00:00Z', 1018);

-- 18일 페이지에 미리 작성 (미래) - 2개
INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-TEST] 더미: 16일생성-18일페이지-미완료', '2025-11-18', false, '2025-11-16T17:00:00Z', 1019),
  ('[DUMMY-TEST] 더미: 15일생성-18일페이지-미완료', '2025-11-18', false, '2025-11-15T17:00:00Z', 1020);

-- 히스토리 데이터 삽입 (3개)
-- 14일 생성 투두의 히스토리 (15일, 16일 수정)
INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT
  id,
  '[DUMMY-TEST] 더미: 14일생성-미완료-1차',
  '[DUMMY-TEST] 더미: 14일생성-미완료-2차',
  '2025-11-15T12:00:00Z',
  '2025-11-15'
FROM todos
WHERE text = '[DUMMY-TEST] 더미: 14일생성-미완료-수정이력있음'
LIMIT 1;

INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT
  id,
  '[DUMMY-TEST] 더미: 14일생성-미완료-2차',
  '[DUMMY-TEST] 더미: 14일생성-미완료-수정이력있음',
  '2025-11-16T12:00:00Z',
  '2025-11-16'
FROM todos
WHERE text = '[DUMMY-TEST] 더미: 14일생성-미완료-수정이력있음'
LIMIT 1;

-- 15일 생성 투두의 히스토리 (16일 수정)
INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT
  id,
  '[DUMMY-TEST] 더미: 15일생성-미완료-1차',
  '[DUMMY-TEST] 더미: 15일생성-미완료-수정이력있음',
  '2025-11-16T13:00:00Z',
  '2025-11-16'
FROM todos
WHERE text = '[DUMMY-TEST] 더미: 15일생성-미완료-수정이력있음'
LIMIT 1;

-- 완료 메시지
SELECT '✅ 더미 데이터 생성 완료!' as message;
SELECT '투두: 20개' as info;
SELECT '히스토리: 3개' as info;
