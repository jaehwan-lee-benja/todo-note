import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase URL 또는 Key가 .env 파일에 설정되지 않았습니다.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupHistoryTable() {
  try {
    console.log('📋 주요 생각정리 버전 히스토리 테이블을 생성합니다...')

    // SQL 파일 읽기
    const sql = fs.readFileSync('./create-key-thoughts-history-table.sql', 'utf8')

    // SQL 실행 (Supabase의 RPC를 통해 실행하거나, 직접 대시보드에서 실행해야 함)
    console.log('\n⚠️  다음 SQL을 Supabase 대시보드의 SQL Editor에서 실행해주세요:')
    console.log('━'.repeat(80))
    console.log(sql)
    console.log('━'.repeat(80))
    console.log('\n📍 Supabase Dashboard → SQL Editor에서 위 SQL을 복사하여 실행하세요.')
    console.log('   URL:', supabaseUrl.replace('.supabase.co', '.supabase.co/project/_/sql/new'))

  } catch (error) {
    console.error('❌ 오류:', error.message)
  }
}

setupHistoryTable()
