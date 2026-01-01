// 재사용 가능한 메모 섹션 컴포넌트
function MemoSection({
  title,
  className,
  content,
  setContent,
  isEditing,
  isSaving,
  textareaRef,
  onStartEdit,
  onSave,
  onCancel,
  onKeyDown,
  placeholder,
  emptyMessage,
  children,
}) {
  return (
    <div className={className}>
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
        <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
          {!isEditing && (
            <button
              onClick={onStartEdit}
              className="section-action-button"
              title="메모 편집"
            >
              ✏️ 편집
            </button>
          )}
          {isEditing && (
            <div className="memo-edit-actions">
              <button
                onClick={onSave}
                className="memo-save-button"
                disabled={isSaving}
              >
                💾 저장
              </button>
              <button
                onClick={onCancel}
                className="memo-cancel-button"
                disabled={isSaving}
              >
                ✕ 취소
              </button>
            </div>
          )}
        </div>
      </div>
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onKeyDown}
          className="memo-textarea"
          placeholder={placeholder}
        />
      ) : (
        <div className="memo-preview" onClick={onStartEdit}>
          {content ? (
            <div className="memo-preview-content">
              {content.split('\n').map((line, idx) => (
                <div key={idx} className="memo-preview-line">{line || '\u00A0'}</div>
              ))}
            </div>
          ) : (
            <div className="memo-empty">{emptyMessage}</div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

export default MemoSection
