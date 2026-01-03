// 사이드바 컴포넌트
function Sidebar({
  showSidebar,
  setShowSidebar,
  session,
  viewMode,
  setViewMode,
  isReorderMode,
  setIsReorderMode,
  onOpenTrash,
  onOpenRoutine,
  onOpenMemo,
  onScrollToKeyThoughts,
  onOpenGanttChart,
  onOpenEncouragementModal,
  onOpenDummyModal,
  onOpenAddSection,
  onOpenHiddenSections,
  onLogout
}) {
  return (
    <>
      {/* 사이드바 오버레이 */}
      {showSidebar && (
        <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />
      )}

      {/* 사이드바 */}
      <div className={`sidebar ${showSidebar ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>메뉴</h2>
          <button className="sidebar-close" onClick={() => setShowSidebar(false)}>✕</button>
        </div>

        {/* 사용자 정보 */}
        {session && session.user && (
          <div style={{
            padding: '1rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            {session.user.user_metadata?.avatar_url && (
              <img
                src={session.user.user_metadata.avatar_url}
                alt="프로필"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%'
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.9rem',
                fontWeight: '600',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {session.user.user_metadata?.full_name || session.user.email}
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: 'rgba(255, 255, 255, 0.6)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {session.user.email}
              </div>
            </div>
          </div>
        )}

        <div className="sidebar-content">
          <button
            className="sidebar-menu-item"
            onClick={() => {
              const newMode = viewMode === 'vertical' ? 'horizontal' : 'vertical'
              setViewMode(newMode)
              localStorage.setItem('viewMode', newMode)
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">{viewMode === 'vertical' ? '⬌' : '⬍'}</span>
            <span>{viewMode === 'vertical' ? '가로 나열' : '세로 나열'}</span>
          </button>
          <button
            className={`sidebar-menu-item ${isReorderMode ? 'active' : ''}`}
            onClick={() => {
              setIsReorderMode(!isReorderMode)
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">↕️</span>
            <span>{isReorderMode ? '섹션 이동 종료' : '섹션 이동'}</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              onOpenAddSection()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">➕</span>
            <span>섹션 추가</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              onOpenHiddenSections()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">🗂️</span>
            <span>숨긴 섹션 관리</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              onOpenTrash()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">🗑️</span>
            <span>휴지통</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              onOpenRoutine()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">📌</span>
            <span>루틴 관리</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              onOpenMemo()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">📝</span>
            <span>생각 메모</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              onScrollToKeyThoughts()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">💡</span>
            <span>주요 생각정리</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              onOpenGanttChart()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">📊</span>
            <span>간트로 보기</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              onOpenEncouragementModal()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">💬</span>
            <span>격려 문구 관리</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              onOpenDummyModal()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">🧪</span>
            <span>더미 데이터 관리</span>
          </button>

          {/* 로그아웃 버튼 */}
          <button
            className="sidebar-menu-item"
            onClick={() => {
              if (confirm('로그아웃 하시겠습니까?')) {
                onLogout()
              }
            }}
            style={{
              marginTop: 'auto',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'rgba(255, 100, 100, 0.9)'
            }}
          >
            <span className="sidebar-icon">🚪</span>
            <span>로그아웃</span>
          </button>
        </div>
      </div>
    </>
  )
}

export default Sidebar
