import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'

/**
 * 메모 관리 커스텀 훅
 * - 메모 내용 불러오기
 * - 자동 저장 (debounce)
 * - 항상 편집 가능 (노션 스타일)
 */
export function useMemo(session) {
  const [memoContent, setMemoContent] = useState('')
  const [isSavingMemo, setIsSavingMemo] = useState(false)
  const [lastSavedContent, setLastSavedContent] = useState('')
  const memoTextareaRef = useRef(null)
  const saveTimeoutRef = useRef(null)

  // 메모 내용 불러오기
  const fetchMemoContent = async () => {
    try {
      const { data, error } = await supabase
        .from('spec_memos')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      const content = data && data.length > 0 ? data[0].content : ''
      setMemoContent(content)
      setLastSavedContent(content)
    } catch (error) {
      console.error('Error fetching memo:', error.message)
      setMemoContent('')
      setLastSavedContent('')
    }
  }

  // 메모 저장 함수
  const saveMemo = useCallback(async (content) => {
    if (content === lastSavedContent) return

    try {
      setIsSavingMemo(true)

      const { data: existingMemo } = await supabase
        .from('spec_memos')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

      if (existingMemo && existingMemo.length > 0) {
        await supabase
          .from('spec_memos')
          .update({ content, updated_at: new Date().toISOString() })
          .eq('id', existingMemo[0].id)
      } else {
        await supabase
          .from('spec_memos')
          .insert([{ content, user_id: session?.user?.id }])
      }

      setLastSavedContent(content)
    } catch (error) {
      console.error('Error saving memo:', error.message)
    } finally {
      setIsSavingMemo(false)
    }
  }, [session, lastSavedContent])

  // 자동 저장 (debounce 1초)
  useEffect(() => {
    if (memoContent === lastSavedContent) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveMemo(memoContent)
    }, 1000)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [memoContent, saveMemo, lastSavedContent])

  // 컴포넌트 언마운트 시 저장되지 않은 내용 저장
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      // 저장되지 않은 변경사항이 있으면 즉시 저장
      if (memoContent !== lastSavedContent) {
        saveMemo(memoContent)
      }
    }
  }, [])

  return {
    memoContent,
    setMemoContent,
    isSavingMemo,
    memoTextareaRef,
    fetchMemoContent,
  }
}
