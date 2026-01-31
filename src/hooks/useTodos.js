import { useState, useRef } from 'react'
import { formatDateForDB } from '../utils/dateUtils'
import { useDeleteLogic } from './useDeleteLogic'
import { useTodoOrder } from './useTodoOrder'
import { useTodoDragDrop } from './useTodoDragDrop'

export const useTodos = (session, supabase, selectedDate, todos, setTodos, routines, setRoutines, selectedTodoForModal, setSelectedTodoForModal) => {
  // 추출된 훅 사용
  const todoOrder = useTodoOrder(todos, setTodos, supabase)

  // 타임라인 드롭 핸들러
  const handleTimelineDrop = async (todoId, hour) => {
    const dateStr = formatDateForDB(selectedDate)

    // 해당 시간대에 이미 있는 투두들의 분 값 확인 (같은 날짜의 투두만)
    const existingTodos = todos.filter(t => {
      if (!t.scheduled_time) return false
      if (t.scheduled_date !== dateStr) return false
      const h = parseInt(t.scheduled_time.split(':')[0], 10)
      return h === hour
    })

    // 다음 분 값 계산 (기존 투두들의 최대 분 + 1)
    let nextMinute = 0
    if (existingTodos.length > 0) {
      const maxMinute = Math.max(...existingTodos.map(t =>
        parseInt(t.scheduled_time.split(':')[1], 10)
      ))
      nextMinute = maxMinute + 1
    }

    const scheduledTime = `${hour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`

    // 현재 투두 찾기 (히스토리 업데이트용)
    const currentTodo = todos.find(t => t.id === todoId)
    const currentHistory = currentTodo?.timeline_history || []

    // 타임라인 히스토리에 새 기록 추가
    const newHistoryEntry = {
      scheduled_date: dateStr,
      scheduled_time: scheduledTime,
      assigned_at: new Date().toISOString()
    }
    const updatedHistory = [...currentHistory, newHistoryEntry]

    // 로컬 상태 업데이트 (scheduled_date, timeline_history도 함께 저장)
    setTodos(prev => prev.map(todo =>
      todo.id === todoId
        ? { ...todo, scheduled_time: scheduledTime, scheduled_date: dateStr, timeline_history: updatedHistory }
        : todo
    ))

    // DB 업데이트 (scheduled_date, timeline_history도 함께 저장)
    try {
      await supabase
        .from('todos')
        .update({
          scheduled_time: scheduledTime,
          scheduled_date: dateStr,
          timeline_history: updatedHistory
        })
        .eq('id', todoId)
    } catch (error) {
      console.error('타임라인 배치 오류:', error.message)
    }
  }

  // 타임라인에서 제거 핸들러
  const handleRemoveFromTimeline = async (todoId) => {
    // 로컬 상태 업데이트 (scheduled_date도 함께 제거)
    setTodos(prev => prev.map(todo =>
      todo.id === todoId
        ? { ...todo, scheduled_time: null, scheduled_date: null }
        : todo
    ))

    // DB 업데이트 (scheduled_date도 함께 제거)
    try {
      await supabase
        .from('todos')
        .update({ scheduled_time: null, scheduled_date: null })
        .eq('id', todoId)
    } catch (error) {
      console.error('타임라인 제거 오류:', error.message)
    }
  }

  // 타임라인 내에서 위로 이동 (첫 번째면 윗 시간대로)
  const handleMoveUpInTimeline = async (todoId, startHour = 6) => {
    const todo = todos.find(t => t.id === todoId)
    if (!todo?.scheduled_time) return

    const hour = parseInt(todo.scheduled_time.split(':')[0], 10)
    const minute = parseInt(todo.scheduled_time.split(':')[1], 10)

    // 같은 시간대의 투두들
    const sameHourTodos = todos
      .filter(t => t.scheduled_time && parseInt(t.scheduled_time.split(':')[0], 10) === hour)
      .sort((a, b) => {
        const minA = parseInt(a.scheduled_time.split(':')[1], 10)
        const minB = parseInt(b.scheduled_time.split(':')[1], 10)
        return minA - minB
      })

    const currentIndex = sameHourTodos.findIndex(t => t.id === todoId)

    // 같은 시간대에서 첫 번째가 아니면 같은 시간대 내에서 교환
    if (currentIndex > 0) {
      const prevTodo = sameHourTodos[currentIndex - 1]
      const prevMinute = parseInt(prevTodo.scheduled_time.split(':')[1], 10)

      const newTime = `${hour.toString().padStart(2, '0')}:${prevMinute.toString().padStart(2, '0')}`
      const prevNewTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`

      setTodos(prev => prev.map(t => {
        if (t.id === todoId) return { ...t, scheduled_time: newTime }
        if (t.id === prevTodo.id) return { ...t, scheduled_time: prevNewTime }
        return t
      }))

      try {
        await supabase.from('todos').update({ scheduled_time: newTime }).eq('id', todoId)
        await supabase.from('todos').update({ scheduled_time: prevNewTime }).eq('id', prevTodo.id)
      } catch (error) {
        console.error('타임라인 순서 변경 오류:', error.message)
      }
    } else {
      // 첫 번째면 윗 시간대로 이동
      if (hour <= startHour) return // 최상위 시간대면 이동 불가

      const prevHour = hour - 1
      // 윗 시간대의 투두들
      const prevHourTodos = todos
        .filter(t => t.scheduled_time && parseInt(t.scheduled_time.split(':')[0], 10) === prevHour)

      // 윗 시간대의 마지막 분 값 + 1
      let newMinute = 0
      if (prevHourTodos.length > 0) {
        const maxMinute = Math.max(...prevHourTodos.map(t =>
          parseInt(t.scheduled_time.split(':')[1], 10)
        ))
        newMinute = maxMinute + 1
      }

      const newTime = `${prevHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`

      setTodos(prev => prev.map(t =>
        t.id === todoId ? { ...t, scheduled_time: newTime } : t
      ))

      try {
        await supabase.from('todos').update({ scheduled_time: newTime }).eq('id', todoId)
      } catch (error) {
        console.error('타임라인 시간대 이동 오류:', error.message)
      }
    }
  }

  // 타임라인 내에서 아래로 이동 (마지막이면 아래 시간대로)
  const handleMoveDownInTimeline = async (todoId, endHour = 24) => {
    const todo = todos.find(t => t.id === todoId)
    if (!todo?.scheduled_time) return

    const hour = parseInt(todo.scheduled_time.split(':')[0], 10)
    const minute = parseInt(todo.scheduled_time.split(':')[1], 10)

    // 같은 시간대의 투두들
    const sameHourTodos = todos
      .filter(t => t.scheduled_time && parseInt(t.scheduled_time.split(':')[0], 10) === hour)
      .sort((a, b) => {
        const minA = parseInt(a.scheduled_time.split(':')[1], 10)
        const minB = parseInt(b.scheduled_time.split(':')[1], 10)
        return minA - minB
      })

    const currentIndex = sameHourTodos.findIndex(t => t.id === todoId)

    // 같은 시간대에서 마지막이 아니면 같은 시간대 내에서 교환
    if (currentIndex < sameHourTodos.length - 1) {
      const nextTodo = sameHourTodos[currentIndex + 1]
      const nextMinute = parseInt(nextTodo.scheduled_time.split(':')[1], 10)

      const newTime = `${hour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`
      const nextNewTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`

      setTodos(prev => prev.map(t => {
        if (t.id === todoId) return { ...t, scheduled_time: newTime }
        if (t.id === nextTodo.id) return { ...t, scheduled_time: nextNewTime }
        return t
      }))

      try {
        await supabase.from('todos').update({ scheduled_time: newTime }).eq('id', todoId)
        await supabase.from('todos').update({ scheduled_time: nextNewTime }).eq('id', nextTodo.id)
      } catch (error) {
        console.error('타임라인 순서 변경 오류:', error.message)
      }
    } else {
      // 마지막이면 아래 시간대로 이동
      if (hour >= endHour) return // 최하위 시간대면 이동 불가

      const nextHour = hour + 1
      // 아래 시간대의 투두들
      const nextHourTodos = todos
        .filter(t => t.scheduled_time && parseInt(t.scheduled_time.split(':')[0], 10) === nextHour)

      // 아래 시간대의 첫 번째 위치 (분 0 또는 기존 최소 분 - 1)
      let newMinute = 0
      if (nextHourTodos.length > 0) {
        const minMinute = Math.min(...nextHourTodos.map(t =>
          parseInt(t.scheduled_time.split(':')[1], 10)
        ))
        // 기존 투두들보다 앞에 배치 (분 값을 더 작게)
        newMinute = minMinute > 0 ? minMinute - 1 : 0
        // 만약 0이면 기존 투두들의 분 값을 모두 +1
        if (newMinute === 0 && minMinute === 0) {
          // 기존 투두들의 분 값을 +1 해서 공간 만들기
          const updatedTodos = nextHourTodos.map(t => ({
            ...t,
            scheduled_time: `${nextHour.toString().padStart(2, '0')}:${(parseInt(t.scheduled_time.split(':')[1], 10) + 1).toString().padStart(2, '0')}`
          }))

          setTodos(prev => prev.map(t => {
            if (t.id === todoId) return { ...t, scheduled_time: `${nextHour.toString().padStart(2, '0')}:00` }
            const updated = updatedTodos.find(u => u.id === t.id)
            return updated || t
          }))

          try {
            await supabase.from('todos').update({ scheduled_time: `${nextHour.toString().padStart(2, '0')}:00` }).eq('id', todoId)
            for (const t of updatedTodos) {
              await supabase.from('todos').update({ scheduled_time: t.scheduled_time }).eq('id', t.id)
            }
          } catch (error) {
            console.error('타임라인 시간대 이동 오류:', error.message)
          }
          return
        }
      }

      const newTime = `${nextHour.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`

      setTodos(prev => prev.map(t =>
        t.id === todoId ? { ...t, scheduled_time: newTime } : t
      ))

      try {
        await supabase.from('todos').update({ scheduled_time: newTime }).eq('id', todoId)
      } catch (error) {
        console.error('타임라인 시간대 이동 오류:', error.message)
      }
    }
  }

  const todoDragDrop = useTodoDragDrop(todos, setTodos, supabase, handleTimelineDrop)

  // State
  // todos와 setTodos는 App 컴포넌트에서 전달받음
  const [inputValue, setInputValue] = useState('')
  const [routineInputValue, setRoutineInputValue] = useState('')
  const [normalInputValue, setNormalInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [isAdding, setIsAdding] = useState(false)
  const [deletedTodo, setDeletedTodo] = useState(null)
  const [showUndoToast, setShowUndoToast] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [successToastMessage, setSuccessToastMessage] = useState('')
  const [lastDeleteAction, setLastDeleteAction] = useState(null)
  const [focusedTodoId, setFocusedTodoId] = useState(null)
  // selectedTodoForModal은 App.jsx에서 전달받음
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [todoToDelete, setTodoToDelete] = useState(null)

  // Refs
  const routineCreationInProgress = useRef(new Set())
  const recentlyEditedIds = useRef(new Set())

  // 공통 삭제 로직 hook 사용
  const { deleteThisOnly, deleteFromNow, deleteAll } = useDeleteLogic({
    type: 'todo',
    supabase,
    selectedDate,
    onDeleteSuccess: (id, deleteType) => {
      // 삭제된 투두 찾기
      const deletedItem = todos.find(t => t.id === id)
      if (deletedItem) {
        // Undo를 위해 저장
        setDeletedTodo(deletedItem)
        setLastDeleteAction({ id, deleteType, item: deletedItem })

        // Undo 토스트 표시
        setShowUndoToast(true)

        // 5초 후 자동 숨김
        setTimeout(() => {
          setShowUndoToast(false)
          setDeletedTodo(null)
          setLastDeleteAction(null)
        }, 5000)
      }

      // UI에서 제거
      setTodos(prevTodos => prevTodos.filter(t => t.id !== id))
      setShowDeleteConfirmModal(false)
      setTodoToDelete(null)
    }
  })

  // 숫자 요일을 키로 변환 (일요일=0, 월요일=1, ...)
  const getDayKey = (dayNumber) => {
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    return keys[dayNumber]
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
          // hidden_dates 체크: 오늘 날짜가 숨김 처리되어 있으면 스킵
          const hiddenDates = existingTodo.hidden_dates || []
          if (hiddenDates.includes(dateStr)) {
            continue // 숨김 처리된 날짜는 visible_dates에 추가하지 않음
          }

          // stop_carryover_from 체크: 이번 및 향후 삭제된 경우 스킵
          if (existingTodo.stop_carryover_from && dateStr >= existingTodo.stop_carryover_from) {
            continue // 이월 중단된 날짜는 추가하지 않음
          }

          // days가 있으면 확정 루틴, 없으면 미정 루틴
          const isPendingRoutine = !routine.days || routine.days.length === 0

          // 기존 투두가 있으면 visible_dates에 날짜 추가
          const currentDates = existingTodo.visible_dates || []

          // If already included, just check/update is_pending_routine and section_type
          const expectedSectionType = isPendingRoutine ? 'pending_routine' : 'routine'
          if (currentDates.includes(dateStr)) {
            // is_pending_routine 또는 section_type이 맞지 않으면 업데이트
            const needsUpdate = existingTodo.is_pending_routine !== isPendingRoutine ||
                existingTodo.section_type !== expectedSectionType
            if (needsUpdate) {
              const { error } = await supabase
                .from('todos')
                .update({
                  is_pending_routine: isPendingRoutine,
                  section_type: expectedSectionType
                })
                .eq('id', existingTodo.id)
              if (error) console.error('업데이트 오류:', error)
            }
            continue
          }

          // visible_dates에 날짜 추가 (정렬된 상태 유지)
          const updatedDates = [...currentDates, dateStr].sort()

          const { error: updateError } = await supabase
            .from('todos')
            .update({
              visible_dates: updatedDates,
              is_pending_routine: isPendingRoutine,
              section_type: isPendingRoutine ? 'pending_routine' : 'routine'
            })
            .eq('id', existingTodo.id)

          if (updateError) {
            console.error('루틴 투두 날짜 추가 오류:', updateError.message)
          }
        } else {
          // 첫 루틴 투두 생성
          // days가 있으면 확정 루틴, 없으면 미정 루틴
          const isPendingRoutine = !routine.days || routine.days.length === 0
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
              is_pending_routine: isPendingRoutine,
              section_type: isPendingRoutine ? 'pending_routine' : 'routine',
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

      // 루틴 투두 자동 생성 - 제거됨 (이제 repeat_type으로 관리)
      // await createRoutineTodosForDate(dateStr)

      // 하이브리드 조회: 새 방식(visible_dates) + 구 방식(date) 모두 지원
      // order_index 전역 정렬 제거 (섹션별로 정렬됨)
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)

      if (error) throw error

      // 루틴 정보 미리 가져오기 (요일 필터링에 필요)
      const routineTodosList = (data || []).filter(t => t.routine_id)
      const routineIds = [...new Set(routineTodosList.map(t => t.routine_id))]
      let routinesMap = {}
      if (routineIds.length > 0) {
        const { data: routinesData } = await supabase
          .from('routines')
          .select('*')
          .in('id', routineIds)
        routinesMap = (routinesData || []).reduce((acc, r) => {
          acc[r.id] = r
          return acc
        }, {})
      }

      // 해당 날짜의 요일 키
      const targetDate = new Date(dateStr)
      const dayKey = getDayKey(targetDate.getDay())

      // 클라이언트 사이드 필터링
      const filteredTodos = (data || []).filter(todo => {
        // stop_carryover_from 체크 (이번 및 향후 삭제)
        if (todo.stop_carryover_from && dateStr >= todo.stop_carryover_from) {
          return false
        }

        // hidden_dates 체크 (새 방식, 구 방식 모두 적용)
        const isHidden = todo.hidden_dates && Array.isArray(todo.hidden_dates) && todo.hidden_dates.includes(dateStr)
        if (isHidden) {
          return false // 숨김 처리된 투두는 표시하지 않음
        }

        // === 새 시스템: repeat_days 배열 기반 반복 투두 ===
        if (todo.repeat_days && todo.repeat_days.length > 0) {
          // repeat_start_date 이전이면 표시 안함
          if (todo.repeat_start_date && dateStr < todo.repeat_start_date) {
            return false
          }
          // repeat_end_date 이후면 표시 안함
          if (todo.repeat_end_date && dateStr > todo.repeat_end_date) {
            return false
          }

          // 생성일(repeat_start_date)에는 항상 표시
          if (todo.repeat_start_date && dateStr === todo.repeat_start_date) {
            return true
          }

          // 그 외에는 repeat_days 배열에 해당 요일이 있는지 확인
          return todo.repeat_days.includes(dayKey)
        }

        // === 기존 시스템: routine_id 기반 (하위 호환) ===
        if (todo.routine_id) {
          const routine = routinesMap[todo.routine_id]
          if (routine) {
            const days = routine.days || []
            // days가 비어있으면 매일 반복 (미정 루틴), 아니면 해당 요일만
            if (days.length > 0 && !days.includes(dayKey)) {
              return false // 해당 요일이 아니면 표시하지 않음
            }
          }
          // routine_id가 있으면 visible_dates나 date와 무관하게 해당 요일에 표시
          return true
        }

        // 새 방식: visible_dates 체크
        if (todo.visible_dates && Array.isArray(todo.visible_dates)) {
          // visible_dates가 있으면 (빈 배열이어도) visible_dates 기준으로만 판단
          return todo.visible_dates.includes(dateStr)
        }

        // 구 방식 (하위 호환): visible_dates가 아예 없으면 date 컬럼 사용
        return todo.date === dateStr
      })

      // 루틴 투두의 section_type 동기화
      const routineTodosToSync = filteredTodos.filter(t => t.routine_id)
      if (routineTodosToSync.length > 0) {
        const routineIds = [...new Set(routineTodosToSync.map(t => t.routine_id))]
        const { data: routinesData } = await supabase
          .from('routines')
          .select('*')
          .in('id', routineIds)

        // section_type이 잘못된 투두 수정
        for (const todo of routineTodosToSync) {
          const routine = routinesData?.find(r => r.id === todo.routine_id)
          if (!routine) continue

          const isPendingRoutine = !routine.days || routine.days.length === 0
          const expectedSectionType = isPendingRoutine ? 'pending_routine' : 'routine'

          if (todo.section_type !== expectedSectionType || todo.is_pending_routine !== isPendingRoutine) {
            await supabase
              .from('todos')
              .update({
                section_type: expectedSectionType,
                is_pending_routine: isPendingRoutine
              })
              .eq('id', todo.id)

            // 로컬 상태도 업데이트
            todo.section_type = expectedSectionType
            todo.is_pending_routine = isPendingRoutine
          }
        }
      }

      setTodos(filteredTodos)
    } catch (error) {
      console.error('할 일 가져오기 오류:', error.message)
    } finally {
      setLoading(false)
    }
  }

  // 투두 추가
  const handleAddTodo = async () => {
    if (inputValue.trim() === '' || isAdding) return

    try {
      setIsAdding(true)

      // 일반 섹션(normal)의 투두들만 필터링하여 최대 order_index 계산
      const normalTodos = todos.filter(t => !t.parent_id && t.section_type === 'normal')
      const newOrderIndex = normalTodos.length > 0 ? Math.max(...normalTodos.map(t => t.order_index)) + 1 : 1

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
          section_type: 'normal', // 일반 투두
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
      const pendingRoutineTodos = todos.filter(t => !t.parent_id && t.section_type === 'pending_routine')
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
          section_type: 'pending_routine', // 미정 루틴 섹션
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

  // 타임라인에서 투두 추가 (더블클릭)
  const handleAddTodoFromTimeline = async (hour, inputText) => {
    if (!inputText || inputText.trim() === '') return

    try {
      // 일반 투두들의 최대 order_index 찾기
      const normalTodos = todos.filter(t => !t.parent_id && t.section_type === 'normal')
      const newOrderIndex = normalTodos.length > 0 ? Math.max(...normalTodos.map(t => t.order_index)) + 1 : 1

      const dateStr = formatDateForDB(selectedDate)

      // 해당 시간대에 이미 있는 투두들의 분 값 확인
      const existingTodos = todos.filter(t => {
        if (!t.scheduled_time) return false
        if (t.scheduled_date !== dateStr) return false
        const h = parseInt(t.scheduled_time.split(':')[0], 10)
        return h === hour
      })

      // 다음 분 값 계산
      let nextMinute = 0
      if (existingTodos.length > 0) {
        const maxMinute = Math.max(...existingTodos.map(t =>
          parseInt(t.scheduled_time.split(':')[1], 10)
        ))
        nextMinute = maxMinute + 1
      }

      const scheduledTime = `${hour.toString().padStart(2, '0')}:${nextMinute.toString().padStart(2, '0')}`

      // 타임라인 히스토리
      const newHistoryEntry = {
        scheduled_date: dateStr,
        scheduled_time: scheduledTime,
        assigned_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('todos')
        .insert([{
          text: inputText.trim(),
          completed: false,
          order_index: newOrderIndex,
          date: dateStr,
          visible_dates: [dateStr],
          hidden_dates: [],
          section_type: 'normal',
          scheduled_time: scheduledTime,
          scheduled_date: dateStr,
          timeline_history: [newHistoryEntry],
          user_id: session?.user?.id
        }])
        .select()

      if (error) throw error

      setTodos([...todos, data[0]])
      return data[0]
    } catch (error) {
      console.error('타임라인에서 투두 추가 오류:', error.message)
      return null
    }
  }

  // 일반 투두 추가
  const handleAddNormalTodo = async () => {
    if (normalInputValue.trim() === '' || isAdding) return

    try {
      setIsAdding(true)

      // 일반 투두들의 최대 order_index 찾기
      const normalTodos = todos.filter(t => !t.parent_id && t.section_type === 'normal')
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
          section_type: 'normal', // 일반 투두
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
  const handleToggleTodo = async (id, dateStr = null) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    // 현재 날짜 (반복 투두용)
    const currentDateStr = dateStr || formatDateForDB(selectedDate)

    try {
      // 반복 투두인 경우 (repeat_days가 있는 경우)
      const isRepeatTodo = todo.repeat_days && todo.repeat_days.length > 0

      if (isRepeatTodo) {
        // 반복 투두: completed_dates 배열로 날짜별 완료 관리
        const completedDates = todo.completed_dates || []
        const isCurrentlyCompleted = completedDates.includes(currentDateStr)

        let newCompletedDates
        if (isCurrentlyCompleted) {
          // 완료 해제: 배열에서 제거
          newCompletedDates = completedDates.filter(d => d !== currentDateStr)
        } else {
          // 완료: 배열에 추가
          newCompletedDates = [...completedDates, currentDateStr].sort()
        }

        const { error } = await supabase
          .from('todos')
          .update({
            completed_dates: newCompletedDates,
          })
          .eq('id', id)

        if (error) throw error

        setTodos(todos.map(t =>
          t.id === id ? { ...t, completed_dates: newCompletedDates } : t
        ))
      } else {
        // 일반 투두: 기존 completed 불리언 사용
        const newCompleted = !todo.completed
        const completedAt = newCompleted ? new Date().toISOString() : null

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
      }
    } catch (error) {
      console.error('할 일 토글 오류:', error.message)
    }
  }

  // UI에서 투두 즉시 제거 (DB 업데이트 후 사용)
  const handleRemoveTodoFromUI = (id) => {
    setTodos(todos.filter(t => t.id !== id))
  }

  // 투두 삭제 (옵션 포함)
  const handleDeleteTodo = async (id, deleteOption) => {
    // 삭제할 todo 찾기
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    // deleteOption이 전달된 경우 직접 삭제 실행
    if (deleteOption) {
      if (deleteOption === 'this-only') {
        await deleteThisOnly(todo)
      } else if (deleteOption === 'from-now') {
        await deleteFromNow(todo)
      } else if (deleteOption === 'all') {
        await deleteAll(todo)
      }
    } else {
      // deleteOption이 없으면 모달 표시 (기존 동작)
      setTodoToDelete(todo)
      setShowDeleteConfirmModal(true)
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

  // 삭제 함수들은 useDeleteLogic hook에서 제공
  // (deleteThisOnly, deleteFromNow, deleteAll)

  // 삭제 실행 취소
  const handleUndoDelete = async () => {
    if (!deletedTodo || !lastDeleteAction) return

    try {
      const { deleteType } = lastDeleteAction
      const dateStr = formatDateForDB(selectedDate)

      if (deleteType === 'this-only') {
        // 옵션 1: hidden_dates에서 오늘 날짜 제거
        const newHiddenDates = (deletedTodo.hidden_dates || []).filter(d => d !== dateStr)
        const { error } = await supabase
          .from('todos')
          .update({ hidden_dates: newHiddenDates })
          .eq('id', deletedTodo.id)

        if (error) throw error
      } else if (deleteType === 'from-now') {
        // 옵션 2: visible_dates 복원, stop_carryover_from 제거
        const { error } = await supabase
          .from('todos')
          .update({
            visible_dates: deletedTodo.visible_dates,
            stop_carryover_from: null
          })
          .eq('id', deletedTodo.id)

        if (error) throw error
      } else if (deleteType === 'all') {
        // 옵션 3: deleted 플래그 제거
        const { error } = await supabase
          .from('todos')
          .update({ deleted: false, deleted_date: null })
          .eq('id', deletedTodo.id)

        if (error) throw error
      }

      // UI에 다시 추가
      setTodos(currentTodos => {
        const restoredTodo = { ...deletedTodo }
        const newTodos = [...currentTodos, restoredTodo]
        return newTodos.sort((a, b) => a.order_index - b.order_index)
      })

      // 토스트 숨김
      setShowUndoToast(false)
      setDeletedTodo(null)
      setLastDeleteAction(null)
    } catch (error) {
      console.error('삭제 취소 오류:', error.message)
    }
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
    isAdding,
    deletedTodo,
    showUndoToast,
    showSuccessToast,
    successToastMessage,
    lastDeleteAction,
    focusedTodoId,
    setFocusedTodoId,
    selectedTodoForModal,
    showDeleteConfirmModal,
    setShowDeleteConfirmModal,
    todoToDelete,
    setTodoToDelete,

    // 드래그 앤 드롭 상태 (useTodoDragDrop에서)
    isDraggingAny: todoDragDrop.isDraggingAny,
    activeTodoId: todoDragDrop.activeTodoId,
    overId: todoDragDrop.overId,

    // Functions
    fetchTodos,
    handleAddTodo,
    handleAddRoutineTodo,
    handleAddNormalTodo,
    handleToggleTodo,
    handleDeleteTodo,
    deleteThisOnly,
    deleteFromNow,
    deleteAll,
    handleUndoDelete,
    handleEditTodo,
    handleAddSubTodo,
    handleRemoveTodoFromUI,

    // 드래그 앤 드롭 함수 (useTodoDragDrop에서)
    handleDragStart: todoDragDrop.handleDragStart,
    handleDragOver: todoDragDrop.handleDragOver,
    handleDragCancel: todoDragDrop.handleDragCancel,
    handleDragEnd: todoDragDrop.handleDragEnd,

    // 순서 이동 함수 (useTodoOrder에서)
    handleMoveUp: todoOrder.handleMoveUp,
    handleMoveDown: todoOrder.handleMoveDown,
    handleMoveToTop: todoOrder.handleMoveToTop,
    handleMoveToBottom: todoOrder.handleMoveToBottom,

    // 타임라인 함수
    handleRemoveFromTimeline,
    handleMoveUpInTimeline,
    handleMoveDownInTimeline,
    handleAddTodoFromTimeline,
  }
}
