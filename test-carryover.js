import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// .env 파일 로드
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const formatDateForDB = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function testCarryOver() {
  const todayStr = '2025-11-26'

  try {
    console.log('=== 이월 작업 시작 ===\n')

    // 모든 미완료 투두 조회 (삭제되지 않은 것만)
    const { data: allTodos, error } = await supabase
      .from('todos')
      .select('*')
      .eq('deleted', false)
      .eq('completed', false)

    if (error) throw error

    console.log(`전체 미완료 투두: ${allTodos.length}개\n`)

    // 오늘 이전 날짜에 생성된 미완료 투두 중, 오늘 날짜가 visible_dates에 없는 것만 필터링
    const todosToCarryOver = allTodos.filter(todo => {
      // created_at 날짜가 오늘 이전인지 확인
      const createdDate = new Date(todo.created_at)
      const createdDateStr = formatDateForDB(createdDate)

      if (createdDateStr >= todayStr) {
        console.log(`❌ 제외 (오늘 이후 생성): ${todo.text} (created: ${createdDateStr})`)
        return false // 오늘 생성된 투두는 이월 대상이 아님
      }

      // visible_dates에 오늘 날짜가 이미 있으면 제외
      const visibleDates = todo.visible_dates || []
      if (visibleDates.includes(todayStr)) {
        console.log(`❌ 제외 (이미 오늘에 표시됨): ${todo.text}`)
        return false
      }

      // hidden_dates에 오늘 날짜가 있으면 제외 (숨김 처리된 경우)
      const hiddenDates = todo.hidden_dates || []
      if (hiddenDates.includes(todayStr)) {
        console.log(`❌ 제외 (오늘 숨김 처리됨): ${todo.text}`)
        return false
      }

      console.log(`✅ 이월 대상: ${todo.text} (created: ${createdDateStr})`)
      return true
    })

    console.log(`\n이월 대상 투두: ${todosToCarryOver.length}개\n`)

    // 이월 대상 투두의 visible_dates에 오늘 날짜 추가
    for (const todo of todosToCarryOver) {
      const updatedVisibleDates = [...(todo.visible_dates || []), todayStr]

      console.log(`이월 중: ${todo.text}`)
      console.log(`  기존 visible_dates: ${JSON.stringify(todo.visible_dates)}`)
      console.log(`  새로운 visible_dates: ${JSON.stringify(updatedVisibleDates)}`)

      const { error: updateError } = await supabase
        .from('todos')
        .update({ visible_dates: updatedVisibleDates })
        .eq('id', todo.id)

      if (updateError) {
        console.error(`  ❌ 이월 실패: ${updateError.message}`)
      } else {
        console.log(`  ✅ 이월 완료`)
      }
    }

    console.log('\n=== 이월 작업 완료 ===')
  } catch (error) {
    console.error('오류:', error.message)
  }
}

testCarryOver()
