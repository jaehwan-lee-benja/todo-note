import { DAYS } from '../../utils/constants'
import AppleTimePicker from '../Common/AppleTimePicker'
import DaySelector from '../Common/DaySelector'
import ModalWrapper from '../Common/ModalWrapper'

function RoutineModal({
  showRoutineModal,
  onClose,
  routineInput,
  setRoutineInput,
  isAddingRoutine,
  selectedDays,
  onToggleDay,
  selectedTimeSlot,
  setSelectedTimeSlot,
  onAddRoutine,
  routines,
  editingRoutineId,
  editingRoutineText,
  setEditingRoutineText,
  editingRoutineDays,
  onToggleEditDay,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onShowHistory,
}) {
  return (
    <ModalWrapper isOpen={showRoutineModal} onClose={onClose} title="📌 루틴 관리" className="routine-modal">
      <div className="routine-add-section">
        <input
          type="text"
          value={routineInput}
          onChange={(e) => setRoutineInput(e.target.value)}
          placeholder="루틴 내용을 입력하세요..."
          className="routine-input"
          disabled={isAddingRoutine}
        />
        <DaySelector
          selectedDays={selectedDays}
          onToggle={onToggleDay}
          disabled={isAddingRoutine}
        />
        <div className="time-slot-selector">
          <label className="time-slot-label">⏰ 시간 (선택사항)</label>
          <AppleTimePicker
            value={selectedTimeSlot}
            onChange={(time) => setSelectedTimeSlot(time)}
          />
        </div>
        <button
          onClick={onAddRoutine}
          className="add-routine-button"
          disabled={isAddingRoutine || routineInput.trim() === ''}
        >
          루틴 추가
        </button>
      </div>

      <div className="routine-list">
        {routines.length === 0 ? (
          <p className="empty-message">등록된 루틴이 없습니다.</p>
        ) : (
          routines.map(routine => (
            <div key={routine.id} className="routine-item">
              {editingRoutineId === routine.id ? (
                <>
                  <div className="routine-edit-content">
                    <input
                      type="text"
                      value={editingRoutineText}
                      onChange={(e) => setEditingRoutineText(e.target.value)}
                      className="routine-edit-input"
                      placeholder="루틴 내용"
                    />
                    <DaySelector
                      selectedDays={editingRoutineDays}
                      onToggle={onToggleEditDay}
                      variant="inline"
                    />
                  </div>
                  <div className="routine-item-actions">
                    <button
                      onClick={onSaveEdit}
                      className="routine-save-button"
                      disabled={editingRoutineText.trim() === '' || editingRoutineDays.length === 0}
                    >
                      저장
                    </button>
                    <button
                      onClick={onCancelEdit}
                      className="routine-cancel-edit-button"
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="routine-item-content">
                    <span className="routine-text">{routine.text}</span>
                    <div className="routine-meta">
                      <div className="routine-days">
                        {DAYS.filter(day => routine.days.includes(day.key)).map(day => (
                          <span key={day.key} className="routine-day-badge">
                            {day.label}
                          </span>
                        ))}
                      </div>
                      {routine.time_slot && (
                        <span className="routine-time-slot">
                          {routine.time_slot}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="routine-item-actions">
                    <button
                      onClick={() => onShowHistory(routine)}
                      className="routine-history-button"
                      title="히스토리 보기"
                    >
                      📊
                    </button>
                    <button
                      onClick={() => onStartEdit(routine)}
                      className="routine-edit-button"
                      title="수정"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => onDelete(routine.id)}
                      className="routine-delete-button"
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

export default RoutineModal
