# Todo Note

투두 관리 웹 애플리케이션

## 개발 환경

```bash
npm run dev      # 개발 서버 실행
npm run build    # 프로덕션 빌드
npm run deploy   # GitHub Pages에 배포
```

## 배포

**중요**: "배포"는 항상 `npm run deploy`를 의미합니다.
- GitHub Pages로 실제 웹사이트 배포
- 빌드 후 gh-pages 브랜치에 자동 푸시
- 배포 URL: https://jaehwan-lee-benja.github.io/todo-note/

GitHub Release는 별도로 요청 시에만 수행합니다.

## 데이터베이스 마이그레이션

새로운 컬럼이나 테이블을 추가할 때는 별도의 SQL 파일로 생성:
- `add-original-todo-id-column.sql`: 원본 투두 추적
- `add-completed-at-column.sql`: 완료 날짜 추적
- `restore-past-todos-from-carryover.sql`: 기존 데이터 복원

## 테스트 데이터

- `create-dummy-data-v2.sql`: 더미 데이터 생성 (현재 날짜 기준 동적 생성)
- `delete-dummy-data-v2.sql`: 더미 데이터 삭제

타임존: 모든 타임스탬프는 KST (Asia/Seoul) 사용

## Claude Code 작업 시 주의사항

### 배포 관련
- "배포해줘" = `npm run deploy` 실행 (GitHub Pages 배포)
- GitHub Release는 명시적으로 요청할 때만 수행

### 문서화 규칙
**중요한 결정이나 규칙이 생기면, 사용자에게 README.md 기록 여부를 확인하세요.**

예시:
```
"이 규칙을 README.md에 기록할까요?"
"이 중요한 변경사항을 문서화할까요?"
```

### 프로젝트 특성
- Supabase 데이터베이스 사용
- 이월 로직: 과거 투두를 복사 방식으로 이월 (이동 X)
- 원본 투두 추적: `original_todo_id` 컬럼 사용
- 완료 날짜 추적: `completed_at` 컬럼으로 미래 완료 표시

## 🔄 리팩토링 계획

**중요**: 다음 세션에서 작업할 대규모 리팩토링 계획이 있습니다.
**참고 문서**: [REFACTORING-PLAN.md](./REFACTORING-PLAN.md)

### 개요
- 이월 시스템을 복사 기반에서 JSON 기반으로 전환
- 데이터 중복 제거 및 로직 단순화
- 작업 전 반드시 REFACTORING-PLAN.md 읽어볼 것
