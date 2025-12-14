#!/usr/bin/env python3
"""
App.jsx 리팩토링 스크립트
커스텀 훅을 import하고 기존 state/함수 정의를 훅 호출로 교체
"""

# 1-143번째 줄 읽기 (SortableSection 컴포넌트까지)
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

header_lines = lines[:143]  # 1-143줄 (import, SortableSection)
app_content = lines[143:3404]  # 144-3404줄 (App 함수 본문, return 제외)
jsx_content = lines[3404:]  # 3405줄부터 끝까지 (JSX return)

# 새로운 App.jsx 내용 작성
new_content = []

# 1. 헤더 부분 (import 문 등) - 커스텀 훅 import 추가
new_content.extend(header_lines[:24])  # 기존 import (1-24줄)

# 커스텀 훅 import 추가
hook_imports = [
    "import { useTodos } from './hooks/useTodos'\n",
    "import { useRoutines } from './hooks/useRoutines'\n",
    "import { useMemo } from './hooks/useMemo'\n",
    "import { useKeyThoughts } from './hooks/useKeyThoughts'\n",
    "import { useSectionOrder } from './hooks/useSectionOrder'\n",
]
new_content.extend(hook_imports)

# 나머지 import와 컴포넌트 (25-143줄)
new_content.extend(header_lines[24:])

# 2. App 함수 시작
new_content.append('function App() {\n')
new_content.append('  // 인증 상태\n')
new_content.append('  const { session, authLoading, handleGoogleLogin, handleLogout } = useAuth()\n')
new_content.append('\n')

# 3. 날짜 state (hooks에 없음)
new_content.append('  const [selectedDate, setSelectedDate] = useState(new Date())\n')
new_content.append('\n')

# 4. 커스텀 훅 호출
new_content.append('  // 커스텀 훅\n')
new_content.append('  const sectionOrderHook = useSectionOrder(session)\n')
new_content.append('  const memoHook = useMemo(session)\n')
new_content.append('  const keyThoughtsHook = useKeyThoughts(session)\n')
new_content.append('\n')
new_content.append('  const routinesHook = useRoutines({\n')
new_content.append('    session,\n')
new_content.append('    supabase,\n')
new_content.append('    selectedDate,\n')
new_content.append('    setTodos: null, // 임시\n')
new_content.append('    setSuccessToastMessage: null, // 임시\n')
new_content.append('    setShowSuccessToast: null, // 임시\n')
new_content.append('  })\n')
new_content.append('\n')
new_content.append('  const todosHook = useTodos(\n')
new_content.append('    session,\n')
new_content.append('    supabase,\n')
new_content.append('    selectedDate,\n')
new_content.append('    routinesHook.routines,\n')
new_content.append('    routinesHook.setRoutines\n')
new_content.append('  )\n')
new_content.append('\n')

# 5. Destructuring
new_content.append('  // Destructuring from hooks\n')
new_content.append('  const {\n')
new_content.append('    todos, setTodos, inputValue, setInputValue,\n')
new_content.append('    routineInputValue, setRoutineInputValue,\n')
new_content.append('    normalInputValue, setNormalInputValue,\n')
new_content.append('    loading, isDraggingAny, isAdding,\n')
new_content.append('    deletedTodo, showUndoToast, showSuccessToast, successToastMessage,\n')
new_content.append('    lastDeleteAction, showTrashModal, trashedItems,\n')
new_content.append('    focusedTodoId, setFocusedTodoId,\n')
new_content.append('    showTodoHistoryModal, showTodoRoutineSetupModal,\n')
new_content.append('    selectedTodoForModal, todoHistory, expandedHistoryIds,\n')
new_content.append('    routineDaysForModal, setRoutineDaysForModal,\n')
new_content.append('    isEditingRoutineInModal, setIsEditingRoutineInModal,\n')
new_content.append('    routineTimeSlotForModal, setRoutineTimeSlotForModal,\n')
new_content.append('    showDeleteConfirmModal, setShowDeleteConfirmModal,\n')
new_content.append('    todoToDelete, setTodoToDelete,\n')
new_content.append('    carryOverInProgress,\n')
new_content.append('    fetchTodos, handleAddTodo, handleAddRoutineTodo, handleAddNormalTodo,\n')
new_content.append('    handleToggleTodo, handleDeleteTodo,\n')
new_content.append('    executeSimpleDelete, hideOnThisDateOnly, deleteCompletely,\n')
new_content.append('    loadTrashedItems, handleRestoreTodo, handlePermanentlyDeleteTodo,\n')
new_content.append('    handleDragEnd, handleDragStart, handleDragCancel,\n')
new_content.append('    handleChangeIndent, handleOpenTodoHistory, handleCloseTodoHistory,\n')
new_content.append('    handleOpenTodoRoutineSetup, handleCloseTodoRoutineSetup,\n')
new_content.append('    handleCreateRoutineFromTodoInModal, handleToggleHistoryExpand,\n')
new_content.append('    handleConfirmDeleteTodo, showSuccessMessage, handleUndoRoutineDelete,\n')
new_content.append('  } = todosHook\n')
new_content.append('\n')

