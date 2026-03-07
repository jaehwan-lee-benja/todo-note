import ModalWrapper from '../Common/ModalWrapper'

function TrashModal({
  showTrashModal,
  onClose,
  trashedItems,
  onEmptyTrash,
  onRestoreFromTrash,
  onPermanentDelete,
  formatDate
}) {
  const headerActions = trashedItems.length > 0 ? (
    <button
      onClick={onEmptyTrash}
      className="empty-trash-button"
      title="휴지통 비우기"
    >
      전체 비우기
    </button>
  ) : null

  return (
    <ModalWrapper
      isOpen={showTrashModal}
      onClose={onClose}
      title="🗑️ 휴지통"
      className="trash-modal"
      headerActions={headerActions}
    >
      <div className="trash-list">
        {trashedItems.length === 0 ? (
          <p className="empty-message">휴지통이 비어있습니다.</p>
        ) : (
          trashedItems.map(item => {
            const visibleDates = item.visible_dates || (item.date ? [item.date] : [])
            const hasCarryover = visibleDates.length > 1 || item.original_todo_id
            const isOldStyleCarryover = item.original_todo_id !== null && item.original_todo_id !== undefined

            const hasHiddenDates = item.hidden_dates && item.hidden_dates.length > 0
            let deleteType = '알 수 없음'

            if (isOldStyleCarryover) {
              deleteType = '이 날짜만 삭제 (구 방식)'
            } else if (hasHiddenDates) {
              deleteType = '일부 날짜 숨김'
            } else if (item.deleted === true) {
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
    </ModalWrapper>
  )
}

export default TrashModal
