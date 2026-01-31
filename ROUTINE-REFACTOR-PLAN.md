# 루틴 시스템 리팩토링 기획서

## 개요

루틴을 별도 섹션에서 관리하는 방식에서, **일반 투두에 반복 기능을 추가**하는 방식으로 전환한다.
동시에 섹션 구조를 통일하여 기본 섹션과 사용자 정의 섹션을 동일한 방식으로 관리한다.

---

## 1. 현재 구조의 문제점

### 1.1 루틴 시스템
- `routines` 테이블과 `todos` 테이블이 이원화되어 있음
- `section_type: 'routine' | 'pending_routine'`으로 섹션 자체가 루틴을 구분
- 루틴 투두는 일반 투두와 다른 흐름으로 관리됨

### 1.2 섹션 시스템
- 기본 섹션 3개가 하드코딩: `['timeline', 'routine', 'normal']`
- 사용자 정의 섹션만 동적 관리 (`user_settings`)
- 기본 섹션을 지정하거나 변경할 수 없음

---

## 2. 목표 구조

### 2.1 핵심 변경 사항

| 항목 | 현재 | 변경 후 |
|-----|------|--------|
| 루틴 관리 | `routines` 테이블 + 별도 섹션 | 투두 자체에 반복 속성 |
| 섹션 구분 | `section_type` (하드코딩) | `sections` 테이블 (동적) |
| 기본 섹션 | 고정 (normal) | 지정 가능 (`is_default`) |
| "for 날짜" 표기 | 이미 구현됨 | 유지 (반복 투두에만 표시) |
| "미정" 배지 | 구현됨 (`is_pending_routine`) | **제거** (명시적 반복 타입 선택) |
| 루틴 통계 | 히스토리 모달 | **제거 (차후 개발)** |

### 2.2 새로운 데이터 구조

#### A. sections 테이블 (신규)

```sql
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📋',
  is_default BOOLEAN DEFAULT FALSE,    -- 기본 섹션 여부 (1개만 true)
  is_system BOOLEAN DEFAULT FALSE,     -- 시스템 섹션 (삭제 불가)
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted BOOLEAN DEFAULT FALSE
);

-- 사용자별 기본 섹션은 1개만
CREATE UNIQUE INDEX idx_sections_default
  ON sections(user_id) WHERE is_default = TRUE AND deleted = FALSE;
```

#### B. todos 테이블 변경

```sql
-- 기존 필드 유지
-- routine_id, is_pending_routine, section_type → 제거 예정 (마이그레이션 후)

-- 신규 필드
ALTER TABLE todos ADD COLUMN repeat_type TEXT DEFAULT 'none';
  -- 'none': 반복 없음
  -- 'daily': 매일
  -- 'weekly': 매주 특정 요일
  -- 'weekdays': 평일만
  -- 'weekends': 주말만

ALTER TABLE todos ADD COLUMN repeat_days JSONB DEFAULT '[]';
  -- weekly일 때 사용: ["mon", "wed", "fri"]

ALTER TABLE todos ADD COLUMN repeat_start_date DATE;
  -- 반복 시작 날짜

ALTER TABLE todos ADD COLUMN repeat_end_date DATE;
  -- 반복 종료 날짜 (선택)

-- section_id를 sections 테이블 FK로 변경
ALTER TABLE todos ADD COLUMN new_section_id UUID REFERENCES sections(id);
```

### 2.3 섹션 초기화 (신규 사용자)

```javascript
// 첫 로그인 시 기본 섹션 생성
const defaultSections = [
  { name: '타임라인', icon: '⏰', is_system: true, is_default: false, order_index: 0 },
  { name: '일반', icon: '✅', is_system: true, is_default: true, order_index: 1 },
]
```

---

## 3. 반복 투두 동작 방식

### 3.1 반복 설정 UI

투두 추가/수정 시 반복 옵션 선택:

```
[반복 없음] [매일] [평일] [주말] [요일 선택]
                                    ↓
                            [월] [화] [수] [목] [금] [토] [일]
```

### 3.2 "for 날짜" 표기

반복이 설정된 투두는 날짜와 함께 표시:

```
형식: {투두명}-for {M/D(요일)}
예시: 운동하기-for 1/30(목)
      회의 준비-for 1/31(금)
```

**표시 조건:**
- `repeat_type !== 'none'` 인 투두만
- 현재 보고 있는 날짜를 기준으로 표기

### 3.3 반복 투두 생성 로직

