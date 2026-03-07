import ModalWrapper from '../Common/ModalWrapper'

function EncouragementModal({
  showEncouragementModal,
  onClose,
  encouragementMessages,
  newEncouragementMessage,
  setNewEncouragementMessage,
  onAddEncouragementMessage,
  editingEncouragementId,
  editingEncouragementText,
  setEditingEncouragementId,
  setEditingEncouragementText,
  onUpdateEncouragementMessage,
  onDeleteEncouragementMessage
}) {
  return (
    <ModalWrapper
      isOpen={showEncouragementModal}
      onClose={onClose}
      title="💬 격려 문구 관리"
      className="encouragement-modal"
    >
      <div className="encouragement-add-section">
        <input
          type="text"
          value={newEncouragementMessage}
          onChange={(e) => setNewEncouragementMessage(e.target.value)}
          placeholder="새로운 격려 문구를 입력하세요..."
          className="encouragement-input"
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && newEncouragementMessage.trim() !== '') {
              await onAddEncouragementMessage(newEncouragementMessage.trim())
              setNewEncouragementMessage('')
            }
          }}
        />
        <button
          onClick={async () => {
            if (newEncouragementMessage.trim() !== '') {
              await onAddEncouragementMessage(newEncouragementMessage.trim())
              setNewEncouragementMessage('')
            }
          }}
          className="add-encouragement-button"
          disabled={newEncouragementMessage.trim() === ''}
        >
          추가
        </button>
      </div>

      <div className="encouragement-list">
        {encouragementMessages.length === 0 ? (
          <p className="empty-message">등록된 격려 문구가 없습니다.</p>
        ) : (
          encouragementMessages.map((message, index) => (
            <div key={index} className="encouragement-item">
              {editingEncouragementId === index ? (
                <>
                  <input
                    type="text"
                    value={editingEncouragementText}
                    onChange={(e) => setEditingEncouragementText(e.target.value)}
                    className="encouragement-edit-input"
                    placeholder="격려 문구"
                  />
                  <div className="encouragement-item-actions">
                    <button
                      onClick={async () => {
                        if (editingEncouragementText.trim() !== '') {
                          await onUpdateEncouragementMessage(index, editingEncouragementText.trim())
                          setEditingEncouragementId(null)
                          setEditingEncouragementText('')
                        }
                      }}
                      className="encouragement-save-button"
                      disabled={editingEncouragementText.trim() === ''}
                    >
                      저장
                    </button>
                    <button
                      onClick={() => {
                        setEditingEncouragementId(null)
                        setEditingEncouragementText('')
                      }}
                      className="encouragement-cancel-button"
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="encouragement-text">{message}</span>
                  <div className="encouragement-item-actions">
                    <button
                      onClick={() => {
                        setEditingEncouragementId(index)
                        setEditingEncouragementText(message)
                      }}
                      className="encouragement-edit-button"
                      title="수정"
                    >
                      수정
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm('이 격려 문구를 삭제하시겠습니까?')) {
                          await onDeleteEncouragementMessage(index)
                        }
                      }}
                      className="encouragement-delete-button"
                      title="삭제"
                    >
                      삭제
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </ModalWrapper>
  )
}

export default EncouragementModal
