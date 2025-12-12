import { formatDateOnly, formatDateForDB } from '../../utils/dateUtils'

// 날짜 네비게이션 컴포넌트
function DateNavigation({ selectedDate, onDateChange, onPrevDay, onNextDay }) {
  return (
    <div className="date-nav-section">
      <div className="date-display-wrapper">
        <span className="date-display">
          {formatDateOnly(selectedDate)}
        </span>
        <input
          type="date"
          value={formatDateForDB(selectedDate)}
          onChange={onDateChange}
          className="date-picker-input"
        />
      </div>
      <button onClick={onPrevDay} className="date-nav-button">◀</button>
      <button onClick={onNextDay} className="date-nav-button">▶</button>
    </div>
  )
}

export default DateNavigation
