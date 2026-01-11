import { useState, useRef } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { formatDateForDB } from '../utils/dateUtils'
import { useDeleteLogic } from './useDeleteLogic'

export const useTodos = (session, supabase, selectedDate, todos, setTodos, routines, setRoutines, selectedTodoForModal, setSelectedTodoForModal) => {
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
  const [focusedTodoId, setFocusedTodoId] = useState(null)
  // selectedTodoForModal은 App.jsx에서 전달받음
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [todoToDelete, setTodoToDelete] = useState(null)
  // 드래그 앤 드롭 개선을 위한 state
  const [activeTodoId, setActiveTodoId] = useState(null)
  const [overId, setOverId] = useState(null)

  // Refs
  const routineCreationInProgress = useRef(new Set())
  const recentlyEditedIds = useRef(new Set())
  const debugLoggedOnce = useRef(false)

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
            console.log(`[createRoutineTodosForDate] "${existingTodo.text}" 업데이트 필요: ${needsUpdate}`)
            console.log(`  - 기존 section_type: ${existingTodo.section_type}, 예상: ${expectedSectionType}`)
            if (needsUpdate) {
              console.log(`  - 업데이트 실행!`)
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

      // 해당 날짜의 요일에 맞는 루틴 투두 자동 생성
      await createRoutineTodosForDate(dateStr)

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

        // 루틴 투두의 경우 해당 요일에 맞는지 확인
        if (todo.routine_id) {
          const routine = routinesMap[todo.routine_id]
          if (routine) {
            const days = routine.days || []
            // days가 비어있으면 매일 반복 (미정 루틴), 아니면 해당 요일만
            if (days.length > 0 && !days.includes(dayKey)) {
              return false // 해당 요일이 아니면 표시하지 않음
            }
          }
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

        // 디버깅 (한 번만)
        if (!debugLoggedOnce.current) {
          debugLoggedOnce.current = true
          console.log('=== 루틴 투두 디버깅 ===')
          routineTodosToSync.forEach(todo => {
            const routine = routinesData?.find(r => r.id === todo.routine_id)
            console.log(`투두: "${todo.text}"`)
            console.log(`  - is_pending_routine: ${todo.is_pending_routine}`)
            console.log(`  - section_type: ${todo.section_type}`)
            console.log(`  - routine_id: ${todo.routine_id}`)
            console.log(`  - 루틴 days: ${routine ? JSON.stringify(routine.days) : '루틴 없음'}`)
          })
        }

        // section_type이 잘못된 투두 수정
        for (const todo of routineTodosToSync) {
          const routine = routinesData?.find(r => r.id === todo.routine_id)
          if (!routine) continue

          const isPendingRoutine = !routine.days || routine.days.length === 0
          const expectedSectionType = isPendingRoutine ? 'pending_routine' : 'routine'

          if (todo.section_type !== expectedSectionType || todo.is_pending_routine !== isPendingRoutine) {
            console.log(`[동기화] "${todo.text}" section_type 수정: ${todo.section_type} -> ${expectedSectionType}`)
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

  // 드래그 시작
  const handleDragStart = (event) => {
    const { active } = event
    setIsDraggingAny(true)
    setActiveTodoId(active.id)
  }

  // 드래그 오버
  const handleDragOver = (event) => {
    const { over } = event
    setOverId(over?.id || null)
  }

  // 드래그 취소
  const handleDragCancel = () => {
    setIsDraggingAny(false)
    setActiveTodoId(null)
    setOverId(null)
  }

  // 드래그 종료
  const handleDragEnd = async (event) => {
    setIsDraggingAny(false)
    setActiveTodoId(null)
    setOverId(null)

    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const activeTodo = todos.find((todo) => todo.id === active.id)
    const overTodo = todos.find((todo) => todo.id === over.id)

    if (!activeTodo || !overTodo) return

    // section_type 기반 섹션 구분
    const activeSectionType = activeTodo.section_type
    const activeSectionId = activeTodo.section_id || null
    const overSectionType = overTodo.section_type
    const overSectionId = overTodo.section_id || null

    // 섹션 간 이동 감지 (section_type이 다르거나 custom 섹션 내에서 section_id가 다른 경우)
    const isCrossSectionMove =
      activeSectionType !== overSectionType ||
      (activeSectionType === 'custom' && activeSectionId !== overSectionId)

    // 대상 섹션의 todos 필터링
    const targetSectionType = overSectionType
    const targetSectionId = overSectionId

    const sectionTodos = todos
      .filter(t => {
        if (t.parent_id) return false // 서브투두 제외
        if (t.section_type !== targetSectionType) return false
        if (targetSectionType === 'custom' && t.section_id !== targetSectionId) return false
        return true
      })
      .sort((a, b) => a.order_index - b.order_index)

    const oldIndexInSection = sectionTodos.findIndex((todo) => todo.id === active.id)
    const newIndexInSection = sectionTodos.findIndex((todo) => todo.id === over.id)

    // 섹션 내에서 재정렬
    let newSectionTodos = [...sectionTodos]

    // 섹션 간 이동인 경우
    if (isCrossSectionMove) {
      // over 위치에 activeTodo 삽입
      newSectionTodos.splice(newIndexInSection, 0, {
        ...activeTodo,
        section_type: targetSectionType,
        section_id: targetSectionId,
        // routine_id는 section_type에 따라 설정
        routine_id: targetSectionType === 'routine' || targetSectionType === 'pending_routine'
          ? activeTodo.routine_id
          : null
      })
    } else {
      // 같은 섹션 내 이동
      newSectionTodos = arrayMove(sectionTodos, oldIndexInSection, newIndexInSection)
    }

    // 로컬 상태 업데이트
    let newTodos = [...todos]

    // 섹션 내 todos의 order_index 업데이트
    newSectionTodos.forEach((sectionTodo, index) => {
      const todoIndex = newTodos.findIndex(t => t.id === sectionTodo.id)
      if (todoIndex !== -1) {
        newTodos[todoIndex] = {
          ...sectionTodo,
          order_index: index + 1
        }
      }
    })

    // 섹션 간 이동인 경우 section_type/section_id도 업데이트
    if (isCrossSectionMove) {
      const activeTodoIndex = newTodos.findIndex(t => t.id === active.id)
      if (activeTodoIndex !== -1) {
        newTodos[activeTodoIndex] = {
          ...newTodos[activeTodoIndex],
          section_type: targetSectionType,
          section_id: targetSectionId,
          routine_id: targetSectionType === 'routine' || targetSectionType === 'pending_routine'
            ? newTodos[activeTodoIndex].routine_id
            : null
        }
      }
    }

    setTodos(newTodos)

    // DB 업데이트
    try {
      // 섹션 간 이동인 경우 section_type/section_id 업데이트
      if (isCrossSectionMove) {
        const updateData = {
          section_type: targetSectionType,
          section_id: targetSectionId
        }

        // routine이나 pending_routine이 아닌 경우 routine_id 제거
        if (targetSectionType !== 'routine' && targetSectionType !== 'pending_routine') {
          updateData.routine_id = null
          updateData.is_pending_routine = false
        }

        await supabase
          .from('todos')
          .update(updateData)
          .eq('id', active.id)
      }

      // 섹션 내 order_index 재정규화 (1, 2, 3, ...)
      for (let i = 0; i < newSectionTodos.length; i++) {
        await supabase
          .from('todos')
          .update({ order_index: i + 1 })
          .eq('id', newSectionTodos[i].id)
      }
    } catch (error) {
      console.error('순서 업데이트 오류:', error.message)
      // 오류 시 원래 상태로 복구
      setTodos(todos)
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
    isDraggingAny,
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
    activeTodoId,
    overId,

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
    handleDragEnd,
    handleRemoveTodoFromUI,
    handleDragStart,
    handleDragOver,
    handleDragCancel,
  }
}
