import { useState } from 'react'
import { isToday } from '../../utils/dateUtils'
import DateNavigation from './DateNavigation'

// 헤더 컴포넌트 (settings-bar)
function Header({
  showSidebar,
  setShowSidebar,
  selectedDate,
  setSelectedDate,
  onDateChange,
  onPrevDay,
  onNextDay,
  showEncouragementEmoji,
  currentEncouragementMessage,
  onEncouragementClick,
  onQuickAdd,
  onOpenMemo
}) {
  const [quickInput, setQuickInput] = useState('')
  const [isQuickAdding, setIsQuickAdding] = useState(false)

  const handleQuickAdd = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey && quickInput.trim()) {
      e.preventDefault()
      setIsQuickAdding(true)
      try {
        await onQuickAdd(quickInput.trim())
        setQuickInput('')
      } catch (error) {
        console.error('Quick add error:', error)
      } finally {
        setIsQuickAdding(false)
      }
    }
  }
  return (
    <div className="header-fixed">
      <div className="settings-bar">
        {/* 햄버거 메뉴 버튼 */}
        <button
          className="hamburger-menu"
          onClick={() => setShowSidebar(!showSidebar)}
          title="메뉴"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="16" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="9" width="16" height="2" rx="1" fill="currentColor"/>
            <rect x="2" y="14" width="16" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>

        {/* 날짜 네비게이션 */}
        <DateNavigation
          selectedDate={selectedDate}
          onDateChange={onDateChange}
          onPrevDay={onPrevDay}
          onNextDay={onNextDay}
        />

        {/* 응원 메시지 */}
        <div className="encouragement-section">
          {isToday(selectedDate) ? (
            <div
              className="encouragement-message"
              onClick={onEncouragementClick}
              title="클릭하면 다른 격려 문구가 나와요!"
            >
              {showEncouragementEmoji ? (
                <span className="encouragement-emoji">🔥 🔥 🔥</span>
              ) : (
                currentEncouragementMessage || '화이팅!'
              )}
            </div>
          ) : (
            <button
              onClick={() => setSelectedDate(new Date())}
              className="today-link"
              title="오늘로 가기"
            >
              오늘 페이지로 바로가기
            </button>
          )}
        </div>

        {/* Quick 입력창 */}
        <div className="quick-input-wrapper">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={handleQuickAdd}
            placeholder="⚡ Quick 투두 입력 (Enter로 추가)"
            className="quick-input"
            disabled={isQuickAdding}
          />
        </div>

        {/* 메모 버튼 */}
        <button
          className="header-memo-button"
          onClick={onOpenMemo}
          title="생각 메모"
        >
          📋 생각 메모
        </button>
      </div>
    </div>
  )
}

export default Header
