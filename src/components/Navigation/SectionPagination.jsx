// 모바일 섹션 페이지네이션 dots 컴포넌트
function SectionPagination({ viewMode, currentSectionIndex, sectionsContainerRef, visibleSectionCount = 3 }) {
  if (viewMode !== 'horizontal') return null

  return (
    <div
      className="section-pagination-dots"
      onTouchStart={(e) => {
        const touch = e.touches[0]
        e.currentTarget.dataset.touchStartX = touch.clientX
        e.currentTarget.dataset.touchStartTime = Date.now()
      }}
      onTouchMove={(e) => {
        // 터치 이동 중에는 아무것도 하지 않음 (스크롤 방지)
        e.currentTarget.dataset.touchMoved = 'true'
      }}
      onTouchEnd={(e) => {
        const touchStartX = parseFloat(e.currentTarget.dataset.touchStartX || '0')
        const touchStartTime = parseInt(e.currentTarget.dataset.touchStartTime || '0')
        const touchMoved = e.currentTarget.dataset.touchMoved === 'true'
        const touchEndX = e.changedTouches[0].clientX
        const touchDuration = Date.now() - touchStartTime

        delete e.currentTarget.dataset.touchStartX
        delete e.currentTarget.dataset.touchStartTime
        delete e.currentTarget.dataset.touchMoved

        // 스와이프 감지 (최소 50px 이동, 500ms 이내)
        if (touchMoved && touchDuration < 500) {
          const diff = touchStartX - touchEndX
          const container = sectionsContainerRef.current
          if (!container) return
          const sections = container.querySelectorAll('.section-block')

          if (Math.abs(diff) > 50) {
            if (diff > 0 && currentSectionIndex < sections.length - 1) {
              // 왼쪽으로 스와이프 -> 다음 섹션
              sections[currentSectionIndex + 1].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
            } else if (diff < 0 && currentSectionIndex > 0) {
              // 오른쪽으로 스와이프 -> 이전 섹션
              sections[currentSectionIndex - 1].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
            }
          }
        }
      }}
    >
      {Array.from({ length: visibleSectionCount }, (_, index) => (
        <button
          key={index}
          className={`pagination-dot ${currentSectionIndex === index ? 'active' : ''}`}
          onClick={() => {
            const container = sectionsContainerRef.current
            if (!container) return
            const sections = container.querySelectorAll('.section-block')
            if (sections[index]) {
              sections[index].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
            }
          }}
        />
      ))}
    </div>
  )
}

export default SectionPagination
