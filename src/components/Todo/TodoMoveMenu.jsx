import React from 'react'

/**
 * 투두 이동 메뉴 컴포넌트
 * 위/아래/맨위/맨아래 이동 및 삭제 옵션 제공
 */
function TodoMoveMenu({
  todoId,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onMoveToTop,
  onMoveToBottom,
  onDelete,
  onClose
}) {
  const handleAction = (action) => {
    action()
    onClose()
  }

  return (
    <div className="move-menu">
      {!isFirst && (
        <>
          <button
            className="move-menu-item"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(() => onMoveToTop && onMoveToTop(todoId))
            }}
          >
            <span className="move-menu-icon">&#x23EB;</span> 맨 위로
          </button>
          <button
            className="move-menu-item"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(() => onMoveUp && onMoveUp(todoId))
            }}
          >
            <span className="move-menu-icon">&#x2B06;&#xFE0F;</span> 위로
          </button>
        </>
      )}
      {!isLast && (
        <>
          <button
            className="move-menu-item"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(() => onMoveDown && onMoveDown(todoId))
            }}
          >
            <span className="move-menu-icon">&#x2B07;&#xFE0F;</span> 아래로
          </button>
          <button
            className="move-menu-item"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(() => onMoveToBottom && onMoveToBottom(todoId))
            }}
          >
            <span className="move-menu-icon">&#x23EC;</span> 맨 아래로
          </button>
        </>
      )}
      <button
        className="move-menu-item delete"
        onClick={(e) => {
          e.stopPropagation()
          if (window.confirm('이 할일을 삭제하시겠습니까?')) {
            onDelete(todoId)
          }
          onClose()
        }}
      >
        <span className="move-menu-icon">&#x1F5D1;&#xFE0F;</span> 삭제
      </button>
    </div>
  )
}

export default TodoMoveMenu
