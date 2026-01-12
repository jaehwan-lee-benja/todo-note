import { supabase } from '../supabaseClient'

/**
 * 사용자 설정 서비스
 * user_settings 테이블의 CRUD 작업을 추상화
 */
export const settingsService = {
  /**
   * 설정 값 가져오기
   * @param {string} key - 설정 키
   * @param {any} defaultValue - 기본값 (설정이 없을 경우)
   * @returns {Promise<any>} 설정 값 또는 기본값
   */
  async get(key, defaultValue = null) {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('setting_key', key)
        .maybeSingle()

      if (error) {
        console.error(`설정 불러오기 오류 [${key}]:`, error.message)
        return defaultValue
      }

      if (data && data.setting_value) {
        return JSON.parse(data.setting_value)
      }

      return defaultValue
    } catch (error) {
      console.error(`설정 불러오기 오류 [${key}]:`, error.message)
      return defaultValue
    }
  },

  /**
   * 설정 값 저장하기 (upsert)
   * @param {string} key - 설정 키
   * @param {any} value - 설정 값 (JSON 직렬화됨)
   * @param {string} userId - 사용자 ID
   * @returns {Promise<boolean>} 성공 여부
   */
  async set(key, value, userId) {
    if (!userId) {
      console.warn(`설정 저장 실패 [${key}]: 사용자 ID 없음`)
      return false
    }

    try {
      const { data: existing, error: selectError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('setting_key', key)
        .maybeSingle()

      if (selectError) {
        console.error(`설정 조회 오류 [${key}]:`, selectError.message)
        return false
      }

      const jsonValue = JSON.stringify(value)

      if (existing) {
        const { error: updateError } = await supabase
          .from('user_settings')
          .update({
            setting_value: jsonValue,
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', key)

        if (updateError) {
          console.error(`설정 업데이트 오류 [${key}]:`, updateError.message)
          return false
        }
      } else {
        const { error: insertError } = await supabase
          .from('user_settings')
          .insert([{
            setting_key: key,
            setting_value: jsonValue,
            user_id: userId
          }])

        if (insertError) {
          console.error(`설정 생성 오류 [${key}]:`, insertError.message)
          return false
        }
      }

      return true
    } catch (error) {
      console.error(`설정 저장 오류 [${key}]:`, error.message)
      return false
    }
  },

  /**
   * 설정 삭제하기
   * @param {string} key - 설정 키
   * @returns {Promise<boolean>} 성공 여부
   */
  async remove(key) {
    try {
      const { error } = await supabase
        .from('user_settings')
        .delete()
        .eq('setting_key', key)

      if (error) {
        console.error(`설정 삭제 오류 [${key}]:`, error.message)
        return false
      }

      return true
    } catch (error) {
      console.error(`설정 삭제 오류 [${key}]:`, error.message)
      return false
    }
  }
}

// 설정 키 상수
export const SETTING_KEYS = {
  SECTION_ORDER: 'section_order',
  SECTION_TITLES: 'section_titles',
  CUSTOM_SECTIONS: 'custom_sections',
  HIDDEN_SECTIONS: 'hidden_sections',
}
