import { useState } from 'react'
import { formatDateForDB } from '../utils/dateUtils'

export function useDummyData(session, supabase, fetchTodos) {
  const [dummySessions, setDummySessions] = useState([])
  const [showDummyModal, setShowDummyModal] = useState(false)
  const [showDummySQL, setShowDummySQL] = useState(false)

  // 더미 데이터 생성
  const handleCreateDummyData = async () => {
    try {
      const sessionId = `DUMMY-${Date.now()}`
      const today = new Date(2025, 10, 16) // 2025-11-16

      const dummyData = []
      const historyData = []

      // 14일 페이지 (정상 생성)
      const date14 = '2025-11-14'
      dummyData.push(
        { text: `[${sessionId}] 더미: 14일생성-미완료-수정이력있음`, date: date14, completed: false, created_at: '2025-11-14T09:00:00Z', order_index: 1001 },
        { text: `[${sessionId}] 더미: 14일생성-14일완료`, date: date14, completed: true, created_at: '2025-11-14T09:10:00Z', order_index: 1002 },
        { text: `[${sessionId}] 더미: 14일생성-15일완료`, date: date14, completed: true, created_at: '2025-11-14T09:20:00Z', order_index: 1003 },
        { text: `[${sessionId}] 더미: 14일생성-16일완료`, date: date14, completed: true, created_at: '2025-11-14T09:30:00Z', order_index: 1004 }
      )

      // 15일 페이지 (정상 생성)
      const date15 = '2025-11-15'
      dummyData.push(
        { text: `[${sessionId}] 더미: 15일생성-미완료-수정이력있음`, date: date15, completed: false, created_at: '2025-11-15T10:00:00Z', order_index: 1005 },
        { text: `[${sessionId}] 더미: 15일생성-15일완료`, date: date15, completed: true, created_at: '2025-11-15T10:10:00Z', order_index: 1006 },
        { text: `[${sessionId}] 더미: 15일생성-16일완료`, date: date15, completed: true, created_at: '2025-11-15T10:20:00Z', order_index: 1007 }
      )

      // 16일 페이지 (정상 생성)
      const date16 = '2025-11-16'
      dummyData.push(
        { text: `[${sessionId}] 더미: 16일생성-미완료`, date: date16, completed: false, created_at: '2025-11-16T11:00:00Z', order_index: 1008 },
        { text: `[${sessionId}] 더미: 16일생성-16일완료`, date: date16, completed: true, created_at: '2025-11-16T11:10:00Z', order_index: 1009 }
      )

      // 15일 페이지에 미리 작성
      dummyData.push(
        { text: `[${sessionId}] 더미: 14일생성-15일페이지-미완료`, date: date15, completed: false, created_at: '2025-11-14T14:00:00Z', order_index: 1010 },
        { text: `[${sessionId}] 더미: 14일생성-15일페이지-15일완료`, date: date15, completed: true, created_at: '2025-11-14T14:10:00Z', order_index: 1011 }
      )

      // 16일 페이지에 미리 작성
      dummyData.push(
        { text: `[${sessionId}] 더미: 15일생성-16일페이지-미완료`, date: date16, completed: false, created_at: '2025-11-15T15:00:00Z', order_index: 1012 },
        { text: `[${sessionId}] 더미: 15일생성-16일페이지-16일완료`, date: date16, completed: true, created_at: '2025-11-15T15:10:00Z', order_index: 1013 },
        { text: `[${sessionId}] 더미: 14일생성-16일페이지-미완료`, date: date16, completed: false, created_at: '2025-11-14T15:00:00Z', order_index: 1014 },
        { text: `[${sessionId}] 더미: 14일생성-16일페이지-16일완료`, date: date16, completed: true, created_at: '2025-11-14T15:10:00Z', order_index: 1015 }
      )

      // 17일 페이지에 미리 작성 (미래)
      const date17 = '2025-11-17'
      dummyData.push(
        { text: `[${sessionId}] 더미: 16일생성-17일페이지-미완료`, date: date17, completed: false, created_at: '2025-11-16T16:00:00Z', order_index: 1016 },
        { text: `[${sessionId}] 더미: 15일생성-17일페이지-미완료`, date: date17, completed: false, created_at: '2025-11-15T16:00:00Z', order_index: 1017 },
        { text: `[${sessionId}] 더미: 14일생성-17일페이지-미완료`, date: date17, completed: false, created_at: '2025-11-14T16:00:00Z', order_index: 1018 }
      )

      // 18일 페이지에 미리 작성 (미래)
      const date18 = '2025-11-18'
      dummyData.push(
        { text: `[${sessionId}] 더미: 16일생성-18일페이지-미완료`, date: date18, completed: false, created_at: '2025-11-16T17:00:00Z', order_index: 1019 },
        { text: `[${sessionId}] 더미: 15일생성-18일페이지-미완료`, date: date18, completed: false, created_at: '2025-11-15T17:00:00Z', order_index: 1020 }
      )

      // Supabase에 투두 삽입
      const { data: insertedTodos, error: todoError } = await supabase
        .from('todos')
        .insert(dummyData)
        .select()

      if (todoError) throw todoError

      // 히스토리 데이터 생성 (수정 이력이 있는 투두들)
      // 14일 생성 투두의 히스토리 (15일, 16일 수정)
      const todo14 = insertedTodos.find(t => t.text.includes('14일생성-미완료-수정이력있음'))
      if (todo14) {
        historyData.push(
          {
            todo_id: todo14.id,
            previous_text: `[${sessionId}] 더미: 14일생성-미완료-1차`,
            new_text: `[${sessionId}] 더미: 14일생성-미완료-2차`,
            changed_at: '2025-11-15T12:00:00Z',
            changed_on_date: date15
          },
          {
            todo_id: todo14.id,
            previous_text: `[${sessionId}] 더미: 14일생성-미완료-2차`,
            new_text: `[${sessionId}] 더미: 14일생성-미완료-수정이력있음`,
            changed_at: '2025-11-16T12:00:00Z',
            changed_on_date: date16
          }
        )
      }

      // 15일 생성 투두의 히스토리 (16일 수정)
      const todo15 = insertedTodos.find(t => t.text.includes('15일생성-미완료-수정이력있음'))
      if (todo15) {
        historyData.push(
          {
            todo_id: todo15.id,
            previous_text: `[${sessionId}] 더미: 15일생성-미완료-1차`,
            new_text: `[${sessionId}] 더미: 15일생성-미완료-수정이력있음`,
            changed_at: '2025-11-16T13:00:00Z',
            changed_on_date: date16
          }
        )
      }

      // 히스토리 데이터 삽입
      if (historyData.length > 0) {
        const { error: historyError } = await supabase
          .from('todo_history')
          .insert(historyData)

        if (historyError) {
          console.error('히스토리 생성 오류:', historyError.message)
        }
      }

      // 세션 정보 저장
      setDummySessions(prev => [...prev, {
        sessionId,
        createdAt: new Date().toISOString(),
        count: dummyData.length,
        historyCount: historyData.length
      }])

      alert(`✅ 더미 데이터 생성 완료!\n투두: ${dummyData.length}개\n히스토리: ${historyData.length}개\n세션 ID: ${sessionId}`)

      // 현재 날짜 새로고침
      fetchTodos()
    } catch (error) {
      console.error('더미 데이터 생성 오류:', error.message)
      alert('❌ 더미 데이터 생성 실패: ' + error.message)
    }
  }

  // 특정 세션 더미 데이터 삭제
  const handleDeleteDummySession = async (sessionId) => {
    const confirmed = window.confirm(
      `⚠️ 정말로 세션 "${sessionId}"의 더미 데이터를 삭제하시겠습니까?\n\n이 세션의 모든 투두가 서버에서 완전히 삭제되며, 이 작업은 되돌릴 수 없습니다.`
    )

    if (!confirmed) return

    try {
      // 먼저 해당 세션의 투두 ID들을 가져오기
      const { data: todosToDelete, error: fetchError } = await supabase
        .from('todos')
        .select('id')
        .like('text', `[${sessionId}]%`)

      if (fetchError) throw fetchError

      // 투두 ID들로 히스토리 삭제 (ON DELETE CASCADE가 없으면 수동으로)
      if (todosToDelete && todosToDelete.length > 0) {
        const todoIds = todosToDelete.map(t => t.id)

        const { error: historyError } = await supabase
          .from('todo_history')
          .delete()
          .in('todo_id', todoIds)

        if (historyError) {
          console.error('히스토리 삭제 오류:', historyError.message)
        }
      }

      // 투두 삭제
      const { error } = await supabase
        .from('todos')
        .delete()
        .like('text', `[${sessionId}]%`)

      if (error) throw error

      setDummySessions(prev => prev.filter(s => s.sessionId !== sessionId))
      alert(`✅ 세션 ${sessionId} 삭제 완료!`)

      // 현재 날짜 새로고침
      fetchTodos()
    } catch (error) {
      console.error('더미 데이터 삭제 오류:', error.message)
      alert('❌ 더미 데이터 삭제 실패: ' + error.message)
    }
  }

  // 모든 더미 데이터 삭제
  const handleDeleteAllDummies = async () => {
    const confirmed = window.confirm(
      `⚠️ 정말로 모든 더미 데이터를 삭제하시겠습니까?\n\n모든 더미 세션의 투두가 서버에서 완전히 삭제되며, 이 작업은 되돌릴 수 없습니다.`
    )

    if (!confirmed) return

    try {
      // 먼저 모든 더미 투두 ID들을 가져오기
      const { data: todosToDelete, error: fetchError } = await supabase
        .from('todos')
        .select('id')
        .like('text', '[DUMMY-%')

      if (fetchError) throw fetchError

      // 투두 ID들로 히스토리 삭제
      if (todosToDelete && todosToDelete.length > 0) {
        const todoIds = todosToDelete.map(t => t.id)

        const { error: historyError } = await supabase
          .from('todo_history')
          .delete()
          .in('todo_id', todoIds)

        if (historyError) {
          console.error('히스토리 삭제 오류:', historyError.message)
        }
      }

      // 투두 삭제
      const { error } = await supabase
        .from('todos')
        .delete()
        .like('text', '[DUMMY-%')

      if (error) throw error

      setDummySessions([])
      alert('✅ 모든 더미 데이터 삭제 완료!')

      // 현재 날짜 새로고침
      fetchTodos()
    } catch (error) {
      console.error('모든 더미 데이터 삭제 오류:', error.message)
      alert('❌ 모든 더미 데이터 삭제 실패: ' + error.message)
    }
  }

  // 중복 투두 확인 및 삭제
  const handleRemoveDuplicates = async () => {
    try {
      // 모든 투두 가져오기 (삭제되지 않은 것만)
      const { data: allTodos, error: fetchError } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      if (!allTodos || allTodos.length === 0) {
        alert('투두가 없습니다.')
        return
      }

      // 같은 텍스트를 가진 투두들을 그룹화
      const textGroups = {}
      allTodos.forEach(todo => {
        if (!textGroups[todo.text]) {
          textGroups[todo.text] = []
        }
        textGroups[todo.text].push(todo)
      })

      // 중복이 있는 그룹만 필터링 (2개 이상)
      const duplicateGroups = Object.entries(textGroups).filter(([_, todos]) => todos.length > 1)

      if (duplicateGroups.length === 0) {
        alert('중복된 투두가 없습니다.')
        return
      }

      // 중복 리스트 생성
      let duplicateList = '중복된 투두 목록:\n\n'
      let todosToDelete = []

      duplicateGroups.forEach(([text, todos]) => {
        duplicateList += `"${text}" - ${todos.length}개\n`
        // 첫 번째(가장 오래된)를 제외한 나머지를 삭제 대상에 추가
        const toDelete = todos.slice(1)
        todosToDelete.push(...toDelete)
        toDelete.forEach(todo => {
          const createdDate = new Date(todo.created_at).toLocaleString('ko-KR')
          duplicateList += `  ❌ 삭제 예정: ${createdDate}\n`
        })
        const keepTodo = todos[0]
        const keepDate = new Date(keepTodo.created_at).toLocaleString('ko-KR')
        duplicateList += `  ✅ 유지: ${keepDate}\n\n`
      })

      duplicateList += `\n총 ${todosToDelete.length}개의 중복 투두를 삭제합니다.`

      // 확인 받기
      const confirmDelete = window.confirm(duplicateList + '\n\n⚠️ 이 투두들은 서버에서 완전히 삭제되며, 이 작업은 되돌릴 수 없습니다.\n\n삭제하시겠습니까?')

      if (!confirmDelete) {
        return
      }

      // 삭제 실행
      const idsToDelete = todosToDelete.map(t => t.id)

      // 히스토리 먼저 삭제
      const { error: historyError } = await supabase
        .from('todo_history')
        .delete()
        .in('todo_id', idsToDelete)

      if (historyError) {
        console.error('히스토리 삭제 오류:', historyError.message)
      }

      // 투두 삭제
      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) throw deleteError

      alert(`✅ ${todosToDelete.length}개의 중복 투두를 삭제했습니다.`)

      // 현재 날짜 새로고침
      fetchTodos()
    } catch (error) {
      console.error('중복 투두 삭제 오류:', error.message)
      alert('❌ 중복 투두 삭제 실패: ' + error.message)
    }
  }

  return {
    dummySessions,
    showDummyModal,
    setShowDummyModal,
    showDummySQL,
    setShowDummySQL,
    handleCreateDummyData,
    handleDeleteDummySession,
    handleDeleteAllDummies,
    handleRemoveDuplicates,
  }
}
