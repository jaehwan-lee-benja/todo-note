# 주요 생각정리 데이터 마이그레이션 실행 가이드

**작성일**: 2024-12-25
**Phase 5**: 마이그레이션 실행

---

## ⚠️ 주의사항

- 이 작업은 **실제 프로덕션 데이터**를 변경합니다
- 마이그레이션 전 **반드시 백업**을 수행하세요
- 문제 발생 시 즉시 롤백할 수 있도록 준비하세요
- 사용자가 적은 시간대에 실행하는 것을 권장합니다

---

## 📋 전체 프로세스

```
1. 백업 (Supabase 콘솔) ✓
   ↓
2. 마이그레이션 함수 생성 (SQL 실행) ✓
   ↓
3. 마이그레이션 실행 ✓
   ↓
4. 검증 (Node.js 스크립트) ✓
   ↓
5. 환경 변수 변경 (.env) ✓
   ↓
6. 애플리케이션 테스트 ✓
   ↓
7. 모니터링 및 롤백 준비 ✓
```

---

## Step 1: 백업 (Supabase 콘솔에서 실행)

### 1.1 Supabase 콘솔 접속

1. https://supabase.com 접속
2. 프로젝트 선택
3. 좌측 메뉴에서 **SQL Editor** 클릭

### 1.2 백업 SQL 실행

```sql
-- 1. user_settings 백업 테이블 생성
CREATE TABLE user_settings_backup_20241225 AS
SELECT * FROM user_settings
WHERE setting_key = 'key_thoughts_blocks';

-- 2. key_thoughts_history 백업 (옵션)
CREATE TABLE key_thoughts_history_backup_20241225 AS
SELECT * FROM key_thoughts_history;

-- 3. 백업 확인
SELECT COUNT(*) as total_users
FROM user_settings_backup_20241225;
```

**결과 확인**: `total_users`가 0보다 크면 백업 성공

---

## Step 2: 마이그레이션 함수 생성

### 2.1 SQL 파일 실행

`migrate-key-thoughts-to-blocks.sql` 파일 전체를 Supabase SQL Editor에 복사하여 실행

**실행 방법**:
1. 로컬 파일 `migrate-key-thoughts-to-blocks.sql` 열기
2. 전체 내용 복사 (Cmd+A → Cmd+C)
3. Supabase SQL Editor에 붙여넣기
4. **Run** 버튼 클릭

**성공 메시지**:
```
Success. No rows returned
```

이것은 정상입니다 (함수 생성은 결과를 반환하지 않음).

---

## Step 3: 마이그레이션 실행

### 3.1 테스트: 단일 사용자 마이그레이션 (권장)

먼저 **자신의 계정**으로 테스트하세요.

```sql
-- 1. 자신의 user_id 확인
SELECT auth.uid() as my_user_id;

-- 2. 단일 사용자 마이그레이션 실행
SELECT * FROM migrate_user_key_thoughts(auth.uid());
```

**성공 예시**:
```
blocks_migrated | success | error_message
----------------|---------|---------------
15              | true    | null
```

### 3.2 검증: 단일 사용자

```sql
SELECT * FROM validate_migration(auth.uid());
```

**성공 예시**:
```
check_name       | original_count | migrated_count | match | details
-----------------|----------------|----------------|-------|------------------
Block count      | 15             | 15             | true  | Original: 15, Migrated: 15
Root block count | 3              | 3              | true  | Original: 3, Migrated: 3
```

**모든 `match`가 `true`이면 성공!**

### 3.3 전체 사용자 마이그레이션 (신중하게!)

단일 사용자 테스트가 성공하면 전체 사용자로 확대:

```sql
-- 전체 사용자 마이그레이션
SELECT * FROM migrate_all_key_thoughts();
```

**결과 예시**:
```
user_id                              | blocks_migrated | success | error_message
-------------------------------------|-----------------|---------|---------------
123e4567-e89b-12d3-a456-426614174000 | 15              | true    | null
223e4567-e89b-12d3-a456-426614174001 | 8               | true    | null
323e4567-e89b-12d3-a456-426614174002 | 0               | false   | Invalid JSON...
```

**중요**: `success = false`인 사용자가 있으면 `error_message` 확인!

---

## Step 4: 검증 (Node.js 스크립트)

### 4.1 검증 스크립트 실행

```bash
cd /Users/benja/claude-project/todo-note
node validate-migration.js
```

**예상 출력**:
```
🔍 마이그레이션 검증 시작...

✅ 사용자 1: blocks_migrated=15, match=true
✅ 사용자 2: blocks_migrated=8, match=true
❌ 사용자 3: 마이그레이션 실패 - Invalid JSON format

========================
총 사용자: 3
성공: 2
실패: 1
========================
```

### 4.2 실패한 사용자 처리

실패한 사용자가 있다면:

1. **원인 확인**: `error_message` 읽기
2. **수동 수정**: 해당 사용자의 `user_settings` 데이터 확인
3. **재실행**: `migrate_user_key_thoughts(user_id)` 다시 실행

---

## Step 5: 환경 변수 변경

### 5.1 .env 파일 수정

```bash
# .env 파일 열기
code /Users/benja/claude-project/todo-note/.env

# 다음 라인 추가 또는 수정
VITE_USE_NEW_BLOCK_STRUCTURE=true
```

### 5.2 개발 서버 재시작

