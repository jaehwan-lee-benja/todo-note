import React, { useRef } from 'react'
import { DAYS } from '../../utils/constants'
import Toast from '../Common/Toast'
import DaySelector from '../Common/DaySelector'
import AppleTimePicker from '../Common/AppleTimePicker'
import DeleteConfirmModal from '../Modals/DeleteConfirmModal'
import RoutineModal from '../Routine/RoutineModal'
import RoutineHistoryModal from '../Routine/RoutineHistoryModal'
import MemoModal from '../Modals/MemoModal'
import GanttChartModal from '../Modals/GanttChartModal'
import EncouragementModal from '../Modals/EncouragementModal'
import AddSectionModal from '../Modals/AddSectionModal'
import HiddenSectionsModal from '../Modals/HiddenSectionsModal'

/**
 * 투두 히스토리 모달 컴포넌트
 */
function TodoHistoryModalContent({
  todo,
  todoHistory,
  expandedHistoryIds,
  toggleHistoryDetail,
  formatDate,
  formatDateOnly,
  onClose
}) {
  const mouseDownOnOverlay = useRef(false)
  const visibleDates = todo.visible_dates && todo.visible_dates.length > 0 ? todo.visible_dates : [todo.date]
  const originalDate = visibleDates[0]
  const carryOverPath = visibleDates.map(date => ({ id: `${todo.id}-${date}`, date }))
  const historyRecords = todoHistory[todo.id] || []

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

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>&#x1F4CA; 투두 히스토리</h2>
          <button onClick={onClose} className="modal-close-button">&#x2715;</button>
        </div>
        <div className="modal-body">
          <div className="todo-history">
            <div className="history-item">
              <span className="history-label">생성일:</span>
              <span className="history-value">{formatDate(todo.created_at)}</span>
            </div>
            <div className="history-item">
              <span className="history-label">원본 페이지:</span>
              <span className="history-value">
                {originalDate ? formatDateOnly(new Date(originalDate + 'T00:00:00')) : formatDateOnly(new Date(todo.date + 'T00:00:00'))}
              </span>
            </div>
            {carryOverPath.length > 0 && (
              <div className="history-item">
                <span className="history-label">이월 경로:</span>
                <span className="history-value">
                  {carryOverPath.map((path, idx) => {
                    const isCurrentPage = path.date === todo.date
                    const dateStr = formatDateOnly(new Date(path.date + 'T00:00:00'))
                    return (
                      <span key={path.id}>
                        {idx > 0 && ' → '}
                        <span style={isCurrentPage ? { fontWeight: 'bold', color: '#4CAF50' } : {}}>
                          {dateStr.split('(')[0]}{isCurrentPage ? '(여기)' : ''}
                        </span>
                      </span>
                    )
                  })}
                </span>
              </div>
            )}
            {(() => {
              const createdDate = new Date(todo.created_at).toISOString().split('T')[0]
              const currentDate = todo.date
              if (createdDate !== currentDate && carryOverPath.length === 0) {
                return (
                  <div className="history-item">
                    <span className="history-label">현재 페이지:</span>
                    <span className="history-value">{formatDateOnly(new Date(todo.date + 'T00:00:00'))}</span>
                  </div>
                )
              }
              return null
            })()}
            {historyRecords.length > 0 && (
              <div className="history-changes-list">
                <div className="history-changes-header">변경 이력 ({historyRecords.length})</div>
                {historyRecords.map((record) => (
                  <div key={record.id} className="history-record-compact">
                    <div className="history-record-summary">
                      <div className="history-change-time">
                        {formatDate(record.changed_at)}
                        {record.changed_on_date && (
                          <span className="history-page-info"> (페이지: {formatDateOnly(new Date(record.changed_on_date + 'T00:00:00'))})</span>
                        )}
                      </div>
                      <button
                        className="history-detail-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleHistoryDetail(record.id)
                        }}
                      >
                        {expandedHistoryIds.includes(record.id) ? '숨기기' : '내용보기'}
                      </button>
                    </div>
                    {expandedHistoryIds.includes(record.id) && (
                      <div className="history-change">
                        <div className="history-change-item history-before">
                          <span className="change-badge">이전</span>
                          <span className="change-text">{record.previous_text}</span>
                        </div>
                        <div className="history-change-arrow">→</div>
                        <div className="history-change-item history-after">
                          <span className="change-badge">이후</span>
                          <span className="change-text">{record.new_text}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 투두 루틴 설정 모달 컴포넌트
 */
function TodoRoutineSetupModalContent({
  todo,
  routines,
  routineDaysForModal,
  isEditingRoutineInModal,
  routineTimeSlotForModal,
  onToggleDay,
  setRoutineTimeSlotForModal,
  setRoutineDaysForModal,
  setIsEditingRoutineInModal,
  handleCreateRoutineFromTodo,
  onClose
}) {
  const mouseDownOnOverlay = useRef(false)
  const currentRoutine = routines.find(r => r.id === todo.routine_id)

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

  return (
    <div className="modal-overlay" onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>&#x1F504; 루틴 설정</h2>
          <button onClick={onClose} className="modal-close-button">&#x2715;</button>
        </div>
        <div className="modal-body">
          <div className="routine-setup-inline">
            {currentRoutine && !isEditingRoutineInModal ? (
              <>
                <div className="routine-current-info">
                  <div className="routine-info-title">설정된 루틴:</div>
                  <div className="routine-days-display">
                    {DAYS.filter(day => currentRoutine.days.includes(day.key)).map(day => (
                      <span key={day.key} className="routine-day-badge">
                        {day.label}
                      </span>
                    ))}
                  </div>
                  {currentRoutine.time_slot && (
                    <div className="routine-time-slot" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                      &#x23F0; {currentRoutine.time_slot}
                    </div>
                  )}
                </div>
                <div className="routine-setup-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setRoutineDaysForModal(currentRoutine.days)
                      setRoutineTimeSlotForModal(currentRoutine.time_slot || '')
                      setIsEditingRoutineInModal(true)
                    }}
                    className="routine-confirm-button"
                  >
                    수정
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      await handleCreateRoutineFromTodo(todo.id, todo.text, [], null, true)
                      onClose()
                    }}
                    className="routine-remove-button"
                  >
                    제거
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="routine-setup-title">
                  {isEditingRoutineInModal ? '루틴 수정:' : '반복할 요일 선택:'}
                </div>
                <DaySelector
                  selectedDays={routineDaysForModal}
                  onToggle={onToggleDay}
                  variant="inline"
                />
                <div className="time-slot-selector" style={{ marginTop: '1rem' }}>
                  <label style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem', display: 'block' }}>
                    &#x23F0; 시간 (선택사항)
                  </label>
                  <AppleTimePicker
                    value={routineTimeSlotForModal}
                    onChange={(time) => setRoutineTimeSlotForModal(time)}
                  />
                </div>
                <div className="routine-setup-actions">
                  <button
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (isEditingRoutineInModal && currentRoutine) {
                        await handleCreateRoutineFromTodo(todo.id, todo.text, routineDaysForModal, currentRoutine.id, false, routineTimeSlotForModal)
                      } else {
                        await handleCreateRoutineFromTodo(todo.id, todo.text, routineDaysForModal, null, false, routineTimeSlotForModal)
                      }
                      onClose()
                    }}
                    className="routine-confirm-button"
                  >
                    확인
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onClose()
                    }}
                    className="routine-cancel-button"
                  >
                    취소
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 앱 모달 통합 컴포넌트
 */
function AppModals({
  // Toast
  showUndoToast,
  showSuccessToast,
  successToastMessage,
  lastDeleteAction,
  handleUndoDelete,
  handleUndoRoutineDelete,

  // Delete Confirm Modal (Todo)
  showDeleteConfirmModal,
  todoToDelete,
  setShowDeleteConfirmModal,
  deleteThisOnly,
  deleteFromNow,
  deleteAll,

  // Delete Confirm Modal (Routine)
  showRoutineDeleteModal,
  routineToDelete,
  setShowRoutineDeleteModal,
  deleteRoutineThisOnly,
  deleteRoutineFromNow,
  deleteRoutineAll,

  // Todo History Modal
  showTodoHistoryModal,
  selectedTodoForModal,
  todoHistory,
  expandedHistoryIds,
  toggleHistoryDetail,
  handleCloseTodoHistoryModal,
  formatDate,
  formatDateOnly,

  // Todo Routine Setup Modal
  showTodoRoutineSetupModal,
  routines,
  routineDaysForModal,
  isEditingRoutineInModal,
  routineTimeSlotForModal,
  handleToggleRoutineDayInModal,
  setRoutineTimeSlotForModal,
  setRoutineDaysForModal,
  setIsEditingRoutineInModal,
  handleCreateRoutineFromTodo,
  handleCloseTodoRoutineSetupModal,

  // Routine Modal
  showRoutineModal,
  handleCloseRoutine,
  routineInput,
  setRoutineInput,
  isAddingRoutine,
  selectedDays,
  handleToggleDay,
  selectedTimeSlot,
  setSelectedTimeSlot,
  handleAddRoutine,
  editingRoutineId,
  editingRoutineText,
  setEditingRoutineText,
  editingRoutineDays,
  handleToggleEditDay,
  handleStartEditRoutine,
  handleSaveEditRoutine,
  handleCancelEditRoutine,
  handleDeleteRoutine,
  fetchRoutineHistory,

  // Routine History Modal
  showRoutineHistory,
  handleCloseRoutineHistory,
  selectedRoutineForHistory,
  routineHistoryData,

  // Memo Modal
  showMemoModal,
  setShowMemoModal,
  memoContent,
  setMemoContent,
  isSavingMemo,

  // Gantt Chart Modal
  showGanttChart,
  handleCloseGanttChart,
  ganttData,
  ganttPeriod,
  setGanttPeriod,

  // Encouragement Modal
  showEncouragementModal,
  setShowEncouragementModal,
  encouragementMessages,
  newEncouragementMessage,
  setNewEncouragementMessage,
  addEncouragementMessage,
  editingEncouragementId,
  editingEncouragementText,
  setEditingEncouragementId,
  setEditingEncouragementText,
  updateEncouragementMessage,
  deleteEncouragementMessage,

  // Add Section Modal
  showAddSectionModal,
  setShowAddSectionModal,
  handleAddSection,

  // Hidden Sections Modal
  showHiddenSectionsModal,
  setShowHiddenSectionsModal,
  hiddenSections,
  sectionOrder,
  sectionTitles,
  customSections,
  handleShowSection
}) {
  return (
    <>
      {/* Toast Messages */}
      {showUndoToast && (
        <Toast
          message="삭제되었습니다"
          onUndo={handleUndoDelete}
        />
      )}

      {showSuccessToast && (
        <Toast
          message={successToastMessage}
          onUndo={lastDeleteAction ? handleUndoRoutineDelete : null}
          variant="success"
        />
      )}

      {/* Delete Confirm Modal (Todo) */}
      {showDeleteConfirmModal && todoToDelete && (
        <DeleteConfirmModal
          todo={todoToDelete}
          onClose={() => setShowDeleteConfirmModal(false)}
          onDeleteThisOnly={deleteThisOnly}
          onDeleteFromNow={deleteFromNow}
          onDeleteAll={deleteAll}
        />
      )}

      {/* Delete Confirm Modal (Routine) */}
      {showRoutineDeleteModal && routineToDelete && (
        <DeleteConfirmModal
          todo={routineToDelete}
          onClose={() => setShowRoutineDeleteModal(false)}
          onDeleteThisOnly={deleteRoutineThisOnly}
          onDeleteFromNow={deleteRoutineFromNow}
          onDeleteAll={deleteRoutineAll}
        />
      )}

      {/* Todo History Modal */}
      {showTodoHistoryModal && selectedTodoForModal && (
        <TodoHistoryModalContent
          todo={selectedTodoForModal}
          todoHistory={todoHistory}
          expandedHistoryIds={expandedHistoryIds}
          toggleHistoryDetail={toggleHistoryDetail}
          formatDate={formatDate}
          formatDateOnly={formatDateOnly}
          onClose={handleCloseTodoHistoryModal}
        />
      )}

      {/* Todo Routine Setup Modal */}
      {showTodoRoutineSetupModal && selectedTodoForModal && (
        <TodoRoutineSetupModalContent
          todo={selectedTodoForModal}
          routines={routines}
          routineDaysForModal={routineDaysForModal}
          isEditingRoutineInModal={isEditingRoutineInModal}
          routineTimeSlotForModal={routineTimeSlotForModal}
          onToggleDay={handleToggleRoutineDayInModal}
          setRoutineTimeSlotForModal={setRoutineTimeSlotForModal}
          setRoutineDaysForModal={setRoutineDaysForModal}
          setIsEditingRoutineInModal={setIsEditingRoutineInModal}
          handleCreateRoutineFromTodo={handleCreateRoutineFromTodo}
          onClose={handleCloseTodoRoutineSetupModal}
        />
      )}

      {/* Routine Modal */}
      <RoutineModal
        showRoutineModal={showRoutineModal}
        onClose={handleCloseRoutine}
        routineInput={routineInput}
        setRoutineInput={setRoutineInput}
        isAddingRoutine={isAddingRoutine}
        selectedDays={selectedDays}
        onToggleDay={handleToggleDay}
        selectedTimeSlot={selectedTimeSlot}
        setSelectedTimeSlot={setSelectedTimeSlot}
        onAddRoutine={handleAddRoutine}
        routines={routines}
        editingRoutineId={editingRoutineId}
        editingRoutineText={editingRoutineText}
        setEditingRoutineText={setEditingRoutineText}
        editingRoutineDays={editingRoutineDays}
        onToggleEditDay={handleToggleEditDay}
        onStartEdit={handleStartEditRoutine}
        onSaveEdit={handleSaveEditRoutine}
        onCancelEdit={handleCancelEditRoutine}
        onDelete={handleDeleteRoutine}
        onShowHistory={fetchRoutineHistory}
      />

      {/* Routine History Modal */}
      <RoutineHistoryModal
        showRoutineHistory={showRoutineHistory}
        onClose={handleCloseRoutineHistory}
        selectedRoutine={selectedRoutineForHistory}
        routineHistoryData={routineHistoryData}
      />

      {/* Memo Modal */}
      <MemoModal
        show={showMemoModal}
        onClose={() => setShowMemoModal(false)}
        content={memoContent}
        setContent={setMemoContent}
        isSaving={isSavingMemo}
        placeholder="자유롭게 메모하세요..."
      />

      {/* Gantt Chart Modal */}
      <GanttChartModal
        showGanttChart={showGanttChart}
        onClose={handleCloseGanttChart}
        ganttData={ganttData}
        ganttPeriod={ganttPeriod}
        setGanttPeriod={setGanttPeriod}
        formatDateOnly={formatDateOnly}
      />

      {/* Encouragement Modal */}
      <EncouragementModal
        showEncouragementModal={showEncouragementModal}
        onClose={() => setShowEncouragementModal(false)}
        encouragementMessages={encouragementMessages}
        newEncouragementMessage={newEncouragementMessage}
        setNewEncouragementMessage={setNewEncouragementMessage}
        onAddEncouragementMessage={addEncouragementMessage}
        editingEncouragementId={editingEncouragementId}
        editingEncouragementText={editingEncouragementText}
        setEditingEncouragementId={setEditingEncouragementId}
        setEditingEncouragementText={setEditingEncouragementText}
        onUpdateEncouragementMessage={updateEncouragementMessage}
        onDeleteEncouragementMessage={deleteEncouragementMessage}
      />

      {/* Add Section Modal */}
      <AddSectionModal
        isOpen={showAddSectionModal}
        onClose={() => setShowAddSectionModal(false)}
        onAddSection={handleAddSection}
      />

      {/* Hidden Sections Modal */}
      <HiddenSectionsModal
        show={showHiddenSectionsModal}
        onClose={() => setShowHiddenSectionsModal(false)}
        hiddenSections={hiddenSections}
        sectionOrder={sectionOrder}
        sectionTitles={sectionTitles}
        customSections={customSections}
        onShowSection={handleShowSection}
      />
    </>
  )
}

export default AppModals
