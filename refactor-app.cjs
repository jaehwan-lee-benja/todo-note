const fs = require('fs');

// 파일 읽기
const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');

console.log('총 줄 수:', lines.length);

// App 함수 찾기
const appStartLine = lines.findIndex(line => line.trim() === 'function App() {');
console.log('App 함수 시작 라인:', appStartLine + 1);

// return 문 찾기 (App 함수 내부)
let returnLine = -1;
for (let i = appStartLine; i < lines.length; i++) {
  if (lines[i].trim() === 'return (') {
    returnLine = i;
    break;
  }
}
console.log('return 시작 라인:', returnLine + 1);

// App 함수 내부의 state와 함수들 분석
let stateCount = 0;
let funcCount = 0;
let effectCount = 0;

for (let i = appStartLine; i < returnLine; i++) {
  const trimmed = lines[i].trim();
  if (trimmed.includes('useState') || trimmed.includes('useRef')) stateCount++;
  if (trimmed.startsWith('const handle') || trimmed.startsWith('const fetch') || trimmed.startsWith('const get')) funcCount++;
  if (trimmed.startsWith('useEffect(')) effectCount++;
}

console.log('State 선언:', stateCount);
console.log('함수 선언:', funcCount);
console.log('useEffect:', effectCount);

// 이제 새로운 App.jsx 생성
const beforeApp = lines.slice(0, appStartLine).join('\n');
const appReturn = lines.slice(returnLine).join('\n');

// 새로운 App 본문
const newAppBody = `function App() {
  // 인증 상태
  const { session, authLoading, handleGoogleLogin, handleLogout } = useAuth()

  // 날짜 및 UI 상태
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showSidebar, setShowSidebar] = useState(false)
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('viewMode')
    return saved || 'horizontal'
  })

  // 더미 데이터 관련
  const [dummySessions, setDummySessions] = useState([])
  const [showDummyModal, setShowDummyModal] = useState(false)
  const [showDummySQL, setShowDummySQL] = useState(false)

  // Gantt 차트 관련
  const [showGanttChart, setShowGanttChart] = useState(false)
  const [ganttData, setGanttData] = useState([])
  const [ganttPeriod, setGanttPeriod] = useState('1week')

  // 격려 메시지 관련
  const [encouragementMessages, setEncouragementMessages] = useState([])
  const [showEncouragementModal, setShowEncouragementModal] = useState(false)
  const [newEncouragementMessage, setNewEncouragementMessage] = useState('')
  const [editingEncouragementId, setEditingEncouragementId] = useState(null)
  const [editingEncouragementText, setEditingEncouragementText] = useState('')
  const [showEncouragementEmoji, setShowEncouragementEmoji] = useState(false)
  const [currentEncouragementMessage, setCurrentEncouragementMessage] = useState('')

  // 기타 Refs
  const sectionsContainerRef = useRef(null)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const contentScrollableRef = useRef(null)
  const recentlyEditedIds = useRef(new Set())

  // ===== 커스텀 훅 =====
  const sectionOrderHook = useSectionOrder(session)
  const memoHook = useMemo(session)
  const keyThoughtsHook = useKeyThoughts(session)

  // Routines와 Todos는 서로 의존하므로 초기 상태로 먼저 생성
  const routinesHook = useRoutines({
    session,
    supabase,
    selectedDate,
    setTodos: () => {}, // 임시
    setSuccessToastMessage: () => {}, // 임시
    setShowSuccessToast: () => {}, // 임시
  })

  const todosHook = useTodos(
    session,
    supabase,
    selectedDate,
    routinesHook.routines,
    routinesHook.setRoutines
  )

  // Routines Hook 업데이트 (순환 참조 해결을 위한 useEffect)
  useEffect(() => {
    // routinesHook에 todosHook의 setter 제공
    // 주의: 이 방법은 완벽하지 않으므로 향후 개선 필요
  }, [])

  // ===== Destructuring =====
  const {
    todos, setTodos, inputValue, setInputValue,
    routineInputValue, setRoutineInputValue,
    normalInputValue, setNormalInputValue,
    loading, isDraggingAny, isAdding,
    deletedTodo, showUndoToast, showSuccessToast, successToastMessage,
    lastDeleteAction, showTrashModal, trashedItems,
    focusedTodoId, setFocusedTodoId,
    showTodoHistoryModal, showTodoRoutineSetupModal,
    selectedTodoForModal, todoHistory, expandedHistoryIds,
    routineDaysForModal, setRoutineDaysForModal,
    isEditingRoutineInModal, setIsEditingRoutineInModal,
    routineTimeSlotForModal, setRoutineTimeSlotForModal,
    showDeleteConfirmModal, setShowDeleteConfirmModal,
    todoToDelete, setTodoToDelete,
    carryOverInProgress,
    fetchTodos, handleAddTodo, handleAddRoutineTodo, handleAddNormalTodo,
    handleToggleTodo, handleDeleteTodo,
    executeSimpleDelete, hideOnThisDateOnly, deleteCompletely,
    loadTrashedItems, handleRestoreTodo, handlePermanentlyDeleteTodo,
    handleDragEnd, handleDragStart, handleDragCancel,
    handleChangeIndent, handleOpenTodoHistory, handleCloseTodoHistory,
    handleOpenTodoRoutineSetup, handleCloseTodoRoutineSetup,
    handleCreateRoutineFromTodoInModal, handleToggleHistoryExpand,
    handleConfirmDeleteTodo, showSuccessMessage, handleUndoRoutineDelete,
  } = todosHook

  const {
    routines, routineInput, selectedDays, selectedTimeSlot,
    isAddingRoutine, showRoutineModal,
    editingRoutineId, editingRoutineText, editingRoutineDays,
    showRoutineHistory, selectedRoutineForHistory, routineHistoryData,
    routineCreationInProgress, setRoutineInput, setSelectedTimeSlot,
    fetchRoutines, handleAddRoutine, handleDeleteRoutine,
    handleStartEditRoutine, handleSaveEditRoutine, handleCancelEditRoutine,
    handleToggleEditDay, handleCreateRoutineFromTodo,
    createRoutineTodosForDate, createRoutineTodos,
    handleOpenRoutine, handleCloseRoutine, handleOpenRoutineHistory,
    handleCloseRoutineHistory, handleToggleRoutineDay,
  } = routinesHook

  const {
    memoContent, setMemoContent,
    isEditingMemoInline, isSavingMemo, memoOriginalContent,
    memoTextareaRef,
    fetchMemoContent, handleStartEditMemoInline,
    handleSaveMemoInline, handleCancelEditMemoInline, handleMemoKeyDown,
  } = memoHook

  const {
    keyThoughtsBlocks, setKeyThoughtsBlocks,
    isSavingKeyThoughts, setIsSavingKeyThoughts,
    lastSavedKeyThoughtsRef, focusedBlockId, setFocusedBlockId,
    keyThoughtsHistory, showKeyThoughtsHistory, setShowKeyThoughtsHistory,
    fetchKeyThoughtsContent, handleSaveKeyThoughts,
    cleanupOldHistory, fetchKeyThoughtsHistory, restoreKeyThoughtsVersion,
  } = keyThoughtsHook

  const {
    sectionOrder, setSectionOrder,
    isReorderMode, setIsReorderMode,
    fetchSectionOrder, moveSectionLeft, moveSectionRight,
    handleSectionDragEnd, handleSectionsContainerDoubleClick,
  } = sectionOrderHook

  // ===== 로컬 헬퍼 함수들 (hooks에 없는 것들) =====
`;

