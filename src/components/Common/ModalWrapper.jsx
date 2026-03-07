import { useModalOverlay } from '../../hooks/useModalOverlay'

/**
 * 공통 모달 래퍼 컴포넌트
 * 오버레이, 헤더(제목+닫기), 컨텐츠 영역을 통합
 *
 * @param {boolean} isOpen - 모달 표시 여부
 * @param {Function} onClose - 모달 닫기 함수
 * @param {string} title - 모달 제목
 * @param {string} [className] - modal-content에 추가할 클래스
 * @param {string} [overlayClassName] - modal-overlay에 추가할 클래스
 * @param {React.ReactNode} [headerActions] - 헤더 우측 추가 버튼 (닫기 버튼 앞)
 * @param {React.ReactNode} children - 모달 본문
 */
function ModalWrapper({
  isOpen,
  onClose,
  title,
  className = '',
  overlayClassName = 'modal-overlay',
  headerClassName = 'modal-header',
  headerActions,
  children
}) {
  const { handleOverlayMouseDown, handleOverlayClick } = useModalOverlay(onClose)

  if (!isOpen) return null

  return (
    <div className={overlayClassName} onMouseDown={handleOverlayMouseDown} onClick={handleOverlayClick}>
      <div className={`modal-content ${className}`.trim()} onClick={(e) => e.stopPropagation()}>
        <div className={headerClassName}>
          <h2>{title}</h2>
          {headerActions ? (
            <div className="modal-header-actions">
              {headerActions}
              <button onClick={onClose} className="modal-close-button">&#x2715;</button>
            </div>
          ) : (
            <button onClick={onClose} className="modal-close-button">&#x2715;</button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

export default ModalWrapper
