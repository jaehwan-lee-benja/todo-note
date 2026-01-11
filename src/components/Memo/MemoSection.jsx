import { useEffect, useRef } from 'react'
import SectionHeader from '../Common/SectionHeader'

// 노션 스타일 메모 섹션 컴포넌트 (항상 편집 가능, 자동 저장)
function MemoSection({
  title,
  className,
  content,
  setContent,
  isSaving,
  placeholder,
  settingsMenuItems = [],
  children,
}) {
  const textareaRef = useRef(null)

  // textarea 높이 자동 조정
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [content])

  return (
    <div className={className}>
      <SectionHeader
        title={title}
        settingsMenuItems={settingsMenuItems}
        customActions={isSaving && (
          <span className="memo-saving-indicator">저장 중...</span>
        )}
      />
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="memo-textarea"
        placeholder={placeholder}
      />
      {children}
    </div>
  )
}

export default MemoSection
