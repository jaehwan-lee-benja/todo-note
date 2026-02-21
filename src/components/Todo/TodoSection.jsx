import SectionHeader from '../Common/SectionHeader'

// Todo 섹션 컴포넌트 (헤더 + 입력 필드 + 자식 컴포넌트)
function TodoSection({
  title,
  icon,
  sectionId,
  onIconChange,
  className,
  inputValue,
  setInputValue,
  onAddTodo,
  isAdding,
  placeholder,
  children,
  editable = false,
  onTitleChange,
  settingsMenuItems = [],
  headerActions,
}) {
  return (
    <div className={className}>
      <SectionHeader
        title={title}
        icon={icon}
        sectionId={sectionId}
        onIconChange={onIconChange}
        editable={editable}
        onTitleChange={onTitleChange}
        settingsMenuItems={settingsMenuItems}
        customActions={headerActions}
      />
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
      <div className="section-body">
        {children}
      </div>
    </div>
  )
}

export default TodoSection
