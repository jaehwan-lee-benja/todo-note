import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './App.css'

// 기본 기획서 내용
const DEFAULT_SPEC_CONTENT = `# Todo Note 간단 기획서

## 📋 프로젝트 개요
**Todo Note** - 날짜별 투두 관리 및 루틴 트래킹 웹 애플리케이션

---

## 🎯 핵심 기능

### **투두 관리** - 날짜별 할 일 추가, 수정, 삭제 및 완료 체크

### **자동 이월** - 미완료 투두를 다음날로 자동 복사하여 놓치지 않게 관리

### **루틴 시스템** - 특정 요일마다 반복되는 작업을 자동으로 생성

### **날짜 네비게이션** - 달력으로 특정 날짜 이동 및 이전/다음 날 버튼

---

## 🛠️ 기술 스택

- **Frontend**: React 19.1.1 + Vite
- **Database**: Supabase (PostgreSQL)
- **Deployment**: GitHub Pages

---

## 🌐 접속 방법

- **배포 URL**: https://jaehwan-lee-benja.github.io/todo-note/
- **개발 서버**: \`npm run dev\` → http://localhost:5173/todo-note/`

// 드래그 가능한 Todo 항목 컴포넌트
function SortableTodoItem({ todo, index, onToggle, onDelete, onEdit, formatDate, formatDateOnly, isFocused, onFocus, onAddSubTodo, subtodos, level = 0, onCreateRoutine, routines }) {
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
      style={style}
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
          return (subtodos.length > 0 || todo.routine_id || hasCompletedDateBadge) && (
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
              {todo.routine_id && (
                <span
                  className="todo-badge clickable"
                  title="루틴 보기"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (showRoutineSetup) {
                      // 이미 루틴설정이 열려있으면 토글 닫기
                      setShowDetails(false)
                      setShowRoutineSetup(false)
                    } else {
                      // 루틴설정 열기
                      setShowDetails(true)
                      setShowRoutineSetup(true)
                      setShowNanotodos(false)
                      setIsAddingSubTodo(false)
                      setShowHistory(false)
                    }
                  }}
                >
                  📌
                </span>
              )}
            </div>
          )
        })()}
        <button
          className="details-toggle-button"
          onClick={(e) => {
            e.stopPropagation()
            const newShowDetails = !showDetails
            setShowDetails(newShowDetails)
            // 토글을 닫을 때는 모든 하위 섹션도 닫기
            if (!newShowDetails) {
              setShowNanotodos(false)
              setIsAddingSubTodo(false)
              setShowRoutineSetup(false)
              setShowHistory(false)
            }
          }}
          title={showDetails ? "세부정보 숨기기" : "세부정보 보기"}
        >
          {showDetails ? '▲' : '▼'}
        </button>
        {showDetails && !isEditing && (
          <>
            {!todo.parent_id && (
              <div className="todo-actions-inline">
                <button
                  className={`action-button-with-text ${showNanotodos ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (showNanotodos) {
                      setShowNanotodos(false)
                      setIsAddingSubTodo(false)
                    } else {
                      setShowNanotodos(true)
                      setIsAddingSubTodo(true)
                      setShowRoutineSetup(false)
                      setShowHistory(false)
                    }
                  }}
                  title="나노투두 추가"
                >
                  <span className="action-icon">🔬</span>
                  <span className="action-text">나노투두</span>
                </button>
                <button
                  className={`action-button-with-text ${showRoutineSetup ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (showRoutineSetup) {
                      setShowRoutineSetup(false)
                    } else {
                      setShowRoutineSetup(true)
                      setShowNanotodos(false)
                      setIsAddingSubTodo(false)
                      setShowHistory(false)
                    }
                  }}
                  title="이 작업을 루틴으로 설정"
                >
                  <span className="action-icon">📌</span>
                  <span className="action-text">루틴설정</span>
                </button>
                <button
                  className={`action-button-with-text ${showHistory ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (showHistory) {
                      setShowHistory(false)
                    } else {
                      handleToggleHistory()
                      setShowNanotodos(false)
                      setIsAddingSubTodo(false)
                      setShowRoutineSetup(false)
                    }
                  }}
                  title="히스토리 보기"
                >
                  <span className="action-icon">📋</span>
                  <span className="action-text">히스토리</span>
                </button>
              </div>
            )}
            {showHistory && (
              <div className="todo-history">
                <div className="history-item">
                  <span className="history-label">생성일:</span>
                  <span className="history-value">{formatDate(todo.created_at)}</span>
                </div>
                <div className="history-item">
                  <span className="history-label">생성된 페이지:</span>
                  <span className="history-value">{formatDateOnly(new Date(todo.date + 'T00:00:00'))}</span>
                </div>
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
            )}
            {showRoutineSetup && !todo.parent_id && (
              <div className="routine-setup-inline" onClick={(e) => e.stopPropagation()}>
                {currentRoutine && !isEditingRoutine ? (
                  // 이미 루틴이 설정된 경우 - 현재 설정 표시
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
                    </div>
                    <div className="routine-setup-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleStartEditRoutine()
                        }}
                        className="routine-confirm-button"
                      >
                        수정
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveRoutine()
                        }}
                        className="routine-remove-button"
                      >
                        제거
                      </button>
                    </div>
                  </>
                ) : (
                  // 루틴이 없거나 수정 모드인 경우 - 요일 선택
                  <>
                    <div className="routine-setup-title">
                      {isEditingRoutine ? '루틴 수정:' : '반복할 요일 선택:'}
                    </div>
                    <div className="day-selector-inline">
                      {DAYS.map(day => (
                        <button
                          key={day.key}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleToggleRoutineDay(day.key)
                          }}
                          className={`day-button-inline ${routineDays.includes(day.key) ? 'selected' : ''}`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    <div className="routine-setup-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          isEditingRoutine ? handleUpdateRoutine() : handleCreateRoutine()
                        }}
                        className="routine-confirm-button"
                        disabled={routineDays.length === 0}
                      >
                        확인
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCancelRoutineSetup()
                        }}
                        className="routine-cancel-button"
                      >
                        취소
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
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
    </div>
  )
}

// 요일 정보
const DAYS = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
]

// 숫자 요일을 키로 변환 (일요일=0, 월요일=1, ...)
const getDayKey = (dayNumber) => {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return keys[dayNumber]
}

function App() {
  const [todos, setTodos] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDraggingAny, setIsDraggingAny] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [deletedTodo, setDeletedTodo] = useState(null)
  const [showUndoToast, setShowUndoToast] = useState(false)
  const [showTrashModal, setShowTrashModal] = useState(false)
  const [trashedItems, setTrashedItems] = useState([])
  const [focusedTodoId, setFocusedTodoId] = useState(null)
  const [showRoutineModal, setShowRoutineModal] = useState(false)
  const [routines, setRoutines] = useState([])
  const [routineInput, setRoutineInput] = useState('')
  const [selectedDays, setSelectedDays] = useState([])
  const [isAddingRoutine, setIsAddingRoutine] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const recentlyEditedIds = useRef(new Set())
  const [editingRoutineId, setEditingRoutineId] = useState(null)
  const [editingRoutineText, setEditingRoutineText] = useState('')
  const [showRoutineHistory, setShowRoutineHistory] = useState(false)
  const [selectedRoutineForHistory, setSelectedRoutineForHistory] = useState(null)
  const [routineHistoryData, setRoutineHistoryData] = useState([])
  const [editingRoutineDays, setEditingRoutineDays] = useState([])
  const [dummySessions, setDummySessions] = useState([])
  const [showDummyModal, setShowDummyModal] = useState(false)
  const [showDummySQL, setShowDummySQL] = useState(false)
  const [showMemoModal, setShowMemoModal] = useState(false)
  const [memoContent, setMemoContent] = useState('')
  const [isEditingMemo, setIsEditingMemo] = useState(false)
  const [isSavingMemo, setIsSavingMemo] = useState(false)
  const [memoOriginalContent, setMemoOriginalContent] = useState('')
  const routineCreationInProgress = useRef(new Set()) // 날짜별 루틴 생성 중 플래그

  // 날짜를 YYYY-MM-DD 형식으로 변환 (DB 저장용)
  const formatDateForDB = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 날짜를 YY.MM.DD(요일) 형식으로 포맷팅 (네비게이션용)
  const formatDateOnly = (date) => {
    const year = String(date.getFullYear()).slice(2)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const weekday = weekdays[date.getDay()]
    return `${year}.${month}.${day}(${weekday})`
  }

  // 날짜를 YY.MM.DD(요일) HH:MM 형식으로 포맷팅 (생성시간 표시용)
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const year = String(date.getFullYear()).slice(2) // 마지막 두 자리만
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')

    const weekdays = ['일', '월', '화', '수', '목', '금', '토']
    const weekday = weekdays[date.getDay()]

    return `${year}.${month}.${day}(${weekday}) ${hours}:${minutes}`
  }

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
      const confirmDelete = window.confirm(duplicateList + '\n\n삭제하시겠습니까?')

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

  // 날짜 변경 핸들러
  const handlePrevDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const handleNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  // 날짜 선택 핸들러
  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value + 'T00:00:00')
    setSelectedDate(newDate)
  }


  // 전날 미완료 항목을 다음 날로 이월 (복사 방식)
  const moveIncompleteTodosToNextDay = async (fromDate, toDate) => {
    try {
      const fromDateStr = formatDateForDB(fromDate)
      const toDateStr = formatDateForDB(toDate)

      // 전날의 미완료 항목 가져오기 (이미 이월된 항목은 제외)
      const { data: incompleteTodos, error: fetchError } = await supabase
        .from('todos')
        .select('*')
        .eq('date', fromDateStr)
        .eq('deleted', false)
        .eq('completed', false)
        .is('original_todo_id', null)
        .order('order_index', { ascending: true })

      if (fetchError) throw fetchError

      if (incompleteTodos && incompleteTodos.length > 0) {
        // 다음 날의 기존 항목 가져오기
        const { data: nextDayTodos, error: nextDayError } = await supabase
          .from('todos')
          .select('*')
          .eq('date', toDateStr)
          .eq('deleted', false)
          .order('order_index', { ascending: true })

        if (nextDayError) throw nextDayError

        const nextDayCount = nextDayTodos ? nextDayTodos.length : 0

        // 다음 날 기존 항목이 있으면 그 뒤에 추가
        const startIndex = nextDayCount + 1

        // 미완료 항목들을 다음 날로 복사 (새 레코드 생성)
        const todosToInsert = incompleteTodos.map((todo, index) => ({
          text: todo.text,
          completed: false,
          date: toDateStr,
          order_index: startIndex + index,
          original_todo_id: todo.id, // 원본 투두 ID 저장
          parent_id: null, // 서브투두는 이월하지 않음
          routine_id: todo.routine_id
        }))

        const { error: insertError } = await supabase
          .from('todos')
          .insert(todosToInsert)

        if (insertError) throw insertError
      }
    } catch (error) {
      console.error('미완료 항목 이월 오류:', error.message)
    }
  }

  // 과거의 모든 미완료 항목을 오늘로 이월 (복사 방식)
  const movePastIncompleteTodosToToday = async () => {
    try {
      const today = new Date()
      const todayStr = formatDateForDB(today)

      // 오늘 이전 날짜의 모든 미완료 항목 가져오기
      const { data: pastIncompleteTodos, error: fetchError } = await supabase
        .from('todos')
        .select('*')
        .lt('date', todayStr)
        .eq('deleted', false)
        .eq('completed', false)
        .is('original_todo_id', null) // 이미 이월된 항목은 제외 (원본만)
        .order('date', { ascending: true })
        .order('order_index', { ascending: true })

      if (fetchError) throw fetchError

      if (pastIncompleteTodos && pastIncompleteTodos.length > 0) {
        // 오늘 날짜의 기존 항목 가져오기
        const { data: todayTodos, error: todayError } = await supabase
          .from('todos')
          .select('*')
          .eq('date', todayStr)
          .eq('deleted', false)
          .order('order_index', { ascending: true })

        if (todayError) throw todayError

        // 오늘 날짜에 이미 이월된 항목의 original_todo_id 목록
        const alreadyCarriedOverIds = new Set(
          todayTodos
            .filter(t => t.original_todo_id !== null)
            .map(t => t.original_todo_id)
        )

        // 아직 이월되지 않은 항목만 필터링
        const todosNeedCarryOver = pastIncompleteTodos.filter(
          todo => !alreadyCarriedOverIds.has(todo.id)
        )

        if (todosNeedCarryOver.length === 0) {
          return // 이월할 항목이 없음
        }

        const todayCount = todayTodos ? todayTodos.length : 0

        // 오늘 기존 항목이 있으면 그 뒤에 추가
        const startIndex = todayCount + 1

        // 과거 미완료 항목들을 오늘로 복사 (새 레코드 생성)
        const todosToInsert = todosNeedCarryOver.map((todo, index) => ({
          text: todo.text,
          completed: false,
          date: todayStr,
          order_index: startIndex + index,
          original_todo_id: todo.id, // 원본 투두 ID 저장
          parent_id: null, // 서브투두는 이월하지 않음
          routine_id: todo.routine_id
        }))

        const { error: insertError } = await supabase
          .from('todos')
          .insert(todosToInsert)

        if (insertError) throw insertError

        console.log(`${todosNeedCarryOver.length}개의 과거 미완료 항목을 오늘로 이월했습니다.`)
      }
    } catch (error) {
      console.error('과거 미완료 항목 이월 오류:', error.message)
    }
  }

  // 루틴 목록 가져오기
  const fetchRoutines = async () => {
    try {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('deleted', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRoutines(data || [])
    } catch (error) {
      console.error('루틴 가져오기 오류:', error.message)
    }
  }

  // 루틴 추가
  const handleAddRoutine = async () => {
    if (routineInput.trim() === '' || selectedDays.length === 0 || isAddingRoutine) return

    try {
      setIsAddingRoutine(true)

      const { data, error } = await supabase
        .from('routines')
        .insert([{ text: routineInput, days: selectedDays }])
        .select()

      if (error) throw error

      setRoutines([data[0], ...routines])
      setRoutineInput('')
      setSelectedDays([])
    } catch (error) {
      console.error('루틴 추가 오류:', error.message)
    } finally {
      setIsAddingRoutine(false)
    }
  }

  // 투두에서 루틴 생성/수정/제거
  const handleCreateRoutineFromTodo = async (todoId, text, days, routineId = null, remove = false) => {
    try {
      if (remove) {
        // 루틴 제거 - routine_id를 null로
        const { error: updateError } = await supabase
          .from('todos')
          .update({ routine_id: null })
          .eq('id', todoId)

        if (updateError) throw updateError

        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === todoId ? { ...todo, routine_id: null } : todo
          )
        )

        console.log('루틴 제거 완료')
        return
      }

      if (routineId) {
        // 기존 루틴 수정
        const { error } = await supabase
          .from('routines')
          .update({ days })
          .eq('id', routineId)

        if (error) throw error

        console.log(`루틴 수정 완료: ${text}`)

        // 로컬 루틴 목록 업데이트
        setRoutines(prevRoutines =>
          prevRoutines.map(r => r.id === routineId ? { ...r, days } : r)
        )
      } else {
        // 새 루틴 생성
        const { data, error } = await supabase
          .from('routines')
          .insert([{ text, days }])
          .select()

        if (error) throw error

        console.log(`루틴 생성 완료: ${text}`)

        // 해당 투두에 루틴 ID 연결
        const { error: updateError } = await supabase
          .from('todos')
          .update({ routine_id: data[0].id })
          .eq('id', todoId)

        if (updateError) throw updateError

        // 로컬 상태 업데이트
        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === todoId ? { ...todo, routine_id: data[0].id } : todo
          )
        )

        if (showRoutineModal) {
          setRoutines([data[0], ...routines])
        }
      }
    } catch (error) {
      console.error('루틴 처리 오류:', error.message)
    }
  }

  // 루틴 수정 시작
  const handleStartEditRoutine = (routine) => {
    setEditingRoutineId(routine.id)
    setEditingRoutineText(routine.text)
    setEditingRoutineDays(routine.days)
  }

  // 루틴 수정 취소
  const handleCancelEditRoutine = () => {
    setEditingRoutineId(null)
    setEditingRoutineText('')
    setEditingRoutineDays([])
  }

  // 루틴 수정 저장
  const handleSaveEditRoutine = async () => {
    if (!editingRoutineId || editingRoutineText.trim() === '' || editingRoutineDays.length === 0) return

    try {
      const { error } = await supabase
        .from('routines')
        .update({
          text: editingRoutineText.trim(),
          days: editingRoutineDays
        })
        .eq('id', editingRoutineId)

      if (error) throw error

      // 로컬 상태 업데이트
      setRoutines(routines.map(routine =>
        routine.id === editingRoutineId
          ? { ...routine, text: editingRoutineText.trim(), days: editingRoutineDays }
          : routine
      ))

      // 수정 상태 초기화
      handleCancelEditRoutine()
    } catch (error) {
      console.error('루틴 수정 오류:', error.message)
    }
  }

  // 루틴 수정 시 요일 토글
  const handleToggleEditDay = (dayKey) => {
    setEditingRoutineDays(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 루틴 삭제
  const handleDeleteRoutine = async (id) => {
    try {
      // 1. 루틴 삭제
      const { error } = await supabase
        .from('routines')
        .update({ deleted: true })
        .eq('id', id)

      if (error) throw error

      // 2. 해당 루틴을 사용하는 모든 투두의 routine_id를 null로 업데이트
      const { error: updateError } = await supabase
        .from('todos')
        .update({ routine_id: null })
        .eq('routine_id', id)

      if (updateError) {
        console.error('투두 루틴 ID 업데이트 오류:', updateError.message)
      }

      // 3. 로컬 상태에서 루틴 제거
      setRoutines(routines.filter(routine => routine.id !== id))

      // 4. 로컬 투두 상태에서 routine_id 제거
      setTodos(prevTodos =>
        prevTodos.map(todo =>
          todo.routine_id === id ? { ...todo, routine_id: null } : todo
        )
      )
    } catch (error) {
      console.error('루틴 삭제 오류:', error.message)
    }
  }

  // 특정 날짜의 루틴 작업 자동 생성
  const createRoutineTodosForDate = async (dateStr) => {
    // 이미 생성 중이면 중복 실행 방지
    if (routineCreationInProgress.current.has(dateStr)) {
      console.log(`루틴 작업 생성 중 (중복 방지): ${dateStr}`)
      return
    }

    try {
      // 생성 시작 플래그 설정
      routineCreationInProgress.current.add(dateStr)

      const targetDate = new Date(dateStr)
      const dayKey = getDayKey(targetDate.getDay())

      // 날짜 표시 형식: "11/17(월)"
      const month = targetDate.getMonth() + 1
      const date = targetDate.getDate()
      const dayNames = ['일', '월', '화', '수', '목', '금', '토']
      const dayName = dayNames[targetDate.getDay()]
      const dateDisplay = `${month}/${date}(${dayName})`

      const { data: allRoutines, error: routineError } = await supabase
        .from('routines')
        .select('*')
        .eq('deleted', false)

      if (routineError) throw routineError

      const matchingRoutines = allRoutines.filter(routine => {
        const days = routine.days || []
        return days.includes(dayKey)
      })

      if (matchingRoutines.length === 0) return

      for (const routine of matchingRoutines) {
        const todoText = `${routine.text}-for ${dateDisplay}`

        // 1차 체크: routine_id로 확인
        const { data: existingByRoutineId, error: checkError1 } = await supabase
          .from('todos')
          .select('id')
          .eq('date', dateStr)
          .eq('routine_id', routine.id)
          .eq('deleted', false)

        if (checkError1) throw checkError1

        // 2차 체크: 텍스트로 확인 (동시 실행 경쟁 조건 대비)
        const { data: existingByText, error: checkError2 } = await supabase
          .from('todos')
          .select('id')
          .eq('date', dateStr)
          .eq('text', todoText)
          .eq('deleted', false)

        if (checkError2) throw checkError2

        // 둘 중 하나라도 존재하면 생성하지 않음
        if ((existingByRoutineId && existingByRoutineId.length > 0) ||
            (existingByText && existingByText.length > 0)) {
          continue
        }

        // 투두 생성
        const { error: insertError } = await supabase
          .from('todos')
          .insert([{
            text: todoText,
            completed: false,
            date: dateStr,
            order_index: 0, // 루틴은 제일 위에
            routine_id: routine.id
          }])

        if (insertError) {
          // 동시 실행으로 인한 중복은 무시
          console.log(`루틴 작업 생성 실패 (중복 가능성): ${todoText}`)
        } else {
          console.log(`루틴 작업 생성: ${todoText} (${dateStr})`)
        }
      }
    } catch (error) {
      console.error('루틴 작업 생성 오류:', error.message)
    } finally {
      // 생성 완료 후 플래그 해제 (1초 후 - 다른 실행도 완료될 시간)
      setTimeout(() => {
        routineCreationInProgress.current.delete(dateStr)
      }, 1000)
    }
  }

  // 오늘 요일의 루틴 작업 자동 생성 (자정용)
  const createRoutineTodos = async () => {
    const today = new Date()
    const todayStr = formatDateForDB(today)
    await createRoutineTodosForDate(todayStr)
  }

  // 루틴 히스토리 조회
  const fetchRoutineHistory = async (routine) => {
    try {
      // 해당 루틴의 모든 투두 조회
      const { data: routineTodos, error } = await supabase
        .from('todos')
        .select('*')
        .eq('routine_id', routine.id)
        .eq('deleted', false)
        .order('date', { ascending: true })

      if (error) throw error

      setRoutineHistoryData(routineTodos || [])
      setSelectedRoutineForHistory(routine)
      setShowRoutineHistory(true)
    } catch (error) {
      console.error('루틴 히스토리 조회 오류:', error.message)
      alert('루틴 히스토리 조회 실패: ' + error.message)
    }
  }

  const handleCloseRoutineHistory = () => {
    setShowRoutineHistory(false)
    setSelectedRoutineForHistory(null)
    setRoutineHistoryData([])
  }

  // 루틴 모달 열기/닫기
  const handleOpenRoutine = () => {
    setShowRoutineModal(true)
    fetchRoutines()
  }

  const handleCloseRoutine = () => {
    setShowRoutineModal(false)
    setRoutineInput('')
    setSelectedDays([])
  }

  const handleToggleDay = (dayKey) => {
    setSelectedDays(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 스크롤바 표시 제어
  useEffect(() => {
    let scrollTimer = null

    const handleScroll = () => {
      // 스크롤 시작 시 클래스 추가
      document.body.classList.add('is-scrolling')

      // 기존 타이머 클리어
      if (scrollTimer) {
        clearTimeout(scrollTimer)
      }

      // 1초 후 클래스 제거
      scrollTimer = setTimeout(() => {
        document.body.classList.remove('is-scrolling')
      }, 1000)
    }

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimer) {
        clearTimeout(scrollTimer)
      }
    }
  }, [])

  // 앱 시작 시 루틴 목록 가져오기
  useEffect(() => {
    fetchRoutines()
  }, [])

  // 앱 시작 시 과거 미완료 항목을 오늘로 이월
  useEffect(() => {
    movePastIncompleteTodosToToday()
  }, [])

  // 자정에 날짜 자동 업데이트 및 루틴 생성
  useEffect(() => {
    const checkMidnight = async () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const timeUntilMidnight = midnight.getTime() - now.getTime()

      const timer = setTimeout(async () => {
        const yesterday = new Date(now)
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // 전날 미완료 항목을 다음 날로 이동
        await moveIncompleteTodosToNextDay(yesterday, tomorrow)

        // 루틴 작업 생성
        await createRoutineTodos()

        // 날짜 업데이트
        setSelectedDate(new Date())
        checkMidnight() // 다음 자정을 위해 재귀 호출
      }, timeUntilMidnight)

      return timer
    }

    const timer = checkMidnight()
    return () => clearTimeout(timer)
  }, [])

  // 선택된 날짜가 변경될 때마다 할 일 목록 가져오기
  useEffect(() => {
    fetchTodos()

    // Supabase Realtime 구독
    const dateStr = formatDateForDB(selectedDate)
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `date=eq.${dateStr}`
        },
        (payload) => {
          console.log('Realtime 변경 감지:', payload)

          if (payload.eventType === 'INSERT') {
            // 새 항목 추가
            setTodos(currentTodos => {
              // 중복 체크
              if (currentTodos.some(t => t.id === payload.new.id)) {
                return currentTodos
              }
              // order_index에 따라 정렬된 위치에 삽입
              const newTodos = [...currentTodos, payload.new]
              return newTodos.sort((a, b) => a.order_index - b.order_index)
            })
          } else if (payload.eventType === 'UPDATE') {
            // 항목 업데이트 (단, 최근에 로컬에서 수정한 항목은 무시)
            setTodos(currentTodos => {
              // 최근에 수정한 항목인지 확인
              if (recentlyEditedIds.current.has(payload.new.id)) {
                return currentTodos
              }
              return currentTodos.map(todo =>
                todo.id === payload.new.id ? payload.new : todo
              ).sort((a, b) => a.order_index - b.order_index)
            })
          } else if (payload.eventType === 'DELETE') {
            // 항목 삭제
            setTodos(currentTodos =>
              currentTodos.filter(todo => todo.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime 구독 상태:', status)
      })

    // 컴포넌트 언마운트 또는 날짜 변경 시 구독 해제
    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDate])

  // 드래그 중 스크롤 차단
  useEffect(() => {
    if (isDraggingAny) {
      // 현재 스크롤 위치 저장
      const scrollY = window.scrollY
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

      // body에 overflow hidden 적용 (스크롤바 너비 보상)
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }

      return () => {
        // 스크롤 복원
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        document.body.style.paddingRight = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isDraggingAny])

  const fetchTodos = async () => {
    try {
      setLoading(true)
      const dateStr = formatDateForDB(selectedDate)

      // 해당 날짜의 요일에 맞는 루틴 투두 자동 생성
      await createRoutineTodosForDate(dateStr)

      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('date', dateStr)
        .eq('deleted', false)
        .order('order_index', { ascending: true })

      if (error) throw error
      setTodos(data || [])
    } catch (error) {
      console.error('할 일 가져오기 오류:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchTrash = async () => {
    try {
      const dateStr = formatDateForDB(selectedDate)
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted_date', dateStr)
        .eq('deleted', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTrashedItems(data || [])
    } catch (error) {
      console.error('휴지통 가져오기 오류:', error.message)
    }
  }

  const handleAddTodo = async () => {
    if (inputValue.trim() === '' || isAdding) return

    try {
      setIsAdding(true)

      // 새 항목은 맨 아래에 추가
      const newOrderIndex = todos.length > 0 ? Math.max(...todos.map(t => t.order_index)) + 1 : 1

      // 새 항목을 추가
      const dateStr = formatDateForDB(selectedDate)
      const { data, error } = await supabase
        .from('todos')
        .insert([{ text: inputValue, completed: false, order_index: newOrderIndex, date: dateStr }])
        .select()

      if (error) throw error

      // 로컬 상태 업데이트
      setTodos([...todos, data[0]])
      setInputValue('')
    } catch (error) {
      console.error('할 일 추가 오류:', error.message)
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggleTodo = async (id) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    try {
      const newCompleted = !todo.completed
      const completedAt = newCompleted ? new Date().toISOString() : null

      // 현재 투두 업데이트
      const { error } = await supabase
        .from('todos')
        .update({
          completed: newCompleted,
          completed_at: completedAt
        })
        .eq('id', id)

      if (error) throw error

      // 이월된 투두라면 원본도 완료 처리
      if (newCompleted && todo.original_todo_id) {
        await supabase
          .from('todos')
          .update({
            completed: true,
            completed_at: completedAt
          })
          .eq('id', todo.original_todo_id)
      }

      setTodos(todos.map(t =>
        t.id === id ? { ...t, completed: newCompleted, completed_at: completedAt } : t
      ))
    } catch (error) {
      console.error('할 일 토글 오류:', error.message)
    }
  }

  const handleDeleteTodo = async (id) => {
    try {
      // 삭제할 todo 찾기
      const todoToDelete = todos.find(todo => todo.id === id)
      if (!todoToDelete) return

      // 삭제된 todo 저장
      setDeletedTodo(todoToDelete)

      // Soft delete: deleted=true, deleted_date=오늘
      const dateStr = formatDateForDB(selectedDate)
      const { error } = await supabase
        .from('todos')
        .update({ deleted: true, deleted_date: dateStr })
        .eq('id', id)

      if (error) throw error

      // UI에서 제거
      setTodos(todos.filter(todo => todo.id !== id))

      // 토스트 표시
      setShowUndoToast(true)

      // 5초 후 토스트 자동 숨김
      setTimeout(() => {
        setShowUndoToast(false)
        setDeletedTodo(null)
      }, 5000)
    } catch (error) {
      console.error('할 일 삭제 오류:', error.message)
    }
  }

  const handleUndoDelete = async () => {
    if (!deletedTodo) return

    try {
      // Soft delete 취소: deleted=false, deleted_date=null
      const { error } = await supabase
        .from('todos')
        .update({ deleted: false, deleted_date: null })
        .eq('id', deletedTodo.id)

      if (error) throw error

      // UI에 다시 추가
      setTodos(currentTodos => {
        const restoredTodo = { ...deletedTodo, deleted: false, deleted_date: null }
        const newTodos = [...currentTodos, restoredTodo]
        return newTodos.sort((a, b) => a.order_index - b.order_index)
      })

      // 토스트 숨김
      setShowUndoToast(false)
      setDeletedTodo(null)
    } catch (error) {
      console.error('삭제 취소 오류:', error.message)
    }
  }

  const handleRestoreFromTrash = async (id) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ deleted: false, deleted_date: null })
        .eq('id', id)

      if (error) throw error

      // 휴지통에서 제거
      setTrashedItems(trashedItems.filter(item => item.id !== id))

      // 일반 리스트 새로고침
      fetchTodos()
    } catch (error) {
      console.error('복원 오류:', error.message)
    }
  }

  const handlePermanentDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)

      if (error) throw error

      // 휴지통에서 제거
      setTrashedItems(trashedItems.filter(item => item.id !== id))
    } catch (error) {
      console.error('영구 삭제 오류:', error.message)
    }
  }

  const handleOpenTrash = () => {
    setShowTrashModal(true)
    fetchTrash()
  }

  const handleCloseTrash = () => {
    setShowTrashModal(false)
  }

  // 메모 관련 함수
  const handleOpenMemo = async () => {
    setShowMemoModal(true)
    await fetchMemoContent()
  }

  const handleCloseMemo = () => {
    setShowMemoModal(false)
    setIsEditingMemo(false)
    setMemoContent(memoOriginalContent) // 취소 시 원래 내용으로 복원
  }

  const fetchMemoContent = async () => {
    try {
      const { data, error } = await supabase
        .from('spec_memos')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      const content = data && data.length > 0 ? data[0].content : DEFAULT_SPEC_CONTENT
      setMemoContent(content)
      setMemoOriginalContent(content)
    } catch (error) {
      console.error('메모 내용 가져오기 오류:', error.message)
      setMemoContent(DEFAULT_SPEC_CONTENT)
      setMemoOriginalContent(DEFAULT_SPEC_CONTENT)
    }
  }

  const handleEditMemo = () => {
    setIsEditingMemo(true)
  }

  const handleSaveMemo = async () => {
    if (isSavingMemo) return

    try {
      setIsSavingMemo(true)

      // 기존 메모 데이터 가져오기
      const { data: existingData, error: fetchError } = await supabase
        .from('spec_memos')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) throw fetchError

      if (existingData && existingData.length > 0) {
        // 업데이트
        const { error: updateError } = await supabase
          .from('spec_memos')
          .update({ content: memoContent, updated_at: new Date().toISOString() })
          .eq('id', existingData[0].id)

        if (updateError) throw updateError
      } else {
        // 새로 생성
        const { error: insertError } = await supabase
          .from('spec_memos')
          .insert([{ content: memoContent }])

        if (insertError) throw insertError
      }

      setMemoOriginalContent(memoContent)
      setIsEditingMemo(false)
    } catch (error) {
      console.error('메모 저장 오류:', error.message)
    } finally {
      setIsSavingMemo(false)
    }
  }

  const handleResetMemo = () => {
    setMemoContent(memoOriginalContent)
    setIsEditingMemo(false)
  }

  const handleFocusTodo = (id) => {
    setFocusedTodoId(focusedTodoId === id ? null : id)
  }

  const handleAddSubTodo = async (parentId, subTodoText) => {
    if (!subTodoText || subTodoText.trim() === '') return

    try {
      // 해당 부모의 서브 투두 개수 확인
      const parentSubtodos = todos.filter(t => t.parent_id === parentId)
      const newOrderIndex = parentSubtodos.length + 1

      const dateStr = formatDateForDB(selectedDate)
      const { data, error } = await supabase
        .from('todos')
        .insert([{
          text: subTodoText.trim(),
          completed: false,
          order_index: newOrderIndex,
          date: dateStr,
          parent_id: parentId
        }])
        .select()

      if (error) throw error

      // 로컬 상태 업데이트
      setTodos([...todos, data[0]])
    } catch (error) {
      console.error('하위 할 일 추가 오류:', error.message)
    }
  }

  const handleEditTodo = async (id, newText) => {
    try {
      let currentTodo = null

      // 수정 중인 ID로 표시 (Realtime UPDATE 무시하기 위함)
      recentlyEditedIds.current.add(id)

      // 먼저 로컬 상태 업데이트 (즉각적인 UI 반영) - 함수형 업데이트 사용
      const now = new Date().toISOString()
      setTodos(prevTodos => {
        currentTodo = prevTodos.find(t => t.id === id)
        if (!currentTodo || currentTodo.text === newText) {
          recentlyEditedIds.current.delete(id)
          return prevTodos
        }
        return prevTodos.map(todo =>
          todo.id === id ? { ...todo, text: newText, updated_at: now } : todo
        )
      })

      if (!currentTodo || currentTodo.text === newText) return

      // 히스토리에 변경 기록 추가 (어떤 날짜 페이지에서 변경되었는지도 기록)
      const { error: historyError } = await supabase
        .from('todo_history')
        .insert([{
          todo_id: id,
          previous_text: currentTodo.text,
          new_text: newText,
          changed_on_date: currentTodo.date
        }])

      if (historyError) {
        console.error('히스토리 저장 오류:', historyError.message)
      }

      // 이월된 투두라면 원본의 히스토리에도 기록
      if (currentTodo.original_todo_id) {
        // 원본 투두 정보 가져오기
        const { data: originalTodo, error: originalError } = await supabase
          .from('todos')
          .select('text, date')
          .eq('id', currentTodo.original_todo_id)
          .single()

        if (!originalError && originalTodo) {
          // 원본 투두의 히스토리에도 변경 기록 추가
          await supabase
            .from('todo_history')
            .insert([{
              todo_id: currentTodo.original_todo_id,
              previous_text: currentTodo.text, // 이월 당시의 텍스트
              new_text: newText,
              changed_on_date: currentTodo.date // 현재 페이지 날짜
            }])
        }
      }

      // 투두 텍스트 업데이트
      const { error } = await supabase
        .from('todos')
        .update({ text: newText })
        .eq('id', id)

      if (error) {
        console.error('할 일 수정 오류:', error.message)
        // 오류 발생 시 원래 상태로 복구
        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === id ? currentTodo : todo
          )
        )
        recentlyEditedIds.current.delete(id)
      } else {
        // 성공 시 5초 후 수정 완료 표시 제거
        setTimeout(() => {
          recentlyEditedIds.current.delete(id)
        }, 5000)
      }
    } catch (error) {
      console.error('할 일 수정 오류:', error.message)
      recentlyEditedIds.current.delete(id)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTodo()
    }
  }

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 10,
        distance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 드래그 시작 핸들러
  const handleDragStart = () => {
    setIsDraggingAny(true)
  }

  // 드래그 취소 핸들러
  const handleDragCancel = () => {
    setIsDraggingAny(false)
  }

  // 드래그 종료 핸들러
  const handleDragEnd = async (event) => {
    setIsDraggingAny(false)

    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = todos.findIndex((todo) => todo.id === active.id)
    const newIndex = todos.findIndex((todo) => todo.id === over.id)

    // 로컬 상태 즉시 업데이트
    const newTodos = arrayMove(todos, oldIndex, newIndex)
    setTodos(newTodos)

    // Supabase에 새로운 순서 저장
    try {
      const updates = newTodos.map((todo, index) => ({
        id: todo.id,
        order_index: index + 1
      }))

      for (const update of updates) {
        await supabase
          .from('todos')
          .update({ order_index: update.order_index })
          .eq('id', update.id)
      }
    } catch (error) {
      console.error('순서 업데이트 오류:', error.message)
      // 오류 시 다시 가져오기
      fetchTodos()
    }
  }

  return (
    <div className={`app ${isDraggingAny ? 'dragging-active' : ''}`}>
      {/* 햄버거 메뉴 버튼 */}
      <button
        className={`hamburger-menu ${showSidebar ? 'hidden' : ''}`}
        onClick={() => setShowSidebar(!showSidebar)}
        title="메뉴"
      >
        ☰
      </button>

      {/* 사이드바 오버레이 */}
      {showSidebar && (
        <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />
      )}

      {/* 사이드바 */}
      <div className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>메뉴</h2>
          <button className="sidebar-close" onClick={() => setShowSidebar(false)}>✕</button>
        </div>
        <div className="sidebar-content">
          <button
            className="sidebar-menu-item"
            onClick={() => {
              handleOpenTrash()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">🗑️</span>
            <span>휴지통</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              handleOpenRoutine()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">📌</span>
            <span>루틴 관리</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              handleOpenMemo()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">📝</span>
            <span>기획서 메모</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              setShowDummyModal(true)
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">🧪</span>
            <span>더미 데이터 관리</span>
          </button>
        </div>
      </div>

      <div className="container">
        <div className="header-fixed">
          <h1>to-do note</h1>

          <div className="input-section">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="새로운 할 일을 입력하세요..."
              className="todo-input"
              disabled={isAdding}
            />
            <button onClick={handleAddTodo} className="add-button" disabled={isAdding}>
              추가
            </button>
          </div>

          <div className="date-navigation">
            <button onClick={handlePrevDay} className="date-nav-button">←</button>
            <div className="date-picker-wrapper">
              <span className="date-display">
                {formatDateOnly(selectedDate)}
              </span>
              <input
                type="date"
                value={formatDateForDB(selectedDate)}
                onChange={handleDateChange}
                className="date-picker-input"
              />
            </div>
            <button onClick={handleNextDay} className="date-nav-button">→</button>
          </div>
        </div>

        <div className="content-scrollable">

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="todo-list">
            {loading ? (
              <p className="empty-message">로딩 중...</p>
            ) : todos.length === 0 ? (
              <p className="empty-message">아직 할 일이 없습니다. 새로운 할 일을 추가해보세요!</p>
            ) : (() => {
              // 루틴 투두와 일반 투두 분리
              const routineTodos = todos.filter(t => !t.parent_id && t.routine_id !== null)
              const normalTodos = todos.filter(t => !t.parent_id && t.routine_id === null)

              return (
                <>
                  {/* 루틴 섹션 */}
                  {routineTodos.length > 0 && (
                    <div className="routine-section">
                      <h3 className="section-title">📌 루틴</h3>
                      <SortableContext
                        items={routineTodos.map(todo => todo.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {routineTodos.map((todo, index) => {
                          const subtodos = todos.filter(t => t.parent_id === todo.id)
                          return (
                            <SortableTodoItem
                              key={todo.id}
                              todo={todo}
                              index={index}
                              onToggle={handleToggleTodo}
                              onDelete={handleDeleteTodo}
                              onEdit={handleEditTodo}
                              formatDate={formatDate}
                              formatDateOnly={formatDateOnly}
                              isFocused={focusedTodoId === todo.id}
                              onFocus={handleFocusTodo}
                              onAddSubTodo={handleAddSubTodo}
                              subtodos={subtodos}
                              level={0}
                              onCreateRoutine={handleCreateRoutineFromTodo}
                              routines={routines}
                            />
                          )
                        })}
                      </SortableContext>
                    </div>
                  )}

                  {/* 일반 투두 섹션 */}
                  {normalTodos.length > 0 && (
                    <div className="normal-section">
                      {routineTodos.length > 0 && <h3 className="section-title">📝 일반 투두</h3>}
                      <SortableContext
                        items={normalTodos.map(todo => todo.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {normalTodos.map((todo, index, array) => {
                  const subtodos = todos.filter(t => t.parent_id === todo.id)

                  // 현재 보고 있는 페이지의 날짜 (selectedDate)
                  const currentPageDate = formatDateForDB(selectedDate)

                  // 투두의 생성일 (created_at에서 날짜만 추출)
                  const todoCreatedDate = todo.created_at ? todo.created_at.split('T')[0] : todo.date

                  // 다음 투두의 생성일
                  const nextTodo = array[index + 1]
                  const nextTodoCreatedDate = nextTodo
                    ? (nextTodo.created_at ? nextTodo.created_at.split('T')[0] : nextTodo.date)
                    : null

                  // 현재 투두는 페이지 날짜 이전에 생성, 다음 투두는 페이지 날짜에 생성된 경우 구분선 표시
                  const showSeparator = todoCreatedDate < currentPageDate && nextTodoCreatedDate >= currentPageDate

                  // 디버깅
                  if (index < 5) {
                    console.log('투두:', todo.text.substring(0, 30), '생성일:', todoCreatedDate, '다음생성일:', nextTodoCreatedDate, '페이지:', currentPageDate, 'separator:', showSeparator)
                  }

                  return (
                    <React.Fragment key={todo.id}>
                      <SortableTodoItem
                        todo={todo}
                        index={index}
                        onToggle={handleToggleTodo}
                        onDelete={handleDeleteTodo}
                        onEdit={handleEditTodo}
                        formatDate={formatDate}
                        formatDateOnly={formatDateOnly}
                        isFocused={focusedTodoId === todo.id}
                        onFocus={handleFocusTodo}
                        onAddSubTodo={handleAddSubTodo}
                        subtodos={subtodos}
                        level={0}
                        onCreateRoutine={handleCreateRoutineFromTodo}
                        routines={routines}
                      />
                      {showSeparator && (
                        <div className="todo-date-separator">
                          <div className="separator-line"></div>
                          <div className="separator-text">이전에서 넘어옴</div>
                          <div className="separator-line"></div>
                        </div>
                      )}
                    </React.Fragment>
                  )
                })}
                      </SortableContext>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </DndContext>

        <div className="todo-stats">
          <p>전체: {todos.length}개 | 완료: {todos.filter(t => t.completed).length}개</p>
        </div>

        {/* 더미 데이터 SQL 복사 섹션 */}
        <div className="dummy-sql-section">
          <button
            className="dummy-sql-toggle"
            onClick={() => setShowDummySQL(!showDummySQL)}
          >
            {showDummySQL ? '▲' : '▼'} 더미 데이터 SQL
          </button>

          {showDummySQL && (
            <div className="dummy-sql-content">
              <div className="sql-block">
                <div className="sql-header">
                  <span>생성 SQL</span>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button
                      onClick={() => {
                        window.open('https://raw.githubusercontent.com/jaehwan-lee-benja/todo-note/main/create-dummy-data-v2.sql', '_blank');
                      }}
                      className="link-button"
                      title="GitHub에서 파일 보기"
                    >
                      🔗
                    </button>
                    <button
                      onClick={() => {
                        // 현재 날짜 기준 동적 SQL 생성
                        const today = new Date();
                        const getDateStr = (offset) => {
                          const d = new Date(today);
                          d.setDate(d.getDate() + offset);
                          return d.toISOString().split('T')[0];
                        };
                        const getDay = (offset) => {
                          const d = new Date(today);
                          d.setDate(d.getDate() + offset);
                          return d.getDate();
                        };

                        const sessionId = Date.now();
                        const d_m2 = getDay(-2), d_m1 = getDay(-1), d_0 = getDay(0), d_p1 = getDay(1), d_p2 = getDay(2);
                        const date_m2 = getDateStr(-2), date_m1 = getDateStr(-1), date_0 = getDateStr(0), date_p1 = getDateStr(1), date_p2 = getDateStr(2);

                        const createSQL = `-- 오늘 날짜 기준 앞뒤 이틀씩 더미 데이터 생성 (${date_0} 기준)
INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음', '${date_m2}', false, '${date_m2}T09:00:00+09:00', 1001),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m2}일완료', '${date_m2}', true, '${date_m2}T09:10:00+09:00', 1002),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m1}일완료', '${date_m2}', true, '${date_m2}T09:20:00+09:00', 1003),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_0}일완료', '${date_m2}', true, '${date_m2}T09:30:00+09:00', 1004);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-수정이력있음', '${date_m1}', false, '${date_m1}T10:00:00+09:00', 1005),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_m1}일완료', '${date_m1}', true, '${date_m1}T10:10:00+09:00', 1006),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_0}일완료', '${date_m1}', true, '${date_m1}T10:20:00+09:00', 1007);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-미완료', '${date_0}', false, '${date_0}T11:00:00+09:00', 1008),
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-${d_0}일완료', '${date_0}', true, '${date_0}T11:10:00+09:00', 1009);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m1}일페이지-미완료', '${date_m1}', false, '${date_m2}T14:00:00+09:00', 1010),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m1}일페이지-${d_m1}일완료', '${date_m1}', true, '${date_m2}T14:10:00+09:00', 1011);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_0}일페이지-미완료', '${date_0}', false, '${date_m1}T15:00:00+09:00', 1012),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_0}일페이지-${d_0}일완료', '${date_0}', true, '${date_m1}T15:10:00+09:00', 1013),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_0}일페이지-미완료', '${date_0}', false, '${date_m2}T15:00:00+09:00', 1014),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_0}일페이지-${d_0}일완료', '${date_0}', true, '${date_m2}T15:10:00+09:00', 1015);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-${d_p1}일페이지-미완료', '${date_p1}', false, '${date_0}T16:00:00+09:00', 1016),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_p1}일페이지-미완료', '${date_p1}', false, '${date_m1}T16:00:00+09:00', 1017),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_p1}일페이지-미완료', '${date_p1}', false, '${date_m2}T16:00:00+09:00', 1018);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-${d_p2}일페이지-미완료', '${date_p2}', false, '${date_0}T17:00:00+09:00', 1019),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_p2}일페이지-미완료', '${date_p2}', false, '${date_m1}T17:00:00+09:00', 1020);

INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT id, '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-1차', '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-2차', '${date_m1}T12:00:00+09:00', '${date_m1}'
FROM todos WHERE text = '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음' LIMIT 1;

INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT id, '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-2차', '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음', '${date_0}T12:00:00+09:00', '${date_0}'
FROM todos WHERE text = '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음' LIMIT 1;

INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT id, '[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-1차', '[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-수정이력있음', '${date_0}T13:00:00+09:00', '${date_0}'
FROM todos WHERE text = '[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-수정이력있음' LIMIT 1;`;

                        // Fallback 복사 방법 (HTTPS 없이도 작동)
                        const textarea = document.createElement('textarea');
                        textarea.value = createSQL;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        try {
                          document.execCommand('copy');
                          alert('생성 SQL 복사 완료!');
                        } catch (err) {
                          alert('복사에 실패했습니다.');
                        }
                        document.body.removeChild(textarea);
                      }}
                      className="copy-button"
                    >
                      📋 복사
                    </button>
                  </div>
                </div>
                <pre className="sql-code">{`-- ⚠️ 참고: 복사 버튼 클릭 시 오늘 날짜 기준으로 자동 생성됩니다
-- 아래는 예시입니다 (실제 날짜는 실행 시점 기준 앞뒤 이틀)

-- DO 블록 버전 (PostgreSQL/Supabase)
DO $$
DECLARE
  day_m2 date := CURRENT_DATE - INTERVAL '2 days';
  day_m1 date := CURRENT_DATE - INTERVAL '1 day';
  day_0 date := CURRENT_DATE;
  day_p1 date := CURRENT_DATE + INTERVAL '1 day';
  day_p2 date := CURRENT_DATE + INTERVAL '2 days';
  d_m2 text := EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '2 days')::text;
  d_m1 text := EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '1 day')::text;
  d_0 text := EXTRACT(DAY FROM CURRENT_DATE)::text;
  d_p1 text := EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '1 day')::text;
  d_p2 text := EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '2 days')::text;
  session_id text := EXTRACT(EPOCH FROM NOW())::bigint::text;
