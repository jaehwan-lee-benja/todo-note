const fs = require('fs');

// 파일 읽기
const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');

// App 함수 찾기
const appStartLine = 148; // 0-indexed
const returnLine = 3409; // 0-indexed

// 1. 헤더 부분 (import, SortableSection)
const header = lines.slice(0, appStartLine).join('\n');

// 2. App 함수 본문 (return 이전)
const appBody = lines.slice(appStartLine, returnLine).join('\n');

// 3. JSX return 부분
const returnPart = lines.slice(returnLine).join('\n');

// 필요한 함수들 추출
const functionsToExtract = [
  { name: 'getRandomEncouragement', start: 339, end: 344 },
  { name: 'handleEncouragementClick', start: 346, end: 364 },
  { name: 'handleCreateDummyData', start: 366, end: 499 },
  { name: 'handleDeleteDummySession', start: 501, end: 549 },
  { name: 'handleDeleteAllDummies', start: 551, end: 599 },
  { name: 'handleRemoveDuplicates', start: 601, end: 691 },
  { name: 'handlePrevDay', start: 693, end: 698 },
  { name: 'handleNextDay', start: 700, end: 704 },
  { name: 'handleDateChange', start: 706, end: 709 },
];

// useEffect들 추출 (라인 번호는 대략적)
const useEffectRanges = [
  { start: 1413, end: 1442 }, // 초기 로드
  { start: 1442, end: 1448 }, // 날짜 변경 시 fetch
  { start: 1448, end: 1454 }, // 등등
];

// 새로운 App.jsx 생성
let newApp = header;

// App 함수 시작
newApp += `function App() {
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

  const routinesHook = useRoutines({
    session,
    supabase,
    selectedDate,
    setTodos: (setter) => {
      // 초기에는 빈 함수, useEffect에서 업데이트
      if (todosHook && todosHook.setTodos) {
        todosHook.setTodos(setter)
      }
    },
    setSuccessToastMessage: (msg) => {
      if (todosHook && todosHook.showSuccessMessage) {
        todosHook.showSuccessMessage(msg)
      }
    },
    setShowSuccessToast: () => {},
  })

  const todosHook = useTodos(
    session,
    supabase,
    selectedDate,
    routinesHook.routines,
    routinesHook.setRoutines
  )

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

  // ===== 로컬 헬퍼 함수들 =====
`;

// 추출한 함수들 추가
functionsToExtract.forEach(({ name, start, end }) => {
  newApp += '\n  ' + lines.slice(start, end + 1).map(line => line.substring(2)).join('\n  ') + '\n';
});

// 나머지 필요한 함수들을 기존 코드에서 복사
// (Gantt, Trash, Memo, 격려 메시지 등)
const additionalFunctions = `
  // Gantt 차트
  const handleOpenGanttChart = async () => {
    try {
      // Gantt 차트 데이터 가져오기 로직
      // ... (기존 코드 복사 필요)
      setShowGanttChart(true)
    } catch (error) {
      console.error('Gantt 차트 열기 오류:', error.message)
    }
  }

  const handleCloseGanttChart = () => {
    setShowGanttChart(false)
  }

  // 쓰레기통
  const handleOpenTrash = () => {
    loadTrashedItems()
    setShowTrashModal(true)
  }

  const handleCloseTrash = () => {
    setShowTrashModal(false)
  }

  // 메모 모달 (레거시)
  const handleOpenMemo = () => {
    // 인라인 편집으로 대체됨
  }

  // 격려 메시지 관리
  const handleAddEncouragementMessage = async () => {
    // ... (기존 코드)
  }

  const handleDeleteEncouragementMessage = async (id) => {
    // ... (기존 코드)
  }

  const handleStartEditEncouragementMessage = (msg) => {
    setEditingEncouragementId(msg.id)
    setEditingEncouragementText(msg.message)
  }

  const handleSaveEditEncouragementMessage = async () => {
    // ... (기존 코드)
  }

  const handleCancelEditEncouragementMessage = () => {
    setEditingEncouragementId(null)
    setEditingEncouragementText('')
  }

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const sectionSensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // ===== useEffect =====
`;

newApp += additionalFunctions;

// useEffect 복사 (기존 코드에서)
// 이 부분은 수동으로 확인 필요
newApp += `
  // 초기 로드
  useEffect(() => {
    if (session) {
      fetchTodos()
      fetchRoutines()
      fetchMemoContent()
      fetchKeyThoughtsContent()
      fetchSectionOrder()
      cleanupOldHistory()
    }
  }, [session])

  // 날짜 변경 시
  useEffect(() => {
    if (session) {
      fetchTodos()
    }
  }, [selectedDate])

  // 뷰 모드 저장
  useEffect(() => {
    localStorage.setItem('viewMode', viewMode)
  }, [viewMode])

  // 주요 생각정리 자동 저장
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (session?.user?.id) {
        handleSaveKeyThoughts()
      }
    }, AUTO_SAVE_DELAY)

    return () => clearTimeout(timeoutId)
  }, [keyThoughtsBlocks])

  // 나머지 useEffect들...
  // (기존 코드에서 복사 필요)

`;

// JSX return 부분 추가
newApp += returnPart;

// 파일 쓰기
fs.writeFileSync('src/App_NEW.jsx', newApp, 'utf8');

console.log('✅ 새로운 App_NEW.jsx 생성 완료!');
console.log('다음 단계:');
console.log('1. App_NEW.jsx 검토');
console.log('2. 누락된 함수/useEffect 추가');
console.log('3. 테스트 후 App.jsx로 교체');
console.log('');
console.log('현재 상태:');
console.log('- 커스텀 훅 import: ✅');
console.log('- State 선언: ✅');
console.log('- 훅 호출 및 destructuring: ✅');
console.log('- 주요 헬퍼 함수: ✅');
console.log('- JSX return: ✅');
console.log('');
console.log('⚠️ 수동 확인 필요:');
console.log('- Gantt 차트 함수 내용');
console.log('- 격려 메시지 CRUD 함수들');
console.log('- 모든 useEffect 내용');
