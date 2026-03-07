/**
 * 투두 필터링 유틸리티 함수들
 * useTodos, useRepeatTodos, useTodoCarryOver 등에서 공통으로 사용
 */

/**
 * 특정 날짜에 투두가 숨겨져 있는지 확인
 */
export const isHiddenOnDate = (todo, dateStr) => {
  const hiddenDates = todo.hidden_dates
  return hiddenDates && Array.isArray(hiddenDates) && hiddenDates.includes(dateStr)
}

/**
 * 특정 날짜에서 이월이 중단되었는지 확인
 */
export const isCarryoverStopped = (todo, dateStr) => {
  return todo.stop_carryover_from && dateStr >= todo.stop_carryover_from
}

/**
 * completed_dates 배열에서 날짜 토글 (추가/제거)
 * @returns {string[]} 새로운 completed_dates 배열
 */
export const toggleCompletedDate = (completedDates, dateStr) => {
  const dates = completedDates || []
  if (dates.includes(dateStr)) {
    return dates.filter(d => d !== dateStr)
  }
  return [...dates, dateStr].sort()
}
