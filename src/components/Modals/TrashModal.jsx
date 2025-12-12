function TrashModal({
  showTrashModal,
  onClose,
  trashedItems,
  onEmptyTrash,
  onRestoreFromTrash,
  onPermanentDelete,
  formatDate
}) {
  if (!showTrashModal) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content trash-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🗑️ 휴지통</h2>
          <div className="modal-header-actions">
            {trashedItems.length > 0 && (
              <button
                onClick={onEmptyTrash}
                className="empty-trash-button"
                title="휴지통 비우기"
              >
                전체 비우기
              </button>
            )}
            <button onClick={onClose} className="modal-close-button">✕</button>
          </div>
        </div>
        <div className="trash-list">
          {trashedItems.length === 0 ? (
            <p className="empty-message">휴지통이 비어있습니다.</p>
          ) : (
            trashedItems.map(item => {
              // 이월 정보
              const visibleDates = item.visible_dates || (item.date ? [item.date] : [])
              const hasCarryover = visibleDates.length > 1 || item.original_todo_id
              const isOldStyleCarryover = item.original_todo_id !== null && item.original_todo_id !== undefined

              // 삭제 타입 판단
              const hasHiddenDates = item.hidden_dates && item.hidden_dates.length > 0
              let deleteType = '알 수 없음'

              if (isOldStyleCarryover) {
                // 구 방식: 개별 레코드 삭제
                deleteType = '이 날짜만 삭제 (구 방식)'
              } else if (hasHiddenDates) {
                // 새 방식: hidden_dates 사용
                deleteType = '일부 날짜 숨김'
              } else if (item.deleted === true) {
                // 새 방식: 완전 삭제
                deleteType = visibleDates.length > 1 ? '모든 날짜 삭제' : '삭제'
              }

              return (
                <div key={item.id} className="trash-item">
                  <div className="trash-item-content">
                    <span className={`trash-text ${item.completed ? 'completed' : ''}`}>
                      {item.text}
                    </span>
                    <div className="trash-metadata">
                      <span className="trash-date">생성: {formatDate(item.created_at)}</span>
                      {item.deleted_date && (
                        <span className="trash-deleted-date">삭제: {item.deleted_date}</span>
                      )}
                      <span className={`trash-delete-type ${
                        isOldStyleCarryover ? 'old-style' : (hasHiddenDates ? 'partial' : 'complete')
                      }`}>
                        {deleteType}
                      </span>
                    </div>

                    {/* 이월 히스토리 정보 */}
                    {hasCarryover && (
                      <div className="trash-carryover-info">
                        <div className="carryover-label">📅 이월 경로:</div>
                        <div className="carryover-dates">
                          {visibleDates.length > 0 ? (
                            visibleDates.map((date, idx) => (
                              <span key={idx} className="carryover-date-badge">
                                {date}
                              </span>
                            ))
                          ) : item.original_todo_id ? (
                            <span className="carryover-note">구 방식 이월 투두 (original_id: {item.original_todo_id})</span>
                          ) : null}
                        </div>
                        {hasHiddenDates && (
                          <div className="hidden-dates-info">
                            <span className="hidden-label">🚫 숨김 날짜:</span>
                            {item.hidden_dates.map((date, idx) => (
                              <span key={idx} className="hidden-date-badge">
                                {date}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="trash-actions">
                    <button
                      onClick={() => onRestoreFromTrash(item.id)}
                      className="restore-button"
                      title="복원"
                    >
                      복원
                    </button>
                    <button
                      onClick={() => onPermanentDelete(item.id)}
                      className="permanent-delete-button"
                      title="영구 삭제"
                    >
                      영구 삭제
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default TrashModal
