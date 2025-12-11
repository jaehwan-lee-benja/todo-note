// 요일 정보
export const DAYS = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
]

// 기본 기획서 내용
export const DEFAULT_SPEC_CONTENT = `# Todo Note 간단 기획서

## 📋 프로젝트 개요
**Todo Note** - 날짜별 투두 관리 및 루틴 트래킹 웹 애플리케이션

---

## 🎯 핵심 기능

### **투두 관리** - 날짜별 할 일 추가, 수정, 삭제 및 완료 체크

### **자동 이월** - 미완료 투두를 다음날로 자동 복사하여 놓치지 않게 관리

### **루틴 시스템** - 특정 요일마다 반복되는 작업을 자동으로 생성

### **날짜 네비게이션** - 달력으로 특정 날짜 이동 및 이전/다음 날 버튼

---

## 🛠️ 기술 스택

- **Frontend**: React 19.1.1 + Vite
- **Database**: Supabase (PostgreSQL)
- **Deployment**: GitHub Pages

---

## 🌐 접속 방법

- **배포 URL**: https://jaehwan-lee-benja.github.io/todo-note/
- **개발 서버**: \`npm run dev\` → http://localhost:5173/todo-note/`

// 기타 상수
export const AUTO_SAVE_DELAY = 1000 // ms
export const DEFAULT_HOUR = '09'
export const DEFAULT_MINUTE = '00'
