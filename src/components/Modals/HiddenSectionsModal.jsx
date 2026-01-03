import React from 'react'

function HiddenSectionsModal({
  show,
  onClose,
  hiddenSections,
  sectionOrder,
  sectionTitles,
  customSections,
  onShowSection,
}) {
  if (!show) return null

  // 섹션 ID로 제목 가져오기
  const getSectionTitle = (sectionId) => {
    // 기본 섹션
    if (sectionTitles[sectionId]) {
      return sectionTitles[sectionId]
    }
    // 커스텀 섹션
    const customSection = customSections.find(s => s.id === sectionId)
    if (customSection) {
      return `${customSection.icon} ${customSection.name}`
    }
    return sectionId
  }

  // 숨긴 섹션이 없는 경우
  if (hiddenSections.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content hidden-sections-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>🗂️ 숨긴 섹션 관리</h2>
            <button onClick={onClose} className="modal-close-button">✕</button>
          </div>
          <div className="modal-body">
            <p className="empty-message">숨긴 섹션이 없습니다.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content hidden-sections-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🗂️ 숨긴 섹션 관리</h2>
          <button onClick={onClose} className="modal-close-button">✕</button>
        </div>
        <div className="modal-body">
          <div className="hidden-sections-list">
            {hiddenSections.map(sectionId => (
              <div key={sectionId} className="hidden-section-item">
                <span className="hidden-section-title">{getSectionTitle(sectionId)}</span>
                <button
                  className="show-section-button"
                  onClick={() => {
                    onShowSection(sectionId)
                  }}
                  title="섹션 보이기"
                >
                  📂 보이기
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default HiddenSectionsModal