```bash
# 기존 서버 종료 (Ctrl+C)
# 새로 시작
npm run dev
```

---

## Step 6: 애플리케이션 테스트

### 6.1 기본 기능 테스트

브라우저에서 http://localhost:5173/todo-note/ 접속 후:

- [ ] **로그인** 정상 작동
- [ ] **주요 생각정리 섹션** 표시됨
- [ ] **기존 블럭 로드** 정상 (내용, 계층 구조 확인)
- [ ] **블럭 추가** (Enter 키)
- [ ] **블럭 수정** (텍스트 입력)
- [ ] **블럭 삭제** (Backspace)
- [ ] **블럭 토글** (열기/닫기)
- [ ] **드래그앤드롭** (순서 변경)

### 6.2 뷰어 모드 테스트

- [ ] **뷰어 열기** (📖 뷰어 버튼)
- [ ] **컬럼 네비게이션** 정상
- [ ] **드래그앤드롭** (뷰어에서)

### 6.3 히스토리 기능 테스트

- [ ] **히스토리 열기** (🕐 히스토리 버튼)
- [ ] **히스토리 목록** 표시
- [ ] **버전 복구** 정상 작동

### 6.4 저장 확인

```sql
-- Supabase SQL Editor에서 실행
-- 최근 수정된 블럭 확인
SELECT block_id, content, updated_at
FROM key_thought_blocks
WHERE user_id = auth.uid()
ORDER BY updated_at DESC
LIMIT 10;
```

---

## Step 7: 롤백 (문제 발생 시)

### 7.1 즉시 롤백 (환경 변수만 변경)

가장 빠른 방법:

```bash
# .env 파일에서
VITE_USE_NEW_BLOCK_STRUCTURE=false

# 서버 재시작
npm run dev
```

→ 기존 `user_settings` 테이블 데이터로 복귀 (데이터 손실 없음)

### 7.2 완전 롤백 (새 테이블 데이터 삭제)

```sql
-- 1. 새 테이블 데이터 삭제
DELETE FROM key_thought_blocks;

-- 2. (옵션) 백업에서 복구
INSERT INTO user_settings
SELECT * FROM user_settings_backup_20241225
ON CONFLICT (user_id, setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value;
```

### 7.3 마이그레이션 함수 삭제 (선택)

```sql
DROP FUNCTION IF EXISTS migrate_blocks_recursive(UUID, JSONB, TEXT, INTEGER);
DROP FUNCTION IF EXISTS migrate_all_key_thoughts();
DROP FUNCTION IF EXISTS migrate_user_key_thoughts(UUID);
DROP FUNCTION IF EXISTS validate_migration(UUID);
```

---

## 📊 모니터링

### 성능 확인

```sql
-- 블럭 로드 속도 (EXPLAIN ANALYZE)
EXPLAIN ANALYZE
SELECT * FROM key_thought_blocks
WHERE user_id = auth.uid()
ORDER BY position;
```

### 데이터 무결성 확인

```sql
-- 부모-자식 관계 확인
SELECT
  COUNT(*) FILTER (WHERE parent_id IS NULL) as root_blocks,
  COUNT(*) FILTER (WHERE parent_id IS NOT NULL) as child_blocks,
  COUNT(DISTINCT user_id) as total_users
FROM key_thought_blocks;
```

---

## ✅ 마이그레이션 완료 체크리스트

- [ ] 백업 완료 (`user_settings_backup_20241225` 테이블 생성)
- [ ] 마이그레이션 함수 생성 완료
- [ ] 단일 사용자 마이그레이션 테스트 성공
- [ ] 전체 사용자 마이그레이션 실행
- [ ] 검증 스크립트 실행 (모든 사용자 `match=true`)
- [ ] 환경 변수 변경 (`VITE_USE_NEW_BLOCK_STRUCTURE=true`)
- [ ] 애플리케이션 테스트 (6가지 기능 모두 통과)
- [ ] 롤백 방법 숙지

---

## 🆘 문제 해결

### 문제 1: "함수가 존재하지 않습니다"

**원인**: Step 2를 건너뛰었거나 SQL 실행 실패

**해결**: `migrate-key-thoughts-to-blocks.sql` 다시 실행

### 문제 2: "blocks_migrated = 0"

**원인**: 해당 사용자의 `user_settings`에 데이터 없음

**해결**: 정상 (데이터가 없는 신규 사용자)

### 문제 3: "Invalid JSON format"

**원인**: `setting_value`가 배열이 아님

**해결**:
```sql
-- 해당 사용자 데이터 확인
SELECT setting_value
FROM user_settings
WHERE user_id = 'problem-user-id'
  AND setting_key = 'key_thoughts_blocks';
```

### 문제 4: 블럭이 표시되지 않음

**원인**: 환경 변수가 적용되지 않음

**해결**:
1. `.env` 파일 확인
2. 서버 재시작 (Ctrl+C → `npm run dev`)
3. 브라우저 캐시 삭제 (Cmd+Shift+R)

---

## 📞 지원

문제가 계속되면:
1. Supabase 콘솔에서 로그 확인
2. 브라우저 개발자 도구 콘솔 확인
3. `validate-migration.js` 결과 확인

---

**작성일**: 2024-12-25
**예상 소요 시간**: 30-60분
**위험도**: Medium (롤백 가능)
