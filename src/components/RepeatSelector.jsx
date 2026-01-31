import React, { useState, useRef, useEffect } from 'react'
import { REPEAT_TYPE, REPEAT_TYPE_LABELS, DAYS } from '../utils/constants'
import './RepeatSelector.css'

/**
 * 반복 설정 선택 컴포넌트
 * - 반복 타입 선택 (없음, 매일, 평일, 주말, 요일 선택)
 * - 요일 선택 UI (weekly 타입일 때)
 */
function RepeatSelector({
  repeatType = REPEAT_TYPE.NONE,
  repeatDays = [],
  onRepeatChange,
  disabled = false,
  compact = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showDayPicker, setShowDayPicker] = useState(repeatType === REPEAT_TYPE.WEEKLY)
  const [selectedDays, setSelectedDays] = useState(repeatDays)
  const dropdownRef = useRef(null)

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
        setShowDayPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 반복 타입 변경
  const handleTypeSelect = (type) => {
    if (type === REPEAT_TYPE.WEEKLY) {
      setShowDayPicker(true)
    } else {
      setShowDayPicker(false)
      setIsOpen(false)
      onRepeatChange({
        repeatType: type,
        repeatDays: [],
      })
    }
  }

  // 요일 토글
  const handleDayToggle = (dayKey) => {
    const newDays = selectedDays.includes(dayKey)
      ? selectedDays.filter(d => d !== dayKey)
      : [...selectedDays, dayKey]
    setSelectedDays(newDays)
  }

  // 요일 선택 확정
  const handleDayPickerConfirm = () => {
    if (selectedDays.length > 0) {
      onRepeatChange({
        repeatType: REPEAT_TYPE.WEEKLY,
        repeatDays: selectedDays,
      })
    }
    setShowDayPicker(false)
    setIsOpen(false)
  }

  // 현재 선택된 타입의 라벨 표시
  const getDisplayLabel = () => {
    if (repeatType === REPEAT_TYPE.WEEKLY && repeatDays.length > 0) {
      const dayLabels = DAYS
        .filter(d => repeatDays.includes(d.key))
        .map(d => d.label)
        .join(', ')
      return dayLabels
    }
    return REPEAT_TYPE_LABELS[repeatType] || '반복 없음'
  }

  // 반복 아이콘
  const getRepeatIcon = () => {
    if (repeatType === REPEAT_TYPE.NONE) return null
    return '🔄'
  }

  if (compact) {
    // 컴팩트 모드: 아이콘만 표시
    return (
      <div className="repeat-selector compact" ref={dropdownRef}>
        <button
          type="button"
          className={`repeat-toggle-button ${repeatType !== REPEAT_TYPE.NONE ? 'active' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          title={getDisplayLabel()}
        >
          {getRepeatIcon() || '🔁'}
        </button>

        {isOpen && (
          <div className="repeat-dropdown">
            {showDayPicker ? (
              <div className="day-picker">
                <div className="day-picker-header">요일 선택</div>
                <div className="day-buttons">
                  {DAYS.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      className={`day-button ${selectedDays.includes(day.key) ? 'selected' : ''}`}
                      onClick={() => handleDayToggle(day.key)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <div className="day-picker-actions">
                  <button
                    type="button"
                    className="day-picker-cancel"
                    onClick={() => {
                      setShowDayPicker(false)
                      setSelectedDays(repeatDays)
                    }}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="day-picker-confirm"
                    onClick={handleDayPickerConfirm}
                    disabled={selectedDays.length === 0}
                  >
                    확인
                  </button>
                </div>
              </div>
            ) : (
              <ul className="repeat-options">
                {Object.entries(REPEAT_TYPE).map(([key, value]) => (
                  <li
                    key={key}
                    className={`repeat-option ${repeatType === value ? 'selected' : ''}`}
                    onClick={() => handleTypeSelect(value)}
                  >
                    {REPEAT_TYPE_LABELS[value]}
                    {repeatType === value && <span className="check-mark">✓</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    )
  }

  // 일반 모드: 버튼 + 라벨
  return (
    <div className="repeat-selector" ref={dropdownRef}>
      <button
        type="button"
        className={`repeat-button ${repeatType !== REPEAT_TYPE.NONE ? 'active' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {getRepeatIcon()} {getDisplayLabel()}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="repeat-dropdown">
          {showDayPicker ? (
            <div className="day-picker">
              <div className="day-picker-header">요일 선택</div>
              <div className="day-buttons">
                {DAYS.map(day => (
                  <button
                    key={day.key}
                    type="button"
                    className={`day-button ${selectedDays.includes(day.key) ? 'selected' : ''}`}
                    onClick={() => handleDayToggle(day.key)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <div className="day-picker-actions">
                <button
                  type="button"
                  className="day-picker-cancel"
                  onClick={() => {
                    setShowDayPicker(false)
                    setSelectedDays(repeatDays)
                  }}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="day-picker-confirm"
                  onClick={handleDayPickerConfirm}
                  disabled={selectedDays.length === 0}
                >
                  확인
                </button>
              </div>
            </div>
          ) : (
            <ul className="repeat-options">
              {Object.entries(REPEAT_TYPE).map(([key, value]) => (
                <li
                  key={key}
                  className={`repeat-option ${repeatType === value ? 'selected' : ''}`}
                  onClick={() => handleTypeSelect(value)}
                >
                  {REPEAT_TYPE_LABELS[value]}
                  {repeatType === value && <span className="check-mark">✓</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export default RepeatSelector
