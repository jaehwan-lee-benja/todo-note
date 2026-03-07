import { useEffect, useRef } from 'react'
import { useModalOverlay } from '../../hooks/useModalOverlay'

function MemoModal({
  show,
  onClose,
  content,
  setContent,
  isSaving,
  placeholder = '자유롭게 메모하세요...'
}) {
  const textareaRef = useRef(null)
  const { handleOverlayMouseDown, handleOverlayClick } = useModalOverlay(onClose)

  useEffect(() => {
    if (textareaRef.current && show) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, window.innerHeight * 0.6) + 'px'
    }
  }, [content, show])

  useEffect(() => {
    if (show && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [show])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && show) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [show, onClose])

  if (!show) return null

  return (
    <div
      className="memo-modal-overlay"
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
    >
      <div className="memo-modal" onClick={(e) => e.stopPropagation()}>
        <div className="memo-modal-header">
          <h3>📋 생각 메모</h3>
          <div className="memo-modal-actions">
            {isSaving && <span className="memo-saving-indicator">저장 중...</span>}
            <button className="memo-modal-close" onClick={onClose}>&#x2715;</button>
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="memo-modal-textarea"
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}

export default MemoModal
