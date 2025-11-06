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
function SortableTodoItem({ todo, onToggle, onDelete, onEdit, formatDate }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)
  const [showDetails, setShowDetails] = useState(false)

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
      className="todo-item-wrapper"
    >
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
        <button
          className="details-toggle-button"
          onClick={(e) => {
            e.stopPropagation()
            setShowDetails(!showDetails)
          }}
          title={showDetails ? "세부정보 숨기기" : "세부정보 보기"}
        >
          ⋯
        </button>
        <span className={`todo-date ${showDetails ? 'show' : ''}`}>{formatDate(todo.created_at)}</span>
      </div>
    </div>
  )
}

function App() {
  const [todos, setTodos] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(true)

  // 날짜를 YY.MM.DD(요일) HH:MM 형식으로 포맷팅
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

  // 컴포넌트 마운트 시 할 일 목록 가져오기
  useEffect(() => {
    fetchTodos()
  }, [])

  const fetchTodos = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('order_index', { ascending: true })

      if (error) throw error
      setTodos(data || [])
    } catch (error) {
      console.error('할 일 가져오기 오류:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleAddTodo = async () => {
    if (inputValue.trim() === '') return

    try {
      // 새 항목은 맨 위에 추가 (order_index = 1)
      const newOrderIndex = 1

      // 먼저 새 항목을 추가
      const { data, error } = await supabase
        .from('todos')
        .insert([{ text: inputValue, completed: false, order_index: newOrderIndex }])
        .select()

      if (error) throw error

      // 기존 항목들의 order_index를 1씩 증가
      if (todos.length > 0) {
        const updatePromises = todos.map((todo) =>
          supabase
            .from('todos')
            .update({ order_index: todo.order_index + 1 })
            .eq('id', todo.id)
        )
        await Promise.all(updatePromises)
      }

      // 로컬 상태 업데이트
      setTodos([data[0], ...todos.map(t => ({ ...t, order_index: t.order_index + 1 }))])
      setInputValue('')
    } catch (error) {
      console.error('할 일 추가 오류:', error.message)
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
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)

      if (error) throw error
      setTodos(todos.filter(todo => todo.id !== id))
    } catch (error) {
      console.error('할 일 삭제 오류:', error.message)
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
      handleAddTodo()
    }
  }

  // 드래그 앤 드롭 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 드래그 시작 핸들러
  const handleDragStart = () => {
    // 드래그 중 페이지 스크롤 완전 차단
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
  }

  // 드래그 취소 핸들러
  const handleDragCancel = () => {
    // 페이지 스크롤 복원
    const scrollY = document.body.style.top
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
    document.body.style.overflow = ''
    window.scrollTo(0, parseInt(scrollY || '0') * -1)
  }

  // 드래그 종료 핸들러
  const handleDragEnd = async (event) => {
    // 페이지 스크롤 복원
    const scrollY = document.body.style.top
    document.body.style.position = ''
    document.body.style.top = ''
    document.body.style.width = ''
    document.body.style.overflow = ''
    window.scrollTo(0, parseInt(scrollY || '0') * -1)

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
    <div className="app">
      <div className="container">
        <h1>📝 할 일 노트</h1>

        <div className="input-section">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="새로운 할 일을 입력하세요..."
            className="todo-input"
          />
          <button onClick={handleAddTodo} className="add-button">
            추가
          </button>
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
                items={todos.map(todo => todo.id)}
                strategy={verticalListSortingStrategy}
              >
                {todos.map(todo => (
                  <SortableTodoItem
                    key={todo.id}
                    todo={todo}
                    onToggle={handleToggleTodo}
                    onDelete={handleDeleteTodo}
                    onEdit={handleEditTodo}
                    formatDate={formatDate}
                  />
                ))}
              </SortableContext>
            )}
          </div>
        </DndContext>

        <div className="todo-stats">
          <p>전체: {todos.length}개 | 완료: {todos.filter(t => t.completed).length}개</p>
        </div>
      </div>
    </div>
  )
}

export default App
