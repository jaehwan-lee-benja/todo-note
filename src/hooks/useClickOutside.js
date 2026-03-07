import { useEffect } from 'react'

/**
 * 요소 외부 클릭 감지 커스텀 훅
 *
 * @param {boolean} isActive - 감지 활성화 여부
 * @param {string} selector - 내부 클릭을 무시할 CSS 선택자
 * @param {Function} onClickOutside - 외부 클릭 시 콜백
 */
export function useClickOutside(isActive, selector, onClickOutside) {
  useEffect(() => {
    if (!isActive) return

    const handleClickOutside = (e) => {
      if (!e.target.closest(selector)) {
        onClickOutside()
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isActive, selector, onClickOutside])
}
