import { useState, useEffect } from 'react'
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

// 드래그 가능한 Todo 항목 컴포넌트
function SortableTodoItem({ todo, index, onToggle, onDelete, onEdit, formatDate, isFocused, onFocus, onAddSubTodo, subtodos, level = 0 }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)
  const [showDetails, setShowDetails] = useState(false)
  const [showSubtodos, setShowSubtodos] = useState(true)
  const [isAddingSubTodo, setIsAddingSubTodo] = useState(false)
  const [subTodoText, setSubTodoText] = useState('')

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

  const handleEditSubmit = () => {
    if (editText.trim() && editText !== todo.text) {
      onEdit(todo.id, editText.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEditSubmit()
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
        {!todo.parent_id && (
          <button
            className="add-subtodo-button-inline"
            onClick={(e) => {
              e.stopPropagation()
              setIsAddingSubTodo(!isAddingSubTodo)
              setShowSubtodos(true)
            }}
            title="하위 할 일 추가"
          >
            +
          </button>
        )}
        <button
          className="details-toggle-button"
          onClick={(e) => {
            e.stopPropagation()
            if (subtodos && subtodos.length > 0) {
              setShowSubtodos(!showSubtodos)
              setShowDetails(!showDetails)
            } else {
              setShowDetails(!showDetails)
            }
          }}
          title={subtodos && subtodos.length > 0
            ? (showSubtodos ? "세부정보 및 하위 할 일 숨기기" : "세부정보 및 하위 할 일 보기")
            : (showDetails ? "세부정보 숨기기" : "세부정보 보기")}
        >
          {(subtodos && subtodos.length > 0)
            ? (showSubtodos ? '▲' : '▼')
            : (showDetails ? '▲' : '▼')}
        </button>
        <span className={`todo-date ${(subtodos && subtodos.length > 0) ? (showSubtodos ? 'show' : '') : (showDetails ? 'show' : '')}`}>{formatDate(todo.created_at)}</span>
        {(subtodos && subtodos.length > 0 && showSubtodos) || (isAddingSubTodo && !todo.parent_id) ? (
          <div className="subtodos-in-item">
            {subtodos.map((subtodo, subIndex) => (
              <SortableTodoItem
                key={subtodo.id}
                todo={subtodo}
                index={subIndex}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                formatDate={formatDate}
                isFocused={isFocused}
                onFocus={onFocus}
                onAddSubTodo={onAddSubTodo}
                subtodos={[]}
                level={level + 1}
              />
            ))}
            {isAddingSubTodo && !todo.parent_id && (
              <div className="subtodo-input-section">
                <input
                  type="text"
                  value={subTodoText}
                  onChange={(e) => setSubTodoText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && subTodoText.trim()) {
                      onAddSubTodo(todo.id, subTodoText.trim())
                      setSubTodoText('')
                      setIsAddingSubTodo(false)
                    }
                  }}
                  placeholder="하위 할 일 입력..."
                  className="subtodo-input"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (subTodoText.trim()) {
                      onAddSubTodo(todo.id, subTodoText.trim())
                      setSubTodoText('')
                      setIsAddingSubTodo(false)
                    }
                  }}
                  className="subtodo-add-button"
                >
                  추가
                </button>
                <button
                  onClick={() => {
                    setIsAddingSubTodo(false)
                    setSubTodoText('')
                  }}
                  className="subtodo-cancel-button"
                >
                  취소
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
      </div>
    </div>
  )
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

  // 전날 미완료 항목을 다음 날로 이동
  const moveIncompleteTodosToNextDay = async (fromDate, toDate) => {
    try {
      const fromDateStr = formatDateForDB(fromDate)
      const toDateStr = formatDateForDB(toDate)

      // 전날의 미완료 항목 가져오기
      const { data: incompleteTodos, error: fetchError } = await supabase
        .from('todos')
        .select('*')
        .eq('date', fromDateStr)
        .eq('deleted', false)
        .eq('completed', false)
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

        // 미완료 항목을 다음 날로 이동 (날짜와 order_index 업데이트)
        const updatePromises = incompleteTodos.map((todo, index) =>
          supabase
            .from('todos')
            .update({
              date: toDateStr,
              order_index: startIndex + index
            })
            .eq('id', todo.id)
        )

        await Promise.all(updatePromises)
      }
    } catch (error) {
      console.error('미완료 항목 이동 오류:', error.message)
    }
  }

  // 자정에 날짜 자동 업데이트
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
            // 항목 업데이트
            setTodos(currentTodos =>
              currentTodos.map(todo =>
                todo.id === payload.new.id ? payload.new : todo
              ).sort((a, b) => a.order_index - b.order_index)
            )
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
      const { error } = await supabase
        .from('todos')
        .update({ completed: !todo.completed })
        .eq('id', id)

      if (error) throw error
      setTodos(todos.map(t =>
        t.id === id ? { ...t, completed: !t.completed } : t
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
      const { error } = await supabase
        .from('todos')
        .update({ text: newText })
        .eq('id', id)

      if (error) throw error
      setTodos(todos.map(todo =>
        todo.id === id ? { ...todo, text: newText } : todo
      ))
    } catch (error) {
      console.error('할 일 수정 오류:', error.message)
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
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 5,
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
      <div className="container">
        <h1>✅ 할 일 노트</h1>

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
          <span className="date-display">{formatDateOnly(selectedDate)}</span>
          <button onClick={handleNextDay} className="date-nav-button">→</button>
        </div>

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
            ) : (
              <SortableContext
                items={todos.filter(t => !t.parent_id).map(todo => todo.id)}
                strategy={verticalListSortingStrategy}
              >
                {todos.filter(t => !t.parent_id).map((todo, index) => {
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
                      isFocused={focusedTodoId === todo.id}
                      onFocus={handleFocusTodo}
                      onAddSubTodo={handleAddSubTodo}
                      subtodos={subtodos}
                      level={0}
                    />
                  )
                })}
              </SortableContext>
            )}
          </div>
        </DndContext>

        <div className="todo-stats">
          <p>전체: {todos.length}개 | 완료: {todos.filter(t => t.completed).length}개</p>
        </div>

        <button onClick={handleOpenTrash} className="trash-button-fixed" title="휴지통">
          🗑️
        </button>

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
      </div>
    </div>
  )
}

export default App
