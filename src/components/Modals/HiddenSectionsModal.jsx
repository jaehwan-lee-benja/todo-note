import ModalWrapper from '../Common/ModalWrapper'

function HiddenSectionsModal({
  show,
  onClose,
  hiddenSections,
  sectionOrder,
  sectionTitles,
  customSections,
  onShowSection,
}) {
  const getSectionTitle = (sectionId) => {
    if (sectionTitles[sectionId]) {
      return sectionTitles[sectionId]
    }
    const customSection = customSections.find(s => s.id === sectionId)
    if (customSection) {
      return `${customSection.icon} ${customSection.name}`
    }
    return sectionId
  }

  return (
    <ModalWrapper isOpen={show} onClose={onClose} title="🗂️ 숨긴 섹션 관리" className="hidden-sections-modal">
      <div className="modal-body">
        {hiddenSections.length === 0 ? (
          <p className="empty-message">숨긴 섹션이 없습니다.</p>
        ) : (
          <div className="hidden-sections-list">
            {hiddenSections.map(sectionId => (
              <div key={sectionId} className="hidden-section-item">
                <span className="hidden-section-title">{getSectionTitle(sectionId)}</span>
                <button
                  className="show-section-button"
                  onClick={() => onShowSection(sectionId)}
                  title="섹션 보이기"
                >
                  📂 보이기
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalWrapper>
  )
}

export default HiddenSectionsModal
