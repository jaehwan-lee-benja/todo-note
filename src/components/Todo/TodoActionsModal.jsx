import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { supabase } from '../../supabaseClient'
import { DAYS } from '../../utils/constants'
import { formatDateForDB } from '../../utils/dateUtils'
import AppleTimePicker from '../Common/AppleTimePicker'
import DaySelector from '../Common/DaySelector'
import DeleteOptions from '../Common/DeleteOptions'

/**
 * 투두 액션 모달 컴포넌트
 * 나노투두, 루틴설정, 히스토리, 루틴기록, 삭제 기능 제공
 */
function TodoActionsModal({
  todo,
  isOpen,
  onClose,
  onEdit,
  onToggle,
  onDelete,
  onAddSubTodo,
  onCreateRoutine,
  subtodos,
  routines,
  formatDate,
  formatDateOnly
}) {
  const [editText, setEditText] = useState(todo.text)
  const [selectedAction, setSelectedAction] = useState(null)
  const [subTodoText, setSubTodoText] = useState('')
  const [deleteOption, setDeleteOption] = useState('this-only')

  // 루틴 설정 상태
  const [isEditingRoutine, setIsEditingRoutine] = useState(false)
  const [routineDays, setRoutineDays] = useState([])
  const [routineTimeSlot, setRoutineTimeSlot] = useState('')

  // 히스토리 상태
  const [todoHistory, setTodoHistory] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [expandedHistoryIds, setExpandedHistoryIds] = useState([])

  // 루틴 기록 상태
  const [routineHistoryData, setRoutineHistoryData] = useState([])
  const [selectedRoutineForHistory, setSelectedRoutineForHistory] = useState(null)

  const currentRoutine = todo.routine_id ? routines.find(r => r.id === todo.routine_id) : null

  // 요일 번호를 키로 변환
  const getDayKey = (dayNumber) => {
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    return keys[dayNumber]
  }

  // 루틴 요일 토글
  const handleToggleRoutineDay = (dayKey) => {
    setRoutineDays(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 히스토리 자동 로드
  useEffect(() => {
    if (selectedAction === 'history' && todoHistory.length === 0 && !isLoadingHistory) {
      const loadHistory = async () => {
        setIsLoadingHistory(true)
        try {
          const { data, error } = await supabase
            .from('todo_history')
            .select('*')
            .eq('todo_id', todo.id)
            .order('changed_at', { ascending: false })

          if (error) throw error
          setTodoHistory(data || [])
        } catch (error) {
          console.error('Error fetching history:', error)
        } finally {
          setIsLoadingHistory(false)
        }
      }
      loadHistory()
    }
  }, [selectedAction, todo.id, todoHistory.length, isLoadingHistory])

  // 루틴 기록 자동 로드
  useEffect(() => {
    if (selectedAction === 'routine-stats' && currentRoutine &&
        (!selectedRoutineForHistory || selectedRoutineForHistory.id !== currentRoutine.id)) {
      const loadRoutineHistory = async () => {
        try {
          const { data: routineTodo, error } = await supabase
            .from('todos')
            .select('*')
            .eq('routine_id', currentRoutine.id)
            .eq('deleted', false)
            .maybeSingle()

          if (error) throw error

          if (routineTodo && routineTodo.visible_dates) {
            const historyData = routineTodo.visible_dates
              .sort()
              .map(date => ({
                id: `${routineTodo.id}-${date}`,
                date,
                text: routineTodo.text,
                completed: routineTodo.completed_dates?.includes(date) || false
              }))

            setRoutineHistoryData(historyData)
            setSelectedRoutineForHistory(currentRoutine)
          }
        } catch (error) {
          console.error('Error fetching routine history:', error)
        }
      }
      loadRoutineHistory()
    }
  }, [selectedAction, currentRoutine, selectedRoutineForHistory])

  // 개별 히스토리 내용 토글
  const toggleHistoryDetail = (historyId) => {
    setExpandedHistoryIds(prev =>
      prev.includes(historyId)
        ? prev.filter(id => id !== historyId)
        : [...prev, historyId]
    )
  }

  if (!isOpen) return null

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="actions-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="actions-modal-header">
          <h3>작업 선택</h3>
          <button onClick={onClose} className="modal-close-button">&#x2715;</button>
        </div>

        {/* 투두 텍스트 편집 영역 */}
        <div className="todo-edit-section">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => {
              if (editText.trim() !== '' && editText !== todo.text) {
                onEdit(todo.id, editText)
              } else if (editText.trim() === '') {
                setEditText(todo.text)
              }
            }}
            className="todo-edit-textarea"
            placeholder="투두 내용을 입력하세요..."
            rows={3}
          />
        </div>

        <div className="actions-modal-body">
          {/* 왼쪽 메뉴 */}
          <div className="actions-menu">
            <button
              className={`action-menu-item ${selectedAction === 'nanotodo' ? 'active' : ''}`}
              onClick={() => setSelectedAction('nanotodo')}
            >
              <span className="action-icon">&#x1F52C;</span>
              <span>나노투두</span>
            </button>
            <button
              className={`action-menu-item ${selectedAction === 'routine' ? 'active' : ''}`}
              onClick={() => {
                setSelectedAction('routine')
                if (currentRoutine) {
                  setRoutineDays(currentRoutine.days || [])
                  setRoutineTimeSlot(currentRoutine.time_slot || '')
                  setIsEditingRoutine(false)
                } else {
                  setRoutineDays([])
                  setRoutineTimeSlot('')
                  setIsEditingRoutine(true)
                }
              }}
            >
              <span className="action-icon">&#x1F4CC;</span>
              <span>루틴설정</span>
            </button>
            <button
              className={`action-menu-item ${selectedAction === 'history' ? 'active' : ''}`}
              onClick={() => setSelectedAction('history')}
            >
              <span className="action-icon">&#x1F4CB;</span>
              <span>히스토리</span>
            </button>
            {todo.routine_id && currentRoutine && (
              <button
                className={`action-menu-item ${selectedAction === 'routine-stats' ? 'active' : ''}`}
                onClick={() => setSelectedAction('routine-stats')}
              >
                <span className="action-icon">&#x1F4CA;</span>
                <span>루틴기록</span>
              </button>
            )}
            <button
              className={`action-menu-item delete ${selectedAction === 'delete' ? 'active' : ''}`}
              onClick={() => setSelectedAction('delete')}
            >
              <span className="action-icon">&#x1F5D1;&#xFE0F;</span>
              <span>삭제</span>
            </button>
          </div>

          {/* 오른쪽 상세 */}
          <div className="actions-detail">
            {!selectedAction && (
              <div className="actions-detail-empty">
                <p>왼쪽에서 작업을 선택하세요</p>
              </div>
            )}

            {/* 나노투두 섹션 */}
            {selectedAction === 'nanotodo' && (
              <div className="actions-detail-content">
                <h4>&#x1F52C; 나노투두</h4>
                <div className="nanotodo-section-in-modal">
                  {subtodos && subtodos.length > 0 && (
                    <div className="subtodo-list-in-modal">
                      {subtodos.map((subtodo) => (
                        <div key={subtodo.id} className="subtodo-item-in-modal">
                          <input
                            type="checkbox"
                            checked={subtodo.completed}
                            onChange={() => onToggle(subtodo.id)}
                            className="subtodo-checkbox-modal"
                          />
                          <span className={`subtodo-text-modal ${subtodo.completed ? 'completed' : ''}`}>
                            {subtodo.text}
                          </span>
                          <button
                            onClick={() => onDelete(subtodo.id)}
                            className="subtodo-delete-modal"
                            title="삭제"
                          >
                            &#x2715;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="subtodo-input-section-modal">
                    <input
                      type="text"
                      value={subTodoText}
                      onChange={(e) => setSubTodoText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && subTodoText.trim()) {
                          onAddSubTodo(todo.id, subTodoText.trim())
                          setSubTodoText('')
                        }
                      }}
                      placeholder="나노투두 입력..."
                      className="subtodo-input-modal"
                    />
                    <button
                      onClick={() => {
                        if (subTodoText.trim()) {
                          onAddSubTodo(todo.id, subTodoText.trim())
                          setSubTodoText('')
                        }
                      }}
                      className="subtodo-add-button-modal"
                    >
                      추가
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 루틴 설정 섹션 */}
            {selectedAction === 'routine' && (
              <div className="actions-detail-content">
                <h4>&#x1F504; 루틴 설정</h4>
                <div className="routine-setup-inline">
                  {currentRoutine && !isEditingRoutine ? (
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
                            setRoutineDays(currentRoutine.days)
                            setRoutineTimeSlot(currentRoutine.time_slot || '')
                            setIsEditingRoutine(true)
                          }}
                          className="routine-confirm-button"
                        >
                          수정
                        </button>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            await onCreateRoutine(todo.id, todo.text, [], null, true)
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
                        {isEditingRoutine && currentRoutine ? '루틴 수정:' : '반복할 요일 선택:'}
                      </div>
                      <DaySelector
                        selectedDays={routineDays}
                        onToggle={handleToggleRoutineDay}
                        variant="inline"
                      />
                      <div className="time-slot-selector" style={{ marginTop: '1rem' }}>
                        <label style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem', display: 'block' }}>
                          &#x23F0; 시간 (선택사항)
                        </label>
                        <AppleTimePicker
                          value={routineTimeSlot}
                          onChange={(time) => setRoutineTimeSlot(time)}
                        />
                      </div>
                      <div className="routine-setup-actions">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (isEditingRoutine && currentRoutine) {
                              await onCreateRoutine(todo.id, todo.text, routineDays, currentRoutine.id, false, routineTimeSlot)
                            } else {
                              await onCreateRoutine(todo.id, todo.text, routineDays, null, false, routineTimeSlot)
                            }
                            setIsEditingRoutine(false)
                            onClose()
                          }}
                          className="routine-confirm-button"
                        >
                          확인
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setIsEditingRoutine(false)
                            setRoutineDays([])
                            setRoutineTimeSlot('')
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
            )}

            {/* 히스토리 섹션 */}
            {selectedAction === 'history' && (() => {
              const visibleDates = todo.visible_dates && todo.visible_dates.length > 0 ? todo.visible_dates : [todo.date]
              const originalDate = visibleDates[0]
              const carryOverPath = visibleDates.map(date => ({ id: `${todo.id}-${date}`, date }))

              if (isLoadingHistory) {
                return (
                  <div className="actions-detail-content">
                    <h4>&#x1F4CA; 투두 히스토리</h4>
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                      로딩 중...
                    </div>
                  </div>
                )
              }

              return (
                <div className="actions-detail-content">
                  <h4>&#x1F4CA; 투두 히스토리</h4>
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
                    {todoHistory.length > 0 && (
                      <div className="history-changes-list">
                        <div className="history-changes-header">변경 이력 ({todoHistory.length})</div>
                        {todoHistory.map((record) => (
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
              )
            })()}

            {/* 루틴 기록 섹션 */}
            {selectedAction === 'routine-stats' && currentRoutine && (() => {
              if (!selectedRoutineForHistory || selectedRoutineForHistory.id !== currentRoutine.id || routineHistoryData.length === 0) {
                return (
                  <div className="actions-detail-content">
                    <h4>&#x1F4CA; {currentRoutine.text} 히스토리</h4>
                    <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                      {(!selectedRoutineForHistory || selectedRoutineForHistory.id !== currentRoutine.id) ? '로딩 중...' : '데이터가 없습니다.'}
                    </div>
                  </div>
                )
              }

              const firstTodo = routineHistoryData[0]
              const firstDate = new Date(firstTodo.date)
              const today = new Date()

              const completionMap = {}
              routineHistoryData.forEach(item => {
                completionMap[item.date] = item.completed
              })

              const monthGroups = []
              let currentDate = new Date(firstDate)

              while (currentDate <= today) {
                const year = currentDate.getFullYear()
                const month = currentDate.getMonth()
                const monthKey = `${year}-${month + 1}`

                if (!monthGroups.find(g => g.key === monthKey)) {
                  monthGroups.push({ key: monthKey, year, month, days: [] })
                }

                const monthGroup = monthGroups.find(g => g.key === monthKey)
                const dateStr = formatDateForDB(currentDate)
                const dayOfWeek = currentDate.getDay()
                const dayKey = getDayKey(dayOfWeek)
                const isRoutineDay = currentRoutine.days.includes(dayKey)

                monthGroup.days.push({
                  date: new Date(currentDate),
                  dateStr,
                  day: currentDate.getDate(),
                  dayOfWeek,
                  isCompleted: completionMap[dateStr] === true,
                  isRoutineDay,
                  hasTodo: completionMap[dateStr] !== undefined
                })

                currentDate.setDate(currentDate.getDate() + 1)
              }

              return (
                <div className="actions-detail-content">
                  <h4>&#x1F4CA; {currentRoutine.text} 히스토리</h4>
                  <div className="routine-history-content">
                    <div className="routine-history-calendar">
                      {monthGroups.map(monthGroup => (
                        <div key={monthGroup.key} className="history-month">
                          <h3 className="history-month-title">
                            {monthGroup.year}년 {monthGroup.month + 1}월
                          </h3>
                          <div className="history-calendar-grid">
                            <div className="history-day-header">일</div>
                            <div className="history-day-header">월</div>
                            <div className="history-day-header">화</div>
                            <div className="history-day-header">수</div>
                            <div className="history-day-header">목</div>
                            <div className="history-day-header">금</div>
                            <div className="history-day-header">토</div>

                            {monthGroup.days.length > 0 && Array(monthGroup.days[0].dayOfWeek).fill(null).map((_, i) => (
                              <div key={`empty-${i}`} className="history-day-cell empty"></div>
                            ))}

                            {monthGroup.days.map((dayInfo) => (
                              <div
                                key={dayInfo.dateStr}
                                className={`history-day-cell ${dayInfo.isCompleted ? 'completed' : ''} ${!dayInfo.isRoutineDay ? 'not-routine-day' : ''}`}
                                title={`${dayInfo.dateStr}${!dayInfo.isRoutineDay ? ' (루틴 요일 아님)' : ''}${dayInfo.isCompleted ? ' - 완료' : dayInfo.hasTodo ? ' - 미완료' : ''}`}
                              >
                                <span className="day-number">{dayInfo.day}</span>
                                {dayInfo.isCompleted && <span className="check-mark">&#x2713;</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="routine-history-stats">
                      <div className="stat-item">
                        <span className="stat-label">총 투두:</span>
                        <span className="stat-value">{routineHistoryData.length}개</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">완료:</span>
                        <span className="stat-value completed">{routineHistoryData.filter(t => t.completed).length}개</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">미완료:</span>
                        <span className="stat-value incomplete">{routineHistoryData.filter(t => !t.completed).length}개</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">완료율:</span>
                        <span className="stat-value">
                          {routineHistoryData.length > 0
                            ? Math.round((routineHistoryData.filter(t => t.completed).length / routineHistoryData.length) * 100)
                            : 0}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* 삭제 섹션 */}
            {selectedAction === 'delete' && (
              <div className="actions-detail-content">
                <h4>&#x1F5D1;&#xFE0F; 할 일 삭제</h4>
                <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '1rem', lineHeight: '1.6' }}>
                  완료되지 않은 할일은 다음날로 이월됩니다.<br/>
                  아래 삭제 옵션 중 선택해주세요.
                </p>

                <DeleteOptions
                  selectedOption={deleteOption}
                  onChange={setDeleteOption}
                />

                <div style={{
                  display: 'flex',
                  gap: '0.5rem',
                  justifyContent: 'flex-end',
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <button
                    onClick={onClose}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      fontSize: '0.9rem'
                    }}
                  >
                    취소
                  </button>
                  <button
                    onClick={async () => {
                      const confirmed = window.confirm(
                        `정말로 삭제하시겠습니까?\n\n삭제 후 5초 이내에 실행취소할 수 있습니다.`
                      )
                      if (!confirmed) return
                      await onDelete(todo.id, deleteOption)
                      onClose()
                    }}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      background: '#ef4444',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: '600'
                    }}
                  >
                    확인
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default TodoActionsModal
