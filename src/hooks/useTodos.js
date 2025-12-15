import { useState, useRef } from 'react'
import { formatDateForDB } from '../utils/dateUtils'

export const useTodos = (session, supabase, selectedDate, todos, setTodos, routines, setRoutines) => {
  // State
  // todos와 setTodos는 App 컴포넌트에서 전달받음
  const [inputValue, setInputValue] = useState('')
  const [routineInputValue, setRoutineInputValue] = useState('')
  const [normalInputValue, setNormalInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDraggingAny, setIsDraggingAny] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [deletedTodo, setDeletedTodo] = useState(null)
  const [showUndoToast, setShowUndoToast] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [successToastMessage, setSuccessToastMessage] = useState('')
  const [lastDeleteAction, setLastDeleteAction] = useState(null)
  const [showTrashModal, setShowTrashModal] = useState(false)
  const [trashedItems, setTrashedItems] = useState([])
  const [focusedTodoId, setFocusedTodoId] = useState(null)
  const [showTodoHistoryModal, setShowTodoHistoryModal] = useState(false)
  const [showTodoRoutineSetupModal, setShowTodoRoutineSetupModal] = useState(false)
  const [selectedTodoForModal, setSelectedTodoForModal] = useState(null)
  const [todoHistory, setTodoHistory] = useState({})
  const [expandedHistoryIds, setExpandedHistoryIds] = useState([])
  const [routineDaysForModal, setRoutineDaysForModal] = useState([])
  const [isEditingRoutineInModal, setIsEditingRoutineInModal] = useState(false)
  const [routineTimeSlotForModal, setRoutineTimeSlotForModal] = useState('')
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [todoToDelete, setTodoToDelete] = useState(null)

  // Refs
  const carryOverInProgress = useRef(false)
  const routineCreationInProgress = useRef(new Set())
  const recentlyEditedIds = useRef(new Set())

  // 숫자 요일을 키로 변환 (일요일=0, 월요일=1, ...)
  const getDayKey = (dayNumber) => {
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    return keys[dayNumber]
  }

  // 미완료 투두 자동 이월
  const carryOverIncompleteTodos = async (todayStr) => {
    // 이미 이월 작업 중이면 중복 실행 방지
    if (carryOverInProgress.current) {
      return
    }

    try {
      // 이월 작업 시작 플래그 설정
      carryOverInProgress.current = true

      // 모든 미완료 투두 조회 (삭제되지 않은 것만)
      const { data: allTodos, error } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)
        .eq('completed', false)

      if (error) throw error
      if (!allTodos || allTodos.length === 0) return

      // 오늘 이전 날짜의 미완료 투두 중, 오늘 날짜가 visible_dates에 없는 것만 필터링
      const todosToCarryOver = allTodos.filter(todo => {
        // hidden_dates에 오늘 날짜가 있으면 제외 (숨김 처리된 경우)
        const hiddenDates = todo.hidden_dates || []
        if (hiddenDates.includes(todayStr)) {
          return false
        }

        // 새 방식: visible_dates 사용
        if (todo.visible_dates && Array.isArray(todo.visible_dates) && todo.visible_dates.length > 0) {
          // visible_dates에 오늘 날짜가 이미 있으면 제외
          if (todo.visible_dates.includes(todayStr)) {
            return false
          }
          // visible_dates의 모든 날짜가 오늘 이전이면 이월 대상
          const hasOldDate = todo.visible_dates.some(dateStr => dateStr < todayStr)
          return hasOldDate
        }

        // 구 방식: date 필드 사용 (하위 호환)
        if (todo.date && todo.date < todayStr) {
          return true
        }

        return false
      })

      if (todosToCarryOver.length === 0) return

      // 이월 대상 투두의 visible_dates에 오늘 날짜 추가
      for (const todo of todosToCarryOver) {
        let updatedVisibleDates = []

        // visible_dates가 있으면 기존 값에 추가
        if (todo.visible_dates && Array.isArray(todo.visible_dates) && todo.visible_dates.length > 0) {
          updatedVisibleDates = [...todo.visible_dates, todayStr]
        } else {
          // visible_dates가 없으면 date 필드를 포함해서 초기화
          updatedVisibleDates = todo.date ? [todo.date, todayStr] : [todayStr]
        }

        const { error: updateError } = await supabase
          .from('todos')
          .update({ visible_dates: updatedVisibleDates })
          .eq('id', todo.id)

        if (updateError) {
          console.error(`투두 ${todo.id} 이월 오류:`, updateError.message)
        }
      }
    } catch (error) {
      console.error('투두 이월 오류:', error.message)
    } finally {
      // 이월 작업 완료 플래그 해제
      carryOverInProgress.current = false
    }
  }

  // 과거의 모든 미완료 항목을 날짜별로 순차 이월 (복사 방식)
  const movePastIncompleteTodosToToday = async () => {
    // 이미 실행 중이면 중복 실행 방지
    if (carryOverInProgress.current) {
      return
    }

    try {
      // 실행 시작 플래그 설정
      carryOverInProgress.current = true

      const today = new Date()
      const todayStr = formatDateForDB(today)

      // 과거의 가장 오래된 미완료 항목 날짜 찾기
      const { data: oldestTodo, error: oldestError } = await supabase
        .from('todos')
        .select('date')
        .lt('date', todayStr)
        .eq('deleted', false)
        .eq('completed', false)
        .is('routine_id', null)
        .order('date', { ascending: true })
        .limit(1)

      if (oldestError) throw oldestError

      if (!oldestTodo || oldestTodo.length === 0) {
        return // 이월할 항목이 없음
      }

      const oldestDate = new Date(oldestTodo[0].date + 'T00:00:00')

      // 가장 오래된 날짜부터 어제까지, 하루씩 순차적으로 이월
      let currentDate = new Date(oldestDate)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      let totalCarriedOver = 0

      while (currentDate <= yesterday) {
        const fromDateStr = formatDateForDB(currentDate)
        const nextDate = new Date(currentDate)
        nextDate.setDate(nextDate.getDate() + 1)
        const toDateStr = formatDateForDB(nextDate)

        // 현재 날짜의 미완료 항목 가져오기
        const { data: incompleteTodos, error: fetchError } = await supabase
          .from('todos')
          .select('*')
          .eq('date', fromDateStr)
          .eq('deleted', false)
          .eq('completed', false)
          .is('routine_id', null)
          .order('order_index', { ascending: true })

        if (fetchError) throw fetchError

        if (incompleteTodos && incompleteTodos.length > 0) {
          // 다음 날의 기존 항목 가져오기
          const { data: nextDayTodos, error: nextDayError } = await supabase
            .from('todos')
            .select('*')
            .eq('date', toDateStr)
            .eq('deleted', false)
            .order('order_index', { ascending: true })

          if (nextDayError) throw nextDayError

          // 이미 이월된 항목 체크
          const alreadyCarriedOverIds = new Set()
          nextDayTodos?.forEach(t => {
            if (t.original_todo_id !== null) {
              alreadyCarriedOverIds.add(t.original_todo_id)
            }
          })

          // 아직 이월되지 않은 항목만 필터링
          const todosNeedCarryOver = incompleteTodos.filter(todo => {
            const originalId = todo.original_todo_id || todo.id
            return !alreadyCarriedOverIds.has(originalId)
          })

          if (todosNeedCarryOver.length > 0) {
            // 원본 투두들의 created_at 조회
            const originalIds = todosNeedCarryOver
              .map(todo => todo.original_todo_id || todo.id)
              .filter((id, index, self) => self.indexOf(id) === index)

            const { data: originalTodos, error: originalError } = await supabase
              .from('todos')
              .select('id, created_at')
              .in('id', originalIds)

            if (originalError) throw originalError

            const createdAtMap = {}
            originalTodos?.forEach(t => {
              createdAtMap[t.id] = t.created_at
            })

            const nextDayCount = nextDayTodos ? nextDayTodos.length : 0
            const startIndex = nextDayCount + 1

            // 다음 날로 복사
            const todosToInsert = todosNeedCarryOver.map((todo, index) => {
              const originalId = todo.original_todo_id || todo.id
              return {
                text: todo.text,
                completed: false,
                date: toDateStr,
                created_at: createdAtMap[originalId] || todo.created_at,
                order_index: startIndex + index,
                original_todo_id: originalId,
                parent_id: null,
                routine_id: null
              }
            })

            const { error: insertError } = await supabase
              .from('todos')
              .insert(todosToInsert)

            if (insertError) throw insertError

            totalCarriedOver += todosNeedCarryOver.length
          }
        }

        // 다음 날로 이동
        currentDate.setDate(currentDate.getDate() + 1)
      }

      if (totalCarriedOver > 0) {
      }
    } catch (error) {
      console.error('과거 미완료 항목 이월 오류:', error.message)
    } finally {
      // 작업 완료 후 플래그 해제
      carryOverInProgress.current = false
    }
  }

  // 특정 날짜의 루틴 작업 자동 생성
  const createRoutineTodosForDate = async (dateStr) => {
    // 이미 생성 중이면 중복 실행 방지
    if (routineCreationInProgress.current.has(dateStr)) {
      return
    }

    try {
      // 생성 시작 플래그 설정
      routineCreationInProgress.current.add(dateStr)

      const targetDate = new Date(dateStr)
      const dayKey = getDayKey(targetDate.getDay())

      const { data: allRoutines, error: routineError } = await supabase
        .from('routines')
        .select('*')
        .eq('deleted', false)

      if (routineError) throw routineError

      const matchingRoutines = allRoutines.filter(routine => {
        const days = routine.days || []
        // days가 비어있으면 매일 반복 (미정 루틴), 아니면 해당 요일만
        const hasMatchingDay = days.length === 0 || days.includes(dayKey)

        // start_date가 있는 경우, 현재 날짜가 시작일 이후인지 확인
        if (routine.start_date) {
          const startDate = new Date(routine.start_date)
          const isAfterStartDate = targetDate >= startDate
          return hasMatchingDay && isAfterStartDate
        }

        // start_date가 없는 경우 (기존 루틴), 요일만 체크
        return hasMatchingDay
      })

      if (matchingRoutines.length === 0) return

      for (const routine of matchingRoutines) {
        const todoText = routine.text

        // JSON 방식: 해당 루틴의 기존 투두 찾기 (중복 방지를 위해 배열로 받기)
        const { data: existingTodos, error: checkError } = await supabase
          .from('todos')
          .select('*')
          .eq('routine_id', routine.id)
          .eq('deleted', false)

        if (checkError) throw checkError

        // 중복이 있으면 첫 번째 것만 사용하고 나머지는 삭제
        if (existingTodos && existingTodos.length > 1) {
          console.warn(`루틴 ${routine.id}에 중복 투두 발견 (${existingTodos.length}개). 첫 번째만 유지하고 나머지 삭제.`)
          for (let i = 1; i < existingTodos.length; i++) {
            await supabase
              .from('todos')
              .update({ deleted: true, deleted_date: new Date().toISOString() })
              .eq('id', existingTodos[i].id)
          }
        }

        const existingTodo = existingTodos && existingTodos.length > 0 ? existingTodos[0] : null

        if (existingTodo) {
          // 기존 투두가 있으면 visible_dates에 날짜 추가
          const currentDates = existingTodo.visible_dates || []

          // 이미 포함되어 있으면 스킵
          if (currentDates.includes(dateStr)) {
            continue
          }

          // visible_dates에 날짜 추가 (정렬된 상태 유지)
          const updatedDates = [...currentDates, dateStr].sort()

          const { error: updateError } = await supabase
            .from('todos')
            .update({ visible_dates: updatedDates })
            .eq('id', existingTodo.id)

          if (updateError) {
            console.error('루틴 투두 날짜 추가 오류:', updateError.message)
          }
        } else {
          // 첫 루틴 투두 생성
          const { error: insertError } = await supabase
            .from('todos')
            .insert([{
              text: todoText,
              completed: false,
              date: dateStr, // created_date 역할
              visible_dates: [dateStr], // JSON 방식
              hidden_dates: [],
              order_index: 0, // 루틴은 제일 위에
              routine_id: routine.id,
              user_id: session?.user?.id
            }])

          if (insertError) {
            console.error('루틴 투두 생성 오류:', insertError.message)
          }
        }
      }
    } catch (error) {
      console.error('루틴 작업 생성 오류:', error.message)
    } finally {
      // 생성 완료 후 플래그 해제 (1초 후 - 다른 실행도 완료될 시간)
      setTimeout(() => {
        routineCreationInProgress.current.delete(dateStr)
      }, 1000)
    }
  }

  // 투두 목록 가져오기
  const fetchTodos = async () => {
    // 로그인하지 않은 상태에서는 투두를 가져오지 않음
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const dateStr = formatDateForDB(selectedDate)
      const today = new Date()
      const todayStr = formatDateForDB(today)
      const isToday = dateStr === todayStr

      // 오늘 날짜인 경우 미완료 투두 자동 이월
      if (isToday) {
        await carryOverIncompleteTodos(dateStr)
      }

      // 해당 날짜의 요일에 맞는 루틴 투두 자동 생성
      await createRoutineTodosForDate(dateStr)

      // 하이브리드 조회: 새 방식(visible_dates) + 구 방식(date) 모두 지원
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)
        .order('order_index', { ascending: true })

      if (error) throw error

      // 클라이언트 사이드 필터링
      const filteredTodos = (data || []).filter(todo => {
        // hidden_dates 체크 (새 방식, 구 방식 모두 적용)
        const isHidden = todo.hidden_dates && Array.isArray(todo.hidden_dates) && todo.hidden_dates.includes(dateStr)
        if (isHidden) {
          return false // 숨김 처리된 투두는 표시하지 않음
        }

        // 새 방식: visible_dates에 현재 날짜가 포함되어 있는지 확인
        if (todo.visible_dates && Array.isArray(todo.visible_dates) && todo.visible_dates.length > 0) {
          const isVisible = todo.visible_dates.includes(dateStr)
          return isVisible
        }

        // 구 방식 (하위 호환): visible_dates가 없거나 빈 배열이면 date 컬럼 사용
        return todo.date === dateStr
      })

      setTodos(filteredTodos)
    } catch (error) {
      console.error('할 일 가져오기 오류:', error.message)
    } finally {
      setLoading(false)
    }
  }

  // 휴지통 가져오기
  const fetchTrash = async () => {
    try {
      // 모든 삭제된 항목 가져오기 (날짜 구분 없이 통합)
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', true)
        .order('deleted_date', { ascending: false })

      if (error) throw error
      setTrashedItems(data || [])
    } catch (error) {
      console.error('휴지통 가져오기 오류:', error.message)
    }
  }

  // 투두 추가
  const handleAddTodo = async () => {
    if (inputValue.trim() === '' || isAdding) return

    try {
      setIsAdding(true)

      // 새 항목은 맨 아래에 추가
      const newOrderIndex = todos.length > 0 ? Math.max(...todos.map(t => t.order_index)) + 1 : 1

      // 새 항목을 추가 (JSON 방식)
      const dateStr = formatDateForDB(selectedDate)
      const { data, error } = await supabase
        .from('todos')
        .insert([{
          text: inputValue,
          completed: false,
          order_index: newOrderIndex,
          date: dateStr,
          visible_dates: [dateStr], // JSON 방식: 현재 날짜를 배열로 설정
          hidden_dates: [],
          user_id: session?.user?.id
        }])
        .select()

      if (error) throw error

      // 로컬 상태 업데이트
      setTodos([...todos, data[0]])
      setInputValue('')
    } catch (error) {
      console.error('할 일 추가 오류:', error.message)
    } finally {
      setIsAdding(false)
    }
  }

  // 루틴 투두 추가
  const handleAddRoutineTodo = async () => {
    if (routineInputValue.trim() === '' || isAdding) return

    try {
      setIsAdding(true)

      const dateStr = formatDateForDB(selectedDate)

      // 1. 빈 배열로 루틴 생성 (매일 반복)
      const { data: routineData, error: routineError } = await supabase
        .from('routines')
        .insert([{
          text: routineInputValue,
          days: [], // 빈 배열 = 매일 반복
          start_date: dateStr,
          user_id: session?.user?.id
        }])
        .select()

      if (routineError) throw routineError

      const newRoutine = routineData[0]

      // 2. 미정 루틴 투두들의 최대 order_index 찾기
      const pendingRoutineTodos = todos.filter(t => !t.parent_id && t.is_pending_routine)
      const newOrderIndex = pendingRoutineTodos.length > 0 ? Math.max(...pendingRoutineTodos.map(t => t.order_index)) + 1 : 1

      // 3. 투두 생성 (루틴 ID 연결, 미정 표시 유지)
      const { data: todoData, error: todoError } = await supabase
        .from('todos')
        .insert([{
          text: routineInputValue,
          completed: false,
          order_index: newOrderIndex,
          date: dateStr,
          visible_dates: [dateStr],
          hidden_dates: [],
          routine_id: newRoutine.id, // 루틴 ID 연결
          is_pending_routine: true, // 미정 루틴으로 표시 (요일 미설정)
          user_id: session?.user?.id
        }])
        .select()

      if (todoError) throw todoError

      // 4. 로컬 상태 업데이트
      setRoutines([newRoutine, ...routines])
      setTodos([...todos, todoData[0]])
      setRoutineInputValue('')
    } catch (error) {
      console.error('할 일 추가 오류:', error.message)
    } finally {
      setIsAdding(false)
    }
  }

  // 일반 투두 추가
  const handleAddNormalTodo = async () => {
    if (normalInputValue.trim() === '' || isAdding) return

    try {
      setIsAdding(true)

      // 일반 투두들의 최대 order_index 찾기
      const normalTodos = todos.filter(t => !t.parent_id && t.routine_id === null)
      const newOrderIndex = normalTodos.length > 0 ? Math.max(...normalTodos.map(t => t.order_index)) + 1 : 1

      // 새 항목을 추가 (JSON 방식)
      const dateStr = formatDateForDB(selectedDate)
      const { data, error } = await supabase
        .from('todos')
        .insert([{
          text: normalInputValue,
          completed: false,
          order_index: newOrderIndex,
          date: dateStr,
          visible_dates: [dateStr],
          hidden_dates: [],
          user_id: session?.user?.id
        }])
        .select()

      if (error) throw error

      // 로컬 상태 업데이트
      setTodos([...todos, data[0]])
      setNormalInputValue('')
    } catch (error) {
      console.error('할 일 추가 오류:', error.message)
    } finally {
      setIsAdding(false)
    }
  }

  // 투두 완료 토글
  const handleToggleTodo = async (id) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    try {
      const newCompleted = !todo.completed
      const completedAt = newCompleted ? new Date().toISOString() : null

      // JSON 방식: 1개 투두만 업데이트 (간단!)
      const { error } = await supabase
        .from('todos')
        .update({
          completed: newCompleted,
          completed_at: completedAt
        })
        .eq('id', id)

      if (error) throw error

      setTodos(todos.map(t =>
        t.id === id ? { ...t, completed: newCompleted, completed_at: completedAt } : t
      ))
    } catch (error) {
      console.error('할 일 토글 오류:', error.message)
    }
  }

  // UI에서 투두 즉시 제거 (DB 업데이트 후 사용)
  const handleRemoveTodoFromUI = (id) => {
    setTodos(todos.filter(t => t.id !== id))
  }

  // 투두 삭제
  const handleDeleteTodo = async (id) => {
    // 삭제할 todo 찾기
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    // visible_dates 확인 (여러 날짜에 보이는 투두인지 체크)
    const visibleDates = (todo.visible_dates?.length > 0)
      ? todo.visible_dates
      : [todo.date || todo.created_date]

    // 구 방식(복사 기반) 이월 투두인지 확인
    const isOldStyleCarryover = todo.original_todo_id !== null && todo.original_todo_id !== undefined

    // 새 방식: 여러 날짜에 보이는 경우 OR 구 방식: 이월된 투두인 경우 → 모달 표시
    if (visibleDates.length > 1 || isOldStyleCarryover) {
      setTodoToDelete(todo)
      setShowDeleteConfirmModal(true)
    } else {
      // 단일 날짜 투두는 바로 삭제
      await executeSimpleDelete(id)
    }
  }

  // 단순 삭제 (단일 날짜 투두)
  const executeSimpleDelete = async (id) => {
    try {
      const todo = todos.find(t => t.id === id)
      if (!todo) return

      // 삭제된 todo 저장
      setDeletedTodo(todo)

      // Soft delete: deleted=true, deleted_date=오늘
      const dateStr = formatDateForDB(selectedDate)
      const { error } = await supabase
        .from('todos')
        .update({ deleted: true, deleted_date: dateStr })
        .eq('id', id)

      if (error) throw error

      // UI에서 제거
      setTodos(todos.filter(t => t.id !== id))

      // 토스트 표시
      setShowUndoToast(true)

      // 5초 후 토스트 자동 숨김
      setTimeout(() => {
        setShowUndoToast(false)
        setDeletedTodo(null)
      }, 5000)
    } catch (error) {
      console.error('할 일 삭제 오류:', error.message)
    }
  }

  // 이 날짜에서만 숨김
  const hideOnThisDateOnly = async (todo) => {
    try {
      const dateStr = formatDateForDB(selectedDate)
      const currentHiddenDates = todo.hidden_dates || []

      // hidden_dates에 현재 날짜 추가
      const newHiddenDates = [...currentHiddenDates, dateStr]

      const { error } = await supabase
        .from('todos')
        .update({ hidden_dates: newHiddenDates })
        .eq('id', todo.id)

      if (error) throw error

      // UI에서 제거
      setTodos(todos.filter(t => t.id !== todo.id))
      setShowDeleteConfirmModal(false)
      setTodoToDelete(null)
    } catch (error) {
      console.error('숨김 오류:', error.message)
    }
  }

  // 완전 삭제
  const deleteCompletely = async (todo) => {
    try {
      const dateStr = formatDateForDB(selectedDate)

      const { error } = await supabase
        .from('todos')
        .update({ deleted: true, deleted_date: dateStr })
        .eq('id', todo.id)

      if (error) throw error

      // UI에서 제거
      setTodos(todos.filter(t => t.id !== todo.id))
      setShowDeleteConfirmModal(false)
      setTodoToDelete(null)
    } catch (error) {
      console.error('삭제 오류:', error.message)
    }
  }

  // 삭제 실행 취소
  const handleUndoDelete = async () => {
    if (!deletedTodo) return

    try {
      // Soft delete 취소: deleted=false, deleted_date=null
      const { error } = await supabase
        .from('todos')
        .update({ deleted: false, deleted_date: null })
        .eq('id', deletedTodo.id)

      if (error) throw error

      // UI에 다시 추가
      setTodos(currentTodos => {
        const restoredTodo = { ...deletedTodo, deleted: false, deleted_date: null }
        const newTodos = [...currentTodos, restoredTodo]
        return newTodos.sort((a, b) => a.order_index - b.order_index)
      })

      // 토스트 숨김
      setShowUndoToast(false)
      setDeletedTodo(null)
    } catch (error) {
      console.error('삭제 취소 오류:', error.message)
    }
  }

  // 휴지통에서 복원
  const handleRestoreFromTrash = async (id) => {
    const confirmed = window.confirm(
      '이 항목을 복원하시겠습니까?\n\n복원된 항목은 원래 날짜 페이지에서 다시 보입니다.'
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('todos')
        .update({
          deleted: false,
          deleted_date: null,
          hidden_dates: []  // 복원 시 숨김 날짜도 초기화하여 모든 날짜에서 보이게
        })
        .eq('id', id)

      if (error) throw error

      // 휴지통에서 제거
      setTrashedItems(trashedItems.filter(item => item.id !== id))

      // 일반 리스트 새로고침 필요 (fetchTodos 호출 필요)

      // 성공 알림
      alert('✅ 복원되었습니다!')
    } catch (error) {
      console.error('복원 오류:', error.message)
      alert('❌ 복원 실패: ' + error.message)
    }
  }

  // 영구 삭제
  const handlePermanentDelete = async (id) => {
    const confirmed = window.confirm(
      '⚠️ 정말로 이 항목을 영구적으로 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.'
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)

      if (error) throw error

      // 휴지통에서 제거
      setTrashedItems(trashedItems.filter(item => item.id !== id))

      // 성공 알림
      alert('🗑️ 영구적으로 삭제되었습니다.')
    } catch (error) {
      console.error('영구 삭제 오류:', error.message)
      alert('❌ 영구 삭제 실패: ' + error.message)
    }
  }

  // 휴지통 비우기
  const handleEmptyTrash = async () => {
    if (trashedItems.length === 0) return

    const confirmed = window.confirm(
      `⚠️ 정말로 휴지통을 비우시겠습니까?\n\n${trashedItems.length}개의 항목이 영구적으로 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`
    )

    if (!confirmed) return

    try {
      // 모든 휴지통 항목의 ID 수집
      const idsToDelete = trashedItems.map(item => item.id)

      // 한 번에 모두 삭제
      const { error } = await supabase
        .from('todos')
        .delete()
        .in('id', idsToDelete)

      if (error) throw error

      // UI 업데이트
      setTrashedItems([])
      alert(`✅ ${idsToDelete.length}개의 항목이 영구 삭제되었습니다.`)
    } catch (error) {
      console.error('휴지통 비우기 오류:', error.message)
      alert('❌ 휴지통 비우기 실패: ' + error.message)
    }
  }

  // 휴지통 열기
  const handleOpenTrash = () => {
    setShowTrashModal(true)
    fetchTrash()
  }

  // 휴지통 닫기
  const handleCloseTrash = () => {
    setShowTrashModal(false)
  }

  // 투두 수정
  const handleEditTodo = async (id, newText) => {
    try {
      let currentTodo = null

      // 수정 중인 ID로 표시 (Realtime UPDATE 무시하기 위함)
      recentlyEditedIds.current.add(id)

      // 먼저 로컬 상태 업데이트 (즉각적인 UI 반영) - 함수형 업데이트 사용
      const now = new Date().toISOString()
      setTodos(prevTodos => {
        currentTodo = prevTodos.find(t => t.id === id)
        if (!currentTodo || currentTodo.text === newText) {
          recentlyEditedIds.current.delete(id)
          return prevTodos
        }
        return prevTodos.map(todo =>
          todo.id === id ? { ...todo, text: newText, updated_at: now } : todo
        )
      })

      if (!currentTodo || currentTodo.text === newText) return

      // 히스토리에 변경 기록 추가
      const { error: historyError } = await supabase
        .from('todo_history')
        .insert([{
          todo_id: id,
          previous_text: currentTodo.text,
          new_text: newText,
          changed_on_date: currentTodo.date,
          user_id: session?.user?.id
        }])

      if (historyError) {
        console.error('히스토리 저장 오류:', historyError.message)
      }

      // 이월된 투두라면 원본의 히스토리에도 기록
      if (currentTodo.original_todo_id) {
        // 원본 투두 정보 가져오기
        const { data: originalTodo, error: originalError } = await supabase
          .from('todos')
          .select('text, date')
          .eq('id', currentTodo.original_todo_id)
          .single()

        if (!originalError && originalTodo) {
          // 원본 투두의 히스토리에도 변경 기록 추가
          await supabase
            .from('todo_history')
            .insert([{
              todo_id: currentTodo.original_todo_id,
              previous_text: currentTodo.text,
              new_text: newText,
              changed_on_date: currentTodo.date,
              user_id: session?.user?.id
            }])
        }
      }

      // 투두 텍스트 업데이트
      const { error } = await supabase
        .from('todos')
        .update({ text: newText })
        .eq('id', id)

      if (error) {
        console.error('할 일 수정 오류:', error.message)
        // 오류 발생 시 원래 상태로 복구
        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === id ? currentTodo : todo
          )
        )
        recentlyEditedIds.current.delete(id)
      } else {
        // 성공 시 5초 후 수정 완료 표시 제거
        setTimeout(() => {
          recentlyEditedIds.current.delete(id)
        }, 5000)
      }
    } catch (error) {
      console.error('할 일 수정 오류:', error.message)
      recentlyEditedIds.current.delete(id)
    }
  }

  // 서브 투두 추가
  const handleAddSubTodo = async (parentId, subTodoText) => {
    if (!subTodoText || subTodoText.trim() === '') return

    try {
      // 해당 부모의 서브 투두 개수 확인
      const parentSubtodos = todos.filter(t => t.parent_id === parentId)
      const newOrderIndex = parentSubtodos.length + 1

      const dateStr = formatDateForDB(selectedDate)
      const { data, error } = await supabase
        .from('todos')
        .insert([{
          text: subTodoText.trim(),
          completed: false,
          order_index: newOrderIndex,
          date: dateStr,
          parent_id: parentId,
          user_id: session?.user?.id
        }])
        .select()

      if (error) throw error

      // 로컬 상태 업데이트
      setTodos([...todos, data[0]])
    } catch (error) {
      console.error('하위 할 일 추가 오류:', error.message)
    }
  }

  // 드래그 시작
  const handleDragStart = () => {
    setIsDraggingAny(true)
  }

  // 드래그 취소
  const handleDragCancel = () => {
    setIsDraggingAny(false)
  }

  // 드래그 종료
  const handleDragEnd = async (event, arrayMove) => {
    setIsDraggingAny(false)

    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = todos.findIndex((todo) => todo.id === active.id)
    const newIndex = todos.findIndex((todo) => todo.id === over.id)

    // 로컬 상태 즉시 업데이트
    const newTodos = arrayMove(todos, oldIndex, newIndex)
    setTodos(newTodos)

    // Supabase에 새로운 순서 저장
    try {
      const updates = newTodos.map((todo, index) => ({
        id: todo.id,
        order_index: index + 1
      }))

      for (const update of updates) {
        await supabase
          .from('todos')
          .update({ order_index: update.order_index })
          .eq('id', update.id)
      }
    } catch (error) {
      console.error('순서 업데이트 오류:', error.message)
      // 오류 시 다시 가져오기 필요 (fetchTodos 호출 필요)
    }
  }

  // 투두 히스토리 모달 열기
  const handleOpenTodoHistoryModal = async (todo) => {
    setSelectedTodoForModal(todo)

    // 히스토리 데이터 가져오기
    try {
      const { data, error } = await supabase
        .from('todo_history')
        .select('*')
        .eq('todo_id', todo.id)
        .order('changed_at', { ascending: false })

      if (error) throw error

      // todoHistory 객체 업데이트
      setTodoHistory(prev => ({
        ...prev,
        [todo.id]: data || []
      }))
    } catch (error) {
      console.error('Error fetching history:', error)
    }

    setShowTodoHistoryModal(true)
  }

  // 투두 히스토리 모달 닫기
  const handleCloseTodoHistoryModal = () => {
    setShowTodoHistoryModal(false)
    setSelectedTodoForModal(null)
    setExpandedHistoryIds([])
  }

  // 투두 루틴 설정 모달 열기
  const handleOpenTodoRoutineSetupModal = (todo) => {
    setSelectedTodoForModal(todo)

    // 기존 루틴이 있으면 요일과 시간대 설정
    const currentRoutine = routines.find(r => r.id === todo.routine_id)
    if (currentRoutine) {
      setRoutineDaysForModal(currentRoutine.days || [])
      setRoutineTimeSlotForModal(currentRoutine.time_slot || '')
      setIsEditingRoutineInModal(false)
    } else {
      setRoutineDaysForModal([])
      setRoutineTimeSlotForModal('')
      setIsEditingRoutineInModal(true)
    }

    setShowTodoRoutineSetupModal(true)
  }

  // 투두 루틴 설정 모달 닫기
  const handleCloseTodoRoutineSetupModal = () => {
    setShowTodoRoutineSetupModal(false)
    setSelectedTodoForModal(null)
    // 루틴 편집 상태 초기화
    setRoutineDaysForModal([])
    setRoutineTimeSlotForModal('')
    setIsEditingRoutineInModal(false)
  }

  // 히스토리 세부 내용 토글
  const toggleHistoryDetail = (historyId) => {
    setExpandedHistoryIds(prev =>
      prev.includes(historyId)
        ? prev.filter(id => id !== historyId)
        : [...prev, historyId]
    )
  }

  return {
    // State
    // todos와 setTodos는 App에서 관리하므로 반환하지 않음
    inputValue,
    setInputValue,
    routineInputValue,
    setRoutineInputValue,
    normalInputValue,
    setNormalInputValue,
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
    focusedTodoId,
    setFocusedTodoId,
    showTodoHistoryModal,
    showTodoRoutineSetupModal,
    selectedTodoForModal,
    todoHistory,
    expandedHistoryIds,
    routineDaysForModal,
    setRoutineDaysForModal,
    isEditingRoutineInModal,
    setIsEditingRoutineInModal,
    routineTimeSlotForModal,
    setRoutineTimeSlotForModal,
    showDeleteConfirmModal,
    setShowDeleteConfirmModal,
    todoToDelete,
    setTodoToDelete,

    // Refs
    carryOverInProgress,

    // Functions
    fetchTodos,
    handleAddTodo,
    handleAddRoutineTodo,
    handleAddNormalTodo,
    handleToggleTodo,
    handleDeleteTodo,
    executeSimpleDelete,
    hideOnThisDateOnly,
    deleteCompletely,
    handleUndoDelete,
    handleRestoreFromTrash,
    handlePermanentDelete,
    handleEditTodo,
    handleAddSubTodo,
    handleDragEnd,
    carryOverIncompleteTodos,
    movePastIncompleteTodosToToday,
    fetchTrash,
    handleEmptyTrash,
    handleRemoveTodoFromUI,
    handleOpenTrash,
    handleCloseTrash,
    handleDragStart,
    handleDragCancel,
    handleOpenTodoHistoryModal,
    handleCloseTodoHistoryModal,
    handleOpenTodoRoutineSetupModal,
    handleCloseTodoRoutineSetupModal,
    toggleHistoryDetail,
  }
}
