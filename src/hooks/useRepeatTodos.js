import { useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { REPEAT_TYPE, DAYS } from '../utils/constants'

/**
 * 반복 투두 관리 커스텀 훅
 * - 반복 투두 날짜별 표시 여부 판단
 * - 반복 투두 완료 처리 (날짜별)
 * - 반복 투두 생성/수정
 */

// 요일 키 배열 (일요일=0 시작)
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

export function useRepeatTodos(session) {

  /**
   * 특정 날짜에 반복 투두가 표시되어야 하는지 확인
   */
  const shouldShowOnDate = useCallback((todo, dateStr) => {
    if (todo.repeat_type === REPEAT_TYPE.NONE) {
      return false // 반복 투두가 아님
    }

    const targetDate = new Date(dateStr + 'T00:00:00')
    const dayOfWeek = targetDate.getDay() // 0=일, 1=월, ..., 6=토
    const dayKey = DAY_KEYS[dayOfWeek]

    // repeat_start_date 이전이면 표시 안함
    if (todo.repeat_start_date) {
      const startDate = new Date(todo.repeat_start_date + 'T00:00:00')
      if (targetDate < startDate) return false
    }

    // repeat_end_date 이후면 표시 안함
    if (todo.repeat_end_date) {
      const endDate = new Date(todo.repeat_end_date + 'T00:00:00')
      if (targetDate > endDate) return false
    }

    // hidden_dates에 포함되면 표시 안함
    if (todo.hidden_dates?.includes(dateStr)) {
      return false
    }

    // stop_carryover_from 이후면 표시 안함
    if (todo.stop_carryover_from && dateStr >= todo.stop_carryover_from) {
      return false
    }

    // 반복 타입별 표시 여부 결정
    switch (todo.repeat_type) {
      case REPEAT_TYPE.DAILY:
        return true

      case REPEAT_TYPE.WEEKDAYS:
        // 월-금 (1-5)
        return dayOfWeek >= 1 && dayOfWeek <= 5

      case REPEAT_TYPE.WEEKENDS:
        // 토-일 (0, 6)
        return dayOfWeek === 0 || dayOfWeek === 6

      case REPEAT_TYPE.WEEKLY:
        // 선택된 요일만
        return todo.repeat_days?.includes(dayKey)

      default:
        return false
    }
  }, [])

  /**
   * 반복 투두가 특정 날짜에 완료되었는지 확인
   */
  const isCompletedOnDate = useCallback((todo, dateStr) => {
    if (todo.repeat_type === REPEAT_TYPE.NONE) {
      // 일반 투두는 기존 completed 필드 사용
      return todo.completed
    }
    // 반복 투두는 completed_dates 배열에서 확인
    return todo.completed_dates?.includes(dateStr)
  }, [])

  /**
   * 반복 투두의 특정 날짜 완료 토글
   */
  const toggleCompletedOnDate = async (todoId, dateStr, currentlyCompleted) => {
    if (!session?.user?.id) return false

    try {
      // 현재 투두 조회
      const { data: todo, error: fetchError } = await supabase
        .from('todos')
        .select('completed_dates, repeat_type')
        .eq('id', todoId)
        .single()

      if (fetchError) throw fetchError

      let newCompletedDates = todo.completed_dates || []

      if (currentlyCompleted) {
        // 완료 해제: 배열에서 제거
        newCompletedDates = newCompletedDates.filter(d => d !== dateStr)
      } else {
        // 완료: 배열에 추가
        if (!newCompletedDates.includes(dateStr)) {
          newCompletedDates = [...newCompletedDates, dateStr].sort()
        }
      }

      const { error: updateError } = await supabase
        .from('todos')
        .update({
          completed_dates: newCompletedDates,
          // 반복 투두의 경우 completed 필드는 사용하지 않음 (또는 최신 날짜 기준으로 설정)
          completed: newCompletedDates.includes(dateStr) ? false : !currentlyCompleted,
          completed_at: !currentlyCompleted ? new Date().toISOString() : null,
        })
        .eq('id', todoId)

      if (updateError) throw updateError

      return true
    } catch (error) {
      console.error('반복 투두 완료 토글 오류:', error)
      return false
    }
  }

  /**
   * 투두에 반복 설정 추가/수정
   */
  const setRepeat = async (todoId, repeatType, repeatDays = [], startDate = null) => {
    if (!session?.user?.id) return false

    try {
      const updateData = {
        repeat_type: repeatType,
        repeat_days: repeatType === REPEAT_TYPE.WEEKLY ? repeatDays : [],
        repeat_start_date: startDate || new Date().toISOString().split('T')[0],
      }

      // 반복 해제 시
      if (repeatType === REPEAT_TYPE.NONE) {
        updateData.repeat_days = []
        updateData.repeat_start_date = null
        updateData.repeat_end_date = null
      }

      const { error } = await supabase
        .from('todos')
        .update(updateData)
        .eq('id', todoId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('반복 설정 오류:', error)
      return false
    }
  }

  /**
   * 반복 투두에서 특정 날짜만 숨기기 (this-only 삭제)
   */
  const hideOnDate = async (todoId, dateStr) => {
    if (!session?.user?.id) return false

    try {
      const { data: todo, error: fetchError } = await supabase
        .from('todos')
        .select('hidden_dates')
        .eq('id', todoId)
        .single()

      if (fetchError) throw fetchError

      let newHiddenDates = todo.hidden_dates || []
      if (!newHiddenDates.includes(dateStr)) {
        newHiddenDates = [...newHiddenDates, dateStr].sort()
      }

      const { error: updateError } = await supabase
        .from('todos')
        .update({ hidden_dates: newHiddenDates })
        .eq('id', todoId)

      if (updateError) throw updateError

      return true
    } catch (error) {
      console.error('날짜 숨기기 오류:', error)
      return false
    }
  }

  /**
   * 반복 투두 종료 (from-now 삭제)
   */
  const endRepeatFromDate = async (todoId, dateStr) => {
    if (!session?.user?.id) return false

    try {
      const { error } = await supabase
        .from('todos')
        .update({
          repeat_end_date: dateStr,
          stop_carryover_from: dateStr,
        })
        .eq('id', todoId)

      if (error) throw error

      return true
    } catch (error) {
      console.error('반복 종료 오류:', error)
      return false
    }
  }

  /**
   * 날짜에 대한 "for 날짜" 표기 문자열 생성
   */
  const getForDateLabel = useCallback((dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    const month = date.getMonth() + 1
    const day = date.getDate()
    const dayNames = ['일', '월', '화', '수', '목', '금', '토']
    const dayName = dayNames[date.getDay()]
    return `for ${month}/${day}(${dayName})`
  }, [])

  /**
   * 반복 투두인지 확인
   */
  const isRepeatTodo = useCallback((todo) => {
    return todo.repeat_type && todo.repeat_type !== REPEAT_TYPE.NONE
  }, [])

  /**
   * 반복 타입 라벨 가져오기
   */
  const getRepeatLabel = useCallback((todo) => {
    if (!todo.repeat_type || todo.repeat_type === REPEAT_TYPE.NONE) {
      return null
    }

    switch (todo.repeat_type) {
      case REPEAT_TYPE.DAILY:
        return '매일'
      case REPEAT_TYPE.WEEKDAYS:
        return '평일'
      case REPEAT_TYPE.WEEKENDS:
        return '주말'
      case REPEAT_TYPE.WEEKLY:
        if (todo.repeat_days?.length > 0) {
          const dayLabels = DAYS
            .filter(d => todo.repeat_days.includes(d.key))
            .map(d => d.label)
            .join(', ')
          return dayLabels
        }
        return '요일 선택'
      default:
        return null
    }
  }, [])

  return {
    shouldShowOnDate,
    isCompletedOnDate,
    toggleCompletedOnDate,
    setRepeat,
    hideOnDate,
    endRepeatFromDate,
    getForDateLabel,
    isRepeatTodo,
    getRepeatLabel,
  }
}
