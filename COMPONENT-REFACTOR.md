# Todo Note 컴포넌트 리팩토링 계획서

> 📅 생성일: 2025-12-11
> 🎯 상태: Phase 1 완료
> 📊 진행률: 10% (5/50)

---

## 📋 목차
- [현재 상태 진단](#현재-상태-진단)
- [목표 아키텍처](#목표-아키텍처)
- [단계별 작업 계획](#단계별-작업-계획)
- [세션 인계 가이드](#세션-인계-가이드)

---

## 📊 현재 상태 진단

### 파일 크기
```
파일명              줄 수      상태
─────────────────────────────────────
src/App.jsx        8,087줄   🔴 매우 심각
  ├─ App 함수     ~5,383줄
  ├─ useState        69개
  ├─ useEffect       18개
  └─ 함수 정의      126개

src/App.css        5,024줄   🔴 매우 심각
  └─ 미디어 쿼리     17개
```

### 주요 문제점
1. ❌ **단일 책임 원칙 위반** - 하나의 컴포넌트가 모든 것 담당
2. ❌ **관심사의 분리 부족** - UI/로직/데이터가 모두 섞임
3. ❌ **컴포넌트 크기 초과** - 권장 400줄 vs 현재 8,087줄
4. ❌ **테스트 불가능** - 단위 테스트 작성 불가
5. ❌ **높은 결합도** - 한 곳 수정이 다른 곳에 영향
6. ❌ **낮은 재사용성** - 다른 프로젝트에 재사용 불가
7. ❌ **Merge conflict 위험** - 협업 시 충돌 가능성 높음
8. ❌ **코드 리뷰 불가능** - 파일이 너무 커서 리뷰 어려움

---

## 🎯 목표 아키텍처

### 폴더 구조
```
src/
├── components/
│   ├── Todo/
│   │   ├── TodoList.jsx
│   │   ├── TodoItem.jsx
│   │   ├── TodoInput.jsx
│   │   ├── SubTodoList.jsx
│   │   └── TodoBadges.jsx
│   ├── Routine/
│   │   ├── RoutineManager.jsx
│   │   ├── RoutineModal.jsx
│   │   ├── RoutineSetupModal.jsx
│   │   └── RoutineHistoryModal.jsx
│   ├── Memo/
│   │   ├── MemoSection.jsx
│   │   └── MemoModal.jsx
│   ├── KeyThoughts/
│   │   ├── KeyThoughtsSection.jsx
│   │   ├── NotionBlock.jsx
│   │   └── KeyThoughtsHistory.jsx
│   ├── Navigation/
│   │   ├── Header.jsx
│   │   ├── DateNavigation.jsx
│   │   ├── Sidebar.jsx
│   │   └── SectionPagination.jsx
│   ├── Auth/
│   │   └── GoogleAuthButton.jsx
│   ├── Modals/
│   │   ├── GanttChartModal.jsx
│   │   ├── TrashModal.jsx
│   │   ├── EncouragementModal.jsx
│   │   └── TodoActionsModal.jsx
│   └── Common/
│       ├── AppleTimePicker.jsx
│       ├── Toast.jsx
│       └── DragHandle.jsx
├── hooks/
│   ├── useTodos.js
│   ├── useRoutines.js
│   ├── useMemo.js
│   ├── useKeyThoughts.js
│   ├── useAuth.js
│   ├── useSupabase.js
│   ├── useCarryOver.js
│   └── useSectionOrder.js
├── utils/
│   ├── dateUtils.js
│   ├── formatters.js
│   └── constants.js
├── styles/
│   ├── App.css (전역 스타일만)
│   ├── components/
│   │   ├── todo.css
│   │   ├── routine.css
│   │   ├── memo.css
│   │   ├── keyThoughts.css
│   │   └── navigation.css
│   └── variables.css
└── App.jsx (200-300줄 목표)
```

---

## 📝 단계별 작업 계획

### ✅ Phase 1: 준비 단계 (1-5) - 완료
- [x] **1.1** 프로젝트 폴더 구조 생성
- [x] **1.2** constants.js 생성 (DAYS, DEFAULT_SPEC_CONTENT)
- [x] **1.3** dateUtils.js 생성 (formatDateForDB, isToday 등)
- [x] **1.4** formatters.js 생성
- [x] **1.5** variables.css 생성 (색상, 크기 변수)

### ✅ Phase 2: Hooks 분리 (6-15)
- [ ] **2.1** useAuth.js (세션, 로그인)
- [ ] **2.2** useSupabase.js (DB 연결)
- [ ] **2.3** useTodos.js (투두 CRUD)
- [ ] **2.4** useRoutines.js (루틴 관리)
- [ ] **2.5** useMemo.js (메모 관리)
- [ ] **2.6** useKeyThoughts.js (주요 생각정리)
- [ ] **2.7** useCarryOver.js (이월 로직)
- [ ] **2.8** useSectionOrder.js (섹션 순서)
- [ ] **2.9** App.jsx에 훅 import  및 적용
- [ ] **2.10** 테스트 & 커밋

### ✅ Phase 3: Common 컴포넌트 (16-20)
- [ ] **3.1** AppleTimePicker.jsx 분리
- [ ] **3.2** Toast.jsx 분리
- [ ] **3.3** DragHandle.jsx 분리
- [ ] **3.4** App.jsx에 import 및 적용
- [ ] **3.5** 테스트 & 커밋

### ✅ Phase 4: Navigation 컴포넌트 (21-25)
- [ ] **4.1** DateNavigation.jsx 분리
- [ ] **4.2** Header.jsx 분리
- [ ] **4.3** Sidebar.jsx 분리
- [ ] **4.4** SectionPagination.jsx 분리
- [ ] **4.5** navigation.css 분리, 테스트 & 커밋

### ✅ Phase 5: Todo 컴포넌트 (26-30)
- [ ] **5.1** TodoBadges.jsx 분리
- [ ] **5.2** SubTodoList.jsx 분리
- [ ] **5.3** TodoItem.jsx 분리 (SortableTodoItem)
- [ ] **5.4** TodoInput.jsx 분리
- [ ] **5.5** TodoList.jsx 분리 (TodoSection)
- [ ] **5.6** todo.css 분리, 테스트 & 커밋

### ✅ Phase 6: Routine 컴포넌트 (31-34)
- [ ] **6.1** RoutineHistoryModal.jsx 분리
- [ ] **6.2** RoutineSetupModal.jsx 분리
- [ ] **6.3** RoutineModal.jsx 분리
- [ ] **6.4** routine.css 분리, 테스트 & 커밋

### ✅ Phase 7: Memo & KeyThoughts (35-39)
- [ ] **7.1** MemoModal.jsx 분리
- [ ] **7.2** MemoSection.jsx 분리
- [ ] **7.3** NotionBlock.jsx 분리
- [ ] **7.4** KeyThoughtsSection.jsx 분리
- [ ] **7.5** KeyThoughtsHistory.jsx 분리
- [ ] **7.6** CSS 분리, 테스트 & 커밋

### ✅ Phase 8: Modals (40-43)
- [ ] **8.1** GanttChartModal.jsx 분리
- [ ] **8.2** TrashModal.jsx 분리
- [ ] **8.3** EncouragementModal.jsx 분리
- [ ] **8.4** TodoActionsModal.jsx 분리
- [ ] **8.5** 테스트 & 커밋

### ✅ Phase 9: Auth (44-45)
- [ ] **9.1** GoogleAuthButton.jsx 분리
- [ ] **9.2** 테스트 & 커밋

### ✅ Phase 10: 최종 정리 (46-50)
- [ ] **10.1** App.jsx 최종 정리 (200-300줄 목표)
- [ ] **10.2** CSS 파일 최종 정리
- [ ] **10.3** import 최적화
- [ ] **10.4** 불필요한 코드 제거
- [ ] **10.5** 전체 동작 테스트
- [ ] **10.6** 최종 커밋 & 배포

---

## 📌 진행 상황 추적

### 현재 상태
**작업 중**: Phase 1 완료 - 커밋 및 테스트
**다음 단계**: Phase 2.1 - useAuth.js 분리

### 완료된 단계
- ✅ **Phase 1 완료** (5/5 단계)
  - ✅ Phase 1.1 - 프로젝트 폴더 구조 생성
  - ✅ Phase 1.2 - constants.js 생성 (DAYS, DEFAULT_SPEC_CONTENT, AUTO_SAVE_DELAY, DEFAULT_HOUR, DEFAULT_MINUTE)
  - ✅ Phase 1.3 - dateUtils.js 생성 (formatDateForDB, formatDateOnly, formatDate, isToday)
  - ✅ Phase 1.4 - formatters.js 생성 (padZero, splitLines, trimText, parseTime, getDateFromISO)
  - ✅ Phase 1.5 - variables.css 생성 (색상, 간격, 폰트 크기, 브레이크포인트 등)

---

## 💡 세션 인계 가이드

### 새 세션에서 작업 시작할 때
1. **이 파일 확인** - `COMPONENT-REFACTOR.md` 읽기
2. **진행 상황 파악** - "현재 상태" 섹션에서 체크
3. **다음 단계 진행** - "다음 단계"부터 작업 시작
4. **체크박스 업데이트** - 완료 시 `[x]` 표시
5. **커밋 메시지** - 단계 번호 포함 (예: "Phase 1.1: 폴더 구조 생성")

### 각 단계 작업 흐름
```
1. 체크박스 확인 → 현재 진행할 단계 확인
2. 작업 수행 → 파일 생성/수정
3. 테스트 → 브라우저에서 동작 확인
4. 체크박스 업데이트 → [x] 표시
5. 커밋 → git commit with 단계 번호
6. 다음 단계로 이동
```

---

## ⚠️ 주의사항

### 🚨 반드시 지켜야 할 것
1. **기능 보존** - 모든 기능이 정상 작동해야 함
2. **스타일 유지** - 디자인이 깨지면 안 됨
3. **점진적 진행** - 한 번에 하나씩만 변경
4. **매 단계 테스트** - 브라우저에서 즉시 확인
5. **작은 커밋** - 각 단계마다 커밋
6. **롤백 준비** - 문제 시 이전 단계로 복원 가능

### 🔍 테스트 체크리스트
- [ ] 투두 추가/수정/삭제 정상 작동
- [ ] 루틴 설정/조회/삭제 정상 작동
- [ ] 메모 작성/저장 정상 작동
- [ ] 주요 생각정리 블록 편집 정상 작동
- [ ] 날짜 네비게이션 정상 작동
- [ ] 드래그 앤 드롭 정상 작동
- [ ] 모바일 UI 정상 표시
- [ ] 스타일 깨짐 없음
- [ ] 콘솔 에러 없음

---

## 🎉 완료 기준

### 최종 목표
- [ ] **App.jsx** 200-300줄 이하
- [ ] **App.css** 500줄 이하 (전역 스타일만)
- [ ] **모든 기능 정상 작동**
- [ ] **모든 스타일 유지**
- [ ] **브라우저 에러 없음**
- [ ] **배포 후 정상 작동 확인**

### 성공 지표
- ✅ 컴포넌트 재사용 가능
- ✅ 단위 테스트 작성 가능
- ✅ 코드 리뷰 용이
- ✅ Merge conflict 감소
- ✅ 유지보수성 향상

---

## 📚 참고 자료

### 폴더 생성 명령어
```bash
mkdir -p src/components/{Todo,Routine,Memo,KeyThoughts,Navigation,Auth,Modals,Common}
mkdir -p src/hooks
mkdir -p src/utils
mkdir -p src/styles/components
```

### 커밋 메시지 예시
```
Phase 1.1: 프로젝트 폴더 구조 생성
Phase 2.3: useTodos 훅 분리 및 적용
Phase 5.3: TodoItem 컴포넌트 분리
```

---

**📅 마지막 업데이트**: 2025-12-11 (초기 작성)
**👤 작성자**: Claude Code
**🔗 관련 문서**: REFACTORING-PLAN.md (데이터 구조 리팩토링)
