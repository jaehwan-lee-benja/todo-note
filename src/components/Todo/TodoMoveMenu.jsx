import React, { useState } from 'react'

/**
 * 투두 이동 메뉴 컴포넌트
 * 위/아래/맨위/맨아래 이동 및 삭제 옵션 제공
 */
function TodoMoveMenu({
  todoId,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onMoveToTop,
  onMoveToBottom,
  onDelete,
  onClose,
  sections = [],
  currentSectionType,
  currentSectionId,
  onMoveToSection,
}) {
  const [showSectionList, setShowSectionList] = useState(false)

  const handleAction = (action) => {
    action()
    onClose()
  }

  const otherSections = sections.filter(s => {
    if (currentSectionType === 'normal' && s.sectionType === 'normal') return false
    if (currentSectionType === 'custom' && s.sectionType === 'custom' && s.sectionId === currentSectionId) return false
    return true
  })

  return (
    <div className="move-menu">
      {!isFirst && (
        <>
          <button
            className="move-menu-item move-to-top"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(() => onMoveToTop && onMoveToTop(todoId))
            }}
          >
            <span className="move-menu-icon">&#x23EB;</span> 맨 위로
          </button>
          <button
            className="move-menu-item"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(() => onMoveUp && onMoveUp(todoId))
            }}
          >
            <span className="move-menu-icon">&#x2B06;&#xFE0F;</span> 위로
          </button>
        </>
      )}
      {!isLast && (
        <>
          <button
            className="move-menu-item"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(() => onMoveDown && onMoveDown(todoId))
            }}
          >
            <span className="move-menu-icon">&#x2B07;&#xFE0F;</span> 아래로
          </button>
          <button
            className="move-menu-item move-to-bottom"
            onClick={(e) => {
              e.stopPropagation()
              handleAction(() => onMoveToBottom && onMoveToBottom(todoId))
            }}
          >
            <span className="move-menu-icon">&#x23EC;</span> 맨 아래로
          </button>
        </>
      )}
      {otherSections.length > 0 && (
        <div className="move-menu-section-wrapper">
          <button
            className={`move-menu-item${showSectionList ? ' active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              setShowSectionList(!showSectionList)
            }}
          >
            <span className="move-menu-icon">&#x1F4C2;</span> 섹션 이동
            <span className="move-menu-arrow">&#x276F;</span>
          </button>
          {showSectionList && (
            <div className="move-menu-section-popup">
              {otherSections.map(section => (
                <button
                  key={section.id}
                  className="move-menu-section-item"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onMoveToSection) {
                      onMoveToSection(todoId, section.sectionType, section.sectionId)
                    }
                    onClose()
                  }}
                >
                  <span className="move-menu-section-icon">{section.icon}</span>
                  {section.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button
        className="move-menu-item delete"
        onClick={(e) => {
          e.stopPropagation()
          if (window.confirm('이 할일을 삭제하시겠습니까?')) {
            onDelete(todoId)
          }
          onClose()
        }}
      >
        <span className="move-menu-icon">&#x1F5D1;&#xFE0F;</span> 삭제
      </button>
    </div>
  )
}

export default TodoMoveMenu
