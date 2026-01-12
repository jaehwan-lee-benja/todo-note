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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { formatDateForDB, formatDateOnly, formatDate } from './utils/dateUtils'
import { useAuth } from './hooks/useAuth'
import Sidebar from './components/Navigation/Sidebar'
import Header from './components/Navigation/Header'
import SectionPagination from './components/Navigation/SectionPagination'
import TodoSection from './components/Todo/TodoSection'
import SortableTodoItem from './components/Todo/SortableTodoItem'
import AppModals from './components/App/AppModals'
import GoogleAuthButton from './components/Auth/GoogleAuthButton'
import { useSectionOrder } from './hooks/useSectionOrder'
import { useMemo as useMemoHook } from './hooks/useMemo'
import { useRoutines } from './hooks/useRoutines'
import { useTodos } from './hooks/useTodos'
import { useTodoHistory } from './hooks/useTodoHistory'
import { useTodoRoutineSetup } from './hooks/useTodoRoutineSetup'
import { useTodoCarryOver } from './hooks/useTodoCarryOver'
import { useEncouragement } from './hooks/useEncouragement'
import { useGanttChart } from './hooks/useGanttChart'
import { settingsService, SETTING_KEYS } from './services/settingsService'
import './App.css'

// 시간 입력은 AppleTimePicker 사용

