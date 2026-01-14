import { useState } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { settingsService, SETTING_KEYS, DEFAULT_SECTION_ICONS, SECTION_EMOJI_OPTIONS } from '../services/settingsService'

/**
 * 섹션 순서 관리 커스텀 훅
 * - 섹션 순서 불러오기/저장하기
 * - 섹션 이동 (왼쪽/오른쪽)
 * - 드래그 앤 드롭으로 섹션 순서 변경
 * - 순서 수정 모드 토글
 * - 섹션 아이콘 관리
 */
// 기본 섹션 목록 (새 섹션 추가 시 여기에 추가)
const DEFAULT_SECTIONS = ['timeline', 'routine', 'normal']

export function useSectionOrder(session) {
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTIONS)
  const [sectionIcons, setSectionIcons] = useState(DEFAULT_SECTION_ICONS)
  const [isReorderMode, setIsReorderMode] = useState(false)

  // 섹션 순서 및 아이콘 불러오기
  const fetchSectionOrder = async () => {
    if (!session?.user?.id) return

    const order = await settingsService.get(SETTING_KEYS.SECTION_ORDER)
    if (order) {
      // 새로 추가된 섹션이 있으면 맨 앞에 추가
      const newSections = DEFAULT_SECTIONS.filter(s => !order.includes(s))
      if (newSections.length > 0) {
        const updatedOrder = [...newSections, ...order]
        setSectionOrder(updatedOrder)
        saveSectionOrder(updatedOrder)
      } else {
        setSectionOrder(order)
      }
    }

    // 아이콘 불러오기
    const icons = await settingsService.get(SETTING_KEYS.SECTION_ICONS)
    if (icons) {
      setSectionIcons({ ...DEFAULT_SECTION_ICONS, ...icons })
    }
  }

  // 섹션 순서 저장하기
  const saveSectionOrder = async (newOrder) => {
    if (!session?.user?.id) return
    await settingsService.set(SETTING_KEYS.SECTION_ORDER, newOrder, session.user.id)
  }

  // 섹션 아이콘 변경하기
  const changeSectionIcon = async (sectionId, newIcon) => {
    if (!session?.user?.id) return

    const updatedIcons = { ...sectionIcons, [sectionId]: newIcon }
    setSectionIcons(updatedIcons)
    await settingsService.set(SETTING_KEYS.SECTION_ICONS, updatedIcons, session.user.id)
  }

  // 랜덤 아이콘 선택 (새 섹션 생성 시 사용)
  const getRandomIcon = () => {
    const randomIndex = Math.floor(Math.random() * SECTION_EMOJI_OPTIONS.length)
    return SECTION_EMOJI_OPTIONS[randomIndex]
  }

  // 섹션 아이콘 가져오기
  const getSectionIcon = (sectionId) => {
    return sectionIcons[sectionId] || DEFAULT_SECTION_ICONS[sectionId] || '📝'
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

    // 섹션 이동 모드가 아니면 아무 것도 하지 않음
    if (!isReorderMode) return

    // active.id가 섹션 ID가 아니면 (TODO ID인 경우) 무시
    if (!sectionOrder.includes(active.id)) return

    if (!over) return

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
    sectionIcons,
    isReorderMode,
    setIsReorderMode,
    fetchSectionOrder,
    saveSectionOrder,
    changeSectionIcon,
    getSectionIcon,
    getRandomIcon,
    moveSectionLeft,
    moveSectionRight,
    handleSectionDragEnd,
    handleSectionsContainerDoubleClick,
  }
}
