import { useState } from 'react'
import { formatDateForDB } from '../utils/dateUtils'

export function useGanttChart(supabase) {
  const [showGanttChart, setShowGanttChart] = useState(false)
  const [ganttData, setGanttData] = useState([])
  const [ganttPeriod, setGanttPeriod] = useState('1week') // 'all', '1week', '2weeks', '1month', '3months', '6months'

  const fetchGanttData = async () => {
    try {
      const today = new Date()
      const todayStr = formatDateForDB(today)

      // 기간 계산
      let startDate = null
      if (ganttPeriod !== 'all') {
        startDate = new Date(today)
        switch (ganttPeriod) {
          case '1week':
            startDate.setDate(today.getDate() - 7)
            break
          case '2weeks':
            startDate.setDate(today.getDate() - 14)
            break
          case '1month':
            startDate.setMonth(today.getMonth() - 1)
            break
          case '3months':
            startDate.setMonth(today.getMonth() - 3)
            break
          case '6months':
            startDate.setMonth(today.getMonth() - 6)
            break
        }
      }

      // 모든 투두 조회 (기간 필터링 포함)
      let query = supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)
        .is('routine_id', null) // 루틴 투두 제외
        .order('created_at', { ascending: true })

      if (startDate) {
        query = query.gte('date', formatDateForDB(startDate))
      }

      const { data: allTodos, error } = await query

      if (error) throw error

      // original_todo_id로 그룹화 (같은 투두의 이월 버전들)
      const groupedByOriginal = {}

      for (const todo of allTodos || []) {
        // 원본 ID 결정 (original_todo_id가 있으면 그것, 없으면 자신의 id)
        const originalId = todo.original_todo_id || todo.id

        if (!groupedByOriginal[originalId]) {
          groupedByOriginal[originalId] = []
        }
        groupedByOriginal[originalId].push(todo)
      }

      // 배열로 변환하고 생성일 순서대로 정렬
      const ganttItems = Object.entries(groupedByOriginal).map(([originalId, todos]) => {
        // 날짜순 정렬
        const sortedTodos = todos.sort((a, b) => new Date(a.date) - new Date(b.date))
        const firstTodo = sortedTodos[0]

        // 모든 날짜 추출
        const allDates = sortedTodos.map(t => t.date)

        // 완료 날짜 찾기 (completed_at이 있는 투두에서 추출)
        let completedDate = null
        for (const todo of sortedTodos) {
          if (todo.completed && todo.completed_at) {
            const completedAtDate = new Date(todo.completed_at)
            completedDate = formatDateForDB(completedAtDate)
            break
          }
        }

        // 오늘 날짜에 있는 투두 찾기 (완료 여부 확인용)
        const todayTodo = sortedTodos.find(t => t.date === todayStr)

        return {
          text: firstTodo.text,
          originalId: parseInt(originalId),
          createdAt: firstTodo.created_at,
          startDate: allDates[0],
          endDate: allDates[allDates.length - 1],
          dates: allDates,
          completed: todayTodo?.completed || false,
          completedDate: completedDate
        }
      }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

      setGanttData(ganttItems)
    } catch (error) {
      console.error('간트차트 데이터 조회 오류:', error.message)
    }
  }

  const handleOpenGanttChart = async () => {
    setShowGanttChart(true)
    await fetchGanttData()
  }

  const handleCloseGanttChart = () => {
    setShowGanttChart(false)
    setGanttData([])
  }

  return {
    showGanttChart,
    ganttData,
    ganttPeriod,
    setGanttPeriod,
    handleOpenGanttChart,
    handleCloseGanttChart,
    fetchGanttData,
  }
}
