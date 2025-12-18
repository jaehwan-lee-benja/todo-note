import { useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { supabase } from '../supabaseClient'

/**
 * 섹션 순서 관리 커스텀 훅
 * - 섹션 순서 불러오기/저장하기
 * - 섹션 이동 (왼쪽/오른쪽)
 * - 드래그 앤 드롭으로 섹션 순서 변경
 * - 순서 수정 모드 토글
 */
export function useSectionOrder(session) {
  const [sectionOrder, setSectionOrder] = useState(['memo', 'routine', 'normal', 'key-thoughts'])
  const [isReorderMode, setIsReorderMode] = useState(false)

  // 섹션 순서 불러오기
  const fetchSectionOrder = async () => {
    // 로그인하지 않은 상태에서는 초기값 사용 (localStorage 제거)
    if (!session?.user?.id) {
      return
    }

    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('setting_key', 'section_order')
        .maybeSingle()

      if (error) {
        console.error('섹션 순서 불러오기 오류:', error.message)
        return
      }

      if (data && data.setting_value) {
        const order = JSON.parse(data.setting_value)
        setSectionOrder(order)
      }
      // DB에 데이터 없으면 초기값 사용 (localStorage fallback 제거)
    } catch (error) {
      console.error('섹션 순서 불러오기 오류:', error.message)
    }
  }

  // 섹션 순서 저장하기
  const saveSectionOrder = async (newOrder) => {
    // 로그인하지 않은 경우 state만 업데이트 (저장 안됨, localStorage 제거)
    if (!session?.user?.id) return

    try {
      // Supabase에만 저장
      const { data: existing, error: selectError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('setting_key', 'section_order')
        .maybeSingle()

      if (selectError) {
        console.error('섹션 순서 조회 오류:', selectError.message)
        return
      }

      if (existing) {
        // 업데이트
        await supabase
          .from('user_settings')
          .update({ setting_value: JSON.stringify(newOrder), updated_at: new Date().toISOString() })
          .eq('setting_key', 'section_order')
      } else {
        // 신규 생성
        await supabase
          .from('user_settings')
          .insert([{
            setting_key: 'section_order',
            setting_value: JSON.stringify(newOrder),
            user_id: session.user.id
          }])
      }
    } catch (error) {
      console.error('섹션 순서 저장 오류:', error.message)
    }
  }

  // 섹션 왼쪽으로 이동
  const moveSectionLeft = (sectionId) => {
    setSectionOrder((prev) => {
      const index = prev.indexOf(sectionId)
      if (index <= 0) return prev
      const newOrder = [...prev]
      ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
      saveSectionOrder(newOrder)
      return newOrder
    })
  }

  // 섹션 오른쪽으로 이동
  const moveSectionRight = (sectionId) => {
    setSectionOrder((prev) => {
      const index = prev.indexOf(sectionId)
      if (index === -1 || index >= prev.length - 1) return prev
      const newOrder = [...prev]
      ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
      saveSectionOrder(newOrder)
      return newOrder
    })
  }

  // 섹션 드래그 앤 드롭 종료
  const handleSectionDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        saveSectionOrder(newOrder)
        return newOrder
      })
    }
  }

  // 섹션 외부 더블클릭으로 순서 수정 모드 종료
  const handleSectionsContainerDoubleClick = (e) => {
    // 섹션 외부(빈 공간)를 더블클릭했을 때만 반응
    if (isReorderMode && e.target === e.currentTarget) {
      setIsReorderMode(false)
    }
  }

  return {
    sectionOrder,
    setSectionOrder,
    isReorderMode,
    setIsReorderMode,
    fetchSectionOrder,
    moveSectionLeft,
    moveSectionRight,
    handleSectionDragEnd,
    handleSectionsContainerDoubleClick,
  }
}
