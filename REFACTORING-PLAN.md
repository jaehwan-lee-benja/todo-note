# 데이터 구조 리팩토링 계획

## 📋 개요
**날짜**: 2025-11-22
**목적**: 이월 시스템을 복사 기반에서 JSON 기반으로 전환하여 데이터 중복 제거 및 로직 단순화

## 🔄 현재 방식 vs 제안 방식

### 현재 방식 (복사 기반)
```javascript
// 21일 미완료 투두가 22일, 23일로 이월될 때
21일: { id: 1, text: "운동하기", date: "2025-11-21", original_todo_id: null }
22일: { id: 2, text: "운동하기", date: "2025-11-22", original_todo_id: 1 } // 새 레코드
23일: { id: 3, text: "운동하기", date: "2025-11-23", original_todo_id: 1 } // 또 새 레코드
```

**문제점:**
- ❌ 날짜마다 별도 레코드 생성 → 데이터 중복
- ❌ 완료 상태 변경 시 모든 관련 레코드 업데이트 필요
- ❌ 삭제 로직 복잡 (4가지 옵션 필요)
- ❌ original_todo_id 추적 복잡

### 제안 방식 (JSON 기반)
```javascript
// 하나의 레코드로 모든 날짜 관리
{
  id: 1,
  text: "운동하기",
  created_date: "2025-11-21",
  completed: false,
  visible_dates: ["2025-11-21", "2025-11-22", "2025-11-23"], // JSON 배열
  hidden_dates: [], // 특정 날짜에서만 숨긴 경우
  deleted: false,
  deleted_date: null
}
```

**장점:**
- ✅ 레코드 1개로 관리 → 데이터 중복 없음
- ✅ 완료 상태 변경 단순 (1개만 업데이트)
- ✅ 삭제 로직 단순화 (배열 조작만)
- ✅ 이월 추적 명확

## 📊 스키마 변경

### 기존 스키마
```sql
CREATE TABLE todos (
  id BIGSERIAL PRIMARY KEY,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  order_index INTEGER,
  original_todo_id BIGINT REFERENCES todos(id),
  parent_id BIGINT REFERENCES todos(id),
  routine_id BIGINT REFERENCES routines(id),
  deleted BOOLEAN DEFAULT false,
  deleted_date DATE,
  completed_at TIMESTAMP
);
```

### 새 스키마
```sql
ALTER TABLE todos
  ADD COLUMN visible_dates JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN hidden_dates JSONB DEFAULT '[]'::jsonb;

-- original_todo_id는 더 이상 필요 없지만 마이그레이션 후 삭제
```

## 🔧 수정 필요 항목

### 1. 이월 로직 (`moveIncompleteTodosToNextDay`)
**현재**: 새 레코드 복사 생성
```javascript
const todosToInsert = todosNeedCarryOver.map((todo, index) => ({
  text: todo.text,
  completed: false,
  date: toDateStr,
  original_todo_id: originalId
}))
await supabase.from('todos').insert(todosToInsert)
```

**변경 후**: visible_dates 배열에 날짜 추가
```javascript
for (const todo of incompleteTodos) {
  const currentDates = todo.visible_dates || [todo.date]
  if (!currentDates.includes(toDateStr)) {
    await supabase
      .from('todos')
      .update({
        visible_dates: [...currentDates, toDateStr]
      })
      .eq('id', todo.id)
  }
}
```

### 2. 조회 로직 (`fetchTodos`)
**현재**: date로 필터링
```javascript
const { data } = await supabase
  .from('todos')
  .select('*')
  .eq('date', dateStr)
  .eq('deleted', false)
```

**변경 후**: visible_dates에서 포함 여부 확인
```javascript
const { data } = await supabase
  .from('todos')
  .select('*')
  .contains('visible_dates', [dateStr]) // JSONB contains
  .not('hidden_dates', 'cs', [dateStr]) // 숨김 날짜 제외
  .eq('deleted', false)
```

### 3. 완료/미완료 토글 (`handleToggleTodo`)
**현재**: 원본 + 모든 이월 레코드 업데이트
```javascript
// 현재 투두 업데이트
await supabase.from('todos').update({ completed: newCompleted }).eq('id', id)

// 원본 투두 완료
await supabase.from('todos').update({ completed: true }).eq('id', originalId)

// 모든 이월 투두들 완료
await supabase.from('todos').update({ completed: true }).eq('original_todo_id', originalId)
```

