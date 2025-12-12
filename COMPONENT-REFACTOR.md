# Todo Note 컴포넌트 리팩토링 계획서

> 📅 생성일: 2025-12-11
> 📅 마지막 업데이트: 2025-12-12
> 🎯 상태: Phase 8 완료 (Modals 컴포넌트 분리)
> 📊 진행률: 46% (23/50)
> 📝 App.jsx: 4,372줄 (원래 8,087줄에서 3,715줄 감소, 45.9% 감소)

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
- [x] **2.1** useAuth.js (세션, 로그인)
- [ ] **2.2** useSupabase.js (DB 연결)
- [ ] **2.3** useTodos.js (투두 CRUD)
- [ ] **2.4** useRoutines.js (루틴 관리)
- [ ] **2.5** useMemo.js (메모 관리)
- [ ] **2.6** useKeyThoughts.js (주요 생각정리)
- [ ] **2.7** useCarryOver.js (이월 로직)
- [ ] **2.8** useSectionOrder.js (섹션 순서)
- [ ] **2.9** App.jsx에 훅 import  및 적용
- [ ] **2.10** 테스트 & 커밋

### ✅ Phase 3: Common 컴포넌트 (16-20) - 완료
- [x] **3.1** AppleTimePicker.jsx 분리
- [x] **3.2** Toast.jsx 분리
- [x] **3.3** DragHandle.jsx 분리 (별도 컴포넌트 불필요, 생략)
- [x] **3.4** App.jsx에 import 및 적용
- [x] **3.5** 테스트 & 커밋

### ✅ Phase 4: Navigation 컴포넌트 (21-25) - 완료
- [x] **4.1** DateNavigation.jsx 분리 (24줄)
- [x] **4.2** Header.jsx 분리 (105줄)
- [x] **4.3** Sidebar.jsx 분리 (181줄)
- [x] **4.4** SectionPagination.jsx 분리 (65줄)
- [x] **4.5** navigation.css 분리 생략 (기존 CSS 유지), 테스트 & 커밋

### ✅ Phase 5: Todo 컴포넌트 (26-27) - 완료
- [x] **5.1** TodoSection.jsx 분리 (35줄) - 재사용 가능한 투두 섹션 (헤더 + 입력 필드)
- [x] **5.2** SortableTodoItem.jsx 분리 (1,425줄) - 드래그 가능한 투두 항목 (서브투두, 루틴, 히스토리 포함)
- [x] **5.3** App.jsx에 import 및 적용
- [x] **5.4** 테스트 & 커밋 (1,451줄 감소, App.jsx: 7,526→6,075줄)

### ✅ Phase 6: Routine 컴포넌트 (28-29) - 완료
- [x] **6.1** RoutineModal.jsx 분리 (172줄) - 루틴 관리 모달
- [x] **6.2** RoutineHistoryModal.jsx 분리 (194줄) - 루틴 히스토리 달력
- [x] **6.3** App.jsx에 import 및 적용
- [x] **6.4** 테스트 & 커밋 (266줄 감소, App.jsx: 6,075→5,809줄)

### ✅ Phase 7: Memo & KeyThoughts (35-39) - 완료
- [ ] **7.1** MemoModal.jsx 분리 (생략 - 인라인 편집으로 구현)
- [x] **7.2** MemoSection.jsx 분리 (79줄) - 재사용 가능한 메모 섹션
- [x] **7.3** NotionBlock.jsx 분리 (531줄) - 드래그 가능한 노션 스타일 블록
- [x] **7.4** KeyThoughtsSection.jsx 분리 (328줄) - 주요 생각정리 섹션
- [ ] **7.5** KeyThoughtsHistory.jsx 분리 (생략 - 기존 히스토리 기능 유지)
- [x] **7.6** App.jsx에 import 및 적용, 테스트 & 커밋 (915줄 감소, App.jsx: 5,809→4,894줄)

