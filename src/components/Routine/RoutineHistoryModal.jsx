import { formatDateForDB } from '../../utils/dateUtils'
import { getDayKey } from '../../utils/constants'
import ModalWrapper from '../Common/ModalWrapper'

function RoutineHistoryModal({
  showRoutineHistory,
  onClose,
  selectedRoutine,
  routineHistoryData,
}) {
  if (!selectedRoutine) return null

  return (
    <ModalWrapper
      isOpen={showRoutineHistory}
      onClose={onClose}
      title={`📊 ${selectedRoutine.text} 히스토리`}
      className="routine-history-modal"
    >
      <div className="routine-history-content">
        {(() => {
          if (routineHistoryData.length === 0) {
            return <p className="empty-message">아직 생성된 투두가 없습니다.</p>
          }

          const firstTodo = routineHistoryData[0]
          const firstDate = new Date(firstTodo.date)
          const today = new Date()

          const completionMap = {}
          routineHistoryData.forEach(todo => {
            completionMap[todo.date] = todo.completed
          })

          const monthGroups = []
          let currentDate = new Date(firstDate)

          while (currentDate <= today) {
            const year = currentDate.getFullYear()
            const month = currentDate.getMonth()
            const monthKey = `${year}-${month + 1}`

            if (!monthGroups.find(g => g.key === monthKey)) {
              monthGroups.push({
                key: monthKey,
                year,
                month,
                days: []
              })
            }

            const monthGroup = monthGroups.find(g => g.key === monthKey)
            const dateStr = formatDateForDB(currentDate)
            const dayOfWeek = currentDate.getDay()

            const dayKey = getDayKey(dayOfWeek)
            const isRoutineDay = selectedRoutine.days.includes(dayKey)

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

                    {monthGroup.days.map((dayInfo, index) => {
                      if (index > 0 && dayInfo.day === 1) {
                        const prevDay = monthGroup.days[index - 1]
                        const emptyCount = 6 - prevDay.dayOfWeek
                        return (
                          <>
                            {Array(emptyCount).fill(null).map((_, i) => (
                              <div key={`empty-end-${index}-${i}`} className="history-day-cell empty"></div>
                            ))}
                            <div key={dayInfo.dateStr} className="history-day-header">일</div>
                            <div className="history-day-header">월</div>
                            <div className="history-day-header">화</div>
                            <div className="history-day-header">수</div>
                            <div className="history-day-header">목</div>
                            <div className="history-day-header">금</div>
                            <div className="history-day-header">토</div>
                            <div className={`history-day-cell ${dayInfo.isCompleted ? 'completed' : ''} ${!dayInfo.isRoutineDay ? 'not-routine-day' : ''}`}>
                              <span className="day-number">{dayInfo.day}</span>
                              {dayInfo.isCompleted && <span className="check-mark">✓</span>}
                            </div>
                          </>
                        )
                      }

                      return (
                        <div
                          key={dayInfo.dateStr}
                          className={`history-day-cell ${dayInfo.isCompleted ? 'completed' : ''} ${!dayInfo.isRoutineDay ? 'not-routine-day' : ''}`}
                          title={`${dayInfo.dateStr}${!dayInfo.isRoutineDay ? ' (루틴 요일 아님)' : ''}${dayInfo.isCompleted ? ' - 완료' : dayInfo.hasTodo ? ' - 미완료' : ''}`}
                        >
                          <span className="day-number">{dayInfo.day}</span>
                          {dayInfo.isCompleted && <span className="check-mark">✓</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

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
    </ModalWrapper>
  )
}

export default RoutineHistoryModal
