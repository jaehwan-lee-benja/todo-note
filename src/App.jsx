import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DAYS } from './utils/constants'
import { formatDateForDB, formatDateOnly, formatDate } from './utils/dateUtils'
import { useAuth } from './hooks/useAuth'
import AppleTimePicker from './components/Common/AppleTimePicker'
import Toast from './components/Common/Toast'
import Sidebar from './components/Navigation/Sidebar'
import Header from './components/Navigation/Header'
import SectionPagination from './components/Navigation/SectionPagination'
import TodoSection from './components/Todo/TodoSection'
import SortableTodoItem from './components/Todo/SortableTodoItem'
import RoutineModal from './components/Routine/RoutineModal'
import RoutineHistoryModal from './components/Routine/RoutineHistoryModal'
import MemoSection from './components/Memo/MemoSection'
import KeyThoughtsSection from './components/KeyThoughts/KeyThoughtsSection'
import TrashModal from './components/Modals/TrashModal'
import DummyModal from './components/Modals/DummyModal'
import GanttChartModal from './components/Modals/GanttChartModal'
import EncouragementModal from './components/Modals/EncouragementModal'
import KeyThoughtsHistoryModal from './components/Modals/KeyThoughtsHistoryModal'
import GoogleAuthButton from './components/Auth/GoogleAuthButton'
import { useSectionOrder } from './hooks/useSectionOrder'
import { useMemo as useMemoHook } from './hooks/useMemo'
import { useKeyThoughts } from './hooks/useKeyThoughts'
import { useRoutines } from './hooks/useRoutines'
import { useTodos } from './hooks/useTodos'
import { useTodoHistory } from './hooks/useTodoHistory'
import { useTodoRoutineSetup } from './hooks/useTodoRoutineSetup'
import { useDummyData } from './hooks/useDummyData'
import { useEncouragement } from './hooks/useEncouragement'
import { useGanttChart } from './hooks/useGanttChart'
import './App.css'

// 드래그 가능한 섹션 래퍼 컴포넌트
function SortableSection({ id, children, disabled, onLongPress }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const longPressTimerRef = useRef(null)
  const [isPressed, setIsPressed] = useState(false)

  const handlePointerDown = (e) => {
    if (disabled && onLongPress) {
      // section-header 영역인지 확인
      const isSectionHeader = e.target.closest('.section-header')
      if (!isSectionHeader) {
        // 헤더가 아니면 long press 무시
        return
      }

      setIsPressed(true)
      longPressTimerRef.current = setTimeout(() => {
        onLongPress()
        setIsPressed(false)
      }, 500) // 500ms 길게 누르기
    }
  }

  const handlePointerMove = () => {
    // 포인터가 움직이면 long press 취소 (텍스트 선택 중)
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
      setIsPressed(false)
    }
  }

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setIsPressed(false)
  }

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setIsPressed(false)
  }

  // translate만 사용 (scale 제거하여 텍스트 렌더링 개선)
  const transformString = transform
    ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
    : undefined

  const style = {
    transform: transformString,
    transition,
  }

  const eventHandlers = disabled
    ? {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
        onPointerLeave: handlePointerCancel,
      }
    : { ...attributes, ...listeners }

  // 순서 수정 모드일 때 클래스 추가
  const classNames = [
    !disabled && 'reorder-mode',
    isDragging && 'dragging'
  ].filter(Boolean).join(' ')

  return (
    <div ref={setNodeRef} style={style} className={classNames} {...eventHandlers}>
      {children}
    </div>
  )
}



// 시간 입력은 AppleTimePicker 사용