**변경 후**: 1개만 업데이트
```javascript
await supabase
  .from('todos')
  .update({
    completed: newCompleted,
    completed_at: completedAt
  })
  .eq('id', id)
```

### 4. 삭제 로직 단순화
**현재**: 4가지 복잡한 옵션
- 옵션 1: 현재 + 원본 삭제
- 옵션 2: 현재만 삭제
- 옵션 3: 원본 + 과거 이월 삭제 + 새 원본 생성
- 옵션 4: 원본 + 모든 이월 삭제

**변경 후**: 2가지 단순 옵션
- 옵션 1: 이 날짜에서만 숨김 → `hidden_dates`에 날짜 추가
- 옵션 2: 완전 삭제 → `deleted = true`

```javascript
// 옵션 1: 이 날짜에서만 숨김
const deleteOnlyThisDate = async (todo, dateStr) => {
  const hiddenDates = todo.hidden_dates || []
  await supabase
    .from('todos')
    .update({ hidden_dates: [...hiddenDates, dateStr] })
    .eq('id', todo.id)
}

// 옵션 2: 완전 삭제
const deleteCompletely = async (todo) => {
  await supabase
    .from('todos')
    .update({ deleted: true, deleted_date: formatDateForDB(new Date()) })
    .eq('id', todo.id)
}
```

## 📦 데이터 마이그레이션

### 마이그레이션 스크립트
```sql
-- 1. 새 컬럼 추가
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS visible_dates JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS hidden_dates JSONB DEFAULT '[]'::jsonb;

-- 2. 기존 데이터를 새 구조로 변환
-- 원본 투두들 (original_todo_id가 null인 것들)
UPDATE todos
SET visible_dates = (
  SELECT jsonb_agg(DISTINCT t.date ORDER BY t.date)
  FROM todos t
  WHERE t.original_todo_id = todos.id OR t.id = todos.id
)
WHERE original_todo_id IS NULL;

-- 3. 이월된 투두들 삭제 (원본만 남김)
DELETE FROM todos WHERE original_todo_id IS NOT NULL;

-- 4. date 컬럼을 created_date로 의미 변경
ALTER TABLE todos RENAME COLUMN date TO created_date;
```

## ⚠️ 주의사항

1. **백업 필수**: 마이그레이션 전 데이터베이스 전체 백업
2. **단계적 적용**:
   - 먼저 새 컬럼 추가
   - 마이그레이션 스크립트 실행
   - 애플리케이션 코드 배포
   - 구 컬럼 삭제
3. **롤백 계획**: 문제 발생 시 되돌릴 수 있는 방법 준비
4. **테스트**:
   - 로컬 환경에서 충분히 테스트
   - 더미 데이터로 모든 시나리오 검증

## 🎯 예상 효과

### 성능 개선
- ✅ 레코드 수 대폭 감소 (이월된 투두 수만큼)
- ✅ 쿼리 단순화
- ✅ 업데이트 연산 최소화

### 코드 품질
- ✅ 로직 단순화 (약 200라인 감소 예상)
- ✅ 버그 가능성 감소
- ✅ 유지보수 용이

### 사용자 경험
- ✅ 삭제 옵션 단순화 (4개 → 2개)
- ✅ 응답 속도 향상
- ✅ 일관성 있는 동작

## 📝 작업 순서

1. ✅ 현재 버전 커밋 및 배포 (완료)
2. ⏳ 새 브랜치 생성 (`refactor/json-based-carryover`)
3. ⏳ 스키마 변경 적용
4. ⏳ 마이그레이션 스크립트 작성 및 테스트
5. ⏳ fetchTodos 수정
6. ⏳ 이월 로직 재작성
7. ⏳ 삭제 로직 단순화
8. ⏳ 완료/미완료 토글 수정
9. ⏳ 전체 테스트
10. ⏳ PR 생성 및 리뷰
11. ⏳ 메인 브랜치 병합 및 배포

## 💬 토론 필요 사항

1. **삭제 옵션**: 2개로 충분한가? 아니면 추가 옵션 필요?
2. **마이그레이션 타이밍**: 언제 진행할 것인가?
3. **롤백 전략**: 문제 발생 시 어떻게 대응할 것인가?

---

**작성자**: Claude Code
**다음 세션 참고사항**: 이 문서를 먼저 읽고 리팩토링 작업 진행