function App() {
  // 인증 상태
  const { session, authLoading, handleGoogleLogin, handleLogout } = useAuth()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showSidebar, setShowSidebar] = useState(false)
  const recentlyEditedIds = useRef(new Set())

  // DnD sensors 설정 (드래그 핸들 방식)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
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
    showDeleteConfirmModal: showRoutineDeleteModal,
    setShowDeleteConfirmModal: setShowRoutineDeleteModal,
    routineToDelete,
    setRoutineToDelete,
    fetchRoutines,
    handleAddRoutine,
    handleCreateRoutineFromTodo,
    handleStartEditRoutine,
    handleCancelEditRoutine,
    handleSaveEditRoutine,
    handleToggleEditDay,
    handleDeleteRoutine,
    deleteThisOnly: deleteRoutineThisOnly,
    deleteFromNow: deleteRoutineFromNow,
    deleteAll: deleteRoutineAll,
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

  // 투두 이월 훅
  const {
    carryOverInProgress,
    carryOverIncompleteTodos,
    movePastIncompleteTodosToToday,
  } = useTodoCarryOver({
    session,
    supabase,
    selectedDate,
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
    focusedTodoId, setFocusedTodoId,
    showDeleteConfirmModal, setShowDeleteConfirmModal,
    todoToDelete, setTodoToDelete,
    activeTodoId,
    overId,
    fetchTodos,
    handleAddTodo,
    handleAddRoutineTodo,
    handleAddNormalTodo,
    handleToggleTodo,
    handleDeleteTodo,
    handleAddSubTodo,
    handleEditTodo,
    handleDragStart,
    handleDragOver,
    handleDragCancel,
    handleDragEnd,
    handleUndoDelete,
    deleteThisOnly,
    deleteFromNow,
    deleteAll,
    handleRemoveTodoFromUI,
    handleMoveUp,
    handleMoveDown,
    handleMoveToTop,
    handleMoveToBottom,
  } = useTodos(session, supabase, selectedDate, todos, setTodos, routines, setRoutines, selectedTodoForModal, setSelectedTodoForModal)

  const handleFocusTodo = (todoId) => {
    setFocusedTodoId(todoId)
  }

  const showSuccessMessage = (message) => {
    // Success message handler (can be extended for toast notifications)
  }

  const handleUndoRoutineDelete = () => {
    handleUndoDelete()
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

  const [showMemoModal, setShowMemoModal] = useState(false)

  const {
    memoContent, setMemoContent,
    isSavingMemo,
    memoTextareaRef,
    fetchMemoContent,
  } = useMemoHook(session)

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

  // Quick Add 함수 (로딩과 무관하게 즉시 동작)
  const handleQuickAdd = async (text) => {
    try {
      const dateStr = formatDateForDB(selectedDate)
      const normalTodos = todos.filter(t => !t.parent_id && t.section_type === 'normal')
      const newOrderIndex = normalTodos.length > 0 ? Math.max(...normalTodos.map(t => t.order_index)) + 1 : 1

      // 임시 ID로 즉시 UI 업데이트 (낙관적 업데이트)
      const tempId = `temp_${Date.now()}_${Math.random()}`
      const optimisticTodo = {
        id: tempId,
        text,
        completed: false,
        order_index: newOrderIndex,
        date: dateStr,
        visible_dates: [dateStr],
        hidden_dates: [],
        section_type: 'normal',
        user_id: session?.user?.id,
        _isOptimistic: true
      }

      setTodos(prev => [...prev, optimisticTodo])

      // 백그라운드에서 DB 저장
      if (session?.user?.id && supabase) {
        const { data, error } = await supabase
          .from('todos')
          .insert([{
            text,
            completed: false,
            order_index: newOrderIndex,
            date: dateStr,
            visible_dates: [dateStr],
            hidden_dates: [],
            section_type: 'normal',
            user_id: session.user.id
          }])
          .select()

        if (error) throw error

        // 실제 데이터로 교체
        setTodos(prev => prev.map(t => t.id === tempId ? data[0] : t))
      } else {
        // 로그인 안 된 경우 로컬 스토리지에 저장
        const pendingTodos = JSON.parse(localStorage.getItem('pendingQuickTodos') || '[]')
        pendingTodos.push({ text, dateStr, timestamp: Date.now() })
        localStorage.setItem('pendingQuickTodos', JSON.stringify(pendingTodos))
      }
    } catch (error) {
      console.error('Quick add error:', error)
      // 실패 시 로컬 스토리지에 저장
      const pendingTodos = JSON.parse(localStorage.getItem('pendingQuickTodos') || '[]')
      pendingTodos.push({ text, dateStr: formatDateForDB(selectedDate), timestamp: Date.now() })
      localStorage.setItem('pendingQuickTodos', JSON.stringify(pendingTodos))
    }
  }

  // showTodoHistoryModal, showTodoRoutineSetupModal 등은 useTodos에서 관리됨
  const [viewMode, setViewMode] = useState(() => {
    // 로컬스토리지에서 뷰 모드 불러오기
    const saved = localStorage.getItem('viewMode')
    return saved || 'horizontal' // 기본값: horizontal
  })

  // 섹션 제목 관리
  const [sectionTitles, setSectionTitles] = useState({
    normal: '📝 일반 투두',
    routine: '🔄 루틴 투두',
  })

  // 사용자 정의 섹션 관리
  const [customSections, setCustomSections] = useState([])
  const [showAddSectionModal, setShowAddSectionModal] = useState(false)
  const [customSectionAdding, setCustomSectionAdding] = useState(false)
  const [customSectionInputs, setCustomSectionInputs] = useState({})

  // 섹션 순서 관리
  const sectionOrderHook = useSectionOrder(session)
  const {
    sectionOrder, setSectionOrder,
    isReorderMode, setIsReorderMode,
    fetchSectionOrder, saveSectionOrder, moveSectionLeft, moveSectionRight,
    handleSectionDragEnd, handleSectionsContainerDoubleClick,
  } = sectionOrderHook
  const sectionsContainerRef = useRef(null) // 가로 스크롤 컨테이너 ref
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0) // 모바일 섹션 인덱스
  const contentScrollableRef = useRef(null) // 세로 스크롤 컨테이너 ref

  // 숨긴 섹션 관리
  const [hiddenSections, setHiddenSections] = useState([])
  const [showHiddenSectionsModal, setShowHiddenSectionsModal] = useState(false)

  // 숨긴 섹션 저장/로드
  const saveHiddenSections = async (sections) => {
    if (!session?.user?.id) return
    await settingsService.set(SETTING_KEYS.HIDDEN_SECTIONS, sections, session.user.id)
  }

  const fetchHiddenSections = async () => {
    if (!session?.user?.id) return

    const sections = await settingsService.get(SETTING_KEYS.HIDDEN_SECTIONS)
    if (sections) {
      setHiddenSections(sections)
    }
  }

  // 섹션 숨기기/보이기
  const handleHideSection = (sectionId) => {
    const updated = [...hiddenSections, sectionId]
    setHiddenSections(updated)
    saveHiddenSections(updated)
  }

  const handleShowSection = (sectionId) => {
    const updated = hiddenSections.filter(id => id !== sectionId)
    setHiddenSections(updated)
    saveHiddenSections(updated)
  }

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

  // 섹션 제목 불러오기
  const fetchSectionTitles = async () => {
    if (!session?.user?.id) return

    const titles = await settingsService.get(SETTING_KEYS.SECTION_TITLES)
    if (titles) {
      setSectionTitles(prev => ({ ...prev, ...titles }))
    }
  }

  // 섹션 제목 저장하기
  const saveSectionTitle = async (sectionId, newTitle) => {
    if (!session?.user?.id) return

    const updatedTitles = {
      ...sectionTitles,
      [sectionId]: newTitle
    }

    setSectionTitles(updatedTitles)
    await settingsService.set(SETTING_KEYS.SECTION_TITLES, updatedTitles, session.user.id)
  }

  // 사용자 정의 섹션 불러오기
  const fetchCustomSections = async () => {
    if (!session?.user?.id) return

    const sections = await settingsService.get(SETTING_KEYS.CUSTOM_SECTIONS)
    if (sections) {
      setCustomSections(sections)
    }
  }

  // 사용자 정의 섹션 저장하기
  const saveCustomSections = async (sections) => {
    if (!session?.user?.id) return
    await settingsService.set(SETTING_KEYS.CUSTOM_SECTIONS, sections, session.user.id)
  }

  // 섹션 추가
  const handleAddSection = ({ name, icon }) => {
    const newSection = {
      id: `custom-${Date.now()}`,
      name,
      icon
    }
    const updatedSections = [...customSections, newSection]
    setCustomSections(updatedSections)
    saveCustomSections(updatedSections)

    // 섹션 순서에도 추가
    const updatedOrder = [...sectionOrder, newSection.id]
    setSectionOrder(updatedOrder)
    saveSectionOrder(updatedOrder)
  }

  // 사용자 정의 섹션에 투두 추가
  const handleAddCustomSectionTodo = async (sectionId) => {
    const inputValue = customSectionInputs[sectionId] || ''
    if (!inputValue.trim() || customSectionAdding) return
    if (!session) {
      alert('로그인이 필요합니다')
      return
    }

    setCustomSectionAdding(true)

    try {
      // 해당 섹션의 투두들의 최대 order_index 찾기 (section_type 기반)
      const sectionTodos = todos.filter(t => !t.parent_id && t.section_type === 'custom' && t.section_id === sectionId)
      const newOrderIndex = sectionTodos.length > 0 ? Math.max(...sectionTodos.map(t => t.order_index)) + 1 : 1

      const dateStr = formatDateForDB(selectedDate)
      const newTodo = {
        text: inputValue.trim(),
        completed: false,
        order_index: newOrderIndex,
        date: dateStr,
        visible_dates: [dateStr],
        hidden_dates: [],
        user_id: session.user.id,
        section_id: sectionId,
        section_type: 'custom',
      }

      const { data, error } = await supabase
        .from('todos')
        .insert([newTodo])
        .select()

      if (error) throw error

      if (data && data.length > 0) {
        setTodos(prev => [...prev, data[0]])
        setCustomSectionInputs(prev => ({ ...prev, [sectionId]: '' }))
      }
    } catch (error) {
      console.error('투두 추가 오류:', error.message)
    } finally {
      setCustomSectionAdding(false)
    }
  }

  // 섹션 삭제
  const handleDeleteSection = async (sectionId) => {
    if (!confirm('이 섹션을 삭제하시겠습니까? 섹션 내의 모든 투두도 함께 삭제됩니다.')) {
      return
    }

    // 해당 섹션의 모든 투두 삭제
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('section_id', sectionId)

      if (error) {
        console.error('섹션 투두 삭제 오류:', error.message)
        return
      }
    } catch (error) {
      console.error('섹션 투두 삭제 오류:', error.message)
      return
    }

    // customSections에서 제거
    const updatedSections = customSections.filter(s => s.id !== sectionId)
    setCustomSections(updatedSections)
    saveCustomSections(updatedSections)

    // 섹션 순서에서도 제거
    const updatedOrder = sectionOrder.filter(id => id !== sectionId)
    setSectionOrder(updatedOrder)
    saveSectionOrder(updatedOrder)

    // 로컬 상태에서 해당 섹션의 투두 제거
    setTodos(prev => prev.filter(t => t.section_id !== sectionId))
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
        // stop_carryover_from 체크 (옵션 2: 이번 및 향후 할일 삭제)
        if (todo.stop_carryover_from && fromDateStr >= todo.stop_carryover_from) {
          return false // 이월 중단된 투두
        }

        // hidden_dates 체크는 무시 (옵션 1: 이 할일만 삭제 - 오늘 숨기고 내일 다시 표시)
        // hidden_dates에 포함되어도 stop_carryover_from이 없으면 계속 이월

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
    fetchRoutines()
    fetchSectionOrder()
    fetchSectionTitles()
    fetchCustomSections()
    fetchHiddenSections()
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
    const loadTodos = async () => {
      // 오늘 날짜인 경우 미완료 투두 자동 이월
      const dateStr = formatDateForDB(selectedDate)
      const today = new Date()
      const todayStr = formatDateForDB(today)
      const isToday = dateStr === todayStr

      if (isToday && session?.user?.id) {
        await carryOverIncompleteTodos(dateStr)
      }

      // 투두 목록 가져오기
      await fetchTodos()
    }

    loadTodos()

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
              // order_index 전역 정렬 제거 (섹션별로 관리됨)
              return [...currentTodos, payload.new]
            })
          } else if (payload.eventType === 'UPDATE') {
            // 항목 업데이트 (단, 최근에 로컬에서 수정한 항목은 무시)
            setTodos(currentTodos => {
              // 최근에 수정한 항목인지 확인
              if (recentlyEditedIds.current.has(payload.new.id)) {
                return currentTodos
              }
              // order_index 전역 정렬 제거 (섹션별로 관리됨)
              return currentTodos.map(todo =>
                todo.id === payload.new.id ? payload.new : todo
              )
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
        onOpenRoutine={handleOpenRoutine}
        onOpenGanttChart={handleOpenGanttChart}
        onOpenEncouragementModal={() => setShowEncouragementModal(true)}
        onOpenAddSection={() => setShowAddSectionModal(true)}
        onOpenHiddenSections={() => setShowHiddenSectionsModal(true)}
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
          setSelectedDate={setSelectedDate}
          onQuickAdd={handleQuickAdd}
          onOpenMemo={() => setShowMemoModal(true)}
        />

        <div className="content-scrollable" ref={contentScrollableRef}>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
        >
          {/* 섹션 간 드래그 앤 드롭을 위한 전역 SortableContext는 내부에서 allTodoIds로 생성 */}
          <div
            ref={sectionsContainerRef}
            className={`sections-container ${viewMode === 'horizontal' ? 'horizontal-layout' : 'vertical-layout'}`}
          >
            <div className="todo-list">
              {loading ? (
                <p className="empty-message">로딩 중...</p>
              ) : (() => {
                // 섹션별로 필터링 후 order_index로 정렬 (section_type 기반)
                const routineTodos = todos
                  .filter(t => !t.parent_id && t.section_type === 'routine')
                  .sort((a, b) => a.order_index - b.order_index)
                const pendingRoutineTodos = todos
                  .filter(t => !t.parent_id && t.section_type === 'pending_routine')
                  .sort((a, b) => a.order_index - b.order_index)
                const normalTodos = todos
                  .filter(t => !t.parent_id && t.section_type === 'normal')
                  .sort((a, b) => a.order_index - b.order_index)

                // 모든 투두 섹션의 투두 ID를 하나의 배열로 모으기 (섹션 간 드래그 앤 드롭 지원)
                const allTodoIds = [
                  ...routineTodos.map(t => t.id),
                  ...pendingRoutineTodos.map(t => t.id),
                  ...normalTodos.map(t => t.id),
                  ...customSections.flatMap(section =>
                    todos.filter(t => !t.parent_id && t.section_type === 'custom' && t.section_id === section.id).map(t => t.id)
                  )
                ]

                return (
                  <SortableContext
                    items={allTodoIds}
                    strategy={verticalListSortingStrategy}
                  >
                      {sectionOrder
                        .filter(sectionId => !hiddenSections.includes(sectionId)) // 숨긴 섹션 제외
                        .map((sectionId, sectionIndex) => {
                        // 섹션 순서 변경을 위한 정보 계산
                        const filteredSectionOrder = sectionOrder.filter(id => !hiddenSections.includes(id))
                        const filteredIndex = filteredSectionOrder.indexOf(sectionId)
                        const isFirst = filteredIndex === 0
                        const isLast = filteredIndex === filteredSectionOrder.length - 1

                        // 기본 설정 메뉴 아이템 (화살표 + 숨기기)
                        const baseSettingsMenuItems = [
                          ...(!isFirst ? [{
                            icon: '←',
                            label: '왼쪽으로 이동',
                            onClick: () => moveSectionLeft(sectionId)
                          }] : []),
                          ...(!isLast ? [{
                            icon: '→',
                            label: '오른쪽으로 이동',
                            onClick: () => moveSectionRight(sectionId)
                          }] : []),
                          {
                            icon: '📦',
                            label: '숨기기',
                            onClick: () => handleHideSection(sectionId)
                          }
                        ]

                        if (sectionId === 'routine') {
                          return (
                            <div key="routine">
                              <TodoSection
                                title="📌 루틴"
                                className="routine-section section-block"
                                inputValue={routineInputValue}
                                setInputValue={setRoutineInputValue}
                                onAddTodo={handleAddRoutineTodo}
                                isAdding={isAdding}
                                placeholder="루틴 할 일 추가..."
                                settingsMenuItems={baseSettingsMenuItems}
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
                              activeId={activeTodoId}
                              overId={overId}
                              onMoveUp={(id) => handleMoveUp(id, 'routine', null)}
                              onMoveDown={(id) => handleMoveDown(id, 'routine', null)}
                              onMoveToTop={(id) => handleMoveToTop(id, 'routine', null)}
                              onMoveToBottom={(id) => handleMoveToBottom(id, 'routine', null)}
                              isFirst={index === 0}
                              isLast={index === routineTodos.length - 1}
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
                              activeId={activeTodoId}
                              overId={overId}
                              onMoveUp={(id) => handleMoveUp(id, 'pending_routine', null)}
                              onMoveDown={(id) => handleMoveDown(id, 'pending_routine', null)}
                              onMoveToTop={(id) => handleMoveToTop(id, 'pending_routine', null)}
                              onMoveToBottom={(id) => handleMoveToBottom(id, 'pending_routine', null)}
                              isFirst={index === 0}
                              isLast={index === pendingRoutineTodos.length - 1}
                            />
                          )
                        })}
                      </SortableContext>
                    )}
                              </TodoSection>
                            </div>
                          )
                        } else if (sectionId === 'normal') {
                          // normal 섹션은 기본 섹션이므로 삭제 불가
                          const normalSettingsMenuItems = [
                            ...(!isFirst ? [{
                              icon: '←',
                              label: '왼쪽으로 이동',
                              onClick: () => moveSectionLeft(sectionId)
                            }] : []),
                            ...(!isLast ? [{
                              icon: '→',
                              label: '오른쪽으로 이동',
                              onClick: () => moveSectionRight(sectionId)
                            }] : []),
                            {
                              icon: '📦',
                              label: '숨기기',
                              onClick: () => {
                                if (confirm('일반 할 일 섹션을 숨기시겠습니까?\n\n숨긴 섹션 관리에서 다시 표시할 수 있습니다.')) {
                                  handleHideSection('normal')
                                }
                              }
                            },
                            {
                              icon: '🗑️',
                              label: '삭제',
                              onClick: () => {
                                alert('⚠️ 기본 투두 섹션은 삭제할 수 없습니다.\n\n필요하지 않은 경우 "숨기기" 기능을 사용해주세요.')
                              }
                            }
                          ]

                          return (
                            <div key="normal">
                              <TodoSection
                                title={sectionTitles.normal}
                                className="normal-section section-block"
                                inputValue={normalInputValue}
                                setInputValue={setNormalInputValue}
                                onAddTodo={handleAddNormalTodo}
                                isAdding={isAdding}
                                placeholder="일반 할 일 추가..."
                                editable={true}
                                onTitleChange={(newTitle) => saveSectionTitle('normal', newTitle)}
                                settingsMenuItems={normalSettingsMenuItems}
                              >
                    {normalTodos.length > 0 && (
                      <SortableContext
                        items={normalTodos.map(todo => todo.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {normalTodos.map((todo, index) => {
                  const subtodos = todos.filter(t => t.parent_id === todo.id)
                  const currentPageDate = formatDateForDB(selectedDate)

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
                      currentPageDate={currentPageDate}
                      onRemoveFromUI={handleRemoveTodoFromUI}
                      showSuccessMessage={showSuccessMessage}
                      activeId={activeTodoId}
                      overId={overId}
                      onMoveUp={(id) => handleMoveUp(id, 'normal', null)}
                      onMoveDown={(id) => handleMoveDown(id, 'normal', null)}
                      onMoveToTop={(id) => handleMoveToTop(id, 'normal', null)}
                      onMoveToBottom={(id) => handleMoveToBottom(id, 'normal', null)}
                      isFirst={index === 0}
                      isLast={index === normalTodos.length - 1}
                    />
                  )
                              })}
                            </SortableContext>
                          )}
                              </TodoSection>
                            </div>
                          )
                        } else {
                          // 사용자 정의 섹션
                          const customSection = customSections.find(s => s.id === sectionId)
                          if (!customSection) return null

                          const customSectionTodos = todos
                            .filter(t =>
                              !t.parent_id &&
                              t.section_type === 'custom' &&
                              t.section_id === sectionId
                            )
                            .sort((a, b) => a.order_index - b.order_index)

                          // 커스텀 섹션 설정 메뉴 (이동 화살표 + 숨기기 + 삭제)
                          const customSettingsMenuItems = [
                            ...(!isFirst ? [{
                              icon: '←',
                              label: '왼쪽으로 이동',
                              onClick: () => moveSectionLeft(sectionId)
                            }] : []),
                            ...(!isLast ? [{
                              icon: '→',
                              label: '오른쪽으로 이동',
                              onClick: () => moveSectionRight(sectionId)
                            }] : []),
                            {
                              icon: '📦',
                              label: '숨기기',
                              onClick: () => handleHideSection(sectionId)
                            },
                            {
                              icon: '🗑️',
                              label: '삭제',
                              onClick: () => handleDeleteSection(sectionId)
                            }
                          ]

                          return (
                            <div key={sectionId}>
                              <TodoSection
                                title={`${customSection.icon} ${customSection.name}`}
                                className="custom-section section-block"
                                inputValue={customSectionInputs[sectionId] || ''}
                                setInputValue={(value) => setCustomSectionInputs(prev => ({ ...prev, [sectionId]: value }))}
                                onAddTodo={() => handleAddCustomSectionTodo(sectionId)}
                                isAdding={customSectionAdding}
                                placeholder={`${customSection.name} 할 일 추가...`}
                                editable={true}
                                onTitleChange={(newTitle) => {
                                  const updatedSections = customSections.map(s =>
                                    s.id === sectionId ? { ...s, name: newTitle } : s
                                  )
                                  setCustomSections(updatedSections)
                                  saveCustomSections(updatedSections)
                                }}
                                settingsMenuItems={customSettingsMenuItems}
                              >
                                {customSectionTodos.length > 0 && (
                                  <SortableContext
                                    items={customSectionTodos.map(todo => todo.id)}
                                    strategy={verticalListSortingStrategy}
                                  >
                                    {customSectionTodos.map((todo, index) => {
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
                                          activeId={activeTodoId}
                                          overId={overId}
                                          onMoveUp={(id) => handleMoveUp(id, 'custom', sectionId)}
                                          onMoveDown={(id) => handleMoveDown(id, 'custom', sectionId)}
                                          onMoveToTop={(id) => handleMoveToTop(id, 'custom', sectionId)}
                                          onMoveToBottom={(id) => handleMoveToBottom(id, 'custom', sectionId)}
                                          isFirst={index === 0}
                                          isLast={index === customSectionTodos.length - 1}
                                        />
                                      )
                                    })}
                                  </SortableContext>
                                )}
                              </TodoSection>
                            </div>
                          )
                        }
                        return null
                      })}
                  </SortableContext>
                )
              })()}
            </div>
          </div>
          <DragOverlay>
            {activeTodoId ? (() => {
              const activeTodo = todos.find(t => t.id === activeTodoId)
              if (!activeTodo) return null
              const subtodos = todos.filter(t => t.parent_id === activeTodo.id)
              return (
                <div className="drag-overlay-todo">
                  <SortableTodoItem
                    todo={activeTodo}
                    index={0}
                    onToggle={() => {}}
                    onDelete={() => {}}
                    onEdit={() => {}}
                    formatDate={formatDate}
                    formatDateOnly={formatDateOnly}
                    isFocused={false}
                    onFocus={() => {}}
                    onAddSubTodo={() => {}}
                    subtodos={subtodos}
                    level={0}
                    onCreateRoutine={() => {}}
                    routines={routines}
                    onShowRoutineHistory={() => {}}
                    onOpenRoutineSetupModal={() => {}}
                    onOpenHistoryModal={() => {}}
                    currentPageDate={formatDateForDB(selectedDate)}
                    onRemoveFromUI={() => {}}
                    showSuccessMessage={() => {}}
                    hideNumber={true}
                  />
                </div>
              )
            })() : null}
          </DragOverlay>
        </DndContext>

        <SectionPagination
          viewMode={viewMode}
          currentSectionIndex={currentSectionIndex}
          sectionsContainerRef={sectionsContainerRef}
          visibleSectionCount={sectionOrder.filter(id => !hiddenSections.includes(id)).length}
        />
        </div>

        <AppModals
          // Toast
          showUndoToast={showUndoToast}
          showSuccessToast={showSuccessToast}
          successToastMessage={successToastMessage}
          lastDeleteAction={lastDeleteAction}
          handleUndoDelete={handleUndoDelete}
          handleUndoRoutineDelete={handleUndoRoutineDelete}

          // Delete Confirm Modal (Todo)
          showDeleteConfirmModal={showDeleteConfirmModal}
          todoToDelete={todoToDelete}
          setShowDeleteConfirmModal={setShowDeleteConfirmModal}
          deleteThisOnly={deleteThisOnly}
          deleteFromNow={deleteFromNow}
          deleteAll={deleteAll}

          // Delete Confirm Modal (Routine)
          showRoutineDeleteModal={showRoutineDeleteModal}
          routineToDelete={routineToDelete}
          setShowRoutineDeleteModal={setShowRoutineDeleteModal}
          deleteRoutineThisOnly={deleteRoutineThisOnly}
          deleteRoutineFromNow={deleteRoutineFromNow}
          deleteRoutineAll={deleteRoutineAll}

          // Todo History Modal
          showTodoHistoryModal={showTodoHistoryModal}
          selectedTodoForModal={selectedTodoForModal}
          todoHistory={todoHistory}
          expandedHistoryIds={expandedHistoryIds}
          toggleHistoryDetail={toggleHistoryDetail}
          handleCloseTodoHistoryModal={handleCloseTodoHistoryModal}
          formatDate={formatDate}
          formatDateOnly={formatDateOnly}

          // Todo Routine Setup Modal
          showTodoRoutineSetupModal={showTodoRoutineSetupModal}
          routines={routines}
          routineDaysForModal={routineDaysForModal}
          isEditingRoutineInModal={isEditingRoutineInModal}
          routineTimeSlotForModal={routineTimeSlotForModal}
          handleToggleRoutineDayInModal={handleToggleRoutineDayInModal}
          setRoutineTimeSlotForModal={setRoutineTimeSlotForModal}
          setRoutineDaysForModal={setRoutineDaysForModal}
          setIsEditingRoutineInModal={setIsEditingRoutineInModal}
          handleCreateRoutineFromTodo={handleCreateRoutineFromTodo}
          handleCloseTodoRoutineSetupModal={handleCloseTodoRoutineSetupModal}

          // Routine Modal
          showRoutineModal={showRoutineModal}
          handleCloseRoutine={handleCloseRoutine}
          routineInput={routineInput}
          setRoutineInput={setRoutineInput}
          isAddingRoutine={isAddingRoutine}
          selectedDays={selectedDays}
          handleToggleDay={handleToggleDay}
          selectedTimeSlot={selectedTimeSlot}
          setSelectedTimeSlot={setSelectedTimeSlot}
          handleAddRoutine={handleAddRoutine}
          editingRoutineId={editingRoutineId}
          editingRoutineText={editingRoutineText}
          setEditingRoutineText={setEditingRoutineText}
          editingRoutineDays={editingRoutineDays}
          handleToggleEditDay={handleToggleEditDay}
          handleStartEditRoutine={handleStartEditRoutine}
          handleSaveEditRoutine={handleSaveEditRoutine}
          handleCancelEditRoutine={handleCancelEditRoutine}
          handleDeleteRoutine={handleDeleteRoutine}
          fetchRoutineHistory={fetchRoutineHistory}

          // Routine History Modal
          showRoutineHistory={showRoutineHistory}
          handleCloseRoutineHistory={handleCloseRoutineHistory}
          selectedRoutineForHistory={selectedRoutineForHistory}
          routineHistoryData={routineHistoryData}

          // Memo Modal
          showMemoModal={showMemoModal}
          setShowMemoModal={setShowMemoModal}
          memoContent={memoContent}
          setMemoContent={setMemoContent}
          isSavingMemo={isSavingMemo}

          // Gantt Chart Modal
          showGanttChart={showGanttChart}
          handleCloseGanttChart={handleCloseGanttChart}
          ganttData={ganttData}
          ganttPeriod={ganttPeriod}
          setGanttPeriod={setGanttPeriod}

          // Encouragement Modal
          showEncouragementModal={showEncouragementModal}
          setShowEncouragementModal={setShowEncouragementModal}
          encouragementMessages={encouragementMessages}
          newEncouragementMessage={newEncouragementMessage}
          setNewEncouragementMessage={setNewEncouragementMessage}
          addEncouragementMessage={addEncouragementMessage}
          editingEncouragementId={editingEncouragementId}
          editingEncouragementText={editingEncouragementText}
          setEditingEncouragementId={setEditingEncouragementId}
          setEditingEncouragementText={setEditingEncouragementText}
          updateEncouragementMessage={updateEncouragementMessage}
          deleteEncouragementMessage={deleteEncouragementMessage}

          // Add Section Modal
          showAddSectionModal={showAddSectionModal}
          setShowAddSectionModal={setShowAddSectionModal}
          handleAddSection={handleAddSection}

          // Hidden Sections Modal
          showHiddenSectionsModal={showHiddenSectionsModal}
          setShowHiddenSectionsModal={setShowHiddenSectionsModal}
          hiddenSections={hiddenSections}
          sectionOrder={sectionOrder}
          sectionTitles={sectionTitles}
          customSections={customSections}
          handleShowSection={handleShowSection}
        />
      </div>
    </div>
  )
}

export default App
