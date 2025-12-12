function DummyModal({
  showDummyModal,
  onClose,
  onCreateDummyData,
  onRemoveDuplicates,
  dummySessions,
  onDeleteDummySession,
  onDeleteAllDummies,
  formatDate
}) {
  if (!showDummyModal) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content routine-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🧪 더미 데이터 관리</h2>
          <button onClick={onClose} className="modal-close-button">✕</button>
        </div>

        <div className="routine-add-section">
          <h3>더미 데이터 생성</h3>
          <p style={{fontSize: '14px', color: '#666', marginBottom: '10px'}}>
            14일~18일 날짜에 걸쳐 총 20개의 테스트용 더미 데이터가 생성됩니다.
          </p>
          <button
            onClick={onCreateDummyData}
            className="add-routine-button"
            style={{width: '100%'}}
          >
            ✅ 더미 데이터 생성 (20개)
          </button>
        </div>

        <div className="routine-add-section">
          <h3>중복 투두 제거</h3>
          <p style={{fontSize: '14px', color: '#666', marginBottom: '10px'}}>
            같은 텍스트의 투두 중 생성일이 가장 빠른 것만 남기고 삭제합니다.
          </p>
          <button
            onClick={onRemoveDuplicates}
            className="add-routine-button"
            style={{width: '100%', background: '#ff6b6b'}}
          >
            🗑️ 중복 투두 제거
          </button>
        </div>

        <div className="routine-list" style={{marginTop: '20px'}}>
          <h3>생성된 세션 목록</h3>
          {dummySessions.length === 0 ? (
            <p className="empty-message">생성된 더미 세션이 없습니다.</p>
          ) : (
            <>
              {dummySessions.map((session, index) => (
                <div key={session.sessionId} className="routine-item">
                  <div className="routine-item-content">
                    <span className="routine-text">
                      세션 #{index + 1}: {session.sessionId}
                    </span>
                    <div className="routine-days">
                      <span className="routine-day-badge">
                        투두 {session.count}개
                      </span>
                      {session.historyCount > 0 && (
                        <span className="routine-day-badge">
                          히스토리 {session.historyCount}개
                        </span>
                      )}
                      <span className="routine-day-badge" style={{fontSize: '11px'}}>
                        {formatDate(session.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="routine-item-actions">
                    <button
                      onClick={() => {
                        if (window.confirm(`세션 #${index + 1}을 삭제하시겠습니까?`)) {
                          onDeleteDummySession(session.sessionId)
                        }
                      }}
                      className="routine-delete-button"
                      title="이 세션만 삭제"
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => {
                  if (window.confirm('모든 더미 데이터를 삭제하시겠습니까?')) {
                    onDeleteAllDummies()
                  }
                }}
                className="routine-delete-button"
                style={{width: '100%', marginTop: '15px', padding: '12px'}}
              >
                🗑️ 모든 더미 데이터 삭제
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default DummyModal
