import { useState, useCallback } from 'react'
import { arrayMove } from '@dnd-kit/sortable'
import { supabase } from '../supabaseClient'
import { DEFAULT_SECTIONS } from '../utils/constants'

/**
 * 섹션 관리 커스텀 훅
 * - sections 테이블과 연동
 * - 섹션 CRUD (생성, 조회, 수정, 삭제)
 * - 기본 섹션 설정/변경
 * - 섹션 순서 변경
 * - 새 사용자 섹션 초기화
 */

export function useSections(session) {
  const [sections, setSections] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isReorderMode, setIsReorderMode] = useState(false)

  // 섹션 목록 조회
  const fetchSections = useCallback(async () => {
    if (!session?.user?.id) return

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('deleted', false)
        .order('order_index', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        setSections(data)
      } else {
        // 섹션이 없으면 기본 섹션 초기화
        await initializeDefaultSections()
      }
    } catch (error) {
      console.error('섹션 조회 오류:', error)
    } finally {
      setIsLoading(false)
    }
  }, [session?.user?.id])

  // 기본 섹션 초기화 (새 사용자)
  const initializeDefaultSections = async () => {
    if (!session?.user?.id) return

    try {
      const sectionsToCreate = DEFAULT_SECTIONS.map((s, index) => ({
        user_id: session.user.id,
        name: s.name,
        icon: s.icon,
        is_system: s.is_system,
        is_default: s.is_default,
        order_index: index,
      }))

      const { data, error } = await supabase
        .from('sections')
        .insert(sectionsToCreate)
        .select()

      if (error) throw error

      if (data) {
        setSections(data)
      }
    } catch (error) {
      console.error('기본 섹션 초기화 오류:', error)
    }
  }

  // 섹션 추가
  const addSection = async (name, icon = '📋') => {
    if (!session?.user?.id) return null

    try {
      const maxOrderIndex = sections.length > 0
        ? Math.max(...sections.map(s => s.order_index))
        : -1

      const { data, error } = await supabase
        .from('sections')
        .insert([{
          user_id: session.user.id,
          name,
          icon,
          is_system: false,
          is_default: false,
          order_index: maxOrderIndex + 1,
        }])
        .select()
        .single()

      if (error) throw error

      if (data) {
        setSections(prev => [...prev, data])
        return data
      }
    } catch (error) {
      console.error('섹션 추가 오류:', error)
    }
    return null
  }

  // 섹션 수정 (이름, 아이콘)
  const updateSection = async (sectionId, updates) => {
    if (!session?.user?.id) return false

    try {
      const { error } = await supabase
        .from('sections')
        .update(updates)
        .eq('id', sectionId)
        .eq('user_id', session.user.id)

      if (error) throw error

      setSections(prev =>
        prev.map(s => s.id === sectionId ? { ...s, ...updates } : s)
      )
      return true
    } catch (error) {
      console.error('섹션 수정 오류:', error)
      return false
    }
  }

  // 섹션 삭제 (시스템 섹션은 삭제 불가)
  const deleteSection = async (sectionId) => {
    if (!session?.user?.id) return false

    const section = sections.find(s => s.id === sectionId)
    if (!section || section.is_system) {
      console.warn('시스템 섹션은 삭제할 수 없습니다.')
      return false
    }

    try {
      // soft delete
      const { error } = await supabase
        .from('sections')
        .update({ deleted: true })
        .eq('id', sectionId)
        .eq('user_id', session.user.id)

      if (error) throw error

      setSections(prev => prev.filter(s => s.id !== sectionId))
      return true
    } catch (error) {
      console.error('섹션 삭제 오류:', error)
      return false
    }
  }

  // 기본 섹션 설정
  const setDefaultSection = async (sectionId) => {
    if (!session?.user?.id) return false

    const section = sections.find(s => s.id === sectionId)
    // 타임라인은 기본 섹션으로 설정 불가
    if (!section || section.name === '타임라인') {
      console.warn('타임라인은 기본 섹션으로 설정할 수 없습니다.')
      return false
    }

    try {
      // 기존 기본 섹션 해제
      const currentDefault = sections.find(s => s.is_default)
      if (currentDefault) {
        await supabase
          .from('sections')
          .update({ is_default: false })
          .eq('id', currentDefault.id)
          .eq('user_id', session.user.id)
      }

      // 새 기본 섹션 설정
      const { error } = await supabase
        .from('sections')
        .update({ is_default: true })
        .eq('id', sectionId)
        .eq('user_id', session.user.id)

      if (error) throw error

      setSections(prev =>
        prev.map(s => ({
          ...s,
          is_default: s.id === sectionId
        }))
      )
      return true
    } catch (error) {
      console.error('기본 섹션 설정 오류:', error)
      return false
    }
  }

  // 기본 섹션 가져오기
  const getDefaultSection = useCallback(() => {
    return sections.find(s => s.is_default) || sections.find(s => s.name === '일반')
  }, [sections])

  // 타임라인 섹션 가져오기
  const getTimelineSection = useCallback(() => {
    return sections.find(s => s.name === '타임라인')
  }, [sections])

  // 섹션 아이콘 변경
  const changeSectionIcon = async (sectionId, newIcon) => {
    return updateSection(sectionId, { icon: newIcon })
  }

  // 섹션 이름 변경
  const changeSectionName = async (sectionId, newName) => {
    const section = sections.find(s => s.id === sectionId)
    if (section?.is_system) {
      console.warn('시스템 섹션의 이름은 변경할 수 없습니다.')
      return false
    }
    return updateSection(sectionId, { name: newName })
  }

  // 섹션 순서 저장
  const saveSectionOrder = async (orderedSections) => {
    if (!session?.user?.id) return false

    try {
      // 각 섹션의 order_index 업데이트
      const updates = orderedSections.map((s, index) => ({
        id: s.id,
        order_index: index,
      }))

      for (const update of updates) {
        await supabase
          .from('sections')
          .update({ order_index: update.order_index })
          .eq('id', update.id)
          .eq('user_id', session.user.id)
      }

      return true
    } catch (error) {
      console.error('섹션 순서 저장 오류:', error)
      return false
    }
  }

  // 섹션 왼쪽으로 이동
  const moveSectionLeft = (sectionId) => {
    setSections((prev) => {
      const index = prev.findIndex(s => s.id === sectionId)
      if (index <= 0) return prev
      const newOrder = arrayMove(prev, index, index - 1)
      saveSectionOrder(newOrder)
      return newOrder
    })
  }

  // 섹션 오른쪽으로 이동
  const moveSectionRight = (sectionId) => {
    setSections((prev) => {
      const index = prev.findIndex(s => s.id === sectionId)
      if (index === -1 || index >= prev.length - 1) return prev
      const newOrder = arrayMove(prev, index, index + 1)
      saveSectionOrder(newOrder)
      return newOrder
    })
  }

  // 섹션 드래그 앤 드롭 종료
  const handleSectionDragEnd = (event) => {
    const { active, over } = event

    if (!isReorderMode) return

    // active.id가 섹션 ID가 아니면 무시
    const activeSection = sections.find(s => s.id === active.id)
    if (!activeSection) return

    if (!over) return

    if (active.id !== over?.id) {
      setSections((items) => {
        const oldIndex = items.findIndex(s => s.id === active.id)
        const newIndex = items.findIndex(s => s.id === over.id)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        saveSectionOrder(newOrder)
        return newOrder
      })
    }
  }

  // 섹션 외부 더블클릭으로 순서 수정 모드 종료
  const handleSectionsContainerDoubleClick = (e) => {
    if (isReorderMode && e.target === e.currentTarget) {
      setIsReorderMode(false)
    }
  }

  // 섹션 ID로 섹션 정보 가져오기
  const getSectionById = useCallback((sectionId) => {
    return sections.find(s => s.id === sectionId)
  }, [sections])

  // 섹션 아이콘 가져오기
  const getSectionIcon = useCallback((sectionId) => {
    const section = sections.find(s => s.id === sectionId)
    return section?.icon || '📋'
  }, [sections])

  // 섹션 순서 배열 (ID 배열로 반환, 호환성 유지)
  const sectionOrder = sections.map(s => s.id)

  return {
    sections,
    setSections,
    sectionOrder,
    isLoading,
    isReorderMode,
    setIsReorderMode,
    fetchSections,
    addSection,
    updateSection,
    deleteSection,
    setDefaultSection,
    getDefaultSection,
    getTimelineSection,
    getSectionById,
    getSectionIcon,
    changeSectionIcon,
    changeSectionName,
    moveSectionLeft,
    moveSectionRight,
    handleSectionDragEnd,
    handleSectionsContainerDoubleClick,
  }
}
