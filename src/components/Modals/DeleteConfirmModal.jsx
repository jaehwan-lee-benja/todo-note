import { useState, useRef } from 'react'
import './DeleteConfirmModal.css'

function DeleteConfirmModal({ todo, onClose, onDeleteThisOnly, onDeleteFromNow, onDeleteAll }) {
  const [selectedOption, setSelectedOption] = useState('this-only')
  const [showTooltip, setShowTooltip] = useState(null)
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

  const handleConfirm = () => {
    if (selectedOption === 'this-only') {
      onDeleteThisOnly(todo)
    } else if (selectedOption === 'from-now') {
      onDeleteFromNow(todo)
    } else if (selectedOption === 'all') {
      onDeleteAll(todo)
    }
    onClose()
  }

  const options = [
    {
      id: 'this-only',
      label: '이 할일',
      subtitle: '오늘만 삭제',
      tooltip: '과거 기록 유지, 오늘것만 삭제, 내일부터 다시 표시함'
    },
    {
      id: 'from-now',
      label: '이번 및 향후 할일',
      subtitle: '오늘부터 삭제',
      tooltip: '과거 기록 유지, 오늘것 삭제, 내일부터도 표시 안함'
    },
    {
      id: 'all',
      label: '모든 할일',
      subtitle: '모두 삭제',
      tooltip: '과거 기록 삭제, 오늘것 삭제, 내일부터도 표시 안함'
    }
  ]

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content delete-confirm-modal-v2" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>할 일 삭제</h2>
          <button onClick={onClose} className="modal-close-button">✕</button>
        </div>

        <div className="delete-confirm-content-v2">
          <p className="delete-info-text">
            완료되지 않은 할일은 다음날로 이월됩니다.<br/>
            아래 삭제 옵션 중 선택해주세요.
          </p>

          <div className="delete-options-v2">
            {options.map(option => (
              <div key={option.id} className="delete-option-item">
                <label className="delete-option-label">
                  <input
                    type="radio"
                    name="delete-option"
                    value={option.id}
                    checked={selectedOption === option.id}
                    onChange={(e) => setSelectedOption(e.target.value)}
                  />
                  <div className="option-text">
                    <span className="option-main">{option.label}</span>
                    <span className="option-sub">{option.subtitle}</span>
                  </div>
                </label>
                <button
                  className="option-help-btn"
                  onMouseEnter={() => setShowTooltip(option.id)}
                  onMouseLeave={() => setShowTooltip(null)}
                  onClick={(e) => {
                    e.preventDefault()
                    setShowTooltip(showTooltip === option.id ? null : option.id)
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <text x="8" y="11.5" textAnchor="middle" fontSize="11" fill="currentColor" fontWeight="600">?</text>
                  </svg>
                </button>
                {showTooltip === option.id && (
                  <div className="option-tooltip">
                    {option.tooltip}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="delete-modal-actions">
            <button className="btn-cancel" onClick={onClose}>
              취소
            </button>
            <button className="btn-confirm" onClick={handleConfirm}>
              확인
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DeleteConfirmModal
