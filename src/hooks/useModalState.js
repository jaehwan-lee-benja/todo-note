import { useState, useCallback } from 'react'

/**
 * 모달 상태 관리 커스텀 훅
 * 반복되는 모달 open/close 패턴을 통합
 *
 * @param {boolean} initialState - 초기 상태 (기본: false)
 * @returns {Object} { isOpen, open, close, toggle }
 *
 * @example
 * const memoModal = useModalState()
 * <button onClick={memoModal.open}>열기</button>
 * {memoModal.isOpen && <Modal onClose={memoModal.close} />}
 */
export function useModalState(initialState = false) {
  const [isOpen, setIsOpen] = useState(initialState)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen(prev => !prev), [])

  return { isOpen, open, close, toggle, setIsOpen }
}

/**
 * 데이터를 가진 모달 상태 관리
 * 모달을 열 때 특정 데이터를 함께 전달해야 하는 경우
 *
 * @param {any} initialData - 초기 데이터 (기본: null)
 * @returns {Object} { isOpen, data, open, close }
 *
 * @example
 * const editModal = useModalStateWithData()
 * <button onClick={() => editModal.open(item)}>수정</button>
 * {editModal.isOpen && <EditModal data={editModal.data} onClose={editModal.close} />}
 */
export function useModalStateWithData(initialData = null) {
  const [isOpen, setIsOpen] = useState(false)
  const [data, setData] = useState(initialData)

  const open = useCallback((newData = null) => {
    setData(newData)
    setIsOpen(true)
  }, [])

  const close = useCallback(() => {
    setIsOpen(false)
    setData(null)
  }, [])

  return { isOpen, data, open, close, setData }
}
