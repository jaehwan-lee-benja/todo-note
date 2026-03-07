import { getDayKey } from './constants'

/**
 * 해당 날짜에 매칭되는 루틴 필터링
 * @param {Array} allRoutines - 전체 루틴 목록
 * @param {string} dateStr - 대상 날짜 (YYYY-MM-DD)
 * @returns {Array} 매칭된 루틴 목록
 */
export const filterMatchingRoutines = (allRoutines, dateStr) => {
  const targetDate = new Date(dateStr)
  const dayKey = getDayKey(targetDate.getDay())

  return allRoutines.filter(routine => {
    const days = routine.days || []
    const hasMatchingDay = days.length === 0 || days.includes(dayKey)

    if (routine.start_date) {
      const startDate = new Date(routine.start_date)
      return hasMatchingDay && targetDate >= startDate
    }

    return hasMatchingDay
  })
}

/**
 * 루틴에서 기존 투두를 찾고 중복 정리
 * @param {Object} supabase - Supabase 클라이언트
 * @param {string} routineId - 루틴 ID
 * @returns {Object|null} 기존 투두 (첫 번째) 또는 null
 */
export const findExistingRoutineTodo = async (supabase, routineId) => {
  const { data: existingTodos, error } = await supabase
    .from('todos')
    .select('*')
    .eq('routine_id', routineId)
    .eq('deleted', false)

  if (error) throw error

  // 중복이 있으면 첫 번째만 유지
  if (existingTodos && existingTodos.length > 1) {
    console.warn(`루틴 ${routineId}에 중복 투두 발견 (${existingTodos.length}개). 첫 번째만 유지하고 나머지 삭제.`)
    for (let i = 1; i < existingTodos.length; i++) {
      await supabase
        .from('todos')
        .update({ deleted: true, deleted_date: new Date().toISOString() })
        .eq('id', existingTodos[i].id)
    }
  }

  return existingTodos && existingTodos.length > 0 ? existingTodos[0] : null
}

/**
 * 루틴 투두를 날짜에 추가하거나 새로 생성
 * @param {Object} params
 * @param {Object} params.supabase - Supabase 클라이언트
 * @param {Object} params.routine - 루틴 객체
 * @param {Object|null} params.existingTodo - 기존 투두 (없으면 새로 생성)
 * @param {string} params.dateStr - 대상 날짜
 * @param {string} params.userId - 사용자 ID
 * @param {Object} [params.options] - 추가 옵션 (hiddenDatesCheck 등)
 */
export const addRoutineTodoForDate = async ({ supabase, routine, existingTodo, dateStr, userId, options = {} }) => {
  const isPendingRoutine = !routine.days || routine.days.length === 0
  const expectedSectionType = isPendingRoutine ? 'pending_routine' : 'routine'

  if (existingTodo) {
    // hidden_dates / stop_carryover_from 체크 (옵션)
    if (options.checkHiddenDates) {
      const hiddenDates = existingTodo.hidden_dates || []
      if (hiddenDates.includes(dateStr)) return 'skipped'

      if (existingTodo.stop_carryover_from && dateStr >= existingTodo.stop_carryover_from) {
        return 'skipped'
      }
    }

    const currentDates = existingTodo.visible_dates || []

    if (currentDates.includes(dateStr)) {
      // 이미 포함되어 있으면 section_type만 동기화
      if (existingTodo.is_pending_routine !== isPendingRoutine ||
          existingTodo.section_type !== expectedSectionType) {
        await supabase
          .from('todos')
          .update({
            is_pending_routine: isPendingRoutine,
            section_type: expectedSectionType
          })
          .eq('id', existingTodo.id)
      }
      return 'exists'
    }

    // visible_dates에 날짜 추가
    const updatedDates = [...currentDates, dateStr].sort()
    const { error } = await supabase
      .from('todos')
      .update({
        visible_dates: updatedDates,
        is_pending_routine: isPendingRoutine,
        section_type: expectedSectionType
      })
      .eq('id', existingTodo.id)

    if (error) console.error('루틴 투두 날짜 추가 오류:', error.message)
    return 'updated'
  } else {
    // 새 투두 생성
    const { error } = await supabase
      .from('todos')
      .insert([{
        text: routine.text,
        completed: false,
        date: dateStr,
        visible_dates: [dateStr],
        hidden_dates: [],
        order_index: 0,
        routine_id: routine.id,
        is_pending_routine: isPendingRoutine,
        section_type: expectedSectionType,
        user_id: userId
      }])

    if (error) console.error('루틴 투두 생성 오류:', error.message)
    return 'created'
  }
}
