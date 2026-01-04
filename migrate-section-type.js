/**
 * section_type 마이그레이션 및 검증 스크립트
 *
 * 실행 방법:
 * 1. Supabase에서 add-section-type-column.sql 실행
 * 2. node migrate-section-type.js 실행하여 검증
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.')
  console.error('VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 .env 파일에 설정하세요.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function validateMigration() {
  console.log('🔍 section_type 마이그레이션 검증 시작...\n')

  try {
    // 1. 전체 투두 조회
    const { data: allTodos, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .eq('deleted', false)

    if (fetchError) {
      throw fetchError
    }

    console.log(`📊 총 투두 개수: ${allTodos.length}\n`)

    // 2. section_type별 분류
    const stats = {
      routine: 0,
      pending_routine: 0,
      normal: 0,
      custom: 0,
      null: 0,
      mismatch: []
    }

    allTodos.forEach(todo => {
      if (!todo.section_type) {
        stats.null++
        return
      }

      stats[todo.section_type]++

      // 데이터 일관성 검증
      const validations = {
        routine: todo.routine_id !== null && !todo.is_pending_routine,
        pending_routine: todo.is_pending_routine === true,
        custom: todo.section_id !== null && todo.section_id !== '',
        normal: todo.routine_id === null && !todo.section_id && !todo.is_pending_routine
      }

      if (!validations[todo.section_type]) {
        stats.mismatch.push({
          id: todo.id,
          text: todo.text.substring(0, 30),
          section_type: todo.section_type,
          routine_id: todo.routine_id,
          section_id: todo.section_id,
          is_pending_routine: todo.is_pending_routine
        })
      }
    })

    // 3. 결과 출력
    console.log('📈 section_type 분포:')
    console.log(`  - routine: ${stats.routine}개`)
    console.log(`  - pending_routine: ${stats.pending_routine}개`)
    console.log(`  - normal: ${stats.normal}개`)
    console.log(`  - custom: ${stats.custom}개`)
    console.log(`  - NULL: ${stats.null}개`)
    console.log('')

    // 4. 불일치 항목 확인
    if (stats.null > 0) {
      console.warn(`⚠️  section_type이 NULL인 투두가 ${stats.null}개 있습니다.`)
      console.warn('   → add-section-type-column.sql의 UPDATE 쿼리를 다시 실행하세요.\n')
    }

    if (stats.mismatch.length > 0) {
      console.error(`❌ 데이터 불일치가 발견되었습니다! (${stats.mismatch.length}개)`)
      console.error('불일치 항목:')
      stats.mismatch.forEach(item => {
        console.error(`  - ID ${item.id}: "${item.text}"`)
        console.error(`    section_type: ${item.section_type}`)
        console.error(`    routine_id: ${item.routine_id}, section_id: ${item.section_id}, is_pending: ${item.is_pending_routine}\n`)
      })
      return false
    }

    // 5. order_index 연속성 검증
    console.log('🔍 섹션별 order_index 연속성 검증...\n')

    const sections = new Map()

    allTodos.forEach(todo => {
      if (todo.parent_id) return // 서브투두 제외

      const key = `${todo.section_type}_${todo.section_id || 'null'}_${todo.routine_id || 'null'}`
      if (!sections.has(key)) {
        sections.set(key, [])
      }
      sections.get(key).push(todo)
    })

    let hasGaps = false

    sections.forEach((todos, key) => {
      const sorted = todos.sort((a, b) => a.order_index - b.order_index)
      const orderIndexes = sorted.map(t => t.order_index)
      const max = Math.max(...orderIndexes)
      const min = Math.min(...orderIndexes)

      // 연속성 확인
      const expected = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      const missing = expected.filter(n => !orderIndexes.includes(n))

      if (missing.length > 0 || max !== todos.length) {
        hasGaps = true
        console.warn(`⚠️  섹션 [${key}]:`)
        console.warn(`    투두 개수: ${todos.length}`)
        console.warn(`    order_index 범위: ${min} ~ ${max}`)
        console.warn(`    불연속 구간: ${missing.join(', ') || '없음'}`)
        console.warn(`    권장: 1 ~ ${todos.length}\n`)
      }
    })

    if (!hasGaps) {
      console.log('✅ 모든 섹션의 order_index가 연속적입니다.\n')
    }

    // 6. 최종 결과
    if (stats.null === 0 && stats.mismatch.length === 0) {
      console.log('✅ 마이그레이션이 성공적으로 완료되었습니다!')
      return true
    }

    return false

  } catch (error) {
    console.error('❌ 오류 발생:', error.message)
    return false
  }
}

async function normalizeOrderIndexes() {
  console.log('\n🔧 섹션별 order_index 정규화 시작...\n')

  try {
    const { data: allTodos, error: fetchError } = await supabase
      .from('todos')
      .select('*')
      .eq('deleted', false)

    if (fetchError) {
      throw fetchError
    }

    // 섹션별로 그룹화
    const sections = new Map()

    allTodos.forEach(todo => {
      if (todo.parent_id) return // 서브투두 제외

      const key = `${todo.section_type}_${todo.section_id || 'null'}_${todo.routine_id || 'null'}`
      if (!sections.has(key)) {
        sections.set(key, [])
      }
      sections.get(key).push(todo)
    })

    // 각 섹션별로 정규화
    let totalUpdates = 0

    for (const [key, todos] of sections.entries()) {
      const sorted = todos.sort((a, b) => a.order_index - b.order_index)

      for (let i = 0; i < sorted.length; i++) {
        const newOrderIndex = i + 1
        if (sorted[i].order_index !== newOrderIndex) {
          const { error: updateError } = await supabase
            .from('todos')
            .update({ order_index: newOrderIndex })
            .eq('id', sorted[i].id)

          if (updateError) {
            console.error(`❌ ID ${sorted[i].id} 업데이트 실패:`, updateError.message)
          } else {
            totalUpdates++
          }
        }
      }
    }

    console.log(`✅ ${totalUpdates}개의 투두 order_index가 정규화되었습니다.\n`)

  } catch (error) {
    console.error('❌ 정규화 오류:', error.message)
  }
}

// 실행
async function main() {
  const isValid = await validateMigration()

  if (!isValid) {
    console.log('\n마이그레이션 검증에 실패했습니다.')
    process.exit(1)
  }

  // order_index 정규화 여부 확인
  const readline = await import('readline')
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  rl.question('\n섹션별 order_index를 정규화하시겠습니까? (y/n): ', async (answer) => {
    if (answer.toLowerCase() === 'y') {
      await normalizeOrderIndexes()
      await validateMigration() // 재검증
    }
    rl.close()
    process.exit(0)
  })
}

main()
