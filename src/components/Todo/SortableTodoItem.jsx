import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { supabase } from '../../supabaseClient'
import { DAYS } from '../../utils/constants'
import { formatDateForDB, formatDateOnly } from '../../utils/dateUtils'
import AppleTimePicker from '../Common/AppleTimePicker'

function SortableTodoItem({ todo, index, onToggle, onDelete, onEdit, formatDate, formatDateOnly, isFocused, onFocus, onAddSubTodo, subtodos, level = 0, onCreateRoutine, routines, onShowRoutineHistory, onOpenRoutineSetupModal, onOpenHistoryModal, currentPageDate, isPendingRoutine = false, onRemoveFromUI, showSuccessMessage, activeId, overId }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)
  const [showDetails, setShowDetails] = useState(false)
  const [showNanotodos, setShowNanotodos] = useState(false)
  const [isAddingSubTodo, setIsAddingSubTodo] = useState(false)
  const [subTodoText, setSubTodoText] = useState('')
  const [showRoutineSetup, setShowRoutineSetup] = useState(false)
  const [routineDays, setRoutineDays] = useState([])
  const [isEditingRoutine, setIsEditingRoutine] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyRecords, setHistoryRecords] = useState([])
  const [expandedHistoryIds, setExpandedHistoryIds] = useState([])
  const [carryOverPath, setCarryOverPath] = useState([])
  const [originalDate, setOriginalDate] = useState(null)
  const [showActionsModal, setShowActionsModal] = useState(false)
  const [selectedAction, setSelectedAction] = useState(null)
  const [isEditingRoutineInModal, setIsEditingRoutineInModal] = useState(false)
  const [routineDaysForModal, setRoutineDaysForModal] = useState([])
  const [routineTimeSlotForModal, setRoutineTimeSlotForModal] = useState('')
  const [todoHistory, setTodoHistory] = useState({}) // todo_id를 키로 하는 히스토리 객체
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [selectedRoutineForHistory, setSelectedRoutineForHistory] = useState(null)
  const [routineHistoryData, setRoutineHistoryData] = useState([])

  // 현재 투두의 루틴 정보 찾기
  const currentRoutine = todo.routine_id ? routines.find(r => r.id === todo.routine_id) : null

  // 스와이프 관련
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeStartX, setSwipeStartX] = useState(0)
  const [swipeStartY, setSwipeStartY] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isPointerDown, setIsPointerDown] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: todo.id,
  })

  // 드래그 개선: 드래그 중인 블록인지, 드롭 위치인지 체크
  const isActive = todo.id === activeId
  const isOver = todo.id === overId && activeId && activeId !== overId

  const style = {
    // transform 제거 - 블록이 움직이지 않도록
    cursor: 'grab',
    opacity: isActive ? 0.4 : 1, // 드래그 중인 블록은 반투명
  }

  // 텍스트가 길면 펼치기 버튼 표시
  const isLongText = todo.text.length > 30

  const handleDoubleClick = () => {
    setIsEditing(true)
    setEditText(todo.text)
  }

  const handleEditSubmit = async () => {
    if (editText.trim() && editText !== todo.text) {
      await onEdit(todo.id, editText.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      await handleEditSubmit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditText(todo.text)
    }
  }

  // 루틴 요일 토글
  const handleToggleRoutineDayInModal = (dayKey) => {
    setRoutineDaysForModal(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 요일 번호를 키로 변환
  const getDayKey = (dayNumber) => {
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    return keys[dayNumber]
  }

  // 이 날짜에서만 숨김
  const hideOnThisDateOnly = async (todo) => {
    try {
      // currentPageDate가 Date 객체인지 문자열인지 확인
      const dateStr = typeof currentPageDate === 'string'
        ? currentPageDate
        : formatDateForDB(currentPageDate)
      const currentHiddenDates = todo.hidden_dates || []

      // hidden_dates에 현재 날짜 추가
      const newHiddenDates = [...currentHiddenDates, dateStr]

      // 루틴 투두인지 확인
      const isRoutineTodo = todo.routine_id !== null && todo.routine_id !== undefined

      let updateData = {
        hidden_dates: newHiddenDates
      }

      // 루틴 투두가 아닌 경우에만 deleted 설정
      if (!isRoutineTodo) {
        updateData.deleted = true
        updateData.deleted_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('todos')
        .update(updateData)
        .eq('id', todo.id)

      if (error) throw error

      // 즉시 UI에서 제거
      if (onRemoveFromUI) {
        onRemoveFromUI(todo.id)
      }

      // 성공 메시지 표시 (실행 취소 정보 포함)
      const isRoutine = todo.routine_id !== null && todo.routine_id !== undefined
      showSuccessMessage(
        isRoutine ? '✅ 오늘만 숨겨졌습니다' : '✅ 이 날짜에서 숨겨졌습니다',
        {
          type: 'hideOnDate',
          todoId: todo.id,
          hiddenDate: dateStr,
          wasDeleted: !isRoutineTodo
        }
      )
    } catch (error) {
      console.error('숨김 처리 오류:', error.message)
      alert('❌ 숨김 처리에 실패했습니다.')
    }
  }

  // 완전 삭제
  const deleteCompletely = async (todo) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ deleted: true, deleted_date: new Date().toISOString() })
        .eq('id', todo.id)

      if (error) throw error

      // 즉시 UI에서 제거
      if (onRemoveFromUI) {
        onRemoveFromUI(todo.id)
      }
    } catch (error) {
      console.error('삭제 오류:', error.message)
      alert('삭제에 실패했습니다.')
    }
  }

  // 루틴 투두 전용: 오늘부터 삭제 (루틴 중단)
  const deleteRoutineFromToday = async (todo) => {
    try {
      if (!todo.routine_id) {
        alert('루틴 투두가 아닙니다.')
        return
      }

      // 루틴을 deleted: true로 설정하여 내일부터 생성되지 않도록
      const { error: routineError } = await supabase
        .from('routines')
        .update({ deleted: true })
        .eq('id', todo.routine_id)

      if (routineError) throw routineError

      // 현재 날짜를 hidden_dates에 추가하여 오늘도 숨김
      const dateStr = typeof currentPageDate === 'string'
        ? currentPageDate
        : formatDateForDB(currentPageDate)
      const currentHiddenDates = todo.hidden_dates || []
      const newHiddenDates = [...currentHiddenDates, dateStr]

      const { error: todoError } = await supabase
        .from('todos')
        .update({ hidden_dates: newHiddenDates })
        .eq('id', todo.id)

      if (todoError) throw todoError

      // UI에서 제거
      if (onRemoveFromUI) {
        onRemoveFromUI(todo.id)
      }

      showSuccessMessage('✅ 오늘부터 루틴이 중단되었습니다', {
        type: 'stopRoutineFromToday',
        todoId: todo.id,
        routineId: todo.routine_id,
        hiddenDate: dateStr
      })
    } catch (error) {
      console.error('루틴 중단 오류:', error.message)
      alert('❌ 루틴 중단에 실패했습니다.')
    }
  }

  // 루틴 투두 전용: 과거+오늘+미래 모두 삭제
  const deleteRoutineCompletely = async (todo) => {
    try {
      if (!todo.routine_id) {
        alert('루틴 투두가 아닙니다.')
        return
      }

      // 1. 루틴을 deleted: true로 설정
      const { error: routineError } = await supabase
        .from('routines')
        .update({ deleted: true })
        .eq('id', todo.routine_id)

      if (routineError) throw routineError

      // 2. 루틴 투두도 deleted: true로 설정 (휴지통으로)
      const { error: todoError } = await supabase
        .from('todos')
        .update({ deleted: true, deleted_date: new Date().toISOString() })
        .eq('id', todo.id)

      if (todoError) throw todoError

      // UI에서 제거
      if (onRemoveFromUI) {
        onRemoveFromUI(todo.id)
      }

      showSuccessMessage('✅ 루틴이 휴지통으로 이동되었습니다', {
        type: 'deleteRoutineCompletely',
        todoId: todo.id,
        routineId: todo.routine_id
      })
    } catch (error) {
      console.error('루틴 완전 삭제 오류:', error.message)
      alert('❌ 루틴 삭제에 실패했습니다.')
    }
  }

  // 히스토리 자동 로드 (selectedAction이 'history'일 때)
  useEffect(() => {
    if (selectedAction === 'history' && !todoHistory[todo.id] && !isLoadingHistory) {
      const loadHistory = async () => {
        setIsLoadingHistory(true)
        try {
          const { data, error } = await supabase
            .from('todo_history')
            .select('*')
            .eq('todo_id', todo.id)
            .order('changed_at', { ascending: false })

          if (error) throw error

          setTodoHistory(prev => ({
            ...prev,
            [todo.id]: data || []
          }))
        } catch (error) {
          console.error('Error fetching history:', error)
        } finally {
          setIsLoadingHistory(false)
        }
      }
      loadHistory()
    }
  }, [selectedAction, todo.id, todoHistory, isLoadingHistory])

  // 루틴 기록 자동 로드 (selectedAction이 'routine-stats'일 때)
  useEffect(() => {
    if (selectedAction === 'routine-stats' && currentRoutine &&
        (!selectedRoutineForHistory || selectedRoutineForHistory.id !== currentRoutine.id)) {
      const loadRoutineHistory = async () => {
        try {
          const { data: routineTodo, error } = await supabase
            .from('todos')
            .select('*')
            .eq('routine_id', currentRoutine.id)
            .eq('deleted', false)
            .maybeSingle()

          if (error) throw error

          if (routineTodo && routineTodo.visible_dates) {
            const historyData = routineTodo.visible_dates
              .sort()
              .map(date => ({
                id: `${routineTodo.id}-${date}`,
                date,
                text: routineTodo.text,
                completed: routineTodo.completed_dates?.includes(date) || false
              }))

            setRoutineHistoryData(historyData)
            setSelectedRoutineForHistory(currentRoutine)
          }
        } catch (error) {
          console.error('Error fetching routine history:', error)
        }
      }
      loadRoutineHistory()
    }
  }, [selectedAction, currentRoutine, selectedRoutineForHistory])

  // 마우스/터치 시작
  const handleStart = (e) => {
    if (isEditing || isDragging) return

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY
    setSwipeStartX(clientX)
    setSwipeStartY(clientY)
    setIsSwiping(false)
    setIsPointerDown(true)
  }

  // 마우스/터치 이동
  const handleMove = (e) => {
    if (isEditing || isDragging || !isPointerDown) return

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY
    const diffX = swipeStartX - clientX
    const diffY = Math.abs(swipeStartY - clientY)

    // 스와이프 감지 (수평 움직임이 확실할 때만)
    if (!isSwiping) {
      const totalDist = Math.abs(diffX) + diffY
      if (totalDist > 10) {
        // 수평 이동이 전체 이동의 80% 이상이면 스와이프
        if (Math.abs(diffX) > totalDist * 0.8) {
          setIsSwiping(true)
          // 터치 이벤트 전파 막기
          if (e.type.includes('touch')) {
            e.preventDefault()
          }
        } else if (diffY > Math.abs(diffX)) {
          // 수직 이동이 더 크면 포인터 해제 (드래그 모드로 전환)
          setIsPointerDown(false)
          return
        }
      }
    }

    // 스와이프 중일 때만 처리
    if (isSwiping) {
      if (e.type.includes('touch')) {
        e.preventDefault()
      }

      if (diffX > 0 && diffX <= 100) {
        // 왼쪽으로 스와이프 (삭제 버튼 열기)
        setSwipeOffset(diffX)
      } else if (diffX < 0 && swipeOffset > 0) {
        // 오른쪽으로 스와이프 (삭제 버튼 닫기)
        const newOffset = swipeOffset + diffX
        setSwipeOffset(Math.max(0, newOffset))
        setSwipeStartX(clientX)
      }
    }
  }

  // 마우스/터치 종료
  const handleEnd = () => {
    setIsPointerDown(false)

    if (isSwiping) {
      setIsSwiping(false)
      // 40px 이상 열렸으면 80px로 고정, 아니면 닫기
      setSwipeOffset(swipeOffset > 40 ? 80 : 0)
    }
  }

  // 삭제 버튼 클릭
  const handleDeleteClick = () => {
    onDelete(todo.id)
  }

  // 루틴 요일 토글
  const handleToggleRoutineDay = (dayKey) => {
    setRoutineDays(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 루틴 생성 확인
  const handleCreateRoutine = async () => {
    if (routineDays.length > 0 && onCreateRoutine) {
      await onCreateRoutine(todo.id, todo.text, routineDays)
      setRoutineDays([])
      setShowRoutineSetup(false)
    }
  }

  // 루틴 설정 취소
  const handleCancelRoutineSetup = () => {
    setRoutineDays([])
    setShowRoutineSetup(false)
    setIsEditingRoutine(false)
  }

  // 루틴 수정 시작
  const handleStartEditRoutine = () => {
    if (currentRoutine) {
      setRoutineDays(currentRoutine.days)
      setIsEditingRoutine(true)
    }
  }

  // 루틴 수정 저장
  const handleUpdateRoutine = async () => {
    if (routineDays.length > 0 && currentRoutine && onCreateRoutine) {
      // 기존 루틴 업데이트
      await onCreateRoutine(todo.id, todo.text, routineDays, currentRoutine.id)
      setRoutineDays([])
      setIsEditingRoutine(false)
      setShowRoutineSetup(false)
    }
  }

  // 루틴 제거
  const handleRemoveRoutine = async () => {
    if (currentRoutine && onCreateRoutine) {
      // routine_id를 null로 설정하여 제거
      await onCreateRoutine(todo.id, todo.text, [], null, true)
      setShowRoutineSetup(false)
    }
  }

  // 히스토리 가져오기
  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('todo_history')
        .select('*')
        .eq('todo_id', todo.id)
        .order('changed_at', { ascending: false })

      if (error) throw error
      setHistoryRecords(data || [])

      // 이월 경로 조회 (original_todo_id가 있는 경우)
      if (todo.original_todo_id) {
        // 원본 투두 조회
        const { data: originalData, error: originalError } = await supabase
          .from('todos')
          .select('id, date, created_at')
          .eq('id', todo.original_todo_id)
          .single()

        if (originalError) {
          console.error('원본 투두 조회 오류:', originalError.message)
          setCarryOverPath([])
          setOriginalDate(null)
          return
        }

        // 원본 날짜 저장
        setOriginalDate(originalData.date)

        // 같은 original_todo_id를 가진 모든 이월된 투두들 조회
        const { data: pathData, error: pathError } = await supabase
          .from('todos')
          .select('id, date, created_at')
          .eq('original_todo_id', todo.original_todo_id)
          .order('date', { ascending: true })

        if (pathError) {
          console.error('이월 경로 조회 오류:', pathError.message)
          setCarryOverPath([])
          return
        }

        // 원본 + 이월된 투두들을 날짜순으로 정렬
        const allPath = [originalData, ...(pathData || [])].sort((a, b) =>
          new Date(a.date) - new Date(b.date)
        )
        setCarryOverPath(allPath)
      } else {
        setCarryOverPath([])
        setOriginalDate(todo.date)
      }
    } catch (error) {
      console.error('히스토리 가져오기 오류:', error.message)
    }
  }

  // 히스토리 토글 시 데이터 가져오기
  const handleToggleHistory = () => {
    const newShowHistory = !showHistory
    setShowHistory(newShowHistory)

    // 히스토리를 열 때만 백그라운드에서 데이터 로드
    if (newShowHistory) {
      fetchHistory()
    }
  }

  // 개별 히스토리 내용 토글
  const toggleHistoryDetail = (historyId) => {
    setExpandedHistoryIds(prev =>
      prev.includes(historyId)
        ? prev.filter(id => id !== historyId)
        : [...prev, historyId]
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderTop: isOver
          ? '2px solid rgba(99, 102, 241, 0.8)' // 드롭 위치 표시선
          : '2px solid transparent', // 기본은 투명 (공간 확보)
      }}
      className={`todo-item-container ${isFocused ? 'focused' : ''}`}
    >
      <span className="todo-number" onClick={() => onFocus(todo.id)}>
        {isFocused && <span className="focus-icon">🔥</span>}
        {index + 1}
      </span>
      <div className="todo-item-wrapper">
        <div className="swipe-background">
          <button
            onClick={handleDeleteClick}
            className="swipe-delete-button"
            title="삭제"
          >
            삭제
          </button>
        </div>
        <div
          {...attributes}
          {...listeners}
          className={`todo-item ${todo.completed ? 'completed' : ''} ${isExpanded ? 'expanded' : ''} ${isDragging ? 'drag-mode' : ''}`}
          style={{
            transform: `translateX(-${swipeOffset}px)`,
            transition: isSwiping || isDragging ? 'none' : 'transform 0.3s ease'
          }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
          className="todo-checkbox"
        />
        <div
          className="todo-content"
          onClick={() => !isEditing && isLongText && setIsExpanded(!isExpanded)}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: isEditing ? 'text' : (isLongText ? 'pointer' : 'default') }}
        >
          {isEditing ? (
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleEditSubmit}
              onKeyDown={handleKeyDown}
              className="todo-edit-input"
              autoFocus
            />
          ) : (
            <span className={`todo-text ${isExpanded ? 'expanded' : ''}`}>
              {todo.text}
            </span>
          )}
        </div>
        {(() => {
          const hasCompletedDateBadge = todo.completed && todo.completed_at &&
            new Date(todo.completed_at).toISOString().split('T')[0] !== todo.date
          const hasRoutineBadge = todo.routine_id && currentRoutine
          const hasPendingRoutineBadge = isPendingRoutine || todo.is_pending_routine
          return (subtodos.length > 0 || hasCompletedDateBadge || hasRoutineBadge || hasPendingRoutineBadge) && (
            <div className="todo-badges">
              {hasCompletedDateBadge && (() => {
                const completedDate = new Date(todo.completed_at).toISOString().split('T')[0]
                const completedDay = new Date(todo.completed_at).getDate()
                return (
                  <span className="completed-date-badge" title={`${completedDate}에 완료됨`}>
                    {completedDay}일✓
                  </span>
                )
              })()}
              {hasRoutineBadge && (() => {
                // JSON 방식: 현재 페이지 날짜 사용
                const displayDate = currentPageDate || todo.date
                const todoDate = new Date(displayDate + 'T00:00:00')
                const month = todoDate.getMonth() + 1
                const date = todoDate.getDate()
                const dayNames = ['일', '월', '화', '수', '목', '금', '토']
                const dayName = dayNames[todoDate.getDay()]
                const dateDisplay = `${month}/${date}(${dayName})`
                return (
                  <span className="routine-date-badge" title={`${currentRoutine.text} 루틴`}>
                    for {dateDisplay}
                  </span>
                )
              })()}
              {hasPendingRoutineBadge && (
                <span className="pending-routine-badge" title="루틴 설정이 필요합니다">
                  미정
                </span>
              )}
              {subtodos.length > 0 && (
                <span
                  className="todo-badge clickable"
                  title="나노투두 보기"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (showNanotodos) {
                      // 이미 나노투두가 열려있으면 토글 닫기
                      setShowDetails(false)
                      setShowNanotodos(false)
                      setIsAddingSubTodo(false)
                    } else {
                      // 나노투두 열기
                      setShowDetails(true)
                      setShowNanotodos(true)
                      setIsAddingSubTodo(false)
                      setShowRoutineSetup(false)
                      setShowHistory(false)
                    }
                  }}
                >
                  🔬
                </span>
              )}
            </div>
          )
        })()}
        {!isEditing && !todo.parent_id && (
          <button
            className="todo-more-button"
            onClick={(e) => {
              e.stopPropagation()
              setShowActionsModal(true)
              setSelectedAction(null)
              // 루틴 설정 상태 초기화
              setIsEditingRoutineInModal(false)
              setRoutineDaysForModal([])
              setRoutineTimeSlotForModal('')
            }}
            title="더보기"
          >
            ⋮
          </button>
        )}
        {showNanotodos && !todo.parent_id && (
          <div className="subtodos-in-item">
            {subtodos && subtodos.length > 0 && subtodos.map((subtodo, subIndex) => (
              <SortableTodoItem
                key={subtodo.id}
                todo={subtodo}
                index={subIndex}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                formatDate={formatDate}
                formatDateOnly={formatDateOnly}
                isFocused={isFocused}
                onFocus={onFocus}
                onAddSubTodo={onAddSubTodo}
                subtodos={[]}
                level={level + 1}
                routines={routines}
                onShowRoutineHistory={onShowRoutineHistory}
                showSuccessMessage={showSuccessMessage}
                onOpenRoutineSetupModal={onOpenRoutineSetupModal}
                onOpenHistoryModal={onOpenHistoryModal}
                currentPageDate={currentPageDate}
              />
            ))}
            {isAddingSubTodo && (
              <div className="subtodo-input-section">
                <input
                  type="text"
                  value={subTodoText}
                  onChange={(e) => setSubTodoText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && subTodoText.trim()) {
                      onAddSubTodo(todo.id, subTodoText.trim())
                      setSubTodoText('')
                    }
                  }}
                  placeholder="나노투두 입력..."
                  className="subtodo-input"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (subTodoText.trim()) {
                      onAddSubTodo(todo.id, subTodoText.trim())
                      setSubTodoText('')
                    }
                  }}
                  className="subtodo-add-button"
                >
                  추가
                </button>
                <button
                  onClick={() => {
                    setSubTodoText('')
                  }}
                  className="subtodo-cancel-button"
                >
                  취소
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* 액션 모달 */}
      {showActionsModal && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={() => setShowActionsModal(false)}>
          <div className="actions-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="actions-modal-header">
              <h3>작업 선택</h3>
              <button onClick={() => setShowActionsModal(false)} className="modal-close-button">✕</button>
            </div>

            {/* 투두 텍스트 편집 영역 */}
            <div className="todo-edit-section">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => {
                  if (editText.trim() !== '' && editText !== todo.text) {
                    onEdit(todo.id, editText)
                  } else if (editText.trim() === '') {
                    setEditText(todo.text) // 빈 텍스트면 원래대로 복구
                  }
                }}
                className="todo-edit-textarea"
                placeholder="투두 내용을 입력하세요..."
                rows={3}
              />
            </div>

            <div className="actions-modal-body">
              {/* 왼쪽 메뉴 */}
              <div className="actions-menu">
                <button
                  className={`action-menu-item ${selectedAction === 'nanotodo' ? 'active' : ''}`}
                  onClick={() => setSelectedAction('nanotodo')}
                >
                  <span className="action-icon">🔬</span>
                  <span>나노투두</span>
                </button>
                <button
                  className={`action-menu-item ${selectedAction === 'routine' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedAction('routine')
                    // 루틴 설정 초기화
                    const currentRoutine = routines.find(r => r.id === todo.routine_id)
                    if (currentRoutine) {
                      setRoutineDaysForModal(currentRoutine.days || [])
                      setRoutineTimeSlotForModal(currentRoutine.time_slot || '')
                      setIsEditingRoutineInModal(false) // 기존 루틴이 있으면 보기 모드
                    } else {
                      setRoutineDaysForModal([])
                      setRoutineTimeSlotForModal('')
                      setIsEditingRoutineInModal(true) // 새로 만들 때는 편집 모드
                    }
                  }}
                >
                  <span className="action-icon">📌</span>
                  <span>루틴설정</span>
                </button>
                <button
                  className={`action-menu-item ${selectedAction === 'history' ? 'active' : ''}`}
                  onClick={() => setSelectedAction('history')}
                >
                  <span className="action-icon">📋</span>
                  <span>히스토리</span>
                </button>
                {todo.routine_id && currentRoutine && (
                  <button
                    className={`action-menu-item ${selectedAction === 'routine-stats' ? 'active' : ''}`}
                    onClick={() => setSelectedAction('routine-stats')}
                  >
                    <span className="action-icon">📊</span>
                    <span>루틴기록</span>
                  </button>
                )}
                <button
                  className={`action-menu-item delete ${selectedAction === 'delete' ? 'active' : ''}`}
                  onClick={() => setSelectedAction('delete')}
                >
                  <span className="action-icon">🗑️</span>
                  <span>삭제</span>
                </button>
              </div>

              {/* 오른쪽 상세 */}
              <div className="actions-detail">
                {!selectedAction && (
                  <div className="actions-detail-empty">
                    <p>왼쪽에서 작업을 선택하세요</p>
                  </div>
                )}

                {selectedAction === 'nanotodo' && (
                  <div className="actions-detail-content">
                    <h4>🔬 나노투두</h4>
                    <div className="nanotodo-section-in-modal">
                      {subtodos && subtodos.length > 0 && (
                        <div className="subtodo-list-in-modal">
                          {subtodos.map((subtodo) => (
                            <div key={subtodo.id} className="subtodo-item-in-modal">
                              <input
                                type="checkbox"
                                checked={subtodo.completed}
                                onChange={() => onToggle(subtodo.id)}
                                className="subtodo-checkbox-modal"
                              />
                              <span className={`subtodo-text-modal ${subtodo.completed ? 'completed' : ''}`}>
                                {subtodo.text}
                              </span>
                              <button
                                onClick={() => onDelete(subtodo.id)}
                                className="subtodo-delete-modal"
                                title="삭제"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="subtodo-input-section-modal">
                        <input
                          type="text"
                          value={subTodoText}
                          onChange={(e) => setSubTodoText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && subTodoText.trim()) {
                              onAddSubTodo(todo.id, subTodoText.trim())
                              setSubTodoText('')
                            }
                          }}
                          placeholder="나노투두 입력..."
                          className="subtodo-input-modal"
                        />
                        <button
                          onClick={() => {
                            if (subTodoText.trim()) {
                              onAddSubTodo(todo.id, subTodoText.trim())
                              setSubTodoText('')
                            }
                          }}
                          className="subtodo-add-button-modal"
                        >
                          추가
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAction === 'routine' && (() => {
                  const currentRoutine = routines.find(r => r.id === todo.routine_id)

                  return (
                    <div className="actions-detail-content">
                      <h4>🔄 루틴 설정</h4>
                      <div className="routine-setup-inline">
                        {currentRoutine && !isEditingRoutineInModal ? (
                          <>
                            <div className="routine-current-info">
                              <div className="routine-info-title">설정된 루틴:</div>
                              <div className="routine-days-display">
                                {DAYS.filter(day => currentRoutine.days.includes(day.key)).map(day => (
                                  <span key={day.key} className="routine-day-badge">
                                    {day.label}
                                  </span>
                                ))}
                              </div>
                              {currentRoutine.time_slot && (
                                <div className="routine-time-slot" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                  ⏰ {currentRoutine.time_slot}
                                </div>
                              )}
                            </div>
                            <div className="routine-setup-actions">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (currentRoutine) {
                                    setRoutineDaysForModal(currentRoutine.days)
                                    setRoutineTimeSlotForModal(currentRoutine.time_slot || '')
                                    setIsEditingRoutineInModal(true)
                                  }
                                }}
                                className="routine-confirm-button"
                              >
                                수정
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (currentRoutine && todo) {
                                    await onCreateRoutine(todo.id, todo.text, [], null, true)
                                    setShowActionsModal(false)
                                  }
                                }}
                                className="routine-remove-button"
                              >
                                제거
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="routine-setup-title">
                              {isEditingRoutineInModal ? '루틴 수정:' : '반복할 요일 선택:'}
                            </div>
                            <div className="day-selector-inline">
                              {DAYS.map(day => (
                                <button
                                  key={day.key}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleRoutineDayInModal(day.key)
                                  }}
                                  className={`day-button-inline ${routineDaysForModal.includes(day.key) ? 'selected' : ''}`}
                                >
                                  {day.label}
                                </button>
                              ))}
                            </div>
                            <div className="time-slot-selector" style={{ marginTop: '1rem' }}>
                              <label style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem', display: 'block' }}>
                                ⏰ 시간 (선택사항)
                              </label>
                              <AppleTimePicker
                                value={routineTimeSlotForModal}
                                onChange={(time) => setRoutineTimeSlotForModal(time)}
                              />
                            </div>
                            <div className="routine-setup-actions">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (todo) {
                                    if (isEditingRoutineInModal && currentRoutine) {
                                      // 루틴 수정
                                      await onCreateRoutine(todo.id, todo.text, routineDaysForModal, currentRoutine.id, false, routineTimeSlotForModal)
                                    } else {
                                      // 새 루틴 생성 (요일 없으면 매일 반복)
                                      await onCreateRoutine(todo.id, todo.text, routineDaysForModal, null, false, routineTimeSlotForModal)
                                    }
                                    setIsEditingRoutineInModal(false)
                                    setShowActionsModal(false)
                                  }
                                }}
                                className="routine-confirm-button"
                              >
                                확인
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setIsEditingRoutineInModal(false)
                                  setRoutineDaysForModal([])
                                  setRoutineTimeSlotForModal('')
                                }}
                                className="routine-cancel-button"
                              >
                                취소
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {selectedAction === 'history' && (() => {
                  const visibleDates = todo.visible_dates && todo.visible_dates.length > 0 ? todo.visible_dates : [todo.date]
                  const originalDate = visibleDates[0]
                  const carryOverPath = visibleDates.map(date => ({ id: `${todo.id}-${date}`, date }))
                  const historyRecords = todoHistory[todo.id] || []

                  if (isLoadingHistory) {
                    return (
                      <div className="actions-detail-content">
                        <h4>📊 투두 히스토리</h4>
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                          로딩 중...
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="actions-detail-content">
                      <h4>📊 투두 히스토리</h4>
                      <div className="todo-history">
                        <div className="history-item">
                          <span className="history-label">생성일:</span>
                          <span className="history-value">{formatDate(todo.created_at)}</span>
                        </div>
                        <div className="history-item">
                          <span className="history-label">원본 페이지:</span>
                          <span className="history-value">
                            {originalDate ? formatDateOnly(new Date(originalDate + 'T00:00:00')) : formatDateOnly(new Date(todo.date + 'T00:00:00'))}
                          </span>
                        </div>
                        {carryOverPath.length > 0 && (
                          <div className="history-item">
                            <span className="history-label">이월 경로:</span>
                            <span className="history-value">
                              {carryOverPath.map((path, idx) => {
                                const isCurrentPage = path.date === todo.date
                                const dateStr = formatDateOnly(new Date(path.date + 'T00:00:00'))
                                return (
                                  <span key={path.id}>
                                    {idx > 0 && ' → '}
                                    <span style={isCurrentPage ? { fontWeight: 'bold', color: '#4CAF50' } : {}}>
                                      {dateStr.split('(')[0]}{isCurrentPage ? '(여기)' : ''}
                                    </span>
                                  </span>
                                )
                              })}
                            </span>
                          </div>
                        )}
                        {(() => {
                          const createdDate = new Date(todo.created_at).toISOString().split('T')[0]
                          const currentDate = todo.date
                          if (createdDate !== currentDate && carryOverPath.length === 0) {
                            return (
                              <div className="history-item">
                                <span className="history-label">현재 페이지:</span>
                                <span className="history-value">{formatDateOnly(new Date(todo.date + 'T00:00:00'))}</span>
                              </div>
                            )
                          }
                          return null
                        })()}
                        {historyRecords.length > 0 && (
                          <div className="history-changes-list">
                            <div className="history-changes-header">변경 이력 ({historyRecords.length})</div>
                            {historyRecords.map((record) => (
                              <div key={record.id} className="history-record-compact">
                                <div className="history-record-summary">
                                  <div className="history-change-time">
                                    {formatDate(record.changed_at)}
                                    {record.changed_on_date && (
                                      <span className="history-page-info"> (페이지: {formatDateOnly(new Date(record.changed_on_date + 'T00:00:00'))})</span>
                                    )}
                                  </div>
                                  <button
                                    className="history-detail-button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleHistoryDetail(record.id)
                                    }}
                                  >
                                    {expandedHistoryIds.includes(record.id) ? '숨기기' : '내용보기'}
                                  </button>
                                </div>
                                {expandedHistoryIds.includes(record.id) && (
                                  <div className="history-change">
                                    <div className="history-change-item history-before">
                                      <span className="change-badge">이전</span>
                                      <span className="change-text">{record.previous_text}</span>
                                    </div>
                                    <div className="history-change-arrow">→</div>
                                    <div className="history-change-item history-after">
                                      <span className="change-badge">이후</span>
                                      <span className="change-text">{record.new_text}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {selectedAction === 'routine-stats' && currentRoutine && (() => {
                  // 로딩 중이거나 데이터가 없는 경우
                  if (!selectedRoutineForHistory || selectedRoutineForHistory.id !== currentRoutine.id || routineHistoryData.length === 0) {
                    return (
                      <div className="actions-detail-content">
                        <h4>📊 {currentRoutine.text} 히스토리</h4>
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                          {(!selectedRoutineForHistory || selectedRoutineForHistory.id !== currentRoutine.id) ? '로딩 중...' : '데이터가 없습니다.'}
                        </div>
                      </div>
                    )
                  }

                  // 첫 번째 투두 날짜부터 오늘까지의 달력 생성
                  const firstTodo = routineHistoryData[0]
                  const firstDate = new Date(firstTodo.date)
                  const today = new Date()

                  // 날짜별 완료 여부 맵 생성
                  const completionMap = {}
                  routineHistoryData.forEach(todo => {
                    completionMap[todo.date] = todo.completed
                  })

                  // 월별로 그룹화
                  const monthGroups = []
                  let currentDate = new Date(firstDate)

                  while (currentDate <= today) {
                    const year = currentDate.getFullYear()
                    const month = currentDate.getMonth()
                    const monthKey = `${year}-${month + 1}`

                    if (!monthGroups.find(g => g.key === monthKey)) {
                      monthGroups.push({
                        key: monthKey,
                        year,
                        month,
                        days: []
                      })
                    }

                    const monthGroup = monthGroups.find(g => g.key === monthKey)
                    const dateStr = formatDateForDB(currentDate)
                    const dayOfWeek = currentDate.getDay()

                    // 루틴이 해당 요일에 설정되어 있는지 확인
                    const dayKey = getDayKey(dayOfWeek)
                    const isRoutineDay = currentRoutine.days.includes(dayKey)

                    monthGroup.days.push({
                      date: new Date(currentDate),
                      dateStr,
                      day: currentDate.getDate(),
                      dayOfWeek,
                      isCompleted: completionMap[dateStr] === true,
                      isRoutineDay,
                      hasTodo: completionMap[dateStr] !== undefined
                    })

                    currentDate.setDate(currentDate.getDate() + 1)
                  }

                  return (
                    <div className="actions-detail-content">
                      <h4>📊 {currentRoutine.text} 히스토리</h4>
                      <div className="routine-history-content">
                        <div className="routine-history-calendar">
                          {monthGroups.map(monthGroup => (
                            <div key={monthGroup.key} className="history-month">
                              <h3 className="history-month-title">
                                {monthGroup.year}년 {monthGroup.month + 1}월
                              </h3>
                              <div className="history-calendar-grid">
                                <div className="history-day-header">일</div>
                                <div className="history-day-header">월</div>
                                <div className="history-day-header">화</div>
                                <div className="history-day-header">수</div>
                                <div className="history-day-header">목</div>
                                <div className="history-day-header">금</div>
                                <div className="history-day-header">토</div>

                                {/* 첫 주의 빈 칸 */}
                                {monthGroup.days.length > 0 && Array(monthGroup.days[0].dayOfWeek).fill(null).map((_, i) => (
                                  <div key={`empty-${i}`} className="history-day-cell empty"></div>
                                ))}

                                {/* 날짜 셀 */}
                                {monthGroup.days.map((dayInfo, index) => {
                                  // 다음 월의 첫날이면 빈칸 추가
                                  if (index > 0 && dayInfo.day === 1) {
                                    const prevDay = monthGroup.days[index - 1]
                                    const emptyCount = 6 - prevDay.dayOfWeek
                                    return (
                                      <React.Fragment key={dayInfo.dateStr}>
                                        {Array(emptyCount).fill(null).map((_, i) => (
                                          <div key={`empty-end-${index}-${i}`} className="history-day-cell empty"></div>
                                        ))}
                                        <div className="history-day-header">일</div>
                                        <div className="history-day-header">월</div>
                                        <div className="history-day-header">화</div>
                                        <div className="history-day-header">수</div>
                                        <div className="history-day-header">목</div>
                                        <div className="history-day-header">금</div>
                                        <div className="history-day-header">토</div>
                                        <div className={`history-day-cell ${dayInfo.isCompleted ? 'completed' : ''} ${!dayInfo.isRoutineDay ? 'not-routine-day' : ''}`}>
                                          <span className="day-number">{dayInfo.day}</span>
                                          {dayInfo.isCompleted && <span className="check-mark">✓</span>}
                                        </div>
                                      </React.Fragment>
                                    )
                                  }

                                  return (
                                    <div
                                      key={dayInfo.dateStr}
                                      className={`history-day-cell ${dayInfo.isCompleted ? 'completed' : ''} ${!dayInfo.isRoutineDay ? 'not-routine-day' : ''}`}
                                      title={`${dayInfo.dateStr}${!dayInfo.isRoutineDay ? ' (루틴 요일 아님)' : ''}${dayInfo.isCompleted ? ' - 완료' : dayInfo.hasTodo ? ' - 미완료' : ''}`}
                                    >
                                      <span className="day-number">{dayInfo.day}</span>
                                      {dayInfo.isCompleted && <span className="check-mark">✓</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="routine-history-stats">
                          <div className="stat-item">
                            <span className="stat-label">총 투두:</span>
                            <span className="stat-value">{routineHistoryData.length}개</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">완료:</span>
                            <span className="stat-value completed">{routineHistoryData.filter(t => t.completed).length}개</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">미완료:</span>
                            <span className="stat-value incomplete">{routineHistoryData.filter(t => !t.completed).length}개</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">완료율:</span>
                            <span className="stat-value">
                              {routineHistoryData.length > 0
                                ? Math.round((routineHistoryData.filter(t => t.completed).length / routineHistoryData.length) * 100)
                                : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {selectedAction === 'delete' && (
                  <div className="actions-detail-content">
                    <h4>🗑️ 삭제</h4>
                    <p className="delete-confirm-text">
                      <strong>{todo.text}</strong>
                    </p>
                    {(() => {
                      // visible_dates 확인 (여러 날짜에 보이는 투두인지 체크)
                      const visibleDates = (todo.visible_dates?.length > 0)
                        ? todo.visible_dates
                        : [todo.date || todo.created_date]

                      // 구 방식(복사 기반) 이월 투두인지 확인
                      const isOldStyleCarryover = todo.original_todo_id !== null && todo.original_todo_id !== undefined

                      // 루틴 투두인지 확인
                      const isRoutineTodo = todo.routine_id !== null && todo.routine_id !== undefined

                      // 루틴 투두인 경우 세 가지 옵션 표시
                      if (isRoutineTodo) {
                        return (
                          <>
                            <p className="delete-confirm-description">
                              이 루틴을 어떻게 삭제하시겠습니까?
                            </p>
                            <div className="delete-options-simple">
                              <button
                                className="delete-option-button-simple option-hide"
                                onClick={async () => {
                                  if (window.confirm('오늘만 숨기시겠습니까?\n다른 날짜에서는 계속 보입니다.')) {
                                    await hideOnThisDateOnly(todo)
                                    setShowActionsModal(false)
                                  }
                                }}
                              >
                                <span className="option-icon">📅</span>
                                <div className="option-content">
                                  <span className="option-title">오늘만 숨김</span>
                                  <span className="option-desc">다른 날짜에서는 계속 보임</span>
                                </div>
                              </button>
                              <button
                                className="delete-option-button-simple option-future"
                                onClick={async () => {
                                  if (window.confirm('오늘부터 루틴을 중단하시겠습니까?\n과거 기록은 유지됩니다.')) {
                                    await deleteRoutineFromToday(todo)
                                    setShowActionsModal(false)
                                  }
                                }}
                              >
                                <span className="option-icon">⏹️</span>
                                <div className="option-content">
                                  <span className="option-title">오늘부터 중단</span>
                                  <span className="option-desc">내일부터 생성 안 됨 (과거 유지)</span>
                                </div>
                              </button>
                              <button
                                className="delete-option-button-simple option-delete"
                                onClick={async () => {
                                  if (window.confirm('⚠️ 루틴과 모든 기록을 삭제하시겠습니까?\n휴지통에서 복원 가능합니다.')) {
                                    await deleteRoutineCompletely(todo)
                                    setShowActionsModal(false)
                                  }
                                }}
                              >
                                <span className="option-icon">🗑️</span>
                                <div className="option-content">
                                  <span className="option-title">모두 삭제</span>
                                  <span className="option-desc">과거+오늘+미래 모두 휴지통으로</span>
                                </div>
                              </button>
                            </div>
                          </>
                        )
                      }
                      // 여러 날짜에 보이는 일반 투두인 경우 두 가지 옵션 표시
                      else if (visibleDates.length > 1 || isOldStyleCarryover) {
                        return (
                          <>
                            <p className="delete-confirm-description">
                              이 투두는 여러 날짜에 보입니다. 어떻게 삭제하시겠습니까?
                            </p>
                            <div className="delete-options-simple">
                              <button
                                className="delete-option-button-simple option-hide"
                                onClick={async () => {
                                  if (window.confirm('이 날짜에서만 숨기시겠습니까?\n다른 날짜에서는 계속 보입니다.')) {
                                    await hideOnThisDateOnly(todo)
                                    setShowActionsModal(false)
                                  }
                                }}
                              >
                                <span className="option-icon">⊘</span>
                                <div className="option-content">
                                  <span className="option-title">이 날짜에서만 숨김</span>
                                  <span className="option-desc">다른 날짜에서는 계속 보입니다</span>
                                </div>
                              </button>
                              <button
                                className="delete-option-button-simple option-delete"
                                onClick={async () => {
                                  await deleteCompletely(todo)
                                  setShowActionsModal(false)
                                }}
                              >
                                <span className="option-icon">🗑️</span>
                                <div className="option-content">
                                  <span className="option-title">휴지통으로 이동</span>
                                  <span className="option-desc">모든 날짜에서 삭제 (복원 가능)</span>
                                </div>
                              </button>
                            </div>
                          </>
                        )
                      } else {
                        // 단일 날짜 투두는 휴지통 이동만 표시
                        return (
                          <>
                            <p className="delete-confirm-description">
                              이 투두를 휴지통으로 이동하시겠습니까?
                            </p>
                            <div className="delete-options-simple">
                              <button
                                className="delete-option-button-simple option-delete"
                                onClick={async () => {
                                  await deleteCompletely(todo)
                                  setShowActionsModal(false)
                                }}
                              >
                                <span className="option-icon">🗑️</span>
                                <div className="option-content">
                                  <span className="option-title">휴지통으로 이동</span>
                                  <span className="option-desc">복원 가능</span>
                                </div>
                              </button>
                            </div>
                          </>
                        )
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default SortableTodoItem