### ✅ Phase 8: Modals (40-43) - 완료
- [x] **8.1** TrashModal.jsx 분리 (133줄) - 휴지통 모달
- [x] **8.2** DummyModal.jsx 분리 (114줄) - 더미 데이터 관리
- [x] **8.3** GanttChartModal.jsx 분리 (134줄) - 간트차트 시각화
- [x] **8.4** EncouragementModal.jsx 분리 (133줄) - 격려 문구 관리
- [x] **8.5** KeyThoughtsHistoryModal.jsx 분리 (97줄) - 주요 생각정리 히스토리
- [x] **8.6** App.jsx에 import 및 적용, 테스트 & 커밋 (522줄 감소, App.jsx: 4,894→4,372줄)

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
**작업 완료**: Phase 1 (5/5), Phase 2.1 (1/10), Phase 3 (5/5), Phase 4 (5/5), Phase 5 (4/4), Phase 6 (4/4), Phase 7 (3/6), Phase 8 (6/6)
**다음 세션 시작점**: Phase 9 Auth 컴포넌트 분리
**권장사항**: Phase 9 Auth 컴포넌트 분리 및 Phase 10 최종 정리로 목표 달성

### 완료된 단계
- ✅ **Phase 1 완료** (5/5 단계)
  - ✅ Phase 1.1 - 프로젝트 폴더 구조 생성
  - ✅ Phase 1.2 - constants.js 생성 (DAYS, DEFAULT_SPEC_CONTENT, AUTO_SAVE_DELAY, DEFAULT_HOUR, DEFAULT_MINUTE)
  - ✅ Phase 1.3 - dateUtils.js 생성 (formatDateForDB, formatDateOnly, formatDate, isToday)
  - ✅ Phase 1.4 - formatters.js 생성 (padZero, splitLines, trimText, parseTime, getDateFromISO)
  - ✅ Phase 1.5 - variables.css 생성 (색상, 간격, 폰트 크기, 브레이크포인트 등)
- ✅ **Phase 2 진행 중** (1/10 단계)
  - ✅ Phase 2.1 - useAuth.js 분리 (session, authLoading, handleGoogleLogin, handleLogout)
- ✅ **Phase 3 완료** (5/5 단계)
  - ✅ Phase 3.1 - AppleTimePicker.jsx 분리 (162줄)
  - ✅ Phase 3.2 - Toast.jsx 분리 (17줄)
  - ✅ Phase 3.3 - DragHandle.jsx 생략 (별도 컴포넌트 불필요)
  - ✅ Phase 3.4 - App.jsx에 import 및 적용
  - ✅ Phase 3.5 - 테스트 완료, 에러 없음
- ✅ **Phase 4 완료** (5/5 단계)
  - ✅ Phase 4.1 - DateNavigation.jsx 분리 (24줄)
  - ✅ Phase 4.2 - Header.jsx 분리 (105줄)
  - ✅ Phase 4.3 - Sidebar.jsx 분리 (181줄)
  - ✅ Phase 4.4 - SectionPagination.jsx 분리 (65줄)
  - ✅ Phase 4.5 - App.jsx에 import 및 적용, 테스트 완료
- ✅ **Phase 5 완료** (4/4 단계)
  - ✅ Phase 5.1 - TodoSection.jsx 분리 (35줄)
  - ✅ Phase 5.2 - SortableTodoItem.jsx 분리 (1,425줄)
  - ✅ Phase 5.3 - App.jsx에 import 및 적용
  - ✅ Phase 5.4 - 테스트 완료, 커밋 (1,451줄 감소, App.jsx: 7,526→6,075줄)
- ✅ **Phase 6 완료** (4/4 단계)
  - ✅ Phase 6.1 - RoutineModal.jsx 분리 (172줄)
  - ✅ Phase 6.2 - RoutineHistoryModal.jsx 분리 (194줄)
  - ✅ Phase 6.3 - App.jsx에 import 및 적용
  - ✅ Phase 6.4 - 테스트 완료, 커밋 (266줄 감소, App.jsx: 6,075→5,809줄)
- ✅ **Phase 7 완료** (3/6 단계, 3개 생략)
  - ✅ Phase 7.2 - MemoSection.jsx 분리 (79줄)
  - ✅ Phase 7.3 - NotionBlock.jsx 분리 (531줄) - SortableNotionBlock, NotionBlock 포함
  - ✅ Phase 7.4 - KeyThoughtsSection.jsx 분리 (328줄)
  - ✅ Phase 7.6 - App.jsx에 import 및 적용, 테스트 완료, 커밋 (915줄 감소, App.jsx: 5,809→4,894줄)