BEGIN
  -- -2일 페이지 데이터 (4개)
  INSERT INTO todos (text, date, completed, created_at, order_index)
  VALUES
    ('[DUMMY-' || session_id || '] 더미: ' || d_m2 || '일생성-미완료-수정이력있음', day_m2, false, (day_m2 + TIME '09:00:00') AT TIME ZONE 'Asia/Seoul', 1001),
    ...

  -- 총 20개의 투두와 3개의 히스토리 생성
  -- 자세한 내용은 GitHub 파일 참고
END $$;`}</pre>
              </div>

              <div className="sql-block">
                <div className="sql-header">
                  <span>삭제 SQL</span>
                  <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button
                      onClick={() => {
                        window.open('https://raw.githubusercontent.com/jaehwan-lee-benja/todo-note/main/delete-dummy-data-v2.sql', '_blank');
                      }}
                      className="link-button"
                      title="GitHub에서 파일 보기"
                    >
                      🔗
                    </button>
                    <button
                      onClick={() => {
                        const deleteSQL = `DELETE FROM todo_history
WHERE todo_id IN (
  SELECT id FROM todos WHERE text LIKE '[DUMMY-%'
);

DELETE FROM todos
WHERE text LIKE '[DUMMY-%';`;

                        // Fallback 복사 방법 (HTTPS 없이도 작동)
                        const textarea = document.createElement('textarea');
                        textarea.value = deleteSQL;
                        textarea.style.position = 'fixed';
                        textarea.style.opacity = '0';
                        document.body.appendChild(textarea);
                        textarea.select();
                        try {
                          document.execCommand('copy');
                          alert('삭제 SQL 복사 완료!');
                        } catch (err) {
                          alert('복사에 실패했습니다.');
                        }
                        document.body.removeChild(textarea);
                      }}
                      className="copy-button"
                    >
                      📋 복사
                    </button>
                  </div>
                </div>
                <pre className="sql-code">{`DELETE FROM todo_history
