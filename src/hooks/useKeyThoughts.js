import { useState, useRef } from 'react'
import { supabase } from '../supabaseClient'

/**
 * 주요 생각정리 관리 커스텀 훅
 * - 블록 기반 메모 (Notion 스타일)
 * - 버전 히스토리 관리
 * - 자동 저장 및 복구
 */
export function useKeyThoughts(session) {
  const [keyThoughtsBlocks, setKeyThoughtsBlocks] = useState([
    { id: Date.now() + Math.random(), type: 'toggle', content: '', children: [], isOpen: true }
  ])
  const [isSavingKeyThoughts, setIsSavingKeyThoughts] = useState(false)
  const lastSavedKeyThoughtsRef = useRef(null)
  const [focusedBlockId, setFocusedBlockId] = useState(null)
  const [keyThoughtsHistory, setKeyThoughtsHistory] = useState([])
  const [showKeyThoughtsHistory, setShowKeyThoughtsHistory] = useState(false)

  // 블록 데이터 정규화 (children이 항상 배열이 되도록 보장)
  const normalizeBlocks = (blocks) => {
    if (!Array.isArray(blocks)) return []
    return blocks.map(block => ({
      ...block,
      children: Array.isArray(block.children) ? normalizeBlocks(block.children) : []
    }))
  }

  // 주요 생각정리 불러오기
  const fetchKeyThoughtsContent = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('setting_key', 'key_thoughts_blocks')
        .maybeSingle()

      if (error) {
        console.error('주요 생각정리 불러오기 오류:', error.message)
        return
      }

      if (data && data.setting_value) {
        const blocks = JSON.parse(data.setting_value)
        const normalized = normalizeBlocks(blocks)
        setKeyThoughtsBlocks(normalized)
        lastSavedKeyThoughtsRef.current = JSON.parse(JSON.stringify(normalized))
      } else {
        // DB에 없으면 localStorage에서 불러오기
        const saved = localStorage.getItem('keyThoughtsBlocks')
        if (saved) {
          const blocks = JSON.parse(saved)
          const normalized = normalizeBlocks(blocks)
          setKeyThoughtsBlocks(normalized)
          lastSavedKeyThoughtsRef.current = JSON.parse(JSON.stringify(normalized))
        }
      }
    } catch (error) {
      console.error('주요 생각정리 불러오기 오류:', error.message)
    }
  }

  // 주요 생각정리 저장
  const handleSaveKeyThoughts = async () => {
    if (!session?.user?.id) return

    try {
      localStorage.setItem('keyThoughtsBlocks', JSON.stringify(keyThoughtsBlocks))

      const { data: existing, error: selectError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('setting_key', 'key_thoughts_blocks')
        .maybeSingle()

      if (selectError) {
        console.error('주요 생각정리 조회 오류:', selectError.message)
        return
      }

      if (existing) {
        await supabase
          .from('user_settings')
          .update({ setting_value: JSON.stringify(keyThoughtsBlocks) })
          .eq('setting_key', 'key_thoughts_blocks')
      } else {
        await supabase
          .from('user_settings')
          .insert([{
            setting_key: 'key_thoughts_blocks',
            setting_value: JSON.stringify(keyThoughtsBlocks),
            user_id: session.user.id
          }])
      }

      // 버전 히스토리 저장
      await saveKeyThoughtsVersion(keyThoughtsBlocks)
    } catch (error) {
      console.error('주요 생각정리 저장 오류:', error.message)
    }
  }

  // 큰 변경 감지 (블록 개수, 타입, 순서, 레벨, 또는 20자 이상 텍스트 변경)
  const hasSignificantChange = (oldBlocks, newBlocks) => {
    if (!oldBlocks || oldBlocks.length === 0) return true
    if (oldBlocks.length !== newBlocks.length) return true

    const compareBlocks = (oldList, newList) => {
      for (let i = 0; i < oldList.length; i++) {
        const oldBlock = oldList[i]
        const newBlock = newList[i]

        if (oldBlock.type !== newBlock.type) return true

        const oldChildCount = oldBlock.children ? oldBlock.children.length : 0
        const newChildCount = newBlock.children ? newBlock.children.length : 0
        if (oldChildCount !== newChildCount) return true

        const oldContent = oldBlock.content || ''
        const newContent = newBlock.content || ''
        if (Math.abs(oldContent.length - newContent.length) >= 20) return true

        if (newChildCount > 0) {
          if (compareBlocks(oldBlock.children, newBlock.children)) return true
        }
      }
      return false
    }

    return compareBlocks(oldBlocks, newBlocks)
  }

  // 30일 이상된 히스토리 자동 삭제
  const cleanupOldHistory = async () => {
    try {
      const lastCleanup = localStorage.getItem('lastHistoryCleanup')
      const today = new Date().toDateString()

      if (lastCleanup === today) {
        return
      }

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { error } = await supabase
        .from('key_thoughts_history')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())

      if (error) {
        console.error('오래된 히스토리 삭제 오류:', error.message)
      } else {
        localStorage.setItem('lastHistoryCleanup', today)
        console.log('오래된 히스토리 정리 완료')
      }
    } catch (error) {
      console.error('오래된 히스토리 삭제 오류:', error.message)
    }
  }

  // 버전 히스토리 저장 (큰 변경이 있을 때만)
  const saveKeyThoughtsVersion = async (blocks) => {
    if (!session?.user?.id) return

    try {
      if (!hasSignificantChange(lastSavedKeyThoughtsRef.current, blocks)) {
        return
      }

      const { error } = await supabase
        .from('key_thoughts_history')
        .insert([{
          content: blocks,
          description: '자동 저장',
          user_id: session.user.id
        }])

      if (error) {
        console.error('버전 히스토리 저장 오류:', error.message)
      } else {
        lastSavedKeyThoughtsRef.current = JSON.parse(JSON.stringify(blocks))
      }
    } catch (error) {
      console.error('버전 히스토리 저장 오류:', error.message)
    }
  }

  // 버전 히스토리 불러오기
  const fetchKeyThoughtsHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('key_thoughts_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('버전 히스토리 불러오기 오류:', error.message)
        return
      }

      setKeyThoughtsHistory(data || [])
    } catch (error) {
      console.error('버전 히스토리 불러오기 오류:', error.message)
    }
  }

  // 특정 버전으로 복구
  const restoreKeyThoughtsVersion = async (versionId) => {
    try {
      const version = keyThoughtsHistory.find(v => v.id === versionId)
      if (!version) {
        alert('해당 버전을 찾을 수 없습니다.')
        return
      }

      if (!window.confirm('이 버전으로 복구하시겠습니까? 현재 내용은 새 버전으로 저장됩니다.')) {
        return
      }

      const restoredBlocks = normalizeBlocks(version.content)
      setKeyThoughtsBlocks(restoredBlocks)
      lastSavedKeyThoughtsRef.current = JSON.parse(JSON.stringify(restoredBlocks))
      await handleSaveKeyThoughts()

      alert('복구되었습니다!')
      setShowKeyThoughtsHistory(false)
    } catch (error) {
      console.error('버전 복구 오류:', error.message)
    }
  }

  return {
    keyThoughtsBlocks,
    setKeyThoughtsBlocks,
    isSavingKeyThoughts,
    setIsSavingKeyThoughts,
    lastSavedKeyThoughtsRef,
    focusedBlockId,
    setFocusedBlockId,
    keyThoughtsHistory,
    setKeyThoughtsHistory,
    showKeyThoughtsHistory,
    setShowKeyThoughtsHistory,
    normalizeBlocks,
    fetchKeyThoughtsContent,
    handleSaveKeyThoughts,
    cleanupOldHistory,
    fetchKeyThoughtsHistory,
    restoreKeyThoughtsVersion,
  }
}