```javascript
// 날짜 변경 시 (또는 앱 로드 시)
async function ensureRepeatTodosForDate(targetDate) {
  // 1. 반복 설정된 투두 조회
  const repeatTodos = await getRepeatTodos(userId)

  // 2. 각 투두에 대해 해당 날짜 표시 여부 결정
  for (const todo of repeatTodos) {
    if (shouldShowOnDate(todo, targetDate)) {
      // visible_dates에 날짜 추가 (기존 이월 방식 활용)
      await addToVisibleDates(todo.id, targetDate)
    }
  }
}

function shouldShowOnDate(todo, date) {
  // repeat_start_date 이전이면 표시 안함
  if (todo.repeat_start_date && date < todo.repeat_start_date) return false

  // repeat_end_date 이후면 표시 안함
  if (todo.repeat_end_date && date > todo.repeat_end_date) return false

  // hidden_dates에 있으면 표시 안함
  if (todo.hidden_dates?.includes(date)) return false

  const dayOfWeek = getDayKey(date) // 'mon', 'tue', ...

  switch (todo.repeat_type) {
    case 'daily':
      return true
    case 'weekdays':
      return !['sat', 'sun'].includes(dayOfWeek)
    case 'weekends':
      return ['sat', 'sun'].includes(dayOfWeek)
    case 'weekly':
      return todo.repeat_days.includes(dayOfWeek)
    default:
      return false
  }
}
```

### 3.4 완료 처리

반복 투두 완료 시:
- **해당 날짜만 완료** (다른 날짜에는 영향 없음)
- `visible_dates`에서 해당 날짜의 완료 상태만 기록
- 또는 별도 `completed_dates` 배열로 관리

```javascript
// 옵션 A: completed_dates 배열 추가
{
  visible_dates: ['2025-01-28', '2025-01-29', '2025-01-30'],
  completed_dates: ['2025-01-28', '2025-01-29'],  // 28, 29일은 완료
}

// 옵션 B: 각 날짜별 상태 객체
{
  date_states: {
    '2025-01-28': { completed: true, completed_at: '...' },
    '2025-01-29': { completed: true, completed_at: '...' },
    '2025-01-30': { completed: false },
  }
}
```

**권장: 옵션 A** (기존 구조와 유사, 단순함)

### 3.5 삭제 처리

기존 삭제 옵션 유지:

| 옵션 | 동작 |
|-----|------|
| 이 할일만 | `hidden_dates`에 해당 날짜 추가 |
| 이번 및 향후 | `repeat_end_date`를 오늘로 설정 |
| 모든 할일 | `deleted: true` (soft delete) |

---

## 4. 섹션 관리

### 4.1 섹션 목록

| 섹션 | 타입 | 삭제 가능 | 기본 지정 가능 |
|-----|------|----------|--------------|
| 타임라인 | 시스템 | ❌ | ❌ (시간 기반 특수 섹션) |
| 일반 | 시스템 | ❌ | ✅ |
| 사용자 정의 | 일반 | ✅ | ✅ |

### 4.2 기본 섹션 동작

- 새 투두 추가 시 기본 섹션에 생성
- 사용자가 다른 섹션을 기본으로 지정 가능
- 기본 섹션 삭제 시 → 다른 섹션을 기본으로 지정 필요

### 4.3 타임라인 섹션

- `scheduled_time`이 설정된 투두만 표시
- 다른 섹션 소속이어도 시간이 설정되면 타임라인에 표시
- 기본 섹션으로 지정 불가

---

## 5. 마이그레이션 계획

### 5.1 단계별 마이그레이션

#### Phase 1: 스키마 추가
```sql
-- 1. sections 테이블 생성
-- 2. todos에 새 필드 추가 (repeat_type, repeat_days, etc.)
-- 3. 기존 필드 유지 (하위 호환)
```

#### Phase 2: 데이터 마이그레이션
```sql
-- 1. 기존 사용자별 섹션 데이터 → sections 테이블
-- 2. routines 테이블 데이터 → todos 반복 필드
-- 3. section_type → new_section_id 매핑
```

#### Phase 3: 코드 전환
```javascript
// 1. useRoutines.js → 반복 로직을 useTodos.js로 통합
// 2. useSectionOrder.js → sections 테이블 연동
// 3. 컴포넌트 업데이트
```

#### Phase 4: 정리
```sql
-- 마이그레이션 완료 확인 후
-- 1. routines 테이블 제거
-- 2. todos.routine_id, is_pending_routine, section_type 제거
-- 3. user_settings에서 섹션 관련 설정 제거
```

### 5.2 롤백 계획

각 Phase별 롤백 스크립트 준비:
- 새 테이블/컬럼 삭제
- 데이터 복원 (백업 테이블 활용)

---

## 6. 제거 항목

### 6.1 루틴 통계 기능 (차후 개발)

현재 제거 대상:
- 루틴 히스토리 모달 (`useRoutines.js`의 `getRoutineHistory`)
- 루틴 완료율 계산 로직
- 관련 UI 컴포넌트

차후 개발 시 고려:
- 반복 투두별 완료율
- 기간별 통계 대시보드
- 스트릭(streak) 기능

### 6.2 "미정" 기능 제거

**현재 동작:**
- 요일을 선택하지 않은 루틴 = "미정" (`is_pending_routine: true`)
- `section_type: 'pending_routine'`으로 별도 섹션에 표시
- UI에 "미정" 배지 표시

