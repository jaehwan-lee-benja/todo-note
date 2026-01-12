# Todo-Note 리팩토링 기획서

## 1. 현황 분석

### 1.1 코드 규모
| 파일 | 원래 | 현재 | 감소 | 상태 |
|------|------|------|------|------|
| App.jsx | 1,967 | 1,865 | -102 | 주의 |
| SortableTodoItem.jsx | 1,414 | 1,190 | -224 | 주의 |
| useTodos.js | 1,055 | 797 | -258 | 개선됨 |
| 전체 | 8,106 | 7,500 | -600+ | 진행중 |

### 1.2 주요 문제점

#### A. 거대 컴포넌트
- **App.jsx**: 30+ 상태 변수, 20+ 훅 사용, 모든 비즈니스 로직 집중
- **SortableTodoItem.jsx**: 38개 useState, 드래그/모달/히스토리 모두 처리

#### B. 코드 중복
- 요일 선택기 UI: 3곳에서 동일 패턴 반복
- 설정 저장/로드: 4곳에서 동일한 Supabase 패턴
- 삭제 확인 UI: 2곳에서 230줄+ 중복
- 모달 상태 관리: 8개 모달이 각각 별도 상태

#### C. 불필요한 파일
- 백업 파일들: App.jsx.backup, .bak, .tmp1-6 등

---

## 2. 리팩토링 원칙

