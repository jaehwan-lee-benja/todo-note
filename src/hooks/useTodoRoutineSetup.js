import { useState } from 'react'

/**
 * 투두 루틴 설정 훅
 *
 * @param {Object} params
 * @param {Object|null} params.selectedTodoForModal - 선택된 투두 (from App.jsx)
 * @param {Function} params.setSelectedTodoForModal - 선택된 투두 업데이트 함수
 * @param {Array} params.routines - 루틴 목록
 * @returns {Object} 루틴 설정 관련 state 및 함수
 */
export const useTodoRoutineSetup = ({
  selectedTodoForModal,
  setSelectedTodoForModal,
  routines,
}) => {
  // State
  const [showTodoRoutineSetupModal, setShowTodoRoutineSetupModal] = useState(false)
  const [routineDaysForModal, setRoutineDaysForModal] = useState([])
  const [isEditingRoutineInModal, setIsEditingRoutineInModal] = useState(false)
  const [routineTimeSlotForModal, setRoutineTimeSlotForModal] = useState('')

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

  // 루틴 요일 토글
  const handleToggleRoutineDayInModal = (dayKey) => {
    setRoutineDaysForModal(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  return {
    // State
    showTodoRoutineSetupModal,
    routineDaysForModal,
    setRoutineDaysForModal,
    isEditingRoutineInModal,
    setIsEditingRoutineInModal,
    routineTimeSlotForModal,
    setRoutineTimeSlotForModal,

    // Functions
    handleOpenTodoRoutineSetupModal,
    handleCloseTodoRoutineSetupModal,
    handleToggleRoutineDayInModal,
  }
}
