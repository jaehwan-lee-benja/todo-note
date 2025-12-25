/**
 * 주요 생각정리 마이그레이션 검증 스크립트
 *
 * 사용법:
 *   node validate-migration.js
 *
 * 기능:
 *   1. 모든 사용자의 마이그레이션 결과 조회
 *   2. 원본 JSON과 마이그레이션된 블럭 수 비교
 *   3. 성공/실패 통계 출력
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// .env 파일 로드
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 오류: VITE_SUPABASE_URL 또는 VITE_SUPABASE_ANON_KEY가 .env 파일에 설정되지 않았습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * 재귀적으로 JSON 블럭 개수 세기
 */
function countBlocksRecursive(blocks) {
  if (!Array.isArray(blocks)) {
    return 0
  }

  let count = 0
  for (const block of blocks) {
    count += 1
    if (Array.isArray(block.children) && block.children.length > 0) {
      count += countBlocksRecursive(block.children)
    }
  }
  return count
}

/**
 * 최상위 블럭 개수 세기
 */
function countRootBlocks(blocks) {
  return Array.isArray(blocks) ? blocks.length : 0
}

/**
 * 메인 검증 함수
 */
async function validateMigration() {
  console.log('🔍 마이그레이션 검증 시작...\n')

  try {
    // 1. user_settings에서 모든 key_thoughts_blocks 조회
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('user_id, setting_value')
      .eq('setting_key', 'key_thoughts_blocks')

    if (settingsError) {
      console.error('❌ user_settings 조회 오류:', settingsError.message)
      process.exit(1)
    }

    console.log(`📊 총 ${userSettings.length}명의 사용자 발견\n`)

    let successCount = 0
    let failCount = 0
    const results = []

    // 2. 각 사용자별로 검증
    for (const setting of userSettings) {
      const userId = setting.user_id
      let originalBlocks

      try {
        originalBlocks = JSON.parse(setting.setting_value)
      } catch (e) {
        console.log(`❌ 사용자 ${userId}: JSON 파싱 실패`)
        failCount++
        results.push({
          userId,
          success: false,
          error: 'JSON 파싱 실패'
        })
        continue
      }

      // 원본 블럭 수 계산
      const originalCount = countBlocksRecursive(originalBlocks)
      const originalRootCount = countRootBlocks(originalBlocks)

      // 마이그레이션된 블럭 수 조회
      const { data: migratedBlocks, error: blocksError } = await supabase
        .from('key_thought_blocks')
        .select('block_id, parent_id')
        .eq('user_id', userId)

      if (blocksError) {
        console.log(`❌ 사용자 ${userId}: key_thought_blocks 조회 오류 - ${blocksError.message}`)
        failCount++
        results.push({
          userId,
          success: false,
          error: blocksError.message
        })
        continue
      }

      const migratedCount = migratedBlocks.length
      const migratedRootCount = migratedBlocks.filter(b => b.parent_id === null).length

      // 비교
      const blockCountMatch = originalCount === migratedCount
      const rootCountMatch = originalRootCount === migratedRootCount
      const success = blockCountMatch && rootCountMatch

      if (success) {
        console.log(`✅ 사용자 ${userId.substring(0, 8)}...: 블럭=${migratedCount}, 루트=${migratedRootCount}`)
        successCount++
        results.push({
          userId,
          success: true,
          originalCount,
          migratedCount,
          originalRootCount,
          migratedRootCount
        })
      } else {
        console.log(`❌ 사용자 ${userId.substring(0, 8)}...: 불일치!`)
        console.log(`   - 블럭 수: 원본=${originalCount}, 마이그레이션=${migratedCount} ${blockCountMatch ? '✓' : '✗'}`)
        console.log(`   - 루트 블럭: 원본=${originalRootCount}, 마이그레이션=${migratedRootCount} ${rootCountMatch ? '✓' : '✗'}`)
        failCount++
        results.push({
          userId,
          success: false,
          originalCount,
          migratedCount,
          originalRootCount,
          migratedRootCount,
          blockCountMatch,
          rootCountMatch
        })
      }
    }

    // 3. 결과 요약
    console.log('\n' + '='.repeat(50))
    console.log(`📊 검증 결과 요약`)
    console.log('='.repeat(50))
    console.log(`총 사용자: ${userSettings.length}`)
    console.log(`✅ 성공: ${successCount} (${(successCount / userSettings.length * 100).toFixed(1)}%)`)
    console.log(`❌ 실패: ${failCount} (${(failCount / userSettings.length * 100).toFixed(1)}%)`)
    console.log('='.repeat(50))

    // 4. 실패한 사용자 상세 정보
    if (failCount > 0) {
      console.log('\n⚠️  실패한 사용자 상세:')
      results
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`\n사용자 ID: ${r.userId}`)
          if (r.error) {
            console.log(`  오류: ${r.error}`)
          } else {
            console.log(`  원본 블럭: ${r.originalCount}, 마이그레이션: ${r.migratedCount}`)
            console.log(`  원본 루트: ${r.originalRootCount}, 마이그레이션: ${r.migratedRootCount}`)
          }
        })
    }

    // 5. 종료 코드
    process.exit(failCount > 0 ? 1 : 0)

  } catch (error) {
    console.error('❌ 예기치 않은 오류:', error.message)
    process.exit(1)
  }
}

// 실행
validateMigration()