### 2.1 핵심 원칙
1. **단일 책임 원칙 (SRP)**: 한 파일/컴포넌트는 한 가지 역할만
2. **300줄 규칙**: 파일당 최대 300줄 목표
3. **DRY (Don't Repeat Yourself)**: 2회 이상 반복되면 추출
4. **점진적 리팩토링**: 기능 유지하면서 단계별 진행

### 2.2 파일 구조 원칙
```
src/
├── components/     # UI 컴포넌트 (표시 담당)
├── hooks/          # 커스텀 훅 (로직 담당)
├── context/        # 전역 상태 (NEW)
├── utils/          # 순수 유틸리티 함수
└── services/       # API/DB 통신 (NEW)
```

### 2.3 네이밍 규칙
- 컴포넌트: PascalCase (예: `DaySelector.jsx`)
- 훅: camelCase + use 접두사 (예: `useModalState.js`)
- 유틸리티: camelCase (예: `settingsService.js`)

---

## 3. 리팩토링 단계

### Phase 1: 정리 (30분) ✅ 완료
- [x] 백업 파일 삭제 (11개 삭제)
- [x] .gitignore 업데이트

### Phase 2: 공통 컴포넌트 추출 (2시간) ✅ 완료
- [x] `DaySelector.jsx` - 요일 선택 UI 통합
- [x] `DeleteOptions.jsx` - 삭제 옵션 선택 UI

### Phase 3: 서비스 레이어 생성 (1시간) ✅ 완료
- [x] `services/settingsService.js` - 설정 CRUD 통합

### Phase 4: 훅 리팩토링 (2시간) ✅ 완료
- [x] `useModalState.js` - 모달 상태 패턴 통합
- [x] `useTodoOrder.js` - 순서 관리 로직 분리
- [x] `useTodoDragDrop.js` - 드래그 앤 드롭 로직 분리
- [x] `useTodos.js` 리팩토링 (1,055줄 → 797줄)

### Phase 5: SortableTodoItem 분리 (3시간)
- [ ] `TodoItem.jsx` - 기본 표시
- [ ] `TodoItemActions.jsx` - 액션 모달
- [ ] `TodoMoveMenu.jsx` - 이동 메뉴

### Phase 6: App.jsx 분리 (3시간)
- [ ] `AppContent.jsx` - 메인 컨텐츠
- [ ] `AppModals.jsx` - 모달 모음
- [ ] `context/AppStateContext.js` - 전역 상태

---

## 4. 세부 작업 명세

### 4.1 Phase 1: 정리

#### 삭제할 파일
```
src/App.jsx.backup
src/App.jsx.bak
src/App.jsx.bak2
src/App.jsx.tmp1
src/App.jsx.tmp2
src/App.jsx.tmp3
src/App.jsx.tmp4
src/App.jsx.tmp5
src/App.jsx.tmp6
```

---

### 4.2 Phase 2: 공통 컴포넌트 추출

#### DaySelector.jsx
**현재 중복 위치:**
- `App.jsx` 1818-1831줄
- `SortableTodoItem.jsx` 794-806줄
- `RoutineModal.jsx`

**새 컴포넌트:**
```jsx
// components/Common/DaySelector.jsx
function DaySelector({ selectedDays, onChange, size = 'normal' }) {
  return (
    <div className={`day-selector ${size}`}>
      {DAYS.map(day => (
        <button
          key={day.key}
          onClick={() => onChange(day.key)}
          className={selectedDays.includes(day.key) ? 'selected' : ''}
        >
          {day.label}
        </button>
      ))}
    </div>
  )
}
```

**예상 효과:** 약 50줄 감소, 일관된 UI

---

#### DeleteOptions.jsx
**현재 중복 위치:**
- `SortableTodoItem.jsx` 1119-1402줄 (283줄)
- `DeleteConfirmModal.jsx`

**새 컴포넌트:**
```jsx
// components/Common/DeleteOptions.jsx
function DeleteOptions({ selectedOption, onChange, onConfirm, onCancel }) {
  // 삭제 옵션 3개 (이 할일, 이번 및 향후, 모든 할일)
  // 툴팁 포함
}
```

**예상 효과:** 약 200줄 감소

---

### 4.3 Phase 3: 서비스 레이어

#### settingsService.js
**현재 중복 패턴:**
```javascript
// 4곳에서 반복되는 패턴
const { data: existing } = await supabase
  .from('user_settings')
  .select('id')
  .eq('setting_key', 'xxx')
  .maybeSingle()

if (existing) { /* update */ } else { /* insert */ }
```

**새 서비스:**
```javascript
// services/settingsService.js
export const settingsService = {
  async get(key, defaultValue = null) { ... },
  async set(key, value, userId) { ... },
  async remove(key) { ... }
}
```

**사용 예:**
```javascript
// Before (8줄)
const { data } = await supabase.from('user_settings')...

// After (1줄)
const data = await settingsService.get('section_order')
```

**예상 효과:** 약 100줄 감소, 에러 처리 통합

---

### 4.4 Phase 4: 훅 리팩토링

#### useModalState.js
**현재 반복 패턴:**
```javascript
const [showXModal, setShowXModal] = useState(false)
// x 8개 모달
```

**새 훅:**
```javascript
// hooks/useModalState.js
function useModalState(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])
  return { isOpen, open, close, toggle }
}
```

**사용 예:**
```javascript
// Before
const [showMemoModal, setShowMemoModal] = useState(false)
onClick={() => setShowMemoModal(true)}
onClose={() => setShowMemoModal(false)}

// After
const memoModal = useModalState()
onClick={memoModal.open}
onClose={memoModal.close}
```

---

#### useTodos.js 분리

**현재 (1,055줄):**
- CRUD 로직
- 드래그앤드롭 로직
- 순서 변경 로직
- 삭제 로직

**분리 계획:**
| 파일 | 역할 | 예상 줄수 |
|------|------|----------|
| useTodoOperations.js | 추가/수정/삭제/토글 | 300 |
| useTodoOrder.js | 순서 변경/이동 | 200 |
| useTodoDragDrop.js | 드래그앤드롭 | 200 |
| useTodos.js | 통합 (위 훅들 조합) | 150 |

---

### 4.5 Phase 5: SortableTodoItem 분리

**현재 (1,414줄):**
- 투두 표시 UI
- 체크박스/편집
- 이동 메뉴
- 액션 모달 (나노투두, 루틴설정, 히스토리, 삭제)
- 루틴 기록 달력

**분리 계획:**
| 파일 | 역할 | 예상 줄수 |
|------|------|----------|
| TodoItem.jsx | 기본 표시 + 체크박스 | 150 |
| TodoMoveMenu.jsx | 이동 메뉴 | 80 |
| TodoActionsModal.jsx | 액션 모달 컨테이너 | 100 |
| TodoNanotodos.jsx | 나노투두 섹션 | 80 |
| TodoRoutineSetup.jsx | 루틴 설정 섹션 | 150 |
| TodoHistory.jsx | 히스토리 섹션 | 120 |
| TodoRoutineStats.jsx | 루틴 기록 달력 | 180 |

**총합:** 860줄 (554줄 감소)

---

### 4.6 Phase 6: App.jsx 분리

**현재 (1,967줄):**
- 상태 선언 (200줄)
- 훅 사용 (100줄)
- 이벤트 핸들러 (300줄)
- useEffect들 (400줄)
- 렌더링 (900줄)

**분리 계획:**
| 파일 | 역할 | 예상 줄수 |
|------|------|----------|
| App.jsx | 최상위 컴포넌트 | 150 |
| AppContent.jsx | 메인 컨텐츠 렌더링 | 300 |
| AppModals.jsx | 모달 모음 | 200 |
| AppSections.jsx | 섹션 렌더링 | 300 |
| context/AppStateContext.js | 전역 상태 | 200 |

---

## 5. 우선순위 및 일정

### 즉시 진행 (Phase 1-2)
| 작업 | 예상 시간 | 영향도 |
|------|----------|--------|
| 백업 파일 삭제 | 10분 | 낮음 |
| DaySelector 추출 | 30분 | 중간 |
| DeleteOptions 추출 | 1시간 | 높음 |

### 단기 (Phase 3-4)
| 작업 | 예상 시간 | 영향도 |
|------|----------|--------|
| settingsService | 1시간 | 중간 |
| useModalState | 30분 | 중간 |
| useTodos 분리 | 2시간 | 높음 |

### 중기 (Phase 5-6)
| 작업 | 예상 시간 | 영향도 |
|------|----------|--------|
| SortableTodoItem 분리 | 3시간 | 매우 높음 |
| App.jsx 분리 | 3시간 | 매우 높음 |

---

## 6. 성공 기준

### 정량적 목표
- [ ] App.jsx: 1,967줄 → 300줄 이하
- [ ] SortableTodoItem.jsx: 1,414줄 → 300줄 이하
- [ ] 단일 파일 최대 줄수: 300줄
- [ ] 코드 중복률: 50% 감소

### 정성적 목표
- [ ] 새 기능 추가 시 수정 파일 수 감소
- [ ] 컴포넌트 단위 테스트 가능
- [ ] 코드 가독성 향상

---

## 7. 리스크 및 대응

| 리스크 | 영향 | 대응 방안 |
|--------|------|----------|
| 기능 손상 | 높음 | 단계별 테스트, 작은 커밋 |
| props drilling 증가 | 중간 | Context API 활용 |
| 성능 저하 | 중간 | React.memo, useMemo 활용 |
| 일정 지연 | 낮음 | 우선순위 기반 점진적 진행 |

---

## 8. 승인 요청

위 리팩토링 계획에 대해 검토 부탁드립니다.

- [ ] Phase 1-2만 진행 (기본 정리 + 공통 컴포넌트)
- [ ] Phase 1-4까지 진행 (서비스/훅 포함)
- [ ] 전체 진행 (Phase 1-6)
- [ ] 수정 필요 (의견 추가)

---

*작성일: 2026-01-12*
*예상 총 소요시간: 12-15시간*
