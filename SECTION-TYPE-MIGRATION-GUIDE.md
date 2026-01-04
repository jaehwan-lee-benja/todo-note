# section_type 마이그레이션 가이드

## 📋 개요

이 마이그레이션은 Todo 순서 변경 및 섹션 관리의 **구조적 개선**을 위한 것입니다.

### 변경 이유
- **문제점**: 기존 방식은 `routine_id`, `section_id`, `is_pending_routine` 등 여러 컬럼을 조합하여 섹션을 구분
- **한계**:
  - 섹션 간 order_index 중복 발생
  - 필터링 로직 복잡도 증가
  - DB 레벨 정렬 불가
- **해결**: `section_type` 컬럼 추가로 섹션을 명확하게 구분

### 개선 효과
- ✅ 섹션별 독립적인 order_index 관리
- ✅ 명확한 섹션 구분 및 필터링
- ✅ DB 레벨 정렬 지원
- ✅ 코드 가독성 및 유지보수성 향상
- ✅ Realtime 업데이트 안정성 개선

---

## 🚀 마이그레이션 단계

### 1단계: 스키마 변경 (Supabase)

```sql
-- add-section-type-column.sql 파일 실행
```

**실행 방법**:
1. Supabase Dashboard → SQL Editor 접속
2. `add-section-type-column.sql` 내용 복사 & 붙여넣기
3. "Run" 버튼 클릭

**변경 내용**:
- `section_type` 컬럼 추가 (TEXT, CHECK 제약조건)
- 기존 데이터 자동 변환 (UPDATE 쿼리)
- 복합 인덱스 생성 (성능 최적화)

### 2단계: 데이터 검증

```bash
node migrate-section-type.js
```

**검증 항목**:
- section_type NULL 값 확인
- 데이터 일관성 검증 (section_type과 기존 컬럼 매칭)
- 섹션별 order_index 연속성 확인

**정규화 옵션**:
- 스크립트 실행 시 order_index 정규화 여부 선택 가능
- 권장: 정규화 실행 (섹션별 1, 2, 3... 순으로 재정렬)

### 3단계: 프론트엔드 배포

```bash
npm run build
npm run deploy
```

**변경된 파일**:
- `src/hooks/useTodos.js`: section_type 기반 로직
- `src/App.jsx`: section_type 기반 필터링

---

## 🗂️ section_type 값

| 값 | 설명 | 기존 조건 |
|---|---|---|
| `routine` | 확정된 루틴 투두 | `routine_id !== null && !is_pending_routine` |
| `pending_routine` | 미정 루틴 투두 | `is_pending_routine === true` |
| `normal` | 일반 투두 | `routine_id === null && section_id === null` |
| `custom` | 사용자 정의 섹션 | `section_id !== null` |

---

## 🔧 주요 변경 사항

### 1. 투두 추가 시

**이전**:
```javascript
const normalTodos = todos.filter(t => !t.parent_id && t.routine_id === null)
```

**이후**:
```javascript
const normalTodos = todos.filter(t => !t.parent_id && t.section_type === 'normal')
```

### 2. 드래그 앤 드롭

**이전**:
- `section_id`와 `routine_id` 조합으로 섹션 구분
- 섹션 간 이동 시 두 값 모두 비교

**이후**:
- `section_type` 기반 섹션 구분
- custom 섹션에서만 `section_id` 추가 비교
- 명확하고 간결한 로직

### 3. 렌더링 필터링

**이전**:
```javascript
const routineTodos = todos.filter(t =>
  !t.parent_id && t.routine_id !== null && !t.is_pending_routine
)
```

**이후**:
```javascript
const routineTodos = todos.filter(t =>
  !t.parent_id && t.section_type === 'routine'
)
```

---

## ⚠️ 주의사항

### 기존 데이터 호환성
- 마이그레이션 스크립트가 기존 데이터를 자동으로 변환
- `routine_id`, `section_id`, `is_pending_routine` 컬럼은 유지 (하위 호환성)
- 새로 추가되는 투두는 자동으로 `section_type` 설정됨

### 롤백 방법
1. `section_type` 컬럼 제거:
   ```sql
   ALTER TABLE todos DROP COLUMN section_type;
   DROP INDEX idx_todos_section_order;
   ```

2. 프론트엔드 코드 복원:
   - Git에서 이전 버전으로 복구
   - 또는 `section_type` 대신 기존 컬럼 조합 사용

### 트러블슈팅

**Q: section_type이 NULL인 투두가 있다면?**
- A: `add-section-type-column.sql`의 UPDATE 쿼리를 다시 실행하거나, `migrate-section-type.js`로 확인

**Q: 순서가 꼬이는 경우?**
- A: `migrate-section-type.js`에서 "y" 입력하여 order_index 정규화 실행

**Q: Realtime 업데이트 시 순서가 바뀌는 경우?**
- A: 섹션별 정렬 로직이 적용되었는지 확인. App.jsx에서 `.sort((a, b) => a.order_index - b.order_index)` 확인

---

## 📊 DB 쿼리 예시

### 섹션별 정렬 조회
```sql
SELECT
  id,
  text,
  section_type,
  section_id,
  order_index
FROM todos
WHERE deleted = false
ORDER BY
  CASE section_type
    WHEN 'routine' THEN 1
    WHEN 'pending_routine' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'custom' THEN 4
    ELSE 5
  END,
  section_id NULLS FIRST,
  order_index;
```

### 섹션별 통계
```sql
SELECT
  section_type,
  COUNT(*) as count,
  MIN(order_index) as min_order,
  MAX(order_index) as max_order
FROM todos
WHERE deleted = false
  AND parent_id IS NULL
GROUP BY section_type;
```

---

## ✅ 체크리스트

- [ ] Supabase에서 `add-section-type-column.sql` 실행
- [ ] `node migrate-section-type.js` 실행 및 검증
- [ ] order_index 정규화 실행 (권장)
- [ ] 프론트엔드 빌드 및 배포
- [ ] 드래그 앤 드롭 기능 테스트
  - [ ] 같은 섹션 내 순서 변경
  - [ ] 섹션 간 이동 (routine → normal)
  - [ ] 사용자 정의 섹션 간 이동
- [ ] Realtime 업데이트 테스트 (다른 탭에서 변경)
- [ ] 새 투두 추가 테스트 (모든 섹션)
- [ ] 투두 삭제 후 순서 유지 확인

---

## 📝 참고

- 기존 설계 분석: 대화 내용 참고
- 개발자 성향: `.claude/PROJECT_PREFERENCES.md`
- 관련 이슈: Todo 순서 변경 디버깅

**마이그레이션 완료 후 이 문서는 참고용으로 보관하시기 바랍니다.**
