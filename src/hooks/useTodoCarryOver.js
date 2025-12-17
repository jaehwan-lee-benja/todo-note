import { useRef } from 'react'
import { formatDateForDB } from '../utils/dateUtils'

/**
 * 투두 이월 관리 훅
 *
 * @param {Object} params
 * @param {Object} params.session - 사용자 세션
 * @param {Object} params.supabase - Supabase 클라이언트
 * @param {string} params.selectedDate - 선택된 날짜
 * @returns {Object} 이월 관련 ref 및 함수
 */
export const useTodoCarryOver = ({
  session,
  supabase,
  selectedDate,
}) => {
  // Ref
  const carryOverInProgress = useRef(false)

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
        // 이월 완료
      }
    } catch (error) {
      console.error('과거 미완료 항목 이월 오류:', error.message)
    } finally {
      // 작업 완료 후 플래그 해제
      carryOverInProgress.current = false
    }
  }

  return {
    // Ref
    carryOverInProgress,

    // Functions
    carryOverIncompleteTodos,
    movePastIncompleteTodosToToday,
  }
}
