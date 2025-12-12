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
}) {
  return (
    <div className={className}>
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
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