new_content.append('  const {\n')
new_content.append('    routines, routineInput, selectedDays, selectedTimeSlot,\n')
new_content.append('    isAddingRoutine, showRoutineModal,\n')
new_content.append('    editingRoutineId, editingRoutineText, editingRoutineDays,\n')
new_content.append('    showRoutineHistory, selectedRoutineForHistory, routineHistoryData,\n')
new_content.append('    routineCreationInProgress, setRoutineInput, setSelectedTimeSlot,\n')
new_content.append('    fetchRoutines, handleAddRoutine, handleDeleteRoutine,\n')
new_content.append('    handleStartEditRoutine, handleSaveEditRoutine, handleCancelEditRoutine,\n')
new_content.append('    handleToggleEditDay, handleCreateRoutineFromTodo,\n')
new_content.append('    createRoutineTodosForDate, createRoutineTodos,\n')
new_content.append('    handleOpenRoutine, handleCloseRoutine, handleOpenRoutineHistory,\n')
new_content.append('    handleCloseRoutineHistory, handleToggleRoutineDay,\n')
new_content.append('  } = routinesHook\n')
new_content.append('\n')

new_content.append('  const {\n')
new_content.append('    memoContent, setMemoContent,\n')
new_content.append('    isEditingMemoInline, isSavingMemo, memoOriginalContent,\n')
new_content.append('    memoTextareaRef,\n')
new_content.append('    fetchMemoContent, handleStartEditMemoInline,\n')
new_content.append('    handleSaveMemoInline, handleCancelEditMemoInline, handleMemoKeyDown,\n')
new_content.append('  } = memoHook\n')
new_content.append('\n')

new_content.append('  const {\n')
new_content.append('    keyThoughtsBlocks, setKeyThoughtsBlocks,\n')
new_content.append('    isSavingKeyThoughts, setIsSavingKeyThoughts,\n')
new_content.append('    lastSavedKeyThoughtsRef, focusedBlockId, setFocusedBlockId,\n')
new_content.append('    keyThoughtsHistory, showKeyThoughtsHistory, setShowKeyThoughtsHistory,\n')
new_content.append('    fetchKeyThoughtsContent, handleSaveKeyThoughts,\n')
new_content.append('    cleanupOldHistory, fetchKeyThoughtsHistory, restoreKeyThoughtsVersion,\n')
new_content.append('  } = keyThoughtsHook\n')
new_content.append('\n')

new_content.append('  const {\n')
new_content.append('    sectionOrder, setSectionOrder,\n')
new_content.append('    isReorderMode, setIsReorderMode,\n')
new_content.append('    fetchSectionOrder, moveSectionLeft, moveSectionRight,\n')
new_content.append('    handleSectionDragEnd, handleSectionsContainerDoubleClick,\n')
new_content.append('  } = sectionOrderHook\n')
new_content.append('\n')

# 6. 나머지 state들 (hooks에 포함되지 않은 것들)
new_content.append('  // UI 상태\n')
new_content.append('  const [showSidebar, setShowSidebar] = useState(false)\n')
new_content.append('  const [dummySessions, setDummySessions] = useState([])\n')
new_content.append('  const [showDummyModal, setShowDummyModal] = useState(false)\n')
new_content.append('  const [showDummySQL, setShowDummySQL] = useState(false)\n')
new_content.append('  const [showGanttChart, setShowGanttChart] = useState(false)\n')
new_content.append('  const [ganttData, setGanttData] = useState([])\n')
new_content.append('  const [ganttPeriod, setGanttPeriod] = useState(\'1week\')\n')
new_content.append('  const [encouragementMessages, setEncouragementMessages] = useState([])\n')
new_content.append('  const [showEncouragementModal, setShowEncouragementModal] = useState(false)\n')
new_content.append('  const [newEncouragementMessage, setNewEncouragementMessage] = useState(\'\')\n')
new_content.append('  const [editingEncouragementId, setEditingEncouragementId] = useState(null)\n')
new_content.append('  const [editingEncouragementText, setEditingEncouragementText] = useState(\'\')\n')
new_content.append('  const [showEncouragementEmoji, setShowEncouragementEmoji] = useState(false)\n')
new_content.append('  const [currentEncouragementMessage, setCurrentEncouragementMessage] = useState(\'\')\n')
new_content.append('  const [viewMode, setViewMode] = useState(() => {\n')
new_content.append('    const saved = localStorage.getItem(\'viewMode\')\n')
new_content.append('    return saved || \'horizontal\'\n')
new_content.append('  })\n')
new_content.append('\n')

new_content.append('  const sectionsContainerRef = useRef(null)\n')
new_content.append('  const [currentSectionIndex, setCurrentSectionIndex] = useState(0)\n')
new_content.append('  const contentScrollableRef = useRef(null)\n')
new_content.append('  const recentlyEditedIds = useRef(new Set())\n')
new_content.append('\n')

# 7. App 본문에서 필요한 함수들만 추출 (hooks에 없는 것들)
# 이 부분은 기존 코드에서 필요한 함수들을 찾아서 추가해야 합니다.
# 우선 주요 함수들을 파악하기 위해 기존 코드를 스캔합니다.

print("스크립트가 새 App.jsx의 일부를 생성했습니다.")
print("수동으로 확인이 필요한 부분:")
print("1. App 본문의 나머지 함수들 (useEffect, 이벤트 핸들러 등)")
print("2. JSX return 부분")
print("3. routinesHook의 setTodos 등 순환 참조 해결")

# 파일 쓰기
with open('src/App_refactored_partial.jsx', 'w', encoding='utf-8') as f:
    f.writelines(new_content)

print("\n부분적으로 리팩토링된 파일: src/App_refactored_partial.jsx")
print("다음 단계: 기존 App.jsx에서 필요한 함수들을 추가로 복사해야 합니다.")
