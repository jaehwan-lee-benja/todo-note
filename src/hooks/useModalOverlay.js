import { useRef, useCallback } from 'react'

/**
 * 모달 오버레이 클릭 핸들러 커스텀 훅
 * mousedown이 오버레이에서 시작된 경우에만 닫히도록 처리
 *
 * @param {Function} onClose - 모달 닫기 함수
 * @returns {{ handleOverlayMouseDown, handleOverlayClick }} 오버레이 이벤트 핸들러
 */
export function useModalOverlay(onClose) {
  const mouseDownOnOverlay = useRef(false)

  const handleOverlayMouseDown = useCallback((e) => {
    if (e.target === e.currentTarget) {
      mouseDownOnOverlay.current = true
    }
  }, [])

  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget && mouseDownOnOverlay.current) {
      onClose()
    }
    mouseDownOnOverlay.current = false
  }, [onClose])

  return { handleOverlayMouseDown, handleOverlayClick }
}
