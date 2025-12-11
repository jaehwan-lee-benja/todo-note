import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// .env 파일 로드
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTodos() {
  try {
    // 모든 투두 조회
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('deleted', false)

    if (error) throw error

    const date25 = '2025-11-25'
    const date26 = '2025-11-26'

    // 25일에 표시되어야 하는 투두
    const todos25 = data.filter(todo => {
      const isHidden = todo.hidden_dates && Array.isArray(todo.hidden_dates) && todo.hidden_dates.includes(date25)
      if (isHidden) return false

      if (todo.visible_dates && Array.isArray(todo.visible_dates) && todo.visible_dates.length > 0) {
        return todo.visible_dates.includes(date25)
      }

      return todo.date === date25
    })

    // 26일에 표시되어야 하는 투두
    const todos26 = data.filter(todo => {
      const isHidden = todo.hidden_dates && Array.isArray(todo.hidden_dates) && todo.hidden_dates.includes(date26)
      if (isHidden) return false

      if (todo.visible_dates && Array.isArray(todo.visible_dates) && todo.visible_dates.length > 0) {
        return todo.visible_dates.includes(date26)
      }

      return todo.date === date26
    })

    console.log(`\n=== 투두 현황 ===`)
    console.log(`\n2025-11-25 (25일): ${todos25.length}개`)
    console.log('투두 목록:')
    todos25.forEach((todo, idx) => {
      console.log(`  ${idx + 1}. [${todo.completed ? '✓' : ' '}] ${todo.text}`)
      console.log(`      created_at: ${todo.created_at}`)
      console.log(`      visible_dates: ${JSON.stringify(todo.visible_dates)}`)
      console.log(`      hidden_dates: ${JSON.stringify(todo.hidden_dates)}`)
    })

    console.log(`\n2025-11-26 (26일, 오늘): ${todos26.length}개`)
    console.log('투두 목록:')
    todos26.forEach((todo, idx) => {
      console.log(`  ${idx + 1}. [${todo.completed ? '✓' : ' '}] ${todo.text}`)
    })

    console.log('\n')
  } catch (error) {
    console.error('오류:', error.message)
  }
}

checkTodos()
