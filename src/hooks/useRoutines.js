import { useState, useRef, useEffect } from 'react'
import { formatDateForDB } from '../utils/dateUtils'
import { useDeleteLogic } from './useDeleteLogic'
import { filterMatchingRoutines, findExistingRoutineTodo, addRoutineTodoForDate } from '../utils/routineUtils'

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

  // 투두에서 반복 설정/수정/제거 (새 시스템: repeat_days 사용)
  const handleCreateRoutineFromTodo = async (todoId, text, days, routineId = null, remove = false, timeSlot = '', startDate = null) => {
    try {
      if (remove) {
        // 반복 제거 - repeat_days를 빈 배열로
        const { error: updateError } = await supabase
          .from('todos')
          .update({
            repeat_days: [],
            routine_id: null, // 하위 호환
            is_pending_routine: false,
          })
          .eq('id', todoId)

        if (updateError) throw updateError

        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === todoId ? { ...todo, repeat_days: [], routine_id: null, is_pending_routine: false } : todo
          )
        )

        return
      }

      // 반복 설정/수정 - repeat_days에 저장
      const updateData = {
        repeat_days: days,
        repeat_start_date: startDate || formatDateForDB(selectedDate),
      }

      const { error: updateError } = await supabase
        .from('todos')
        .update(updateData)
        .eq('id', todoId)

      if (updateError) throw updateError

      // 로컬 투두 목록 업데이트
      setTodos(prevTodos =>
        prevTodos.map(t => t.id === todoId ? { ...t, ...updateData } : t)
      )
    } catch (error) {
      console.error('반복 설정 오류:', error.message)
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
    if (routineCreationInProgress.current.has(dateStr)) return

    try {
      routineCreationInProgress.current.add(dateStr)

      const { data: allRoutines, error: routineError } = await supabase
        .from('routines')
        .select('*')
        .eq('deleted', false)

      if (routineError) throw routineError

      const matchingRoutines = filterMatchingRoutines(allRoutines, dateStr)
      if (matchingRoutines.length === 0) return

      for (const routine of matchingRoutines) {
        const existingTodo = await findExistingRoutineTodo(supabase, routine.id)
        await addRoutineTodoForDate({
          supabase, routine, existingTodo, dateStr,
          userId: session?.user?.id
        })
      }
    } catch (error) {
      console.error('루틴 작업 생성 오류:', error.message)
    } finally {
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
