import { useState, useRef } from 'react'

function AddSectionModal({ isOpen, onClose, onAddSection }) {
  const [sectionName, setSectionName] = useState('')
  const [sectionIcon, setSectionIcon] = useState('📌')

  const commonEmojis = ['📌', '⭐', '🎯', '📝', '💼', '🏠', '🎨', '📚', '💻', '🏃', '🎵', '🍕']

  const handleSubmit = (e) => {
    e.preventDefault()
    if (sectionName.trim()) {
      onAddSection({
        name: sectionName.trim(),
        icon: sectionIcon
      })
      setSectionName('')
      setSectionIcon('📌')
      onClose()
    }
  }

  const mouseDownOnOverlay = useRef(false)

  const handleOverlayMouseDown = (e) => {
    if (e.target === e.currentTarget) {
      mouseDownOnOverlay.current = true
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && mouseDownOnOverlay.current) {
      onClose()
    }
    mouseDownOnOverlay.current = false
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content add-section-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>새 섹션 추가</h2>
          <button className="modal-close-button" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="add-section-form">
          <div className="form-group">
            <label>섹션 이름</label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              placeholder="예: 업무, 개인 프로젝트, 취미..."
              className="section-name-input"
              autoFocus
              maxLength={20}
            />
          </div>

          <div className="form-group">
            <label>아이콘 선택</label>
            <div className="emoji-grid">
              {commonEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`emoji-button ${sectionIcon === emoji ? 'selected' : ''}`}
                  onClick={() => setSectionIcon(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-button">
              취소
            </button>
            <button type="submit" className="submit-button" disabled={!sectionName.trim()}>
              추가
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddSectionModal
