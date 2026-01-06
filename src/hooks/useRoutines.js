import { useState, useRef, useEffect } from 'react'
import { formatDateForDB } from '../utils/dateUtils'
import { useDeleteLogic } from './useDeleteLogic'

// 숫자 요일을 키로 변환 (일요일=0, 월요일=1, ...)
const getDayKey = (dayNumber) => {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return keys[dayNumber]
}

export const useRoutines = ({
  session,
  supabase,
  selectedDate,
  setTodos,
  setSuccessToastMessage,
  setShowSuccessToast
}) => {
  // State
  const [routines, setRoutines] = useState([])
  const [routineInput, setRoutineInput] = useState('')
  const [selectedDays, setSelectedDays] = useState([])
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('')
  const [isAddingRoutine, setIsAddingRoutine] = useState(false)
  const [showRoutineModal, setShowRoutineModal] = useState(false)
  const [editingRoutineId, setEditingRoutineId] = useState(null)
  const [editingRoutineText, setEditingRoutineText] = useState('')
  const [editingRoutineDays, setEditingRoutineDays] = useState([])
  const [showRoutineHistory, setShowRoutineHistory] = useState(false)
  const [selectedRoutineForHistory, setSelectedRoutineForHistory] = useState(null)
  const [routineHistoryData, setRoutineHistoryData] = useState([])
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [routineToDelete, setRoutineToDelete] = useState(null)

  // Refs
  const routineCreationInProgress = useRef(new Set()) // 날짜별 루틴 생성 중 플래그

  // 공통 삭제 로직 hook 사용
  const { deleteThisOnly, deleteFromNow, deleteAll } = useDeleteLogic({
    type: 'routine',
    supabase,
    selectedDate,
    onDeleteSuccess: (id, deleteType) => {
      // UI에서 루틴 제거
      setRoutines(prevRoutines => prevRoutines.filter(r => r.id !== id))

      // 루틴과 연결된 투두의 routine_id를 null로 (deleteAll의 경우만 필요하지만 hook에서 처리)
      // 루틴 삭제 성공 메시지
      setSuccessToastMessage('루틴이 삭제되었습니다')
      setShowSuccessToast(true)
    }
  })

  // 루틴 목록 가져오기
  const fetchRoutines = async () => {
    // 로그인하지 않은 상태에서는 루틴을 가져오지 않음
    if (!session?.user?.id) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('deleted', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRoutines(data || [])
    } catch (error) {
      console.error('루틴 가져오기 오류:', error.message)
    }
  }

  // 루틴 추가
  const handleAddRoutine = async () => {
    if (routineInput.trim() === '' || isAddingRoutine) return

    try {
      setIsAddingRoutine(true)

      const routineData = {
        text: routineInput,
        days: selectedDays, // 빈 배열이면 매일 반복
        start_date: formatDateForDB(selectedDate), // 시작 날짜 추가
        user_id: session?.user?.id
      }

      // 시간대가 선택되었으면 추가
      if (selectedTimeSlot) {
        routineData.time_slot = selectedTimeSlot
      }

      const { data, error } = await supabase
        .from('routines')
        .insert([routineData])
        .select()

      if (error) throw error

      setRoutines([data[0], ...routines])
      setRoutineInput('')
      setSelectedDays([])
      setSelectedTimeSlot('')
    } catch (error) {
      console.error('루틴 추가 오류:', error.message)
    } finally {
      setIsAddingRoutine(false)
    }
  }

  // 투두에서 루틴 생성/수정/제거
  const handleCreateRoutineFromTodo = async (todoId, text, days, routineId = null, remove = false, timeSlot = '', startDate = null) => {
    try {
      if (remove) {
        // 루틴 제거 - routine_id를 null로
        const { error: updateError } = await supabase
          .from('todos')
          .update({ routine_id: null })
          .eq('id', todoId)

        if (updateError) throw updateError

        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === todoId ? { ...todo, routine_id: null } : todo
          )
        )

        return
      }

      if (routineId) {
        // 기존 루틴 수정
        const { error } = await supabase
          .from('routines')
          .update({ days, time_slot: timeSlot })
          .eq('id', routineId)

        if (error) throw error

        // 투두의 is_pending_routine 플래그 업데이트
        // days가 있으면 정식 루틴, 없으면 미정 루틴
        const { error: updateError } = await supabase
          .from('todos')
          .update({ is_pending_routine: days.length === 0 })
          .eq('id', todoId)

        if (updateError) throw updateError

        // 로컬 루틴 목록 업데이트
        setRoutines(prevRoutines =>
          prevRoutines.map(r => r.id === routineId ? { ...r, days, time_slot: timeSlot } : r)
        )

        // 로컬 투두 목록 업데이트
        setTodos(prevTodos =>
          prevTodos.map(t => t.id === todoId ? { ...t, is_pending_routine: days.length === 0 } : t)
        )
      } else {
        // 새 루틴 생성 - start_date 추가
        const routineData = {
          text,
          days,
          time_slot: timeSlot,
          start_date: startDate || formatDateForDB(selectedDate), // 시작 날짜 설정
          user_id: session?.user?.id
        }

        const { data, error } = await supabase
          .from('routines')
          .insert([routineData])
          .select()

        if (error) throw error


        // 해당 투두에 루틴 ID 연결 및 미정 루틴 플래그 설정
        // days가 있으면 정식 루틴(false), 없으면 미정 루틴(true)
        const { error: updateError } = await supabase
          .from('todos')
          .update({ routine_id: data[0].id, is_pending_routine: days.length === 0 })
          .eq('id', todoId)

        if (updateError) throw updateError

        // 로컬 상태 업데이트
        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === todoId ? { ...todo, routine_id: data[0].id, is_pending_routine: days.length === 0 } : todo
          )
        )

        // 새 루틴을 routines 배열에 추가 (항상)
        setRoutines(prevRoutines => [data[0], ...prevRoutines])
      }
    } catch (error) {
      console.error('루틴 처리 오류:', error.message)
    }
  }

  // 루틴 수정 시작
  const handleStartEditRoutine = (routine) => {
    setEditingRoutineId(routine.id)
    setEditingRoutineText(routine.text)
    setEditingRoutineDays(routine.days)
  }

  // 루틴 수정 취소
  const handleCancelEditRoutine = () => {
    setEditingRoutineId(null)
    setEditingRoutineText('')
    setEditingRoutineDays([])
  }

  // 루틴 수정 저장
  const handleSaveEditRoutine = async () => {
    if (!editingRoutineId || editingRoutineText.trim() === '' || editingRoutineDays.length === 0) return

    try {
      const { error } = await supabase
        .from('routines')
        .update({
          text: editingRoutineText.trim(),
          days: editingRoutineDays
        })
        .eq('id', editingRoutineId)

      if (error) throw error

      // 로컬 상태 업데이트
      setRoutines(routines.map(routine =>
        routine.id === editingRoutineId
          ? { ...routine, text: editingRoutineText.trim(), days: editingRoutineDays }
          : routine
      ))

      // 수정 상태 초기화
      handleCancelEditRoutine()
    } catch (error) {
      console.error('루틴 수정 오류:', error.message)
    }
  }

  // 루틴 수정 시 요일 토글
  const handleToggleEditDay = (dayKey) => {
    setEditingRoutineDays(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 루틴 삭제 (모달 표시)
  const handleDeleteRoutine = async (id) => {
    const routine = routines.find(r => r.id === id)
    if (!routine) return

    // 모달 표시
    setRoutineToDelete(routine)
    setShowDeleteConfirmModal(true)
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

  // 오늘 요일의 루틴 작업 자동 생성 (자정용)
  const createRoutineTodos = async () => {
    const today = new Date()
    const todayStr = formatDateForDB(today)
    await createRoutineTodosForDate(todayStr)
  }

  // 루틴 히스토리 조회
  const fetchRoutineHistory = async (routine) => {
    try {
      // JSON 방식: 해당 루틴의 투두 조회 (중복 방지)
      const { data: routineTodos, error } = await supabase
        .from('todos')
        .select('*')
        .eq('routine_id', routine.id)
        .eq('deleted', false)

      if (error) throw error

      // 중복이 있으면 첫 번째 것만 사용
      const routineTodo = routineTodos && routineTodos.length > 0 ? routineTodos[0] : null

      if (routineTodo && routineTodo.visible_dates) {
        // visible_dates 배열을 날짜별 객체 배열로 변환
        const historyData = routineTodo.visible_dates
          .sort() // 날짜 정렬
          .map(date => ({
            id: `${routineTodo.id}-${date}`, // 고유 ID 생성
            date,
            text: routineTodo.text,
            completed: routineTodo.completed, // TODO: 날짜별 완료 상태 추적 필요
            routine_id: routineTodo.routine_id
          }))

        setRoutineHistoryData(historyData)
      } else {
        setRoutineHistoryData([])
      }

      setSelectedRoutineForHistory(routine)
      setShowRoutineHistory(true)
    } catch (error) {
      console.error('루틴 히스토리 조회 오류:', error.message)
      alert('루틴 히스토리 조회 실패: ' + error.message)
    }
  }

  // 루틴 히스토리 모달 닫기
  const handleCloseRoutineHistory = () => {
    setShowRoutineHistory(false)
    setSelectedRoutineForHistory(null)
    setRoutineHistoryData([])
  }

  // 루틴 모달 열기/닫기
  const handleOpenRoutine = () => {
    setShowRoutineModal(true)
    fetchRoutines()
  }

  const handleCloseRoutine = () => {
    setShowRoutineModal(false)
    setRoutineInput('')
    setSelectedDays([])
  }

  const handleToggleDay = (dayKey) => {
    setSelectedDays(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 앱 시작 시 루틴 목록 가져오기
  useEffect(() => {
    if (!session) return
    fetchRoutines()
  }, [session])

  return {
    // State
    routines,
    setRoutines,
    routineInput,
    selectedDays,
    selectedTimeSlot,
    isAddingRoutine,
    showRoutineModal,
    editingRoutineId,
    editingRoutineText,
    editingRoutineDays,
    showRoutineHistory,
    selectedRoutineForHistory,
    routineHistoryData,
    routineCreationInProgress,
    showDeleteConfirmModal,
    setShowDeleteConfirmModal,
    routineToDelete,
    setRoutineToDelete,

    // Setters
    setRoutineInput,
    setSelectedTimeSlot,

    // Functions
    fetchRoutines,
    handleAddRoutine,
    handleDeleteRoutine,
    deleteThisOnly,
    deleteFromNow,
    deleteAll,
    handleStartEditRoutine,
    handleSaveEditRoutine,
    handleCancelEditRoutine,
    handleToggleEditDay,
    handleCreateRoutineFromTodo,
    createRoutineTodosForDate,
    createRoutineTodos,
    fetchRoutineHistory,
    handleCloseRoutineHistory,
    handleOpenRoutine,
    handleCloseRoutine,
    handleToggleDay
  }
}
