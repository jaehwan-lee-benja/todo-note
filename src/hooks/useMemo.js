import { useState, useRef } from 'react'
import { supabase } from '../supabaseClient'

/**
 * 메모 관리 커스텀 훅
 * - 메모 내용 불러오기/저장하기
 * - 인라인 편집 모드
 * - 키보드 단축키 (Cmd+S, Esc)
 */
export function useMemo(session) {
  const [memoContent, setMemoContent] = useState('')
  const [isEditingMemoInline, setIsEditingMemoInline] = useState(false)
  const [isSavingMemo, setIsSavingMemo] = useState(false)
  const [memoOriginalContent, setMemoOriginalContent] = useState('')
  const memoTextareaRef = useRef(null)

  // 메모 내용 불러오기
  const fetchMemoContent = async () => {
    try {
      const { data, error } = await supabase
        .from('spec_memos')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      // DB에 데이터 없으면 빈 문자열 사용 (기본값 제거)
      const content = data && data.length > 0 ? data[0].content : ''
      setMemoContent(content)
      setMemoOriginalContent(content)
    } catch (error) {
      console.error('메모 내용 가져오기 오류:', error.message)
      // 에러 시에도 빈 문자열 사용
      setMemoContent('')
      setMemoOriginalContent('')
    }
  }

  // 인라인 메모 편집 시작
  const handleStartEditMemoInline = () => {
    setIsEditingMemoInline(true)
    setMemoOriginalContent(memoContent)
    // textarea에 포커스
    setTimeout(() => {
      if (memoTextareaRef.current) {
        memoTextareaRef.current.focus()
      }
    }, 0)
  }

  // 인라인 메모 저장
  const handleSaveMemoInline = async () => {
    if (isSavingMemo) return

    try {
      setIsSavingMemo(true)

      // 기존 메모가 있는지 확인
      const { data: existingMemo } = await supabase
        .from('spec_memos')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

      if (existingMemo && existingMemo.length > 0) {
        // 업데이트
        await supabase
          .from('spec_memos')
          .update({ content: memoContent, updated_at: new Date().toISOString() })
          .eq('id', existingMemo[0].id)
      } else {
        // 신규 생성
        await supabase
          .from('spec_memos')
          .insert([{ content: memoContent, user_id: session?.user?.id }])
      }

      setMemoOriginalContent(memoContent)
      setIsEditingMemoInline(false)
    } catch (error) {
      console.error('메모 저장 오류:', error.message)
      alert('메모 저장에 실패했습니다.')
    } finally {
      setIsSavingMemo(false)
    }
  }

  // 인라인 메모 편집 취소
  const handleCancelEditMemoInline = () => {
    setMemoContent(memoOriginalContent)
    setIsEditingMemoInline(false)
  }

  // 메모 키보드 단축키 처리
  const handleMemoKeyDown = (e) => {
    // Cmd/Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSaveMemoInline()
    }
    // Esc to cancel
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEditMemoInline()
    }
  }

  return {
    memoContent,
    setMemoContent,
    isEditingMemoInline,
    setIsEditingMemoInline,
    isSavingMemo,
    memoOriginalContent,
    memoTextareaRef,
    fetchMemoContent,
    handleStartEditMemoInline,
    handleSaveMemoInline,
    handleCancelEditMemoInline,
    handleMemoKeyDown,
  }
}
