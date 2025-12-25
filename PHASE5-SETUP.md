# Phase 5 설정 가이드

마이그레이션 실행 전 필요한 설정을 안내합니다.

## 📝 환경 변수 설정

### .env 파일 수정

`.env` 파일에 다음 라인을 추가하세요:

```bash
# 새로운 블럭 기반 구조 사용 여부
# 마이그레이션 전: false (기본값)
# 마이그레이션 후 테스트: true
VITE_USE_NEW_BLOCK_STRUCTURE=false
```

### 설정 방법

1. 프로젝트 루트의 `.env` 파일을 엽니다
2. 파일 끝에 위 라인을 추가합니다
3. 저장합니다

## 📋 마이그레이션 실행 순서

### 1단계: 준비 (현재 완료)

- ✅ 마이그레이션 스크립트 작성 (`migrate-key-thoughts-to-blocks.sql`)
- ✅ 검증 스크립트 작성 (`validate-migration.js`)
- ✅ 실행 가이드 작성 (`MIGRATION-GUIDE.md`)
- ✅ 롤백 스크립트 준비 (`rollback-key-thoughts-migration.sql`)

### 2단계: 마이그레이션 실행 (사용자가 직접)

**상세 가이드**: `MIGRATION-GUIDE.md` 참고

1. **백업**
   - Supabase 콘솔 접속
   - `user_settings` 테이블 백업

2. **함수 생성**
   - `migrate-key-thoughts-to-blocks.sql` 실행

3. **테스트**
   - 단일 사용자 마이그레이션 먼저 시도
   - 검증 확인

4. **전체 실행**
   - 모든 사용자 마이그레이션
   - 검증 스크립트 실행

5. **환경 변수 변경**
   ```bash
   VITE_USE_NEW_BLOCK_STRUCTURE=true
   ```

6. **애플리케이션 테스트**
   - 개발 서버 재시작
   - 모든 기능 테스트

## ⚠️ 중요 사항

### 마이그레이션 전

- `.env` 파일에 `VITE_USE_NEW_BLOCK_STRUCTURE=false` 설정
- 이 상태에서는 **기존 방식** (user_settings JSON) 사용

### 마이그레이션 후

- Supabase에서 마이그레이션 완료
- 검증 스크립트로 확인
- `.env` 파일에 `VITE_USE_NEW_BLOCK_STRUCTURE=true` 설정
- 개발 서버 재시작
- 이 상태에서는 **새 방식** (key_thought_blocks 테이블) 사용

### 롤백 시

- `.env` 파일에 `VITE_USE_NEW_BLOCK_STRUCTURE=false` 변경
- 개발 서버 재시작
- 즉시 기존 방식으로 복귀

## 🧪 검증 스크립트 실행 방법

```bash
# 프로젝트 디렉토리에서
cd /Users/benja/claude-project/todo-note

# 검증 스크립트 실행
node validate-migration.js
```

**예상 출력**:
```
🔍 마이그레이션 검증 시작...

📊 총 3명의 사용자 발견

✅ 사용자 12345678...: 블럭=15, 루트=3
✅ 사용자 23456789...: 블럭=8, 루트=2
✅ 사용자 34567890...: 블럭=0, 루트=0

==================================================
📊 검증 결과 요약
==================================================
총 사용자: 3
✅ 성공: 3 (100.0%)
❌ 실패: 0 (0.0%)
==================================================
```

## 📚 참고 문서

- **상세 마이그레이션 가이드**: `MIGRATION-GUIDE.md`
- **리팩토링 기획서**: `KEY-THOUGHTS-REFACTOR-PLAN.md`
- **롤백 스크립트**: `rollback-key-thoughts-migration.sql`

## 🆘 문제 해결

### "VITE_USE_NEW_BLOCK_STRUCTURE is not defined"

- `.env` 파일에 해당 환경 변수가 없음
- 위 설정 방법대로 추가하세요

### 서버 재시작 후에도 변경사항 적용 안됨

- 브라우저 캐시 삭제: `Cmd+Shift+R` (Mac) 또는 `Ctrl+Shift+R` (Windows)
- `.env` 파일 저장 확인
- 터미널에서 서버 완전히 종료 후 재시작

### 마이그레이션 후 데이터가 안 보임

1. `.env`에서 `VITE_USE_NEW_BLOCK_STRUCTURE=true` 확인
2. 서버 재시작 확인
3. Supabase에서 `key_thought_blocks` 테이블 확인:
   ```sql
   SELECT COUNT(*) FROM key_thought_blocks WHERE user_id = auth.uid();
   ```

---

**작성일**: 2024-12-25
**Phase**: 5 (마이그레이션 실행)
**상태**: 준비 완료
