import { useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'

/**
 * 투두 드래그 앤 드롭 훅
 * 투두의 드래그 시작/오버/취소/종료 이벤트 처리
 *
 * @param {Array} todos - 전체 투두 배열
 * @param {Function} setTodos - 투두 상태 업데이트 함수
 * @param {Object} supabase - Supabase 클라이언트
 * @param {Function} onTimelineDrop - 타임라인 드롭 콜백 (optional)
 */
export function useTodoDragDrop(todos, setTodos, supabase, onTimelineDrop) {
  // 드래그 상태
  const [isDraggingAny, setIsDraggingAny] = useState(false)
  const [activeTodoId, setActiveTodoId] = useState(null)
  const [overId, setOverId] = useState(null)

  /**
   * 드래그 시작
   */
  const handleDragStart = (event) => {
    const { active } = event
    setIsDraggingAny(true)
    setActiveTodoId(active.id)
  }

  /**
   * 드래그 오버
   */
  const handleDragOver = (event) => {
    const { over } = event
    setOverId(over?.id || null)
  }

  /**
   * 드래그 취소
   */
  const handleDragCancel = () => {
    setIsDraggingAny(false)
    setActiveTodoId(null)
    setOverId(null)
  }

  /**
   * 드래그 종료 및 순서 업데이트
   */
  const handleDragEnd = async (event) => {
    setIsDraggingAny(false)
    setActiveTodoId(null)
    setOverId(null)

    const { active, over } = event

    if (!over) {
      return
    }

    // 타임라인 드롭 처리
    if (over.id && String(over.id).startsWith('timeline-')) {
      const hour = parseInt(String(over.id).replace('timeline-', ''), 10)
      const activeTodo = todos.find((todo) => todo.id === active.id)
      if (activeTodo && onTimelineDrop) {
        onTimelineDrop(activeTodo.id, hour)
      }
      return
    }

    if (active.id === over.id) {
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
    isDraggingAny,
    activeTodoId,
    overId,
    // Functions
    handleDragStart,
    handleDragOver,
    handleDragCancel,
    handleDragEnd,
  }
}
