import { useState } from 'react'

/**
 * 투두 히스토리 관리 훅
 *
 * @param {Object} params
 * @param {Object} params.session - 사용자 세션
 * @param {Object} params.supabase - Supabase 클라이언트
 * @param {Object|null} params.selectedTodoForModal - 선택된 투두 (from App.jsx)
 * @param {Function} params.setSelectedTodoForModal - 선택된 투두 업데이트 함수
 * @returns {Object} 히스토리 관련 state 및 함수
 */
export const useTodoHistory = ({
  session,
  supabase,
  selectedTodoForModal,
  setSelectedTodoForModal,
}) => {
  // State
  const [showTodoHistoryModal, setShowTodoHistoryModal] = useState(false)
  const [todoHistory, setTodoHistory] = useState({})
  const [expandedHistoryIds, setExpandedHistoryIds] = useState([])

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
    showTodoHistoryModal,
    todoHistory,
    expandedHistoryIds,

    // Functions
    handleOpenTodoHistoryModal,
    handleCloseTodoHistoryModal,
    toggleHistoryDetail,
  }
}