- ✅ **Phase 8 완료** (6/6 단계)
  - ✅ Phase 8.1 - TrashModal.jsx 분리 (133줄) - 휴지통 모달
  - ✅ Phase 8.2 - DummyModal.jsx 분리 (114줄) - 더미 데이터 관리
  - ✅ Phase 8.3 - GanttChartModal.jsx 분리 (134줄) - 간트차트 시각화
  - ✅ Phase 8.4 - EncouragementModal.jsx 분리 (133줄) - 격려 문구 관리
  - ✅ Phase 8.5 - KeyThoughtsHistoryModal.jsx 분리 (97줄) - 주요 생각정리 히스토리
  - ✅ Phase 8.6 - App.jsx에 import 및 적용, 테스트 완료, 커밋 (522줄 감소, App.jsx: 4,894→4,372줄)

### 미완료 단계 (Phase 2.2-2.10)
⚠️ **주의**: Phase 2 나머지 훅 분리는 복잡도가 매우 높음
- ⏳ Phase 2.2 - useSupabase.js (이미 supabaseClient.js로 분리됨, 건너뛰기 가능)
- ⏳ Phase 2.3 - useTodos.js (매우 복잡, 400+ 줄 예상)
- ⏳ Phase 2.4 - useRoutines.js (복잡, 300+ 줄 예상)
- ⏳ Phase 2.5 - useMemo.js (중간, 100+ 줄)
- ⏳ Phase 2.6 - useKeyThoughts.js (중간, 200+ 줄)
- ⏳ Phase 2.7 - useCarryOver.js (복잡, 200+ 줄)
- ⏳ Phase 2.8 - useSectionOrder.js (간단, 50+ 줄)
- ⏳ Phase 2.9 - App.jsx 적용 및 테스트
- ⏳ Phase 2.10 - 커밋 & 배포

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

## 📝 현재 세션 요약 (2025-12-11)

### 완료된 작업
✅ **Phase 1: 준비 단계** (5/5 완료)
- 프로젝트 폴더 구조 생성
- utils 파일 생성 (constants, dateUtils, formatters)
- styles 파일 생성 (variables.css)
- App.jsx에서 약 60줄 감소

✅ **Phase 2.1: useAuth 훅 분리** (1/10 완료)
- 인증 관련 로직 완전 분리
- App.jsx에서 약 45줄 감소
- 모든 기능 정상 작동 확인

### 다음 세션 제안사항

#### 옵션 1: Phase 2 계속 진행 (훅 분리)
**장점**: 로직 분리로 유지보수성 향상
**단점**: 매우 시간 소요 (Phase 2.3-2.8은 각각 200-400줄)
**예상 소요**: 5-8시간

#### 옵션 2: Phase 3-4 먼저 진행 (컴포넌트 분리) ⭐ 권장
**장점**:
- 시각적으로 명확한 개선 (파일 수 증가)
- 작은 컴포넌트로 분리하기 쉬움
- 더 빠른 진행 가능
**추천 순서**:
1. Phase 3: Common 컴포넌트 (AppleTimePicker, Toast, DragHandle)
2. Phase 4: Navigation 컴포넌트 (Header, DateNavigation, Sidebar)
3. Phase 5: Todo 컴포넌트 (TodoItem, TodoList, TodoBadges)

#### 옵션 3: 하이브리드 방식
- Phase 2는 간소화 (핵심 2-3개 훅만)
- Phase 3-5 컴포넌트 분리 우선
- 나머지 훅은 필요 시 진행

### 현재 파일 크기
```
src/App.jsx: 7,970줄 (원래 8,087줄)
src/App.css: 5,024줄
```

**목표**: App.jsx 200-300줄로 축소

---

**📅 마지막 업데이트**: 2025-12-11
**👤 작성자**: Claude Code
**🔗 관련 문서**: REFACTORING-PLAN.md (데이터 구조 리팩토링)
