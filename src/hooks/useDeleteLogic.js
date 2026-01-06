import { formatDateForDB } from '../utils/dateUtils'
import { DELETE_TYPE } from '../utils/constants'

/**
 * 공통 삭제 로직을 제공하는 Hook
 * 투두와 루틴 모두에서 재사용 가능
 *
 * @param {Object} params
 * @param {'todo'|'routine'} params.type - 삭제할 아이템 타입
 * @param {Object} params.supabase - Supabase 클라이언트
 * @param {Date} params.selectedDate - 현재 선택된 날짜
 * @param {Function} params.onDeleteSuccess - 삭제 성공 시 콜백
 */
export const useDeleteLogic = ({ type, supabase, selectedDate, onDeleteSuccess }) => {

  /**
   * 옵션 1: 이 할일만 삭제 (오늘만 숨김, 내일부터 다시 표시)
   * - hidden_dates에 오늘 날짜 추가
   * - 이월 시 hidden_dates 무시하므로 내일 다시 나타남
   */
  const deleteThisOnly = async (item) => {
    try {
      const dateStr = formatDateForDB(selectedDate)
      const currentHiddenDates = item.hidden_dates || []
      const newHiddenDates = [...currentHiddenDates, dateStr]

      const tableName = type === 'todo' ? 'todos' : 'routines'

      // hidden_dates 업데이트
      const { error } = await supabase
        .from(tableName)
        .update({ hidden_dates: newHiddenDates })
        .eq('id', item.id)

      if (error) throw error

      if (onDeleteSuccess) {
        onDeleteSuccess(item.id, DELETE_TYPE.THIS_ONLY)
      }

      return { success: true }
    } catch (error) {
      console.error(`${type} 삭제 오류 (THIS_ONLY):`, error.message)
      return { success: false, error }
    }
  }

  /**
   * 옵션 2: 이번 및 향후 할일 삭제 (오늘부터 이월 중단)
   * - visible_dates에서 오늘 이후 날짜 모두 제거
   * - stop_carryover_from 설정하여 미래 이월 중단
   */
  const deleteFromNow = async (item) => {
    try {
      const dateStr = formatDateForDB(selectedDate)
      const currentVisibleDates = item.visible_dates || []

      // 오늘 및 미래 날짜를 visible_dates에서 제거 (과거만 유지)
      const newVisibleDates = currentVisibleDates.filter(d => d < dateStr)

      const tableName = type === 'todo' ? 'todos' : 'routines'

      // visible_dates 업데이트 + stop_carryover 플래그
      const { error } = await supabase
        .from(tableName)
        .update({
          visible_dates: newVisibleDates,
          stop_carryover_from: dateStr  // 이월 중단 시작 날짜
        })
        .eq('id', item.id)

      if (error) throw error

      if (onDeleteSuccess) {
        onDeleteSuccess(item.id, DELETE_TYPE.FROM_NOW)
      }

      return { success: true }
    } catch (error) {
      console.error(`${type} 삭제 오류 (FROM_NOW):`, error.message)
      return { success: false, error }
    }
  }

  /**
   * 옵션 3: 모든 할일 삭제 (완전 삭제)
   * - deleted = true
   * - 과거/현재/미래 모든 날짜에서 제거
   */
  const deleteAll = async (item) => {
    try {
      const dateStr = formatDateForDB(selectedDate)
      const tableName = type === 'todo' ? 'todos' : 'routines'

      // Soft delete
      const { error } = await supabase
        .from(tableName)
        .update({
          deleted: true,
          deleted_date: dateStr
        })
        .eq('id', item.id)

      if (error) throw error

      // 루틴인 경우, 연결된 투두의 routine_id를 null로
      if (type === 'routine') {
        await supabase
          .from('todos')
          .update({ routine_id: null })
          .eq('routine_id', item.id)
      }

      if (onDeleteSuccess) {
        onDeleteSuccess(item.id, DELETE_TYPE.ALL)
      }

      return { success: true }
    } catch (error) {
      console.error(`${type} 삭제 오류 (ALL):`, error.message)
      return { success: false, error }
    }
  }

  return {
    deleteThisOnly,
    deleteFromNow,
    deleteAll
  }
}
