#!/usr/bin/env python3
"""
App.jsx 리팩토링 스크립트 - 커스텀 훅 통합
"""
import re

# 파일 읽기
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# App 함수 시작 지점 찾기
app_start = content.find('function App() {')
if app_start == -1:
    print("Error: App 함수를 찾을 수 없습니다.")
    exit(1)

# App 함수 전 부분 (imports, SortableSection 등)
before_app = content[:app_start]

# App 함수 이후 부분
after_app_start = content[app_start:]

# App 함수의 return 찾기
return_match = re.search(r'\n  return \(', after_app_start)
if not return_match:
    print("Error: return 문을 찾을 수 없습니다.")
    exit(1)

return_pos = return_match.start()

# App 함수 본문 (function App() { ... 부터 return 전까지)
app_body_start = after_app_start[:return_pos]

# return 이후
app_return = after_app_start[return_pos:]

# 새로운 App 함수 본문 작성
new_app_body = '''function App() {
  // 인증 상태
  const { session, authLoading, handleGoogleLogin, handleLogout } = useAuth()

  // UI 상태
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showSidebar, setShowSidebar] = useState(false)
  const [dummySessions, setDummySessions] = useState([])
  const [showDummyModal, setShowDummyModal] = useState(false)
  const [showDummySQL, setShowDummySQL] = useState(false)
  const [showGanttChart, setShowGanttChart] = useState(false)
  const [ganttData, setGanttData] = useState([])
  const [ganttPeriod, setGanttPeriod] = useState('1week')
  const [encouragementMessages, setEncouragementMessages] = useState([])
  const [showEncouragementModal, setShowEncouragementModal] = useState(false)
  const [newEncouragementMessage, setNewEncouragementMessage] = useState('')
  const [editingEncouragementId, setEditingEncouragementId] = useState(null)
  const [editingEncouragementText, setEditingEncouragementText] = useState('')
  const [showEncouragementEmoji, setShowEncouragementEmoji] = useState(false)
  const [currentEncouragementMessage, setCurrentEncouragementMessage] = useState('')
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('viewMode')
    return saved || 'horizontal'
  })

  const sectionsContainerRef = useRef(null)
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)
  const contentScrollableRef = useRef(null)
  const recentlyEditedIds = useRef(new Set())

  // 커스텀 훅
  const sectionOrderHook = useSectionOrder(session)
  const memoHook = useMemo(session)
  const keyThoughtsHook = useKeyThoughts(session)

  // Routines Hook (setTodos 없이 초기화, 나중에 업데이트)
  const [routinesHookState, setRoutinesHookState] = useState(null)
  const routinesHook = useRoutines({
    session,
    supabase,
    selectedDate,
    setTodos: routinesHookState?.setTodos || (() => {}),
    setSuccessToastMessage: routinesHookState?.setSuccessToastMessage || (() => {}),
    setShowSuccessToast: routinesHookState?.setShowSuccessToast || (() => {}),
  })

  const todosHook = useTodos(
    session,
    supabase,
    selectedDate,
    routinesHook.routines,
    routinesHook.setRoutines
  )

  // Routines Hook 업데이트 (순환 참조 해결)
  useEffect(() => {
    setRoutinesHookState({
      setTodos: todosHook.setTodos,
      setSuccessToastMessage: (msg) => todosHook.showSuccessMessage(msg),
      setShowSuccessToast: (show) => {}, // showSuccessMessage로 통합
    })
  }, [])

  // Destructuring
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

'''

# 기존 코드에서 남겨야 할 함수들 추출
# (격려 메시지, 날짜 변경, 더미 데이터, Gantt, useEffect 등)

# 격려 메시지 함수들
encouragement_functions = re.search(
    r'  // 랜덤 격려 문구 선택.*?(?=\n  // |  useEffect|  const fetch)',
    app_body_start,
    re.DOTALL
)

# 날짜 변경 함수들
date_functions = re.search(
    r'  const handlePrevDay = .*?(?=\n  const fetch|\n  const handle[A-Z][a-z]+[^D])',
    app_body_start,
    re.DOTALL
)

# useEffect들 및 나머지 함수들
remaining_code = re.search(
    r'(  useEffect\(.*)',
    app_body_start,
    re.DOTALL
)

# 조합
functions_to_keep = []

# 격려 메시지 관련
encourage_section = '''  // 랜덤 격려 문구 선택
  const getRandomEncouragement = () => {
    if (encouragementMessages.length === 0) return ""
    const randomIndex = Math.floor(Math.random() * encouragementMessages.length)
    return encouragementMessages[randomIndex]
  }

  // 격려 메시지 클릭 핸들러
  const handleEncouragementClick = () => {
    setShowEncouragementEmoji(true)
    setCurrentEncouragementMessage(getRandomEncouragement())
    setTimeout(() => setShowEncouragementEmoji(false), 3000)
  }

  // 더미 데이터 생성 (개발용)
  const handleCreateDummyData = async () => {
    // ... 기존 코드 유지 ...
  }

  const handleDeleteDummySession = async (sessionId) => {
    // ... 기존 코드 유지 ...
  }

  const handleDeleteAllDummies = async () => {
    // ... 기존 코드 유지 ...
  }

  const handleRemoveDuplicates = async () => {
    // ... 기존 코드 유지 ...
  }

  // 날짜 변경
  const handlePrevDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() - 1)
      return newDate
    })
  }

  const handleNextDay = () => {
    setSelectedDate(prev => {
      const newDate = new Date(prev)
      newDate.setDate(newDate.getDate() + 1)
      return newDate
    })
  }

  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value + 'T00:00:00')
    setSelectedDate(newDate)
  }

  // Gantt 차트
  const handleOpenGanttChart = async () => {
    // ... 기존 코드 유지 ...
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

  // 메모 모달 (레거시 - 인라인으로 대체됨)
  const handleOpenMemo = () => {
    // 더 이상 사용하지 않음
  }

'''

print("리팩토링 진행 중...")
print("파일이 너무 복잡하여 수동 검토가 필요합니다.")
print("부분 리팩토링된 본문을 생성합니다...")

# 새 파일 생성 (검토용)
with open('src/App_new_body.jsx.tmp', 'w', encoding='utf-8') as f:
    f.write(new_app_body)
    f.write(encourage_section)

print("임시 파일 생성: src/App_new_body.jsx.tmp")
print("\n다음 단계:")
print("1. 기존 App.jsx에서 useEffect 및 나머지 함수들을 복사")
print("2. 중복 제거")
print("3. 수동 병합")
