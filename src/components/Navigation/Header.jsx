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
  isReorderMode,
  setIsReorderMode
}) {
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

        {/* 섹션 이동 토글 버튼 */}
        <button
          className={`section-reorder-toggle ${isReorderMode ? 'active' : ''}`}
          onClick={() => setIsReorderMode(!isReorderMode)}
          title={isReorderMode ? '섹션 이동 종료' : '섹션 이동'}
        >
          ↕️
        </button>

        {/* 섹션 순서 수정 모드 */}
        {isReorderMode && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '8px',
            fontSize: '0.9rem',
            color: '#60a5fa'
          }}>
            <span>📌 섹션 순서 수정 중</span>
            <button
              onClick={() => setIsReorderMode(false)}
              style={{
                padding: '0.25rem 0.75rem',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#60a5fa',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}
            >
              완료
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Header
