import { arrayMove } from '@dnd-kit/sortable'

/**
 * 투두 순서 관리 훅
 * 투두의 위/아래/맨위/맨아래 이동 기능 제공
 *
 * @param {Array} todos - 전체 투두 배열
 * @param {Function} setTodos - 투두 상태 업데이트 함수
 * @param {Object} supabase - Supabase 클라이언트
 */
export function useTodoOrder(todos, setTodos, supabase) {
  /**
   * 섹션별 투두 필터링
   */
  const getSectionTodos = (sectionType, sectionId) => {
    return todos
      .filter(t => {
        if (t.parent_id) return false
        if (t.section_type !== sectionType) return false
        if (sectionType === 'custom' && t.section_id !== sectionId) return false
        return true
      })
      .sort((a, b) => a.order_index - b.order_index)
  }

  /**
   * 투두 순서 DB 업데이트
   */
  const updateTodoOrder = async (newSectionTodos) => {
    // 로컬 상태 업데이트
    let newTodos = [...todos]
    newSectionTodos.forEach((sectionTodo, index) => {
      const todoIndex = newTodos.findIndex(t => t.id === sectionTodo.id)
      if (todoIndex !== -1) {
        newTodos[todoIndex] = {
          ...newTodos[todoIndex],
          order_index: index + 1
        }
      }
    })
    setTodos(newTodos)

    // DB 업데이트
    try {
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

  /**
   * 투두 위로 이동
   */
  const handleMoveUp = async (todoId, sectionType, sectionId) => {
    const todo = todos.find(t => t.id === todoId)
    if (!todo) return

    const sectionTodos = getSectionTodos(sectionType, sectionId)
    const currentIndex = sectionTodos.findIndex(t => t.id === todoId)
    if (currentIndex <= 0) return // 이미 맨 위

    const newSectionTodos = arrayMove(sectionTodos, currentIndex, currentIndex - 1)
    await updateTodoOrder(newSectionTodos)
  }

  /**
   * 투두 아래로 이동
   */
  const handleMoveDown = async (todoId, sectionType, sectionId) => {
    const todo = todos.find(t => t.id === todoId)
    if (!todo) return

    const sectionTodos = getSectionTodos(sectionType, sectionId)
    const currentIndex = sectionTodos.findIndex(t => t.id === todoId)
    if (currentIndex >= sectionTodos.length - 1) return // 이미 맨 아래

    const newSectionTodos = arrayMove(sectionTodos, currentIndex, currentIndex + 1)
    await updateTodoOrder(newSectionTodos)
  }

  /**
   * 투두 맨 위로 이동
   */
  const handleMoveToTop = async (todoId, sectionType, sectionId) => {
    const todo = todos.find(t => t.id === todoId)
    if (!todo) return

    const sectionTodos = getSectionTodos(sectionType, sectionId)
    const currentIndex = sectionTodos.findIndex(t => t.id === todoId)
    if (currentIndex <= 0) return // 이미 맨 위

    const newSectionTodos = arrayMove(sectionTodos, currentIndex, 0)
    await updateTodoOrder(newSectionTodos)
  }

  /**
   * 투두 맨 아래로 이동
   */
  const handleMoveToBottom = async (todoId, sectionType, sectionId) => {
    const todo = todos.find(t => t.id === todoId)
    if (!todo) return

    const sectionTodos = getSectionTodos(sectionType, sectionId)
    const currentIndex = sectionTodos.findIndex(t => t.id === todoId)
    if (currentIndex >= sectionTodos.length - 1) return // 이미 맨 아래

    const newSectionTodos = arrayMove(sectionTodos, currentIndex, sectionTodos.length - 1)
    await updateTodoOrder(newSectionTodos)
  }

  return {
    handleMoveUp,
    handleMoveDown,
    handleMoveToTop,
    handleMoveToBottom,
    updateTodoOrder,
  }
}
