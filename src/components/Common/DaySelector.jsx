import { DAYS } from '../../utils/constants'

/**
 * 요일 선택 컴포넌트
 * @param {string[]} selectedDays - 선택된 요일 키 배열 (예: ['mon', 'wed', 'fri'])
 * @param {function} onToggle - 요일 토글 핸들러 (dayKey) => void
 * @param {boolean} disabled - 비활성화 여부
 * @param {string} variant - 스타일 변형 ('default' | 'inline')
 */
function DaySelector({ selectedDays = [], onToggle, disabled = false, variant = 'default' }) {
  const handleClick = (e, dayKey) => {
    e.stopPropagation()
    onToggle(dayKey)
  }

  const className = variant === 'inline' ? 'day-selector-inline' : 'day-selector'
  const buttonClassName = variant === 'inline' ? 'day-button-inline' : 'day-button'

  return (
    <div className={className}>
      {DAYS.map(day => (
        <button
          key={day.key}
          onClick={(e) => handleClick(e, day.key)}
          className={`${buttonClassName} ${selectedDays.includes(day.key) ? 'selected' : ''}`}
          disabled={disabled}
          type="button"
        >
          {day.label}
        </button>
      ))}
    </div>
  )
}

export default DaySelector
