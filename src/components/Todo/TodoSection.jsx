import { useState } from 'react'

// Todo 섹션 컴포넌트 (헤더 + 입력 필드 + 자식 컴포넌트)
function TodoSection({
  title,
  className,
  inputValue,
  setInputValue,
  onAddTodo,
  isAdding,
  placeholder,
  children,
  editable = false,
  onTitleChange,
  headerActions,
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(title)

  const handleTitleClick = () => {
    if (editable) {
      setIsEditingTitle(true)
      setEditedTitle(title)
    }
  }

  const handleTitleBlur = () => {
    setIsEditingTitle(false)
    if (editedTitle.trim() && editedTitle !== title) {
      onTitleChange?.(editedTitle.trim())
    } else {
      setEditedTitle(title)
    }
  }

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleTitleBlur()
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false)
      setEditedTitle(title)
    }
  }

  return (
    <div className={className}>
      <div className="section-header">
        {isEditingTitle ? (
          <input
            type="text"
            className="section-title-edit"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            autoFocus
          />
        ) : (
          <h3
            className={`section-title ${editable ? 'editable' : ''}`}
            onClick={handleTitleClick}
          >
            {title}
          </h3>
        )}
        {headerActions && (
          <div className="section-header-actions">
            {headerActions}
          </div>
        )}
      </div>
      <div className="section-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAddTodo()
          }}
          placeholder={placeholder}
          className="todo-input"
          disabled={isAdding}
        />
        <button onClick={onAddTodo} className="add-button" disabled={isAdding}>
          추가
        </button>
      </div>
      {children}
    </div>
  )
}

export default TodoSection