**제거 이유:**
- 새 구조에서는 반복 타입을 명시적으로 선택 (daily, weekly, weekdays 등)
- "요일 미선택 = 매일 반복"이 아닌, 사용자가 직접 "매일" 선택
- 미정 상태 자체가 불필요

**제거 대상:**
- `todos.is_pending_routine` 필드
- `section_type: 'pending_routine'`
- UI의 "미정" 배지 (`pending-routine-badge`)
- 관련 분기 로직

### 6.3 기존 루틴 섹션

- `section_type: 'routine'` 제거
- `section_type: 'pending_routine'` 제거
- `routines` 테이블 제거
- `useRoutines.js` 훅 제거 또는 대폭 수정

---

## 7. 영향받는 파일

### 7.1 삭제/대폭 수정

| 파일 | 변경 |
|-----|------|
| `src/hooks/useRoutines.js` | 제거 또는 `useRepeatTodos.js`로 대체 |
| `supabase-routine-schema.sql` | 제거 |

### 7.2 수정 필요

| 파일 | 변경 내용 |
|-----|----------|
| `src/hooks/useTodos.js` | 반복 로직 통합, 섹션 연동 변경 |
| `src/hooks/useSectionOrder.js` | sections 테이블 연동 |
| `src/hooks/useTodoCarryOver.js` | 반복 투두 이월 로직 |
| `src/components/Todo/SortableTodoItem.jsx` | "미정" 배지 제거, 반복 아이콘 추가 |
| `src/components/AddTodoInput.jsx` | 반복 설정 UI |
| `src/components/Modals/AddSectionModal.jsx` | sections 테이블 연동 |
| `src/services/settingsService.js` | 섹션 관련 로직 수정 |
| `src/utils/constants.js` | 반복 타입 상수 추가 |

### 7.3 신규 생성

| 파일 | 용도 |
|-----|------|
| `src/hooks/useRepeatTodos.js` | 반복 투두 전용 로직 |
| `src/hooks/useSections.js` | sections 테이블 CRUD |
| `src/components/RepeatSelector.jsx` | 반복 설정 UI 컴포넌트 |
| `create-sections-table.sql` | 섹션 테이블 생성 |
| `migrate-routines-to-repeat.sql` | 데이터 마이그레이션 |

---

## 8. UI 변경 사항

### 8.1 투두 아이템

**Before:**
```
[□] 운동하기                    (루틴 섹션에서)
```

**After:**
```
[□] 운동하기-for 1/30(목) 🔄    (일반 섹션에서, 반복 아이콘 표시)
```

### 8.2 투두 추가

**Before:**
```
[투두 입력] [추가]
--- 별도 루틴 추가 UI ---
[루틴 입력] [요일 선택] [추가]
```

**After:**
```
[투두 입력] [반복 ▼] [추가]
              ↓
         [반복 없음]
         [매일]
         [평일]
         [주말]
         [요일 선택...]
```

### 8.3 섹션 관리

**Before:**
```
⏰ 타임라인
📌 루틴          ← 제거
✅ 일반
🎯 사용자 섹션
```

**After:**
```
⏰ 타임라인
✅ 일반 ⭐        ← 기본 섹션 표시
🎯 사용자 섹션    ← 기본으로 지정 가능
```

---

## 9. 개발 우선순위

### Phase 1: 기반 작업
1. [ ] sections 테이블 생성 및 마이그레이션
2. [ ] todos 테이블에 반복 필드 추가
3. [ ] 기존 데이터 마이그레이션 스크립트 작성

### Phase 2: 섹션 시스템
4. [ ] useSections.js 훅 구현
5. [ ] 섹션 CRUD UI 수정
6. [ ] 기본 섹션 지정 기능

### Phase 3: 반복 투두
7. [ ] 반복 설정 UI (RepeatSelector)
8. [ ] 반복 투두 생성/표시 로직
9. [x] "for 날짜" 표기 (이미 구현됨 - 반복 투두에만 표시되도록 조건 수정)
10. [ ] 반복 투두 완료/삭제 처리
11. [ ] "미정" 배지 및 관련 로직 제거

### Phase 4: 정리
11. [ ] 루틴 통계 기능 제거
12. [ ] 기존 루틴 코드 제거
13. [ ] 테스트 및 버그 수정

---

## 10. 검증 항목

- [ ] 기존 루틴 데이터가 정상 마이그레이션 되었는가
- [ ] 반복 투두가 올바른 날짜에 표시되는가
- [ ] "for 날짜" 표기가 정확한가
- [ ] 기본 섹션 지정이 정상 동작하는가
- [ ] 섹션 순서 변경이 정상 동작하는가
- [ ] 반복 투두 완료/삭제가 의도대로 동작하는가
- [ ] 이월 로직이 반복 투두와 충돌하지 않는가
