const fs = require('fs');

console.log('=== App.jsx 리팩토링 시작 ===\n');

// 파일 읽기
const content = fs.readFileSync('src/App.jsx', 'utf8');
const lines = content.split('\n');

console.log(`원본 줄 수: ${lines.length}`);

// 1. 헤더 (imports + SortableSection) - 148줄까지
const header = lines.slice(0, 149).join('\n');

// 2. JSX return 부분 - 3410줄부터
const jsxReturn = lines.slice(3410).join('\n');

// 3. 기존 코드에서 필요한 함수들 추출
const extractFunction = (name, start, end) => {
  return lines.slice(start, end).map(line => {
    // 들여쓰기 조정 (2칸 제거)
    if (line.startsWith('  ')) {
      return line.substring(2);
    }
    return line;
  }).join('\n');
};

// 필요한 함수들과 useEffect들을 추출
const encouragementFuncs = extractFunction('encouragement', 340, 365);
const dummyFuncs = extractFunction('dummy', 367, 692);
const dateFuncs = extractFunction('date', 694, 710);

// 격려 메시지 관리, Gantt, Trash 등의 함수들 (기존 코드에서 찾아서 복사)
// 간단하게 핵심만 포함

const additionalFunctions = `
  // Gantt 차트
  const handleOpenGanttChart = async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', session?.user?.id)
        .eq('deleted', false)
        .order('completed_at', { ascending: false })

      if (error) throw error

      setGanttData(data || [])
      setShowGanttChart(true)
    } catch (error) {
      console.error('Gantt 차트 데이터 로드 오류:', error.message)
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
    if (!newEncouragementMessage.trim()) return

    try {
      const { error } = await supabase
        .from('encouragement_messages')
        .insert([{ message: newEncouragementMessage, user_id: session?.user?.id }])

      if (error) throw error

      setNewEncouragementMessage('')
      fetchEncouragementMessages()
    } catch (error) {
      console.error('격려 메시지 추가 오류:', error.message)
    }
  }

  const handleDeleteEncouragementMessage = async (id) => {
    try {
      const { error } = await supabase
        .from('encouragement_messages')
        .delete()
        .eq('id', id)

      if (error) throw error

      fetchEncouragementMessages()
    } catch (error) {
      console.error('격려 메시지 삭제 오류:', error.message)
    }
  }

  const handleStartEditEncouragementMessage = (msg) => {
    setEditingEncouragementId(msg.id)
    setEditingEncouragementText(msg.message)
  }

  const handleSaveEditEncouragementMessage = async () => {
    try {
      const { error } = await supabase
        .from('encouragement_messages')
        .update({ message: editingEncouragementText })
        .eq('id', editingEncouragementId)

      if (error) throw error

      setEditingEncouragementId(null)
      setEditingEncouragementText('')
      fetchEncouragementMessages()
    } catch (error) {
      console.error('격려 메시지 수정 오류:', error.message)
    }
  }

  const handleCancelEditEncouragementMessage = () => {
    setEditingEncouragementId(null)
    setEditingEncouragementText('')
  }

  const fetchEncouragementMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('encouragement_messages')
        .select('*')
        .eq('user_id', session?.user?.id)
        .order('created_at', { ascending: true })

      if (error) throw error

      setEncouragementMessages(data || [])

      if (data && data.length > 0 && !currentEncouragementMessage) {
        setCurrentEncouragementMessage(data[0].message)
      }
    } catch (error) {
      console.error('격려 메시지 불러오기 오류:', error.message)
    }
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
`;

// 새로운 App.jsx 생성
const newApp = `${header}
function App() {
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
    setTodos: () => {}, // 초기값, useEffect에서 업데이트
    setSuccessToastMessage: () => {},
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
${encouragementFuncs}

${dummyFuncs}

${dateFuncs}

${additionalFunctions}

  // ===== useEffect =====
  // 초기 로드
  useEffect(() => {
    if (session) {
      fetchTodos()
      fetchRoutines()
      fetchMemoContent()
      fetchKeyThoughtsContent()
      fetchSectionOrder()
      cleanupOldHistory()
      fetchEncouragementMessages()
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

  // 루틴 자동 생성 (날짜 변경 시)
  useEffect(() => {
    if (session && routines.length > 0) {
      createRoutineTodos()
    }
  }, [selectedDate, routines])

${jsxReturn}
`;

// 파일 쓰기
fs.writeFileSync('src/App_REFACTORED.jsx', newApp, 'utf8');

const newLines = newApp.split('\n').length;
const reduction = ((1 - newLines / lines.length) * 100).toFixed(1);

console.log(`\n=== 리팩토링 완료 ===`);
console.log(`원본 줄 수: ${lines.length}`);
console.log(`새 파일 줄 수: ${newLines}`);
console.log(`감소율: ${reduction}%`);
console.log(`\n새 파일 저장: src/App_REFACTORED.jsx`);
console.log(`\n다음 단계:`);
console.log(`1. App_REFACTORED.jsx 검토`);
console.log(`2. 테스트`);
console.log(`3. 문제 없으면: mv src/App_REFACTORED.jsx src/App.jsx`);
