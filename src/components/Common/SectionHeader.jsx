import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'

function SectionHeader({
  title,
  editable = false,
  onTitleChange,
  showHideButton = false,
  onHide,
  showDeleteButton = false,
  onDelete,
  customActions,
  settingsMenuItems = [], // 설정 드롭다운 메뉴 아이템들
}) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState(title)
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const settingsButtonRef = useRef(null)

  const handleTitleSave = () => {
    if (editedTitle.trim() && editedTitle !== title) {
      onTitleChange?.(editedTitle.trim())
    }
    setIsEditingTitle(false)
  }

  const handleTitleCancel = () => {
    setEditedTitle(title)
    setIsEditingTitle(false)
  }

  // 설정 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSettingsMenu && settingsButtonRef.current && !settingsButtonRef.current.contains(event.target)) {
        const dropdown = document.querySelector('.section-settings-dropdown')
        if (dropdown && !dropdown.contains(event.target)) {
          setShowSettingsMenu(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettingsMenu])

  return (
    <div className="section-header">
      <div className="section-title-container">
        {isEditingTitle ? (
          <div className="section-title-edit-wrapper">
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleTitleSave()
                } else if (e.key === 'Escape') {
                  handleTitleCancel()
                }
              }}
              className="section-title-input"
              autoFocus
            />
          </div>
        ) : (
          <h2
            className={`section-title ${editable ? 'editable' : ''}`}
            onClick={() => editable && setIsEditingTitle(true)}
          >
            {title}
          </h2>
        )}
      </div>

      <div className="section-actions">
        {/* 커스텀 액션 (다른 섹션 전용 버튼들) */}
        {customActions}

        {/* 설정 버튼 (settingsMenuItems가 있을 때만) */}
        {settingsMenuItems.length > 0 && (
          <div style={{ position: 'relative' }}>
            <button
              ref={settingsButtonRef}
              className="section-action-button settings-button"
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              title="설정"
            >
              ⚙️
            </button>

            {/* 설정 드롭다운 메뉴 (Portal) */}
            {showSettingsMenu && ReactDOM.createPortal(
              <div
                className="section-settings-dropdown"
                style={{
                  position: 'fixed',
                  top: `${settingsButtonRef.current?.getBoundingClientRect().bottom + 5}px`,
                  left: `${settingsButtonRef.current?.getBoundingClientRect().left}px`,
                }}
              >
                {settingsMenuItems.map((item, index) => (
                  <button
                    key={index}
                    className="settings-menu-item"
                    onClick={() => {
                      item.onClick()
                      setShowSettingsMenu(false)
                    }}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>,
              document.body
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default SectionHeader
