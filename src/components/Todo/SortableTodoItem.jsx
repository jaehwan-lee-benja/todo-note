import React, { useState, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import TodoMoveMenu from './TodoMoveMenu'
import TodoActionsModal from './TodoActionsModal'

function SortableTodoItem({
  todo,
  index,
  onToggle,
  onDelete,
  onEdit,
  formatDate,
  formatDateOnly,
  isFocused,
  onFocus,
  onAddSubTodo,
  subtodos,
  level = 0,
  onCreateRoutine,
  routines,
  onShowRoutineHistory,
  onOpenRoutineSetupModal,
  onOpenHistoryModal,
  currentPageDate,
  isPendingRoutine = false,
  onRemoveFromUI,
  showSuccessMessage,
  activeId,
  overId,
  hideNumber = false,
  onMoveUp,
  onMoveDown,
  onMoveToTop,
  onMoveToBottom,
  isFirst,
  isLast
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)
  const [showNanotodos, setShowNanotodos] = useState(false)
  const [isAddingSubTodo, setIsAddingSubTodo] = useState(false)
  const [subTodoText, setSubTodoText] = useState('')
  const [showActionsModal, setShowActionsModal] = useState(false)

  // 현재 투두의 루틴 정보 찾기
  const currentRoutine = todo.routine_id ? routines.find(r => r.id === todo.routine_id) : null

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
    cursor: 'grab',
    opacity: isActive ? 0.4 : 1,
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      await handleEditSubmit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditText(todo.text)
    }
  }

  // 이동 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMoveMenu && !e.target.closest('.drag-handle-wrapper')) {
        setShowMoveMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showMoveMenu])

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderTop: isOver
          ? '2px solid rgba(99, 102, 241, 0.8)'
          : '2px solid transparent',
      }}
      className="todo-item-container"
    >
      <div className="drag-handle-wrapper">
        <span
          className="drag-handle"
          {...attributes}
          {...listeners}
          onClick={(e) => {
            e.stopPropagation()
            setShowMoveMenu(!showMoveMenu)
          }}
          title="클릭: 이동 메뉴 / 길게 누름: 드래그"
        ></span>
        {showMoveMenu && (
          <TodoMoveMenu
            todoId={todo.id}
            isFirst={isFirst}
            isLast={isLast}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onMoveToTop={onMoveToTop}
            onMoveToBottom={onMoveToBottom}
            onDelete={onDelete}
            onClose={() => setShowMoveMenu(false)}
          />
        )}
      </div>
      {!hideNumber && (
        <span className="todo-number">
          {index + 1}
        </span>
      )}
      <div className="todo-item-wrapper">
        <div
          className={`todo-item ${todo.completed ? 'completed' : ''} ${isExpanded ? 'expanded' : ''} ${isDragging ? 'drag-mode' : ''} ${todo.scheduled_time && todo.scheduled_date === currentPageDate ? 'has-timeline' : ''}`}
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
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleEditSubmit}
                onKeyDown={handleKeyDown}
                className="todo-edit-input"
                autoFocus
                rows={1}
                style={{
                  minHeight: '1.35em',
                  resize: 'vertical',
                  overflow: 'hidden'
                }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
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
                      {completedDay}일&#x2713;
                    </span>
                  )
                })()}
                {hasRoutineBadge && (() => {
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
                        setShowNanotodos(false)
                        setIsAddingSubTodo(false)
                      } else {
                        setShowNanotodos(true)
                        setIsAddingSubTodo(false)
                      }
                    }}
                  >
                    &#x1F52C;
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
              }}
              title="더보기"
            >
              &#x22EE;
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
                    onClick={() => setSubTodoText('')}
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
      <TodoActionsModal
        todo={todo}
        isOpen={showActionsModal}
        onClose={() => setShowActionsModal(false)}
        onEdit={onEdit}
        onToggle={onToggle}
        onDelete={onDelete}
        onAddSubTodo={onAddSubTodo}
        onCreateRoutine={onCreateRoutine}
        subtodos={subtodos}
        routines={routines}
        formatDate={formatDate}
        formatDateOnly={formatDateOnly}
      />
    </div>
  )
}

export default SortableTodoItem
