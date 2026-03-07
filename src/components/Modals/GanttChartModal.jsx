import ModalWrapper from '../Common/ModalWrapper'

function GanttChartModal({
  showGanttChart,
  onClose,
  ganttData,
  ganttPeriod,
  setGanttPeriod,
  formatDateOnly
}) {
  return (
    <ModalWrapper isOpen={showGanttChart} onClose={onClose} title="📊 간트차트 - 투두 현황" className="gantt-modal">
      <div className="gantt-filter">
        <div className="gantt-period-buttons">
          {[
            { value: '1week', label: '지난 1주일' },
            { value: '2weeks', label: '지난 2주일' },
            { value: '1month', label: '지난 1개월' },
            { value: '3months', label: '지난 3개월' },
            { value: '6months', label: '지난 6개월' },
            { value: 'all', label: '전체' }
          ].map((period) => (
            <button
              key={period.value}
              className={`period-button ${ganttPeriod === period.value ? 'active' : ''}`}
              onClick={() => setGanttPeriod(period.value)}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="gantt-content">
        {ganttData.length === 0 ? (
          <p className="empty-message">투두가 없습니다.</p>
        ) : (
          <div className="gantt-chart">
            {(() => {
              const allDates = ganttData.flatMap(item => item.dates)
              const uniqueDates = [...new Set(allDates)].sort((a, b) => new Date(a) - new Date(b))

              if (uniqueDates.length === 0) {
                return <p className="empty-message">날짜 정보가 없습니다.</p>
              }

              const startDate = new Date(uniqueDates[0])
              const endDate = new Date(uniqueDates[uniqueDates.length - 1])

              const dateRange = []
              for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                dateRange.push(new Date(d).toISOString().split('T')[0])
              }

              return (
                <>
                  <div className="gantt-header">
                    <div className="gantt-task-column">투두 항목</div>
                    <div className="gantt-timeline">
                      {dateRange.map(date => (
                        <div key={date} className="gantt-date-cell">
                          {formatDateOnly(new Date(date + 'T00:00:00')).split('(')[0]}
                        </div>
                      ))}
                    </div>
                  </div>

                  {ganttData.map((item) => {
                    const datesSet = new Set(item.dates)

                    return (
                      <div key={item.originalId} className="gantt-row">
                        <div className="gantt-task-column" title={item.text}>
                          <span className={item.completed ? 'completed-task' : ''}>
                            {item.text}
                          </span>
                        </div>
                        <div className="gantt-timeline">
                          {dateRange.map(date => {
                            const hasTask = datesSet.has(date)

                            if (!hasTask) {
                              return <div key={date} className="gantt-date-cell"></div>
                            }

                            const isStartDate = date === item.startDate
                            const isCompletedDate = date === item.completedDate

                            let cellClass = 'gantt-date-cell has-task'
                            if (isStartDate) {
                              cellClass += ' start-date'
                            } else if (isCompletedDate) {
                              cellClass += ' completed-date'
                            } else {
                              cellClass += ' middle-date'
                            }

                            return (
                              <div key={date} className={cellClass}>
                                {isCompletedDate ? <span className="completed-circle">✓</span> : '○'}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </>
              )
            })()}
          </div>
        )}
      </div>
    </ModalWrapper>
  )
}

export default GanttChartModal