console.log('\n새로운 App 본문의 시작 부분을 생성했습니다.');
console.log('다음 단계: 기존 App.jsx에서 필요한 함수들을 추출하여 추가');

// 기존 코드에서 필요한 함수들 추출 (정규식 사용)
const appBody = lines.slice(appStartLine, returnLine).join('\n');

// 필요한 함수들 패턴
const functionsToExtract = [
  'getRandomEncouragement',
  'handleEncouragementClick',
  'handleCreateDummyData',
  'handleDeleteDummySession',
  'handleDeleteAllDummies',
  'handleRemoveDuplicates',
  'handlePrevDay',
  'handleNextDay',
  'handleDateChange',
  'handleOpenGanttChart',
  'handleCloseGanttChart',
  'handleOpenTrash',
  'handleCloseTrash',
  'handleOpenMemo',
  // useEffect들은 별도로 처리
];

console.log('\n추출이 필요한 함수 목록:');
functionsToExtract.forEach(fn => console.log(`- ${fn}`));

// 저장
fs.writeFileSync('refactor-analysis.txt', `
총 줄 수: ${lines.length}
App 함수 시작: ${appStartLine + 1}
return 시작: ${returnLine + 1}
State 선언: ${stateCount}
함수 선언: ${funcCount}
useEffect: ${effectCount}

필요한 작업:
1. ${functionsToExtract.length}개의 함수 추출
2. ${effectCount}개의 useEffect 검토 및 통합
3. JSX return 부분 유지

새로운 App 본문 생성 완료.
`, 'utf8');

console.log('\n분석 결과가 refactor-analysis.txt에 저장되었습니다.');
