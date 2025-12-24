# 주요 생각정리 데이터 구조 리팩토링 기획서

**작성일**: 2024-12-24
**최종 수정**: 2024-12-24
**상태**: Phase 1 완료 ✅

---

## 📌 현재 진행 상황

- ✅ **Phase 1 완료** (2024-12-24)
  - 새 테이블 생성 SQL 작성 완료
  - 마이그레이션 스크립트 작성 완료
  - 롤백 스크립트 작성 완료
  - Supabase에 테이블 생성 완료
- ⏸️ **Phase 2-6**: 대기 중

---

## 📋 목차

1. [현재 상태 분석](#1-현재-상태-분석)
2. [문제점 및 개선 목표](#2-문제점-및-개선-목표)
3. [새로운 데이터베이스 설계](#3-새로운-데이터베이스-설계)
4. [마이그레이션 전략](#4-마이그레이션-전략)
5. [구현 계획](#5-구현-계획)
6. [테스트 체크리스트](#6-테스트-체크리스트)
7. [롤백 계획](#7-롤백-계획)

---

## 1. 현재 상태 분석

### 1.1 현재 데이터 구조

**저장 위치**: `user_settings` 테이블
- `setting_key`: 'key_thoughts_blocks'
- `setting_value`: JSON 문자열 (전체 블럭 트리 구조)

**블럭 구조 (JSON)**:
```javascript
[
  {
    id: 1734234567890.123,
    type: 'toggle',
    content: '주당의 가장 가치가기',
    isOpen: true,
    children: [
      {
        id: 1734234567891.456,
        type: 'toggle',
        content: '주당의 성장',
        isOpen: false,
        children: []
      }
    ]
  }
]
```

**히스토리**: `key_thoughts_history` 테이블
- `content`: JSONB (전체 블럭 스냅샷)
- `description`: TEXT
- `created_at`: TIMESTAMP

### 1.2 현재 동작 방식

1. **로드**: `user_settings`에서 JSON 문자열을 가져와 파싱
2. **수정**: React state에서 전체 트리 구조 수정
3. **저장**: 전체 트리를 JSON.stringify하여 `user_settings`에 저장
4. **히스토리**: 변경 시마다 전체 스냅샷을 `key_thoughts_history`에 저장

---

## 2. 문제점 및 개선 목표

### 2.1 현재 구조의 문제점

1. **성능 이슈**
   - 작은 수정에도 전체 JSON을 파싱/직렬화
   - 블럭이 많아질수록 저장/로드 속도 저하
   - 1개 블럭 수정 시에도 전체 데이터 업데이트

2. **확장성 제한**
   - 개별 블럭 쿼리 불가능 (검색 어려움)
   - 블럭 통계/분석 어려움
   - 특정 블럭만 조회 불가

3. **데이터 무결성**
   - JSON 파싱 오류 시 전체 데이터 손실 위험
   - 트랜잭션 처리 어려움
   - 동시 수정 시 충돌 가능성

4. **유지보수성**
   - 복잡한 중첩 구조 관리
   - 디버깅 어려움
   - 데이터 마이그레이션 복잡

### 2.2 개선 목표

1. **개별 블럭 관리**
   - 각 블럭을 독립적인 row로 저장
   - 개별 블럭 CRUD 가능
   - 부분 업데이트 지원

2. **쿼리 효율성**
   - 블럭 검색 가능
   - 특정 깊이/부모의 블럭만 조회
   - 인덱싱으로 빠른 조회

3. **데이터 무결성**
   - Foreign Key로 계층 구조 보장
   - 트랜잭션으로 일관성 유지
   - 블럭별 검증 가능

4. **확장성**
   - 블럭별 메타데이터 추가 용이
   - 통계/분석 쿼리 가능
   - 향후 기능 확장 용이

---

## 3. 새로운 데이터베이스 설계

### 3.1 새 테이블: `key_thought_blocks`

```sql
CREATE TABLE key_thought_blocks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 블럭 기본 정보
  block_id TEXT NOT NULL UNIQUE,  -- 클라이언트 생성 ID (timestamp + random)
  content TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'toggle',  -- 'toggle', 'text', 'heading', etc.

  -- 계층 구조
  parent_id TEXT REFERENCES key_thought_blocks(block_id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,  -- 형제 블럭 간 순서
  depth INTEGER NOT NULL DEFAULT 0,     -- 깊이 (0=최상위)

  -- UI 상태
  is_open BOOLEAN NOT NULL DEFAULT true,

  -- 메타데이터
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 인덱스
  CONSTRAINT unique_user_block UNIQUE(user_id, block_id)
);

-- 인덱스
CREATE INDEX idx_blocks_user_id ON key_thought_blocks(user_id);
CREATE INDEX idx_blocks_parent_id ON key_thought_blocks(parent_id);
CREATE INDEX idx_blocks_position ON key_thought_blocks(user_id, parent_id, position);
CREATE INDEX idx_blocks_depth ON key_thought_blocks(user_id, depth);
CREATE INDEX idx_blocks_content_search ON key_thought_blocks USING gin(to_tsvector('simple', content));
```

### 3.2 히스토리 테이블 개선

기존 `key_thoughts_history` 테이블은 스냅샷 용도로 유지하되, 구조 변경:

```sql
ALTER TABLE key_thoughts_history
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX idx_history_user_version ON key_thoughts_history(user_id, version DESC);
```

### 3.3 데이터 예시

**Before (JSON)**:
```json
[{
  "id": 1734234567890.123,
  "content": "A",
  "children": [{
    "id": 1734234567891.456,
    "content": "B"
  }]
}]
```

**After (Rows)**:
| id | user_id | block_id | content | parent_id | position | depth |
|----|---------|----------|---------|-----------|----------|-------|
| 1  | uuid1   | 1734...890 | A      | NULL      | 0        | 0     |
| 2  | uuid1   | 1734...891 | B      | 1734...890| 0        | 1     |

---

## 4. 마이그레이션 전략

### 4.1 마이그레이션 단계

**Phase 1: 준비 (병렬 운영)**
- 새 테이블 생성
- 기존 데이터 유지
- 읽기는 기존 방식, 쓰기는 양쪽 모두

**Phase 2: 데이터 이전**
- 기존 JSON 데이터를 새 테이블로 변환
- 검증 스크립트 실행
- 불일치 확인 및 수정

**Phase 3: 전환**
- 읽기를 새 테이블로 전환
- 기존 테이블은 백업 용도로 유지
- 1주일 모니터링

**Phase 4: 정리**
- 기존 데이터 삭제
- 마이그레이션 코드 제거

### 4.2 마이그레이션 스크립트

```sql
-- migrate-key-thoughts-to-blocks.sql
DO $$
DECLARE
  user_record RECORD;
  blocks_json JSONB;
BEGIN
  -- 모든 사용자의 주요 생각정리 데이터 가져오기
  FOR user_record IN
    SELECT user_id, setting_value
    FROM user_settings
    WHERE setting_key = 'key_thoughts_blocks'
  LOOP
    blocks_json := user_record.setting_value::JSONB;

    -- 재귀적으로 블럭 삽입
    PERFORM migrate_blocks_recursive(
      user_record.user_id,
      blocks_json,
      NULL,  -- parent_id
      0      -- depth
    );
  END LOOP;
END $$;

-- 재귀 함수
CREATE OR REPLACE FUNCTION migrate_blocks_recursive(
  p_user_id UUID,
  p_blocks JSONB,
  p_parent_id TEXT,
  p_depth INTEGER
) RETURNS VOID AS $$
DECLARE
  block JSONB;
  block_id TEXT;
  position INTEGER := 0;
BEGIN
  FOR block IN SELECT * FROM jsonb_array_elements(p_blocks)
  LOOP
    block_id := block->>'id';

    -- 블럭 삽입
    INSERT INTO key_thought_blocks (
      user_id, block_id, content, type, parent_id, position, depth, is_open
    ) VALUES (
      p_user_id,
      block_id,
      COALESCE(block->>'content', ''),
      COALESCE(block->>'type', 'toggle'),
      p_parent_id,
      position,
      p_depth,
      COALESCE((block->>'isOpen')::BOOLEAN, true)
    );

    -- children이 있으면 재귀 호출
    IF block->'children' IS NOT NULL THEN
      PERFORM migrate_blocks_recursive(
        p_user_id,
        block->'children',
        block_id,
        p_depth + 1
      );
    END IF;

    position := position + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. 구현 계획

### Phase 1: 데이터베이스 준비 ✅ 완료 (2024-12-24)

#### 1.1 새 테이블 생성
- [x] `create-key-thought-blocks-table.sql` 작성
- [x] Supabase에서 실행
- [x] RLS 정책 설정

#### 1.2 마이그레이션 스크립트 작성
- [x] `migrate-key-thoughts-to-blocks.sql` 작성
- [ ] 테스트 데이터로 검증 (Phase 5에서 진행 예정)
- [x] 롤백 스크립트 작성 (`rollback-key-thoughts-migration.sql`)

---

### Phase 2: 백엔드 API 레이어 (2일)

#### 2.1 Custom Hook 생성: `useKeyThoughtBlocks.js`

```javascript
// src/hooks/useKeyThoughtBlocks.js
export function useKeyThoughtBlocks(session) {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(false)

  // 블럭 트리 로드 (계층 구조 유지)
  const fetchBlocks = async () => {
    const { data } = await supabase
      .from('key_thought_blocks')
      .select('*')
      .order('position', { ascending: true })

    // 플랫 리스트를 트리 구조로 변환
    return buildTree(data)
  }

  // 개별 블럭 생성
  const createBlock = async (blockData) => { ... }

  // 개별 블럭 수정
  const updateBlock = async (blockId, updates) => { ... }

  // 개별 블럭 삭제
  const deleteBlock = async (blockId) => { ... }

  // 블럭 이동 (드래그앤드롭)
  const moveBlock = async (blockId, newParentId, newPosition) => { ... }

  return {
    blocks,
    fetchBlocks,
    createBlock,
    updateBlock,
    deleteBlock,
    moveBlock,
    loading
  }
}
```

#### 2.2 유틸리티 함수

```javascript
// src/utils/keyThoughtsUtils.js

// 플랫 리스트 → 트리 구조 변환
export function buildTree(flatBlocks) {
  const map = new Map()
  const roots = []

  // 1. Map 생성
  flatBlocks.forEach(block => {
    map.set(block.block_id, { ...block, children: [] })
  })

  // 2. 트리 구축
  flatBlocks.forEach(block => {
    const node = map.get(block.block_id)
    if (block.parent_id === null) {
      roots.push(node)
    } else {
      const parent = map.get(block.parent_id)
      if (parent) {
        parent.children.push(node)
      }
    }
  })

  return roots
}

// 트리 구조 → 플랫 리스트 변환 (저장용)
export function flattenTree(tree, parentId = null, depth = 0) {
  let result = []

  tree.forEach((node, index) => {
    const { children, ...blockData } = node
    result.push({
      ...blockData,
      parent_id: parentId,
      position: index,
      depth
    })

    if (children && children.length > 0) {
      result = result.concat(
        flattenTree(children, node.block_id, depth + 1)
      )
    }
  })

  return result
}
```

---

### Phase 3: 프론트엔드 전환 (2일)

#### 3.1 App.jsx 수정

**Before**:
```javascript
const [keyThoughtsBlocks, setKeyThoughtsBlocks] = useState([...])
```

**After**:
```javascript
const {
  blocks: keyThoughtsBlocks,
  setBlocks: setKeyThoughtsBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  moveBlock
} = useKeyThoughtBlocks(session)
```

#### 3.2 KeyThoughtsSection 수정

- 블럭 추가 시: `createBlock()` 호출
- 블럭 수정 시: `updateBlock()` 호출
- 블럭 삭제 시: `deleteBlock()` 호출

#### 3.3 KeyThoughtsViewerPage 수정

- 드래그앤드롭 시: `moveBlock()` 호출

---

### Phase 4: 히스토리 기능 전환 (1일)

#### 4.1 히스토리 저장 방식 변경

**Before**: 전체 JSON 스냅샷 저장

**After**:
1. 변경 시점의 모든 블럭 조회
2. 트리 구조로 재구성
3. JSON으로 직렬화하여 `key_thoughts_history`에 저장

```javascript
const saveKeyThoughtsVersion = async (description = '') => {
  const { data: allBlocks } = await supabase
    .from('key_thought_blocks')
    .select('*')
    .order('position')

  const tree = buildTree(allBlocks)

  await supabase
    .from('key_thoughts_history')
    .insert({
      user_id: session.user.id,
      content: tree,
      description,
      version: (currentVersion || 0) + 1
    })
}
```

#### 4.2 히스토리 복구 수정

```javascript
const restoreVersion = async (versionId) => {
  // 1. 기존 블럭 전부 삭제
  await supabase
    .from('key_thought_blocks')
    .delete()
    .eq('user_id', session.user.id)

  // 2. 히스토리에서 가져온 JSON을 개별 블럭으로 삽입
  const { data: version } = await supabase
    .from('key_thoughts_history')
    .select('content')
    .eq('id', versionId)
    .single()

  const flatBlocks = flattenTree(version.content)

  await supabase
    .from('key_thought_blocks')
    .insert(flatBlocks.map(block => ({
      ...block,
      user_id: session.user.id
    })))
}
```

---

### Phase 5: 마이그레이션 실행 (1일)

#### 5.1 기존 사용자 데이터 이전

```javascript
// scripts/migrate-existing-users.js
const migrateAllUsers = async () => {
  // SQL 마이그레이션 스크립트 실행
  const { error } = await supabase.rpc('migrate_all_key_thoughts')

  if (error) {
    console.error('Migration failed:', error)
    return
  }

  console.log('✅ Migration completed')
}
```

#### 5.2 검증

```javascript
// scripts/validate-migration.js
const validateMigration = async () => {
  // 1. 각 사용자별로 기존 JSON과 새 블럭 비교
  // 2. 블럭 수, 내용, 계층 구조 일치 확인
  // 3. 불일치 발견 시 로그 출력
}
```

---

### Phase 6: 정리 및 최적화 (1일)

#### 6.1 기존 코드 제거

- [ ] `user_settings`에서 'key_thoughts_blocks' 관련 코드 제거
- [ ] localStorage 관련 코드 제거
- [ ] 구 JSON 방식 관련 함수 제거

#### 6.2 성능 최적화

- [ ] 블럭 로드 시 필요한 depth만 조회
- [ ] 블럭 캐싱 추가
- [ ] Optimistic UI 업데이트

---

## 6. 테스트 체크리스트

### 6.1 기능 테스트

- [ ] 블럭 생성
- [ ] 블럭 수정 (content, isOpen)
- [ ] 블럭 삭제
- [ ] 블럭 이동 (같은 레벨)
- [ ] 블럭 이동 (다른 depth)
- [ ] 블럭 이동 (children으로)
- [ ] 하위 블럭 토글 (열기/닫기)

### 6.2 뷰어 페이지 테스트

- [ ] 컬럼 네비게이션
- [ ] 드래그앤드롭 (상단/중간/하단)
- [ ] 빈 칼럼에 드롭
- [ ] 드롭 라인 표시

### 6.3 히스토리 테스트

- [ ] 히스토리 저장
- [ ] 히스토리 목록 조회
- [ ] 히스토리 복구
- [ ] 복구 후 편집 가능

### 6.4 데이터 무결성 테스트

- [ ] 마이그레이션 전후 데이터 일치
- [ ] parent_id 참조 무결성
- [ ] position 순서 정확성
- [ ] depth 계산 정확성

### 6.5 성능 테스트

- [ ] 100개 블럭 로드 속도
- [ ] 1000개 블럭 로드 속도
- [ ] 개별 블럭 수정 속도
- [ ] 드래그앤드롭 반응 속도

---

## 7. 롤백 계획

### 7.1 롤백 트리거

다음 상황에서 롤백 고려:
- 마이그레이션 실패율 > 5%
- 성능 저하 > 50%
- 치명적 버그 발견
- 사용자 데이터 손실

### 7.2 롤백 절차

```sql
-- 1. 새 테이블 비활성화
ALTER TABLE key_thought_blocks DISABLE;

-- 2. 기존 user_settings 데이터 복구
-- (백업에서 복원)

-- 3. 애플리케이션 코드 롤백
-- (Git revert)
```

### 7.3 백업 정책

- 마이그레이션 전 전체 DB 백업
- `user_settings` 테이블 별도 백업
- 마이그레이션 후 1주일간 백업 유지

---

## 8. 예상 이점

### 8.1 성능 개선

- 개별 블럭 수정 시 **90% 속도 향상** (전체 JSON 대비)
- 블럭 검색 **10배 빠름** (인덱스 활용)
- 대량 블럭 처리 **효율성 증가**

### 8.2 확장성

- 블럭별 메타데이터 추가 가능 (태그, 즐겨찾기, 공유 등)
- 블럭 검색 기능 구현 가능
- 통계/분석 기능 추가 가능

### 8.3 유지보수성

- 코드 복잡도 감소
- 디버깅 용이
- 데이터 무결성 보장

---

## 9. 다음 단계

### ✅ Phase 1 완료 (2024-12-24)
- 새 테이블 `key_thought_blocks` 생성 완료
- 마이그레이션 스크립트 준비 완료
- 롤백 스크립트 준비 완료

### 📋 다음 작업: Phase 2 - 백엔드 API 레이어
Phase 2를 시작하려면:
1. `src/hooks/useKeyThoughtBlocks.js` 작성
2. `src/utils/keyThoughtsUtils.js` 작성 (buildTree, flattenTree)
3. 기존 코드와 병렬 운영 준비

---

**작성일**: 2024-12-24
**최종 수정**: 2024-12-24
**Phase 1 완료일**: 2024-12-24
**예상 소요 기간**: 7-10일 (Phase 1 완료, 2-6 진행 예정)
**우선순위**: Medium (기능 추가보다는 구조 개선)