WHERE todo_id IN (
  SELECT id FROM todos WHERE text LIKE '[DUMMY-%'
);

DELETE FROM todos
WHERE text LIKE '[DUMMY-%';`}</pre>
              </div>
            </div>
          )}
        </div>
        </div>

        {showUndoToast && (
          <div className="undo-toast">
            <span>삭제되었습니다</span>
            <button onClick={handleUndoDelete} className="undo-button">
              취소
            </button>
          </div>
        )}

        {showTrashModal && (
          <div className="modal-overlay" onClick={handleCloseTrash}>
            <div className="modal-content trash-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🗑️ 휴지통 - {formatDateOnly(selectedDate)}</h2>
                <button onClick={handleCloseTrash} className="modal-close-button">✕</button>
              </div>
              <div className="trash-list">
                {trashedItems.length === 0 ? (
                  <p className="empty-message">휴지통이 비어있습니다.</p>
                ) : (
                  trashedItems.map(item => (
                    <div key={item.id} className="trash-item">
                      <div className="trash-item-content">
                        <span className={`trash-text ${item.completed ? 'completed' : ''}`}>
                          {item.text}
                        </span>
                        <span className="trash-date">{formatDate(item.created_at)}</span>
                      </div>
                      <div className="trash-actions">
                        <button
                          onClick={() => handleRestoreFromTrash(item.id)}
                          className="restore-button"
                          title="복원"
                        >
                          복원
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(item.id)}
                          className="permanent-delete-button"
                          title="영구 삭제"
                        >
                          영구 삭제
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showDummyModal && (
          <div className="modal-overlay" onClick={() => setShowDummyModal(false)}>
            <div className="modal-content routine-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🧪 더미 데이터 관리</h2>
                <button onClick={() => setShowDummyModal(false)} className="modal-close-button">✕</button>
              </div>

              <div className="routine-add-section">
                <h3>더미 데이터 생성</h3>
                <p style={{fontSize: '14px', color: '#666', marginBottom: '10px'}}>
                  14일~18일 날짜에 걸쳐 총 20개의 테스트용 더미 데이터가 생성됩니다.
                </p>
                <button
                  onClick={handleCreateDummyData}
                  className="add-routine-button"
                  style={{width: '100%'}}
                >
                  ✅ 더미 데이터 생성 (20개)
                </button>
              </div>

              <div className="routine-add-section">
                <h3>중복 투두 제거</h3>
                <p style={{fontSize: '14px', color: '#666', marginBottom: '10px'}}>
                  같은 텍스트의 투두 중 생성일이 가장 빠른 것만 남기고 삭제합니다.
                </p>
                <button
                  onClick={handleRemoveDuplicates}
                  className="add-routine-button"
                  style={{width: '100%', background: '#ff6b6b'}}
                >
                  🗑️ 중복 투두 제거
                </button>
              </div>

              <div className="routine-list" style={{marginTop: '20px'}}>
                <h3>생성된 세션 목록</h3>
                {dummySessions.length === 0 ? (
                  <p className="empty-message">생성된 더미 세션이 없습니다.</p>
                ) : (
                  <>
                    {dummySessions.map((session, index) => (
                      <div key={session.sessionId} className="routine-item">
                        <div className="routine-item-content">
                          <span className="routine-text">
                            세션 #{index + 1}: {session.sessionId}
                          </span>
                          <div className="routine-days">
                            <span className="routine-day-badge">
                              투두 {session.count}개
                            </span>
                            {session.historyCount > 0 && (
                              <span className="routine-day-badge">
                                히스토리 {session.historyCount}개
                              </span>
                            )}
                            <span className="routine-day-badge" style={{fontSize: '11px'}}>
                              {formatDate(session.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="routine-item-actions">
                          <button
                            onClick={() => {
                              if (window.confirm(`세션 #${index + 1}을 삭제하시겠습니까?`)) {
                                handleDeleteDummySession(session.sessionId)
                              }
                            }}
                            className="routine-delete-button"
                            title="이 세션만 삭제"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        if (window.confirm('모든 더미 데이터를 삭제하시겠습니까?')) {
                          handleDeleteAllDummies()
                        }
                      }}
                      className="routine-delete-button"
                      style={{width: '100%', marginTop: '15px', padding: '12px'}}
                    >
                      🗑️ 모든 더미 데이터 삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {showMemoModal && (
          <div className="modal-overlay" onClick={handleCloseMemo}>
            <div className="modal-content memo-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📝 기획서 메모</h2>
                <button onClick={handleCloseMemo} className="modal-close-button">✕</button>
              </div>

              <div className="memo-content">
                {isEditingMemo ? (
                  <div className="memo-edit-mode">
                    <textarea
                      value={memoContent}
                      onChange={(e) => setMemoContent(e.target.value)}
                      className="memo-textarea"
                      placeholder="메모 내용을 입력하세요..."
                      rows={20}
                    />
                    <div className="memo-actions">
                      <button
                        onClick={handleSaveMemo}
                        className="memo-save-button"
                        disabled={isSavingMemo}
                      >
                        {isSavingMemo ? '저장 중...' : '💾 저장'}
                      </button>
                      <button
                        onClick={handleResetMemo}
                        className="memo-cancel-button"
                        disabled={isSavingMemo}
                      >
                        ↩️ 취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="memo-view-mode">
                    <div className="memo-display">
                      <pre className="memo-text">{memoContent}</pre>
                    </div>
                    <div className="memo-actions">
                      <button
                        onClick={handleEditMemo}
                        className="memo-edit-button"
                      >
                        ✏️ 편집
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showRoutineModal && (
          <div className="modal-overlay" onClick={handleCloseRoutine}>
            <div className="modal-content routine-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📌 루틴 관리</h2>
                <button onClick={handleCloseRoutine} className="modal-close-button">✕</button>
              </div>

              <div className="routine-add-section">
                <input
                  type="text"
                  value={routineInput}
                  onChange={(e) => setRoutineInput(e.target.value)}
                  placeholder="루틴 내용을 입력하세요..."
                  className="routine-input"
                  disabled={isAddingRoutine}
                />
                <div className="day-selector">
                  {DAYS.map(day => (
                    <button
                      key={day.key}
                      onClick={() => handleToggleDay(day.key)}
                      className={`day-button ${selectedDays.includes(day.key) ? 'selected' : ''}`}
                      disabled={isAddingRoutine}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAddRoutine}
                  className="add-routine-button"
                  disabled={isAddingRoutine || routineInput.trim() === '' || selectedDays.length === 0}
                >
                  루틴 추가
                </button>
              </div>

              <div className="routine-list">
                {routines.length === 0 ? (
                  <p className="empty-message">등록된 루틴이 없습니다.</p>
                ) : (
                  routines.map(routine => (
                    <div key={routine.id} className="routine-item">
                      {editingRoutineId === routine.id ? (
                        // 수정 모드
                        <>
                          <div className="routine-edit-content">
                            <input
                              type="text"
                              value={editingRoutineText}
                              onChange={(e) => setEditingRoutineText(e.target.value)}
                              className="routine-edit-input"
                              placeholder="루틴 내용"
                            />
                            <div className="day-selector-inline">
                              {DAYS.map(day => (
                                <button
                                  key={day.key}
                                  onClick={() => handleToggleEditDay(day.key)}
                                  className={`day-button-inline ${editingRoutineDays.includes(day.key) ? 'selected' : ''}`}
                                >
                                  {day.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="routine-item-actions">
                            <button
                              onClick={handleSaveEditRoutine}
                              className="routine-save-button"
                              disabled={editingRoutineText.trim() === '' || editingRoutineDays.length === 0}
                            >
                              저장
                            </button>
                            <button
                              onClick={handleCancelEditRoutine}
                              className="routine-cancel-edit-button"
                            >
                              취소
                            </button>
                          </div>
                        </>
                      ) : (
                        // 일반 모드
                        <>
                          <div className="routine-item-content">
                            <span className="routine-text">{routine.text}</span>
                            <div className="routine-days">
                              {DAYS.filter(day => routine.days.includes(day.key)).map(day => (
                                <span key={day.key} className="routine-day-badge">
                                  {day.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="routine-item-actions">
                            <button
                              onClick={() => fetchRoutineHistory(routine)}
                              className="routine-history-button"
                              title="히스토리 보기"
                            >
                              📊
                            </button>
                            <button
                              onClick={() => handleStartEditRoutine(routine)}
                              className="routine-edit-button"
                              title="수정"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteRoutine(routine.id)}
                              className="routine-delete-button"
                              title="삭제"
                            >
                              삭제
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showRoutineHistory && selectedRoutineForHistory && (
          <div className="modal-overlay" onClick={handleCloseRoutineHistory}>
            <div className="modal-content routine-history-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📊 {selectedRoutineForHistory.text} 히스토리</h2>
                <button onClick={handleCloseRoutineHistory} className="modal-close-button">✕</button>
              </div>

              <div className="routine-history-content">
                {(() => {
                  if (routineHistoryData.length === 0) {
                    return <p className="empty-message">아직 생성된 투두가 없습니다.</p>
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
                    const isRoutineDay = selectedRoutineForHistory.days.includes(dayKey)

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
                                  <>
                                    {Array(emptyCount).fill(null).map((_, i) => (
                                      <div key={`empty-end-${index}-${i}`} className="history-day-cell empty"></div>
                                    ))}
                                    <div key={dayInfo.dateStr} className="history-day-header">일</div>
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
                                  </>
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
                  )
                })()}

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
          </div>
        )}
      </div>
    </div>
  )
}

export default App