function App() {
  // 인증 상태
  const { session, authLoading, handleGoogleLogin, handleLogout } = useAuth()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showSidebar, setShowSidebar] = useState(false)
  const recentlyEditedIds = useRef(new Set())

  // DnD sensors 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const sectionSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    })
  )

  // todos state를 먼저 선언 (useRoutines와 useTodos가 공유)
  const [todos, setTodos] = useState([])

  // 공유 UI State (여러 훅에서 사용)
  const [selectedTodoForModal, setSelectedTodoForModal] = useState(null)

  // 투두 히스토리 훅
  const {
    showTodoHistoryModal,
    todoHistory,
    expandedHistoryIds,
    handleOpenTodoHistoryModal,
    handleCloseTodoHistoryModal,
    toggleHistoryDetail,
  } = useTodoHistory({
    session,
    supabase,
    selectedTodoForModal,
    setSelectedTodoForModal,
  })

  const {
    showRoutineModal, setShowRoutineModal,
    routines, setRoutines,
    routineInput, setRoutineInput,
    selectedDays, setSelectedDays,
    selectedTimeSlot, setSelectedTimeSlot,
    isAddingRoutine,
    editingRoutineId, setEditingRoutineId,
    editingRoutineText, setEditingRoutineText,
    showRoutineHistory, setShowRoutineHistory,
    selectedRoutineForHistory, setSelectedRoutineForHistory,
    routineHistoryData, setRoutineHistoryData,
    editingRoutineDays, setEditingRoutineDays,
    fetchRoutines,
    handleAddRoutine,
    handleCreateRoutineFromTodo,
    handleStartEditRoutine,
    handleCancelEditRoutine,
    handleSaveEditRoutine,
    handleToggleEditDay,
    handleDeleteRoutine,
    fetchRoutineHistory,
    handleCloseRoutineHistory,
    handleOpenRoutine,
    handleCloseRoutine,
    handleToggleDay,
    createRoutineTodos,
  } = useRoutines({
    session,
    supabase,
    selectedDate,
    setTodos,
    setSuccessToastMessage: () => {},
    setShowSuccessToast: () => {},
  })

  // 투두 루틴 설정 훅
  const {
    showTodoRoutineSetupModal,
    routineDaysForModal,
    setRoutineDaysForModal,
    isEditingRoutineInModal,
    setIsEditingRoutineInModal,
    routineTimeSlotForModal,
    setRoutineTimeSlotForModal,
    handleOpenTodoRoutineSetupModal,
    handleCloseTodoRoutineSetupModal,
  } = useTodoRoutineSetup({
    selectedTodoForModal,
    setSelectedTodoForModal,
    routines,
  })

  const {
    inputValue, setInputValue,
    routineInputValue, setRoutineInputValue,
    normalInputValue, setNormalInputValue,
    loading,
    isDraggingAny,
    isAdding,
    deletedTodo,
    showUndoToast,
    showSuccessToast,
    successToastMessage,
    lastDeleteAction,
    showTrashModal,
    trashedItems,
    focusedTodoId, setFocusedTodoId,
    showDeleteConfirmModal, setShowDeleteConfirmModal,
    todoToDelete, setTodoToDelete,
    carryOverInProgress,
    fetchTodos,
    handleAddTodo,
    handleAddRoutineTodo,
    handleAddNormalTodo,
    handleToggleTodo,
    handleDeleteTodo,
    handleRestoreFromTrash,
    handlePermanentDelete,
    movePastIncompleteTodosToToday,
    carryOverIncompleteTodos,
    handleAddSubTodo,
    handleEditTodo,
    handleDragStart,
    handleDragCancel,
    handleDragEnd,
    handleOpenTrash,
    handleCloseTrash,
    fetchTrash,
    handleEmptyTrash,
    handleUndoDelete,
    executeSimpleDelete,
    hideOnThisDateOnly,
    deleteCompletely,
    handleRemoveTodoFromUI,
  } = useTodos(session, supabase, selectedDate, todos, setTodos, routines, setRoutines, selectedTodoForModal, setSelectedTodoForModal)

  const handleFocusTodo = (todoId) => {
    setFocusedTodoId(todoId)
  }

  const showSuccessMessage = (message) => {
    console.log('Success:', message)
  }

  const handleUndoRoutineDelete = () => {
    handleUndoDelete()
  }

  const handleOpenMemo = () => {
    const memoSection = document.querySelector('.memo-section')
    if (memoSection) {
      memoSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const {
    showGanttChart,
    ganttData,
    ganttPeriod,
    setGanttPeriod,
    handleOpenGanttChart,
    handleCloseGanttChart,
    fetchGanttData,
  } = useGanttChart(supabase)

  const {
    dummySessions,
    showDummyModal,
    setShowDummyModal,
    showDummySQL,
    setShowDummySQL,
    handleCreateDummyData,
    handleDeleteDummySession,
    handleDeleteAllDummies,
    handleRemoveDuplicates,
  } = useDummyData(session, supabase, fetchTodos)

  const [showMemoModal, setShowMemoModal] = useState(false)

  const {
    memoContent, setMemoContent,
    isEditingMemo, setIsEditingMemo,
    isSavingMemo, setIsSavingMemo,
    memoOriginalContent, setMemoOriginalContent,
    isEditingMemoInline, setIsEditingMemoInline,
    memoTextareaRef,
    fetchMemoContent,
    handleEditMemo,
    handleStartEditMemoInline,
    handleSaveMemoInline,
    handleCancelEditMemoInline,
    handleMemoKeyDown,
    handleSaveMemo,
    handleResetMemo,
  } = useMemoHook(session)

  const {
    isSavingKeyThoughts,
    keyThoughtsBlocks, setKeyThoughtsBlocks,
    lastSavedKeyThoughtsRef,
    focusedBlockId, setFocusedBlockId,
    keyThoughtsHistory, setKeyThoughtsHistory,
    showKeyThoughtsHistory, setShowKeyThoughtsHistory,
    normalizeBlocks,
    fetchKeyThoughtsContent,
    handleSaveKeyThoughts,
    hasSignificantChange,
    cleanupOldHistory,
    saveKeyThoughtsVersion,
    fetchKeyThoughtsHistory,
    restoreKeyThoughtsVersion,
  } = useKeyThoughts(session)

  const {
    encouragementMessages,
    showEncouragementModal,
    setShowEncouragementModal,
    newEncouragementMessage,
    setNewEncouragementMessage,
    editingEncouragementId,
    setEditingEncouragementId,
    editingEncouragementText,
    setEditingEncouragementText,
    showEncouragementEmoji,
    currentEncouragementMessage,
    handleEncouragementClick,
    fetchEncouragementMessages,
    addEncouragementMessage,
    updateEncouragementMessage,
    deleteEncouragementMessage,
  } = useEncouragement(session, supabase)

  // showTodoHistoryModal, showTodoRoutineSetupModal 등은 useTodos에서 관리됨
  const [viewMode, setViewMode] = useState(() => {
    // 로컬스토리지에서 뷰 모드 불러오기
    const saved = localStorage.getItem('viewMode')
    return saved || 'horizontal' // 기본값: horizontal
  })
  // 섹션 순서 관리
  const sectionOrderHook = useSectionOrder(session)
  const {
    sectionOrder, setSectionOrder,
    isReorderMode, setIsReorderMode,
    fetchSectionOrder, moveSectionLeft, moveSectionRight,
    handleSectionDragEnd, handleSectionsContainerDoubleClick,
  } = sectionOrderHook
  const sectionsContainerRef = useRef(null) // 가로 스크롤 컨테이너 ref
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0) // 모바일 섹션 인덱스
  const contentScrollableRef = useRef(null) // 세로 스크롤 컨테이너 ref

  // 랜덤 격려 문구 선택
  // 날짜 변경 핸들러
  const handlePrevDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const handleNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  // 날짜 선택 핸들러
  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value + 'T00:00:00')
    setSelectedDate(newDate)
  }


  // 전날 미완료 항목을 다음 날로 이월 (JSON 방식)
  const moveIncompleteTodosToNextDay = async (fromDate, toDate) => {
    try {
      const fromDateStr = formatDateForDB(fromDate)
      const toDateStr = formatDateForDB(toDate)

      // 전날의 모든 투두 가져오기 (하이브리드 방식)
      const { data: allTodos, error: fetchError } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)
        .eq('completed', false)
        .is('routine_id', null) // 루틴 투두는 이월하지 않음

      if (fetchError) throw fetchError

      // 클라이언트 사이드 필터링: fromDateStr에 보이는 미완료 투두
      const incompleteTodos = (allTodos || []).filter(todo => {
        // hidden_dates 체크 (새 방식, 구 방식 모두 적용)
        const isHidden = todo.hidden_dates && Array.isArray(todo.hidden_dates) && todo.hidden_dates.includes(fromDateStr)
        if (isHidden) {
          return false // 숨김 처리된 투두는 이월하지 않음
        }

        // 새 방식: visible_dates 사용
        if (todo.visible_dates && Array.isArray(todo.visible_dates) && todo.visible_dates.length > 0) {
          const isVisible = todo.visible_dates.includes(fromDateStr)
          return isVisible
        }
        // 구 방식: date 사용
        return todo.date === fromDateStr
      })

      if (incompleteTodos.length === 0) {
        return
      }

      // 각 투두의 visible_dates에 toDateStr 추가
      for (const todo of incompleteTodos) {
        let currentVisibleDates = todo.visible_dates || [todo.date]

        // 이미 포함되어 있으면 스킵
        if (currentVisibleDates.includes(toDateStr)) {
          continue
        }

        // 새 날짜 추가
        const newVisibleDates = [...currentVisibleDates, toDateStr].sort()

        // 업데이트
        const { error: updateError } = await supabase
          .from('todos')
          .update({ visible_dates: newVisibleDates })
          .eq('id', todo.id)

        if (updateError) {
          console.error(`투두 ${todo.id} 이월 오류:`, updateError.message)
        }
      }
    } catch (error) {
      console.error('미완료 항목 이월 오류:', error.message)
    }
  }


  // 스크롤바 표시 제어
  useEffect(() => {
    let scrollTimer = null

    const handleScroll = () => {
      // 스크롤 시작 시 클래스 추가
      document.body.classList.add('is-scrolling')

      // 기존 타이머 클리어
      if (scrollTimer) {
        clearTimeout(scrollTimer)
      }

      // 1초 후 클래스 제거
      scrollTimer = setTimeout(() => {
        document.body.classList.remove('is-scrolling')
      }, 1000)
    }

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimer) {
        clearTimeout(scrollTimer)
      }
    }
  }, [])

  // 앱 시작 시 데이터 가져오기
  useEffect(() => {
    if (!session) return
    fetchEncouragementMessages()
    fetchMemoContent()
    fetchKeyThoughtsContent()
    fetchRoutines()
    fetchSectionOrder()
  }, [session])

  // 가로/세로 레이아웃에서 드래그로 스크롤 기능
  useEffect(() => {
    if (!sectionsContainerRef.current) return

    const container = sectionsContainerRef.current
    const isHorizontal = viewMode === 'horizontal'
    let isDown = false
    let startPos = 0
    let scrollPos = 0
    let bounceOffset = 0
    let animationFrame = null

    const getEventPos = (e) => {
      if (e.type.includes('touch')) {
        return isHorizontal ? e.touches[0].pageX : e.touches[0].pageY
      }
      return isHorizontal ? e.pageX : e.pageY
    }

    const handlePointerDown = (e) => {
      // section-block 위에서는 그랩 스크롤 비활성화
      if (e.target.closest('.section-block')) return

      isDown = true
      startPos = getEventPos(e)
      scrollPos = isHorizontal ? container.scrollLeft : container.scrollTop
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
        animationFrame = null
      }
      container.style.transition = 'none'
      container.style.transform = isHorizontal ? 'translateX(0)' : 'translateY(0)'
      bounceOffset = 0
    }

    const handlePointerLeave = () => {
      if (isDown && bounceOffset !== 0) {
        container.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        container.style.transform = isHorizontal ? 'translateX(0)' : 'translateY(0)'
        setTimeout(() => {
          container.style.transition = 'none'
          bounceOffset = 0
        }, 300)
      }
      isDown = false
    }

    const handlePointerUp = () => {
      if (bounceOffset !== 0) {
        container.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        container.style.transform = isHorizontal ? 'translateX(0)' : 'translateY(0)'
        setTimeout(() => {
          container.style.transition = 'none'
          bounceOffset = 0
        }, 300)
      }
      isDown = false
    }

    const handlePointerMove = (e) => {
      if (!isDown) return
      e.preventDefault()

      const pos = getEventPos(e)
      const walk = (pos - startPos) * 1.5
      const newScrollPos = scrollPos - walk

      const maxScroll = isHorizontal
        ? container.scrollWidth - container.clientWidth
        : container.scrollHeight - container.clientHeight

      if (newScrollPos < 0) {
        const overscroll = -newScrollPos
        bounceOffset = Math.min(overscroll * 0.3, 100)
        if (isHorizontal) {
          container.scrollLeft = 0
          container.style.transform = `translateX(${bounceOffset}px)`
        } else {
          container.scrollTop = 0
          container.style.transform = `translateY(${bounceOffset}px)`
        }
      } else if (newScrollPos > maxScroll) {
        const overscroll = newScrollPos - maxScroll
        bounceOffset = -Math.min(overscroll * 0.3, 100)
        if (isHorizontal) {
          container.scrollLeft = maxScroll
          container.style.transform = `translateX(${bounceOffset}px)`
        } else {
          container.scrollTop = maxScroll
          container.style.transform = `translateY(${bounceOffset}px)`
        }
      } else {
        bounceOffset = 0
        container.style.transform = isHorizontal ? 'translateX(0)' : 'translateY(0)'
        if (isHorizontal) {
          container.scrollLeft = newScrollPos
        } else {
          container.scrollTop = newScrollPos
        }
      }
    }

    // section-block 위에서 가로 휠 스크롤 방지
    const handleWheel = (e) => {
      if (isHorizontal && e.target.closest('.section-block') && e.deltaX !== 0) {
        e.preventDefault()
      }
    }

    // 마우스 이벤트
    container.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('mouseup', handlePointerUp)
    document.addEventListener('mouseleave', handlePointerLeave)
    container.addEventListener('mousemove', handlePointerMove)

    // 터치 이벤트
    container.addEventListener('touchstart', handlePointerDown, { passive: true })
    container.addEventListener('touchmove', handlePointerMove, { passive: false })
    container.addEventListener('touchend', handlePointerUp)
    container.addEventListener('touchcancel', handlePointerUp)

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('mouseup', handlePointerUp)
      document.removeEventListener('mouseleave', handlePointerLeave)
      container.removeEventListener('mousemove', handlePointerMove)

      container.removeEventListener('touchstart', handlePointerDown)
      container.removeEventListener('touchmove', handlePointerMove)
      container.removeEventListener('touchend', handlePointerUp)
      container.removeEventListener('touchcancel', handlePointerUp)

      container.removeEventListener('wheel', handleWheel)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [viewMode, todos, routines])

  // 모바일 섹션 스크롤 감지 (페이지네이션 dots용)
  useEffect(() => {
    if (viewMode !== 'horizontal' || !sectionsContainerRef.current) return

    const container = sectionsContainerRef.current
    const handleScroll = () => {
      const sections = container.querySelectorAll('.section-block')
      if (sections.length === 0) return

      const containerRect = container.getBoundingClientRect()
      const containerCenter = containerRect.left + containerRect.width / 2

      let closestIndex = 0
      let closestDistance = Infinity

      sections.forEach((section, index) => {
        const sectionRect = section.getBoundingClientRect()
        const sectionCenter = sectionRect.left + sectionRect.width / 2
        const distance = Math.abs(sectionCenter - containerCenter)

        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })

      setCurrentSectionIndex(closestIndex)
    }

    container.addEventListener('scroll', handleScroll)
    handleScroll() // 초기 상태 설정

    return () => container.removeEventListener('scroll', handleScroll)
  }, [viewMode, todos, routines])

  // 세로 스크롤 드래그 기능 (content-scrollable)
  useEffect(() => {
    if (!contentScrollableRef.current) return

    const container = contentScrollableRef.current
    let isDown = false
    let startY = 0
    let scrollTop = 0
    let bounceOffset = 0

    const handleMouseDown = (e) => {
      // 섹션 블록 내부 클릭은 제외
      const isClickOnSection = e.target.closest('.section-block')
      if (isClickOnSection) return

      isDown = true
      startY = e.pageY
      scrollTop = container.scrollTop
      container.style.transition = 'none'
      container.style.transform = 'translateY(0)'
      bounceOffset = 0
    }

    const handleMouseLeave = () => {
      if (isDown && bounceOffset !== 0) {
        container.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        container.style.transform = 'translateY(0)'
        setTimeout(() => {
          container.style.transition = 'none'
          bounceOffset = 0
        }, 300)
      }
      isDown = false
    }

    const handleMouseUp = () => {
      if (bounceOffset !== 0) {
        container.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        container.style.transform = 'translateY(0)'
        setTimeout(() => {
          container.style.transition = 'none'
          bounceOffset = 0
        }, 300)
      }
      isDown = false
    }

    const handleMouseMove = (e) => {
      if (!isDown) return
      e.preventDefault()

      const y = e.pageY
      const walk = (y - startY) * 1.5
      const newScrollTop = scrollTop - walk
      const maxScroll = container.scrollHeight - container.clientHeight

      if (newScrollTop < 0) {
        const overscroll = -newScrollTop
        bounceOffset = Math.min(overscroll * 0.3, 100)
        container.scrollTop = 0
        container.style.transform = `translateY(${bounceOffset}px)`
      } else if (newScrollTop > maxScroll) {
        const overscroll = newScrollTop - maxScroll
        bounceOffset = -Math.min(overscroll * 0.3, 100)
        container.scrollTop = maxScroll
        container.style.transform = `translateY(${bounceOffset}px)`
      } else {
        bounceOffset = 0
        container.style.transform = 'translateY(0)'
        container.scrollTop = newScrollTop
      }
    }

    container.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('mousemove', handleMouseMove)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('mousemove', handleMouseMove)
    }
  }, [todos, routines])

  // 간트차트 기간이 변경되면 데이터 다시 로드
  useEffect(() => {
    if (showGanttChart) {
      fetchGanttData()
    }
  }, [ganttPeriod])

  // 자정에 날짜 자동 업데이트 및 루틴 생성
  useEffect(() => {
    const checkMidnight = async () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const timeUntilMidnight = midnight.getTime() - now.getTime()

      const timer = setTimeout(async () => {
        const yesterday = new Date(now)
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // 전날 미완료 항목을 다음 날로 이동
        await moveIncompleteTodosToNextDay(yesterday, tomorrow)

        // 루틴 작업 생성
        await createRoutineTodos()

        // 날짜 업데이트
        setSelectedDate(new Date())
        checkMidnight() // 다음 자정을 위해 재귀 호출
      }, timeUntilMidnight)

      return timer
    }

    const timer = checkMidnight()
    return () => clearTimeout(timer)
  }, [])

  // 선택된 날짜가 변경될 때마다 할 일 목록 가져오기
  useEffect(() => {
    fetchTodos()

    // Supabase Realtime 구독
    const dateStr = formatDateForDB(selectedDate)
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `date=eq.${dateStr}`
        },
        (payload) => {

          if (payload.eventType === 'INSERT') {
            // 새 항목 추가
            setTodos(currentTodos => {
              // 중복 체크
              if (currentTodos.some(t => t.id === payload.new.id)) {
                return currentTodos
              }
              // order_index에 따라 정렬된 위치에 삽입
              const newTodos = [...currentTodos, payload.new]
              return newTodos.sort((a, b) => a.order_index - b.order_index)
            })
          } else if (payload.eventType === 'UPDATE') {
            // 항목 업데이트 (단, 최근에 로컬에서 수정한 항목은 무시)
            setTodos(currentTodos => {
              // 최근에 수정한 항목인지 확인
              if (recentlyEditedIds.current.has(payload.new.id)) {
                return currentTodos
              }
              return currentTodos.map(todo =>
                todo.id === payload.new.id ? payload.new : todo
              ).sort((a, b) => a.order_index - b.order_index)
            })
          } else if (payload.eventType === 'DELETE') {
            // 항목 삭제
            setTodos(currentTodos =>
              currentTodos.filter(todo => todo.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe((status) => {
      })

    // 컴포넌트 언마운트 또는 날짜 변경 시 구독 해제
    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDate, session])

  // 드래그 중 스크롤 차단
  useEffect(() => {
    if (isDraggingAny) {
      // 현재 스크롤 위치 저장
      const scrollY = window.scrollY
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

      // body에 overflow hidden 적용 (스크롤바 너비 보상)
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }

      return () => {
        // 스크롤 복원
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        document.body.style.paddingRight = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isDraggingAny])

  // Google 로그인 인증 화면
  const authScreen = GoogleAuthButton({ authLoading, session, handleGoogleLogin })
  if (authScreen) return authScreen

  return (
    <div className={`app ${isDraggingAny ? 'dragging-active' : ''}`}>
      <Sidebar
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        session={session}
        viewMode={viewMode}
        setViewMode={setViewMode}
        onOpenTrash={handleOpenTrash}
        onOpenRoutine={handleOpenRoutine}
        onOpenMemo={handleOpenMemo}
        onScrollToKeyThoughts={() => {
          const keyThoughtsSection = document.querySelector('.key-thoughts-section')
          if (keyThoughtsSection) {
            keyThoughtsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }
        }}
        onOpenGanttChart={handleOpenGanttChart}
        onOpenEncouragementModal={() => setShowEncouragementModal(true)}
        onOpenDummyModal={() => setShowDummyModal(true)}
        onLogout={handleLogout}
      />

      <div className={`container ${viewMode === 'horizontal' ? 'container-wide' : ''}`}>
        <Header
          showSidebar={showSidebar}
          setShowSidebar={setShowSidebar}
          selectedDate={selectedDate}
          onDateChange={handleDateChange}
          onPrevDay={handlePrevDay}
          onNextDay={handleNextDay}
          showEncouragementEmoji={showEncouragementEmoji}
          currentEncouragementMessage={currentEncouragementMessage}
          onEncouragementClick={handleEncouragementClick}
          isReorderMode={isReorderMode}
          setIsReorderMode={setIsReorderMode}
          setSelectedDate={setSelectedDate}
        />

        <div className="content-scrollable" ref={contentScrollableRef}>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="todo-list">
            {loading ? (
              <p className="empty-message">로딩 중...</p>
            ) : (() => {
              // 루틴 투두, 미정 루틴, 일반 투두 분리
              const routineTodos = todos.filter(t => !t.parent_id && t.routine_id !== null && !t.is_pending_routine)
              const pendingRoutineTodos = todos.filter(t => !t.parent_id && t.is_pending_routine)
              const normalTodos = todos.filter(t => !t.parent_id && t.routine_id === null && !t.is_pending_routine)

              return (
                <DndContext
                  sensors={sectionSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSectionDragEnd}
                >
                  <SortableContext
                    items={sectionOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div
                      ref={sectionsContainerRef}
                      className={`sections-container ${viewMode === 'horizontal' ? 'horizontal-layout' : 'vertical-layout'}`}
                      onDoubleClick={handleSectionsContainerDoubleClick}
                    >
                      {sectionOrder.map((sectionId) => {
                        if (sectionId === 'memo') {
                          return (
                            <SortableSection
                              key="memo"
                              id="memo"
                              disabled={!isReorderMode}
                              onLongPress={() => setIsReorderMode(true)}
                            >
                              <MemoSection
                                title="📋 생각 메모"
                                className="memo-section section-block"
                                content={memoContent}
                                setContent={setMemoContent}
                                isEditing={isEditingMemoInline}
                                isSaving={isSavingMemo}
                                textareaRef={memoTextareaRef}
                                onStartEdit={handleStartEditMemoInline}
                                onSave={handleSaveMemoInline}
                                onCancel={handleCancelEditMemoInline}
                                onKeyDown={handleMemoKeyDown}
                                placeholder="메모를 작성해보세요..."
                                emptyMessage="메모를 작성해보세요"
                              >
                    {/* SQL 버튼 */}
                    {!isEditingMemoInline && (
                      <div style={{marginTop: '1rem'}}>
                        <button
                          onClick={() => setShowDummySQL(!showDummySQL)}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'rgba(255, 255, 255, 0.7)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                          }}
                          title="더미 데이터 SQL 펼치기/접기"
                        >
                          <span>🧪 SQL 더미 데이터</span>
                          <span>{showDummySQL ? '▲' : '▼'}</span>
                        </button>
                      </div>
                    )}

                    {/* 더미 데이터 SQL */}
                    {showDummySQL && !isEditingMemoInline && (
                      <div className="dummy-sql-content" style={{marginTop: '1rem'}}>
                        <div className="sql-block">
                          <div className="sql-header">
                            <span>생성 SQL</span>
                            <div style={{display: 'flex', gap: '0.5rem'}}>
                              <button
                                onClick={() => {
                                  window.open('https://raw.githubusercontent.com/jaehwan-lee-benja/todo-note/main/create-dummy-data-v2.sql', '_blank');
                                }}
                                className="link-button"
                                title="GitHub에서 파일 보기"
                              >
                                🔗
                              </button>
                              <button
                                onClick={() => {
                                  const today = new Date();
                                  const getDateStr = (offset) => {
                                    const d = new Date(today);
                                    d.setDate(d.getDate() + offset);
                                    return d.toISOString().split('T')[0];
                                  };
                                  const getDay = (offset) => {
                                    const d = new Date(today);
                                    d.setDate(d.getDate() + offset);
                                    return d.getDate();
                                  };

                                  const sessionId = Date.now();
                                  const d_m2 = getDay(-2), d_m1 = getDay(-1), d_0 = getDay(0), d_p1 = getDay(1), d_p2 = getDay(2);
                                  const date_m2 = getDateStr(-2), date_m1 = getDateStr(-1), date_0 = getDateStr(0), date_p1 = getDateStr(1), date_p2 = getDateStr(2);

                                  const createSQL = `-- 오늘 날짜 기준 앞뒤 이틀씩 더미 데이터 생성 (${date_0} 기준)
INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음', '${date_m2}', false, '${date_m2}T09:00:00+09:00', 1001),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m2}일완료', '${date_m2}', true, '${date_m2}T09:10:00+09:00', 1002),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m1}일완료', '${date_m2}', true, '${date_m2}T09:20:00+09:00', 1003),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_0}일완료', '${date_m2}', true, '${date_m2}T09:30:00+09:00', 1004);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-수정이력있음', '${date_m1}', false, '${date_m1}T10:00:00+09:00', 1005),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_m1}일완료', '${date_m1}', true, '${date_m1}T10:10:00+09:00', 1006),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_0}일완료', '${date_m1}', true, '${date_m1}T10:20:00+09:00', 1007);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-미완료', '${date_0}', false, '${date_0}T11:00:00+09:00', 1008),
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-${d_0}일완료', '${date_0}', true, '${date_0}T11:10:00+09:00', 1009);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m1}일페이지-미완료', '${date_m1}', false, '${date_m2}T14:00:00+09:00', 1010),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m1}일페이지-${d_m1}일완료', '${date_m1}', true, '${date_m2}T14:10:00+09:00', 1011);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_0}일페이지-미완료', '${date_0}', false, '${date_m1}T15:00:00+09:00', 1012),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_0}일페이지-${d_0}일완료', '${date_0}', true, '${date_m1}T15:10:00+09:00', 1013),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_0}일페이지-미완료', '${date_0}', false, '${date_m2}T15:00:00+09:00', 1014),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_0}일페이지-${d_0}일완료', '${date_0}', true, '${date_m2}T15:10:00+09:00', 1015);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-${d_p1}일페이지-미완료', '${date_p1}', false, '${date_0}T16:00:00+09:00', 1016),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_p1}일페이지-미완료', '${date_p1}', false, '${date_m1}T16:00:00+09:00', 1017),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_p1}일페이지-미완료', '${date_p1}', false, '${date_m2}T16:00:00+09:00', 1018);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-${d_p2}일페이지-미완료', '${date_p2}', false, '${date_0}T17:00:00+09:00', 1019),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_p2}일페이지-미완료', '${date_p2}', false, '${date_m1}T17:00:00+09:00', 1020);

INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT id, '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-1차', '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-2차', '${date_m1}T12:00:00+09:00', '${date_m1}'
FROM todos WHERE text = '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음' LIMIT 1;

INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT id, '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-2차', '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음', '${date_0}T12:00:00+09:00', '${date_0}'
FROM todos WHERE text = '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음' LIMIT 1;

INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT id, '[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-1차', '[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-수정이력있음', '${date_0}T13:00:00+09:00', '${date_0}'
FROM todos WHERE text = '[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-수정이력있음' LIMIT 1;`;

                                  const textarea = document.createElement('textarea');
                                  textarea.value = createSQL;
                                  textarea.style.position = 'fixed';
                                  textarea.style.opacity = '0';
                                  document.body.appendChild(textarea);
                                  textarea.select();
                                  try {
                                    document.execCommand('copy');
                                    alert('생성 SQL 복사 완료!');
                                  } catch (err) {
                                    alert('복사에 실패했습니다.');
                                  }
                                  document.body.removeChild(textarea);
                                }}
                                className="copy-button"
                              >
                                📋 복사
                              </button>
                            </div>
                          </div>
                          <pre className="sql-code">{`-- ⚠️ 참고: 복사 버튼 클릭 시 오늘 날짜 기준으로 자동 생성됩니다
-- 아래는 예시입니다 (실제 날짜는 실행 시점 기준 앞뒤 이틀)

-- DO 블록 버전 (PostgreSQL/Supabase)
DO $$
DECLARE
  day_m2 date := CURRENT_DATE - INTERVAL '2 days';
  day_m1 date := CURRENT_DATE - INTERVAL '1 day';
  day_0 date := CURRENT_DATE;
  day_p1 date := CURRENT_DATE + INTERVAL '1 day';
  day_p2 date := CURRENT_DATE + INTERVAL '2 days';
  d_m2 text := EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '2 days')::text;
  d_m1 text := EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '1 day')::text;
  d_0 text := EXTRACT(DAY FROM CURRENT_DATE)::text;
  d_p1 text := EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '1 day')::text;
  d_p2 text := EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '2 days')::text;
  session_id text := EXTRACT(EPOCH FROM NOW())::bigint::text;
BEGIN
  -- -2일 페이지 데이터 (4개)
  INSERT INTO todos (text, date, completed, created_at, order_index)
  VALUES
    ('[DUMMY-' || session_id || '] 더미: ' || d_m2 || '일생성-미완료-수정이력있음', day_m2, false, (day_m2 + TIME '09:00:00') AT TIME ZONE 'Asia/Seoul', 1001),
    ...

  -- 총 20개의 투두와 3개의 히스토리 생성
  -- 자세한 내용은 GitHub 파일 참고
END $$;`}</pre>
                        </div>

                        <div className="sql-block">
                          <div className="sql-header">
                            <span>삭제 SQL</span>
                            <div style={{display: 'flex', gap: '0.5rem'}}>
                              <button
                                onClick={() => {
                                  window.open('https://raw.githubusercontent.com/jaehwan-lee-benja/todo-note/main/delete-dummy-data-v2.sql', '_blank');
                                }}
                                className="link-button"
                                title="GitHub에서 파일 보기"
                              >
                                🔗
                              </button>
                              <button
                                onClick={() => {
                                  const deleteSQL = `DELETE FROM todo_history
WHERE todo_id IN (
  SELECT id FROM todos WHERE text LIKE '[DUMMY-%'
);

DELETE FROM todos
WHERE text LIKE '[DUMMY-%';`;

                                  const textarea = document.createElement('textarea');
                                  textarea.value = deleteSQL;
                                  textarea.style.position = 'fixed';
                                  textarea.style.opacity = '0';
                                  document.body.appendChild(textarea);
                                  textarea.select();
                                  try {
                                    document.execCommand('copy');
                                    alert('삭제 SQL 복사 완료!');
                                  } catch (err) {
                                    alert('복사에 실패했습니다.');
                                  }
                                  document.body.removeChild(textarea);
                                }}
                                className="copy-button"
                              >
                                📋 복사
                              </button>
                            </div>
                          </div>
                          <pre className="sql-code">{`DELETE FROM todo_history
WHERE todo_id IN (
  SELECT id FROM todos WHERE text LIKE '[DUMMY-%'
);

DELETE FROM todos
WHERE text LIKE '[DUMMY-%';`}</pre>
                        </div>
                      </div>
                    )}
                              </MemoSection>
                            </SortableSection>
                          )
                        } else if (sectionId === 'routine') {
                          return (
                            <SortableSection
                              key="routine"
                              id="routine"
                              disabled={!isReorderMode}
                              onLongPress={() => setIsReorderMode(true)}
                            >
                              <TodoSection
                                title="📌 루틴"
                                className="routine-section section-block"
                                inputValue={routineInputValue}
                                setInputValue={setRoutineInputValue}
                                onAddTodo={handleAddRoutineTodo}
                                isAdding={isAdding}
                                placeholder="루틴 할 일 추가..."
                              >
                    {/* 확정 루틴 */}
                    {routineTodos.length > 0 && (
                      <SortableContext
                        items={routineTodos.map(todo => todo.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {routineTodos.map((todo, index) => {
                          const subtodos = todos.filter(t => t.parent_id === todo.id)
                          return (
                            <SortableTodoItem
                              key={todo.id}
                              todo={todo}
                              index={index}
                              onToggle={handleToggleTodo}
                              onDelete={handleDeleteTodo}
                              onEdit={handleEditTodo}
                              formatDate={formatDate}
                              formatDateOnly={formatDateOnly}
                              isFocused={focusedTodoId === todo.id}
                              onFocus={handleFocusTodo}
                              onAddSubTodo={handleAddSubTodo}
                              subtodos={subtodos}
                              level={0}
                              onCreateRoutine={handleCreateRoutineFromTodo}
                              routines={routines}
                              onShowRoutineHistory={fetchRoutineHistory}
                              onOpenRoutineSetupModal={handleOpenTodoRoutineSetupModal}
                              onOpenHistoryModal={handleOpenTodoHistoryModal}
                              currentPageDate={formatDateForDB(selectedDate)}
                              onRemoveFromUI={handleRemoveTodoFromUI}
                              showSuccessMessage={showSuccessMessage}
                            />
                          )
                        })}
                      </SortableContext>
                    )}

                    {/* 구분선 (확정 루틴과 미정 루틴 사이) */}
                    {routineTodos.length > 0 && pendingRoutineTodos.length > 0 && (
                      <div style={{ margin: '1rem 0', padding: '0 1rem' }}>
                        <div className="separator-line"></div>
                      </div>
                    )}

                    {/* 미정 루틴 */}
                    {pendingRoutineTodos.length > 0 && (
                      <SortableContext
                        items={pendingRoutineTodos.map(todo => todo.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {pendingRoutineTodos.map((todo, index) => {
                          const subtodos = todos.filter(t => t.parent_id === todo.id)
                          return (
                            <SortableTodoItem
                              key={todo.id}
                              todo={todo}
                              index={index}
                              onToggle={handleToggleTodo}
                              onDelete={handleDeleteTodo}
                              onEdit={handleEditTodo}
                              formatDate={formatDate}
                              formatDateOnly={formatDateOnly}
                              isFocused={focusedTodoId === todo.id}
                              onFocus={handleFocusTodo}
                              onAddSubTodo={handleAddSubTodo}
                              subtodos={subtodos}
                              level={0}
                              onCreateRoutine={handleCreateRoutineFromTodo}
                              routines={routines}
                              onShowRoutineHistory={fetchRoutineHistory}
                              onOpenRoutineSetupModal={handleOpenTodoRoutineSetupModal}
                              onOpenHistoryModal={handleOpenTodoHistoryModal}
                              currentPageDate={formatDateForDB(selectedDate)}
                              isPendingRoutine={true}
                              onRemoveFromUI={handleRemoveTodoFromUI}
                              showSuccessMessage={showSuccessMessage}
                            />
                          )
                        })}
                      </SortableContext>
                    )}
                              </TodoSection>
                            </SortableSection>
                          )
                        } else if (sectionId === 'normal') {
                          return (
                            <SortableSection
                              key="normal"
                              id="normal"
                              disabled={!isReorderMode}
                              onLongPress={() => setIsReorderMode(true)}
                            >
                              <TodoSection
                                title="📝 일반 투두"
                                className="normal-section section-block"
                                inputValue={normalInputValue}
                                setInputValue={setNormalInputValue}
                                onAddTodo={handleAddNormalTodo}
                                isAdding={isAdding}
                                placeholder="일반 할 일 추가..."
                              >
                    {normalTodos.length > 0 && (
                      <SortableContext
                        items={normalTodos.map(todo => todo.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {normalTodos.map((todo, index, array) => {
                  const subtodos = todos.filter(t => t.parent_id === todo.id)

                  // 현재 보고 있는 페이지의 날짜 (selectedDate)
                  const currentPageDate = formatDateForDB(selectedDate)

                  // 투두의 생성일 (created_at에서 날짜만 추출)
                  const todoCreatedDate = todo.created_at ? todo.created_at.split('T')[0] : todo.date

                  // 다음 투두의 생성일
                  const nextTodo = array[index + 1]
                  const nextTodoCreatedDate = nextTodo
                    ? (nextTodo.created_at ? nextTodo.created_at.split('T')[0] : nextTodo.date)
                    : null

                  // 현재 투두는 페이지 날짜 이전에 생성, 다음 투두는 페이지 날짜에 생성된 경우 구분선 표시
                  const showSeparator = todoCreatedDate < currentPageDate && nextTodoCreatedDate >= currentPageDate

                  // 디버깅
                  if (index < 5) {
                  }

                  return (
                    <React.Fragment key={todo.id}>
                      <SortableTodoItem
                        todo={todo}
                        index={index}
                        onToggle={handleToggleTodo}
                        onDelete={handleDeleteTodo}
                        onEdit={handleEditTodo}
                        formatDate={formatDate}
                        formatDateOnly={formatDateOnly}
                        isFocused={focusedTodoId === todo.id}
                        onFocus={handleFocusTodo}
                        onAddSubTodo={handleAddSubTodo}
                        subtodos={subtodos}
                        level={0}
                        onCreateRoutine={handleCreateRoutineFromTodo}
                        routines={routines}
                        onShowRoutineHistory={fetchRoutineHistory}
                        onOpenRoutineSetupModal={handleOpenTodoRoutineSetupModal}
                        onOpenHistoryModal={handleOpenTodoHistoryModal}
                        currentPageDate={currentPageDate}
                        onRemoveFromUI={handleRemoveTodoFromUI}
                        showSuccessMessage={showSuccessMessage}
                      />
                      {showSeparator && (
                        <div className="todo-date-separator">
                          <div className="separator-line"></div>
                          <div className="separator-text">이전에서 넘어옴</div>
                          <div className="separator-line"></div>
                        </div>
                      )}
                    </React.Fragment>
                  )
                              })}
                            </SortableContext>
                          )}
                              </TodoSection>
                            </SortableSection>
                          )
                        } else if (sectionId === 'key-thoughts') {
                          return (
                            <SortableSection
                              key="key-thoughts"
                              id="key-thoughts"
                              disabled={!isReorderMode}
                              onLongPress={() => setIsReorderMode(true)}
                            >
                              <KeyThoughtsSection
                                blocks={keyThoughtsBlocks}
                                setBlocks={setKeyThoughtsBlocks}
                                focusedBlockId={focusedBlockId}
                                setFocusedBlockId={setFocusedBlockId}
                                onShowHistory={() => {
                                  fetchKeyThoughtsHistory()
                                  setShowKeyThoughtsHistory(true)
                                }}
                              />
                            </SortableSection>
                          )
                        }
                        return null
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )
            })()}
          </div>
        </DndContext>

        <SectionPagination
          viewMode={viewMode}
          currentSectionIndex={currentSectionIndex}
          sectionsContainerRef={sectionsContainerRef}
        />
        </div>

        {showUndoToast && (
          <Toast
            message="삭제되었습니다"
            onUndo={handleUndoDelete}
          />
        )}

        {showSuccessToast && (
          <Toast
            message={successToastMessage}
            onUndo={lastDeleteAction ? handleUndoRoutineDelete : null}
            variant="success"
          />
        )}

        {showDeleteConfirmModal && todoToDelete && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirmModal(false)}>
            <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🗑️ 삭제 옵션 선택</h2>
                <button onClick={() => setShowDeleteConfirmModal(false)} className="modal-close-button">✕</button>
              </div>
              <div className="delete-confirm-content">
                <p className="delete-confirm-text">
                  <strong>{todoToDelete.text}</strong>
                </p>
                <p className="delete-confirm-description">
                  이 투두는 여러 날짜에 보입니다. 어떻게 삭제하시겠습니까?
                </p>
                <div className="delete-options-simple">
                  <button
                    className="delete-option-button-simple option-hide"
                    onClick={() => hideOnThisDateOnly(todoToDelete)}
                  >
                    <span className="option-icon">👁️‍🗨️</span>
                    <span className="option-title">이 날짜에서만 숨김</span>
                    <span className="option-desc">다른 날짜에서는 계속 보입니다</span>
                  </button>
                  <button
                    className="delete-option-button-simple option-delete"
                    onClick={() => deleteCompletely(todoToDelete)}
                  >
                    <span className="option-icon">🗑️</span>
                    <span className="option-title">휴지통으로 이동</span>
                    <span className="option-desc">모든 날짜에서 삭제 (복원 가능)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 투두 히스토리 모달 */}
        {showTodoHistoryModal && selectedTodoForModal && (() => {
          const todo = selectedTodoForModal
          const visibleDates = todo.visible_dates && todo.visible_dates.length > 0 ? todo.visible_dates : [todo.date]
          const originalDate = visibleDates[0]
          const carryOverPath = visibleDates.map(date => ({ id: `${todo.id}-${date}`, date }))
          const historyRecords = todoHistory[todo.id] || []

          return (
            <div className="modal-overlay" onClick={handleCloseTodoHistoryModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>📊 투두 히스토리</h2>
                  <button onClick={handleCloseTodoHistoryModal} className="modal-close-button">✕</button>
                </div>
                <div className="modal-body">
                  <div className="todo-history">
                    <div className="history-item">
                      <span className="history-label">생성일:</span>
                      <span className="history-value">{formatDate(todo.created_at)}</span>
                    </div>
                    <div className="history-item">
                      <span className="history-label">원본 페이지:</span>
                      <span className="history-value">
                        {originalDate ? formatDateOnly(new Date(originalDate + 'T00:00:00')) : formatDateOnly(new Date(todo.date + 'T00:00:00'))}
                      </span>
                    </div>
                    {carryOverPath.length > 0 && (
                      <div className="history-item">
                        <span className="history-label">이월 경로:</span>
                        <span className="history-value">
                          {carryOverPath.map((path, idx) => {
                            const isCurrentPage = path.date === todo.date
                            const dateStr = formatDateOnly(new Date(path.date + 'T00:00:00'))
                            return (
                              <span key={path.id}>
                                {idx > 0 && ' → '}
                                <span style={isCurrentPage ? { fontWeight: 'bold', color: '#4CAF50' } : {}}>
                                  {dateStr.split('(')[0]}{isCurrentPage ? '(여기)' : ''}
                                </span>
                              </span>
                            )
                          })}
                        </span>
                      </div>
                    )}
                    {(() => {
                      const createdDate = new Date(todo.created_at).toISOString().split('T')[0]
                      const currentDate = todo.date
                      if (createdDate !== currentDate && carryOverPath.length === 0) {
                        return (
                          <div className="history-item">
                            <span className="history-label">현재 페이지:</span>
                            <span className="history-value">{formatDateOnly(new Date(todo.date + 'T00:00:00'))}</span>
                          </div>
                        )
                      }
                      return null
                    })()}
                    {historyRecords.length > 0 && (
                      <div className="history-changes-list">
                        <div className="history-changes-header">변경 이력 ({historyRecords.length})</div>
                        {historyRecords.map((record) => (
                          <div key={record.id} className="history-record-compact">
                            <div className="history-record-summary">
                              <div className="history-change-time">
                                {formatDate(record.changed_at)}
                                {record.changed_on_date && (
                                  <span className="history-page-info"> (페이지: {formatDateOnly(new Date(record.changed_on_date + 'T00:00:00'))})</span>
                                )}
                              </div>
                              <button
                                className="history-detail-button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleHistoryDetail(record.id)
                                }}
                              >
                                {expandedHistoryIds.includes(record.id) ? '숨기기' : '내용보기'}
                              </button>
                            </div>
                            {expandedHistoryIds.includes(record.id) && (
                              <div className="history-change">
                                <div className="history-change-item history-before">
                                  <span className="change-badge">이전</span>
                                  <span className="change-text">{record.previous_text}</span>
                                </div>
                                <div className="history-change-arrow">→</div>
                                <div className="history-change-item history-after">
                                  <span className="change-badge">이후</span>
                                  <span className="change-text">{record.new_text}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* 루틴 설정 모달 */}
        {showTodoRoutineSetupModal && selectedTodoForModal && (() => {
          const todo = selectedTodoForModal
          const currentRoutine = routines.find(r => r.id === todo.routine_id)

          return (
            <div className="modal-overlay" onClick={handleCloseTodoRoutineSetupModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>🔄 루틴 설정</h2>
                  <button onClick={handleCloseTodoRoutineSetupModal} className="modal-close-button">✕</button>
                </div>
                <div className="modal-body">
                  <div className="routine-setup-inline">
                    {currentRoutine && !isEditingRoutineInModal ? (
                      <>
                        <div className="routine-current-info">
                          <div className="routine-info-title">설정된 루틴:</div>
                          <div className="routine-days-display">
                            {DAYS.filter(day => currentRoutine.days.includes(day.key)).map(day => (
                              <span key={day.key} className="routine-day-badge">
                                {day.label}
                              </span>
                            ))}
                          </div>
                          {currentRoutine.time_slot && (
                            <div className="routine-time-slot" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                              ⏰ {currentRoutine.time_slot}
                            </div>
                          )}
                        </div>
                        <div className="routine-setup-actions">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (currentRoutine) {
                                setRoutineDaysForModal(currentRoutine.days)
                                setRoutineTimeSlotForModal(currentRoutine.time_slot || '')
                                setIsEditingRoutineInModal(true)
                              }
                            }}
                            className="routine-confirm-button"
                          >
                            수정
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (currentRoutine && todo) {
                                await handleCreateRoutineFromTodo(todo.id, todo.text, [], null, true)
                                handleCloseTodoRoutineSetupModal()
                              }
                            }}
                            className="routine-remove-button"
                          >
                            제거
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="routine-setup-title">
                          {isEditingRoutineInModal ? '루틴 수정:' : '반복할 요일 선택:'}
                        </div>
                        <div className="day-selector-inline">
                          {DAYS.map(day => (
                            <button
                              key={day.key}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleRoutineDayInModal(day.key)
                              }}
                              className={`day-button-inline ${routineDaysForModal.includes(day.key) ? 'selected' : ''}`}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                        <div className="time-slot-selector" style={{ marginTop: '1rem' }}>
                          <label style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem', display: 'block' }}>
                            ⏰ 시간 (선택사항)
                          </label>
                          <AppleTimePicker
                            value={routineTimeSlotForModal}
                            onChange={(time) => setRoutineTimeSlotForModal(time)}
                          />
                        </div>
                        <div className="routine-setup-actions">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (todo) {
                                if (isEditingRoutineInModal && currentRoutine) {
                                  // 루틴 수정
                                  await handleCreateRoutineFromTodo(todo.id, todo.text, routineDaysForModal, currentRoutine.id, false, routineTimeSlotForModal)
                                } else {
                                  // 새 루틴 생성 (요일 없으면 매일 반복)
                                  await handleCreateRoutineFromTodo(todo.id, todo.text, routineDaysForModal, null, false, routineTimeSlotForModal)
                                }
                                handleCloseTodoRoutineSetupModal()
                              }
                            }}
                            className="routine-confirm-button"
                          >
                            확인
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCloseTodoRoutineSetupModal()
                            }}
                            className="routine-cancel-button"
                          >
                            취소
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}





        <RoutineModal
          showRoutineModal={showRoutineModal}
          onClose={handleCloseRoutine}
          routineInput={routineInput}
          setRoutineInput={setRoutineInput}
          isAddingRoutine={isAddingRoutine}
          selectedDays={selectedDays}
          onToggleDay={handleToggleDay}
          selectedTimeSlot={selectedTimeSlot}
          setSelectedTimeSlot={setSelectedTimeSlot}
          onAddRoutine={handleAddRoutine}
          routines={routines}
          editingRoutineId={editingRoutineId}
          editingRoutineText={editingRoutineText}
          setEditingRoutineText={setEditingRoutineText}
          editingRoutineDays={editingRoutineDays}
          onToggleEditDay={handleToggleEditDay}
          onStartEdit={handleStartEditRoutine}
          onSaveEdit={handleSaveEditRoutine}
          onCancelEdit={handleCancelEditRoutine}
          onDelete={handleDeleteRoutine}
          onShowHistory={fetchRoutineHistory}
        />

        <RoutineHistoryModal
          showRoutineHistory={showRoutineHistory}
          onClose={handleCloseRoutineHistory}
          selectedRoutine={selectedRoutineForHistory}
          routineHistoryData={routineHistoryData}
        />

        <TrashModal
          showTrashModal={showTrashModal}
          onClose={handleCloseTrash}
          trashedItems={trashedItems}
          onEmptyTrash={handleEmptyTrash}
          onRestoreFromTrash={handleRestoreFromTrash}
          onPermanentDelete={handlePermanentDelete}
          formatDate={formatDate}
        />

        <DummyModal
          showDummyModal={showDummyModal}
          onClose={() => setShowDummyModal(false)}
          onCreateDummyData={handleCreateDummyData}
          onRemoveDuplicates={handleRemoveDuplicates}
          dummySessions={dummySessions}
          onDeleteDummySession={handleDeleteDummySession}
          onDeleteAllDummies={handleDeleteAllDummies}
          formatDate={formatDate}
        />

        <GanttChartModal
          showGanttChart={showGanttChart}
          onClose={handleCloseGanttChart}
          ganttData={ganttData}
          ganttPeriod={ganttPeriod}
          setGanttPeriod={setGanttPeriod}
          formatDateOnly={formatDateOnly}
        />

        <EncouragementModal
          showEncouragementModal={showEncouragementModal}
          onClose={() => setShowEncouragementModal(false)}
          encouragementMessages={encouragementMessages}
          newEncouragementMessage={newEncouragementMessage}
          setNewEncouragementMessage={setNewEncouragementMessage}
          onAddEncouragementMessage={addEncouragementMessage}
          editingEncouragementId={editingEncouragementId}
          editingEncouragementText={editingEncouragementText}
          setEditingEncouragementId={setEditingEncouragementId}
          setEditingEncouragementText={setEditingEncouragementText}
          onUpdateEncouragementMessage={updateEncouragementMessage}
          onDeleteEncouragementMessage={deleteEncouragementMessage}
        />

        <KeyThoughtsHistoryModal
          showKeyThoughtsHistory={showKeyThoughtsHistory}
          onClose={() => setShowKeyThoughtsHistory(false)}
          keyThoughtsHistory={keyThoughtsHistory}
          onRestoreVersion={restoreKeyThoughtsVersion}
        />
      </div>
    </div>
  )
}

export default App
