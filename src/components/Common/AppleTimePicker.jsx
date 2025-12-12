import { useState, useEffect, useRef } from 'react'
import { DEFAULT_HOUR, DEFAULT_MINUTE } from '../../utils/constants'

// 애플 스타일 시간 Picker 컴포넌트
function AppleTimePicker({ value, onChange }) {
  const hourRef = useRef(null)
  const minuteRef = useRef(null)
  const prevValueRef = useRef(value)
  const isMounted = useRef(false)
  const [hour, setHour] = useState(() => {
    if (value && value.includes(':')) {
      return value.split(':')[0]
    }
    return DEFAULT_HOUR
  })
  const [minute, setMinute] = useState(() => {
    if (value && value.includes(':')) {
      return value.split(':')[1]
    }
    return DEFAULT_MINUTE
  })

  // value가 외부에서 변경되면 hour와 minute 업데이트
  useEffect(() => {
    if (value && value.includes(':') && value !== prevValueRef.current) {
      const [h, m] = value.split(':')
      prevValueRef.current = value
      setHour(h)
      setMinute(m)
    }
  }, [value])

  // hour 또는 minute가 변경되면 onChange 호출
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true
      return
    }
    const newValue = `${hour}:${minute}`
    prevValueRef.current = newValue
    if (onChange) {
      onChange(newValue)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hour, minute])

  const handleScroll = (ref, setter, max) => {
    if (!ref.current) return
    const scrollTop = ref.current.scrollTop
    const itemHeight = 40 // 각 아이템 높이
    const index = Math.round(scrollTop / itemHeight)
    const value = String(index).padStart(2, '0')
    setter(value)
  }

  const scrollToValue = (ref, value) => {
    if (!ref.current) return
    const itemHeight = 40
    const index = parseInt(value, 10)
    ref.current.scrollTop = index * itemHeight
  }

  useEffect(() => {
    scrollToValue(hourRef, hour)
  }, [])

  useEffect(() => {
    scrollToValue(minuteRef, minute)
  }, [])

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

  const incrementHour = () => {
    const newHour = (parseInt(hour, 10) + 1) % 24
    const newHourStr = String(newHour).padStart(2, '0')
    setHour(newHourStr)
    scrollToValue(hourRef, newHourStr)
  }

  const decrementHour = () => {
    const newHour = (parseInt(hour, 10) - 1 + 24) % 24
    const newHourStr = String(newHour).padStart(2, '0')
    setHour(newHourStr)
    scrollToValue(hourRef, newHourStr)
  }

  const incrementMinute = () => {
    const newMinute = (parseInt(minute, 10) + 1) % 60
    const newMinuteStr = String(newMinute).padStart(2, '0')
    setMinute(newMinuteStr)
    scrollToValue(minuteRef, newMinuteStr)
  }

  const decrementMinute = () => {
    const newMinute = (parseInt(minute, 10) - 1 + 60) % 60
    const newMinuteStr = String(newMinute).padStart(2, '0')
    setMinute(newMinuteStr)
    scrollToValue(minuteRef, newMinuteStr)
  }

  return (
    <div className="apple-time-picker">
      <div className="picker-arrows-top">
        <button className="picker-arrow-button" onClick={incrementHour}>▲</button>
        <div style={{ width: '20px' }} />
        <button className="picker-arrow-button" onClick={incrementMinute}>▲</button>
      </div>
      <div className="picker-container">
        <div
          className="picker-column"
          ref={hourRef}
          onScroll={() => handleScroll(hourRef, setHour, 24)}
        >
          <div className="picker-spacer" />
          {hours.map((h) => (
            <div
              key={h}
              className={`picker-item ${h === hour ? 'selected' : ''}`}
              onClick={() => {
                setHour(h)
                scrollToValue(hourRef, h)
              }}
            >
              {h}
            </div>
          ))}
          <div className="picker-spacer" />
        </div>
        <div className="picker-separator">:</div>
        <div
          className="picker-column"
          ref={minuteRef}
          onScroll={() => handleScroll(minuteRef, setMinute, 60)}
        >
          <div className="picker-spacer" />
          {minutes.map((m) => (
            <div
              key={m}
              className={`picker-item ${m === minute ? 'selected' : ''}`}
              onClick={() => {
                setMinute(m)
                scrollToValue(minuteRef, m)
              }}
            >
              {m}
            </div>
          ))}
          <div className="picker-spacer" />
        </div>
      </div>
      <div className="picker-arrows-bottom">
        <button className="picker-arrow-button" onClick={decrementHour}>▼</button>
        <div style={{ width: '20px' }} />
        <button className="picker-arrow-button" onClick={decrementMinute}>▼</button>
      </div>
      <div className="picker-selection-indicator" />
    </div>
  )
}

export default AppleTimePicker
