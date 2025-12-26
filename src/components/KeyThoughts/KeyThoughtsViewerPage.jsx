import React, { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import './KeyThoughtsViewerPage.css'

/**
 * 드래그 가능한 블럭 컴포넌트
 */
function SortableBlock({
  block,
  depth,
  isSelected,
  isOver,
  dropPosition,
  activeId,
  hasChildren,
  text,
  onClick,
  showBottomLine: showChildDropBottomLine,
  isEditing,
  editingText,
  onDoubleClick,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onAddChildBlock,
  onDeleteBlock
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
  } = useSortable({ id: block.id })

  const textareaRef = useRef(null)

  // textarea 높이 자동 조정
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [isEditing, editingText])

  // 노션 방식: 드래그 중에는 블록들이 움직이지 않음
  const isActive = block.id === activeId
  const showTopLine = isOver && dropPosition === 'top' && activeId && activeId !== block.id
  const showBottomLine = (isOver && dropPosition === 'bottom' && activeId && activeId !== block.id) || showChildDropBottomLine
  const showAsChild = isOver && dropPosition === 'center' && activeId && activeId !== block.id

  const style = {
    // transform 제거 - 블록이 움직이지 않도록
    cursor: isEditing ? 'text' : 'grab',
    opacity: isActive ? 0.4 : 1, // 드래그 중인 블록은 약간 투명하게
  }

  // 편집 중일 때는 드래그 비활성화
  const dragHandlers = isEditing ? {} : { ...attributes, ...listeners }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={block.id}
      data-drop-zone={isOver ? dropPosition : ''}
      className={`viewer-block ${isSelected ? 'selected' : ''} ${hasChildren ? 'has-children' : ''} ${showTopLine ? 'show-drop-line-top' : ''} ${showBottomLine ? 'show-drop-line-bottom' : ''} ${showAsChild ? 'show-as-child-target' : ''} ${isEditing ? 'editing' : ''}`}
      onClick={isEditing ? undefined : onClick}
      onDoubleClick={isEditing ? undefined : onDoubleClick}
      {...dragHandlers}
    >
      <div className="block-content-area">
        {isEditing ? (
          <textarea
            ref={textareaRef}
            className="block-edit-input"
            value={editingText}
            onChange={(e) => onEditChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSaveEdit()
              } else if (e.key === 'Escape') {
                onCancelEdit()
              }
            }}
            onBlur={onSaveEdit}
            autoFocus
            rows={1}
          />
        ) : (
          <div className="block-text">{text || '내용 입력'}</div>
        )}
      </div>

      <div className="block-actions-area">
        {isEditing ? (
          <div className="block-edit-buttons">
            <button
              className="add-child-button"
              onMouseDown={(e) => e.preventDefault()} // blur 방지
              onClick={(e) => {
                e.stopPropagation()
                onSaveEdit() // 먼저 저장
                onAddChildBlock(block.id)
              }}
              title="하위 블럭 만들기"
            >
              추가
            </button>
            <button
              className="delete-block-button"
              onMouseDown={(e) => e.preventDefault()} // blur 방지
              onClick={(e) => {
                e.stopPropagation()
                if (window.confirm('이 블럭을 삭제하시겠습니까?')) {
                  onDeleteBlock(block.id)
                }
              }}
              title="블럭 삭제"
            >
              삭제
            </button>
          </div>
        ) : (
          hasChildren && <div className="block-arrow">{isSelected ? '▶' : '▷'}</div>
        )}
      </div>
    </div>
  )
}

/**
 * 주요 생각정리 뷰어 페이지 (전체 화면 모드)
 * @param {Array} blocks - 주요 생각정리 블럭 데이터
 * @param {Function} setBlocks - 블럭 데이터 업데이트 함수
 * @param {Function} onSave - 블럭 데이터 저장 함수
 * @param {Function} onClose - 뷰어 닫기 핸들러
 */
function KeyThoughtsViewerPage({ blocks = [], setBlocks, onSave, onClose }) {
  // 다크모드 상태 (기본값: 다크모드)
  const [isDarkMode, setIsDarkMode] = useState(true)

  // 각 컬럼에서 선택된 블럭 추적
  const [selectedPath, setSelectedPath] = useState([]) // [blockId1, blockId2, ...]

  // 드래그 상태
  const [activeBlock, setActiveBlock] = useState(null)
  const [overId, setOverId] = useState(null)
  const [dropPosition, setDropPosition] = useState(null) // 'top' | 'center' | 'bottom'

  // 편집 상태
  const [editingBlockId, setEditingBlockId] = useState(null)
  const [editingText, setEditingText] = useState('')

  // 마우스 위치를 useRef로 즉시 접근 가능하게 (state 지연 없음)
  const pointerPositionRef = useRef({ x: 0, y: 0 })
  const currentOverIdRef = useRef(null) // 현재 over 중인 블럭 ID
  const activeBlockIdRef = useRef(null) // 드래그 중인 블럭 ID

  // 길게 누르기 지원 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 500, // 500ms 길게 누르기
        tolerance: 8,
      },
    })
  )

  // 특정 깊이의 블럭들을 가져오기
  const getBlocksAtDepth = (depth) => {
    if (depth === 0) {
      return blocks || [] // 최상위 블럭들
    }

    // 선택된 경로를 따라가며 하위 블럭 찾기
    let currentBlocks = blocks
    for (let i = 0; i < depth; i++) {
      const selectedId = selectedPath[i]
      if (!selectedId) return []

      const selectedBlock = currentBlocks.find(b => b.id === selectedId)
      if (!selectedBlock || !selectedBlock.children || selectedBlock.children.length === 0) {
        return []
      }
      currentBlocks = selectedBlock.children
    }
    return currentBlocks
  }

  // 블럭 클릭 핸들러
  const handleBlockClick = (depth, blockId, e) => {
    // 편집 중이면 무시
    if (editingBlockId) return
    // 드래그 중이면 무시
    if (activeBlock) return

    // 선택된 경로를 해당 깊이까지만 유지하고 새 선택 추가
    const newPath = selectedPath.slice(0, depth)
    newPath[depth] = blockId
    setSelectedPath(newPath)
  }

  // 블럭 더블클릭 핸들러 (편집 모드)
  const handleBlockDoubleClick = (blockId, e) => {
    e.stopPropagation()
    const block = findBlockById(blocks, blockId)
    if (block) {
      setEditingBlockId(blockId)
      setEditingText(getBlockText(block))
    }
  }

  // 블럭 편집 저장
  const handleSaveEdit = () => {
    if (!editingBlockId || !setBlocks) return

    const clonedBlocks = JSON.parse(JSON.stringify(blocks))

    // 블럭 찾아서 내용 업데이트
    const updateBlockContent = (blockList, targetId, newContent) => {
      for (let i = 0; i < blockList.length; i++) {
        if (blockList[i].id === targetId) {
          // content 구조 유지하며 업데이트
          if (Array.isArray(blockList[i].content)) {
            blockList[i].content = [{ text: newContent }]
          } else {
            blockList[i].content = newContent
          }
          return true
        }
        if (blockList[i].children) {
          if (updateBlockContent(blockList[i].children, targetId, newContent)) return true
        }
      }
      return false
    }

    updateBlockContent(clonedBlocks, editingBlockId, editingText)
    setBlocks(clonedBlocks)
    setEditingBlockId(null)
    setEditingText('')

    // 편집 완료 후 저장
    if (onSave) {
      setTimeout(() => {
        onSave()
      }, 100)
    }
  }

  // 편집 취소
  const handleCancelEdit = () => {
    setEditingBlockId(null)
    setEditingText('')
  }

  // 하위 블럭 추가
  const handleAddChildBlock = (parentId) => {
    if (!setBlocks) return

    const clonedBlocks = JSON.parse(JSON.stringify(blocks))

    // 부모 블럭 찾아서 빈 하위 블럭 추가
    const addEmptyChild = (blockList, targetId) => {
      for (let i = 0; i < blockList.length; i++) {
        if (blockList[i].id === targetId) {
          // 고유 ID 생성
          const newBlockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          const emptyBlock = {
            id: newBlockId,
            content: '',
            children: []
          }

          if (!blockList[i].children) {
            blockList[i].children = []
          }
          blockList[i].children.push(emptyBlock)
          return newBlockId
        }
        if (blockList[i].children) {
          const result = addEmptyChild(blockList[i].children, targetId)
          if (result) return result
        }
      }
      return null
    }

    const newBlockId = addEmptyChild(clonedBlocks, parentId)
    if (newBlockId) {
      setBlocks(clonedBlocks)

      // 편집 모드 종료하고 새 블럭으로 경로 업데이트
      setEditingBlockId(null)
      setEditingText('')

      // 부모 블럭의 depth 찾기
      const parentDepth = findBlockDepth(clonedBlocks, parentId)
      if (parentDepth !== -1) {
        const newPath = selectedPath.slice(0, parentDepth)
        newPath[parentDepth] = parentId
        setSelectedPath(newPath)
      }

      // 하위 블럭 추가 후 저장
      if (onSave) {
        setTimeout(() => {
          onSave()
        }, 100)
      }
    }
  }

  // 블럭 삭제
  const handleDeleteBlock = (blockId) => {
    if (!setBlocks) return

    const clonedBlocks = JSON.parse(JSON.stringify(blocks))

    // 블럭 찾아서 삭제
    const deleteBlock = (blockList, targetId) => {
      for (let i = 0; i < blockList.length; i++) {
        if (blockList[i].id === targetId) {
          blockList.splice(i, 1)
          return true
        }
        if (blockList[i].children) {
          if (deleteBlock(blockList[i].children, targetId)) return true
        }
      }
      return false
    }

    if (deleteBlock(clonedBlocks, blockId)) {
      setBlocks(clonedBlocks)

      // 편집 모드 종료
      setEditingBlockId(null)
      setEditingText('')

      // 선택된 경로 초기화 (삭제된 블럭이 경로에 포함되어 있을 수 있음)
      const newPath = selectedPath.filter(id => id !== blockId)
      setSelectedPath(newPath)

      // 블럭 삭제 후 저장
      if (onSave) {
        setTimeout(() => {
          onSave()
        }, 100)
      }
    }
  }

  // 컬럼에 새 블럭 추가 (제일 아래)
  const handleAddBlockToColumn = (depth) => {
    if (!setBlocks) return

    const clonedBlocks = JSON.parse(JSON.stringify(blocks))
    const newBlockId = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const emptyBlock = {
      id: newBlockId,
      content: '',
      children: []
    }

    if (depth === 0) {
      // 최상위 레벨에 추가
      clonedBlocks.push(emptyBlock)
    } else {
      // 하위 레벨에 추가 - 선택된 경로의 마지막 블럭의 children에 추가
      const parentId = selectedPath[depth - 1]
      if (!parentId) return

      const addToParent = (blockList) => {
        for (let i = 0; i < blockList.length; i++) {
          if (blockList[i].id === parentId) {
            if (!blockList[i].children) {
              blockList[i].children = []
            }
            blockList[i].children.push(emptyBlock)
            return true
          }
          if (blockList[i].children) {
            if (addToParent(blockList[i].children)) return true
          }
        }
        return false
      }

      addToParent(clonedBlocks)
    }

    setBlocks(clonedBlocks)

    // 새로 추가된 블럭을 자동으로 편집 모드로 전환
    setTimeout(() => {
      setEditingBlockId(newBlockId)
      setEditingText('')
    }, 50)

    // 블럭 추가 후 저장
    if (onSave) {
      setTimeout(() => {
        onSave()
      }, 100)
    }
  }

  // 블럭을 ID로 찾기 (재귀)
  const findBlockById = (blockList, id) => {
    for (const block of blockList) {
      if (block.id === id) return block
      if (block.children) {
        const found = findBlockById(block.children, id)
        if (found) return found
      }
    }
    return null
  }

  // 블럭의 depth 찾기
  const findBlockDepth = (blockList, targetId, currentDepth = 0) => {
    for (const block of blockList) {
      if (block.id === targetId) return currentDepth
      if (block.children) {
        const depth = findBlockDepth(block.children, targetId, currentDepth + 1)
        if (depth !== -1) return depth
      }
    }
    return -1
  }

  // 드롭 위치 계산 헬퍼 함수 (재사용)
  const calculateDropPosition = (overId, mouseY) => {
    if (!overId) return null

    // 마우스 위치가 초기값(0)이면 계산 스킵
    if (mouseY === 0) return null

    // over된 요소의 위치 정보 가져오기
    const overElement = document.querySelector(`[data-block-id="${overId}"]`)
    if (!overElement) {
      return 'top'
    }

    const rect = overElement.getBoundingClientRect()
    const relativeY = mouseY - rect.top
    const percentage = relativeY / rect.height

    // 영역 구분: 상단 25% | 중앙 50% | 하단 25%
    let position
    if (percentage < 0) {
      position = 'top'
    } else if (percentage > 1) {
      position = 'bottom'
    } else if (percentage < 0.25) {
      position = 'top'
    } else if (percentage > 0.75) {
      position = 'bottom'
    } else {
      position = 'center'
    }

    // 중앙 영역에 드래그 중이면 해당 블럭의 하위 컬럼 열기 (children이 없어도 열림)
    if (position === 'center') {
      const overBlock = findBlockById(blocks, overId)
      if (overBlock) {
        const depth = findBlockDepth(blocks, overId)
        if (depth !== -1) {
          // 해당 depth까지의 경로를 유지하고 overId 추가
          const newPath = selectedPath.slice(0, depth)
          newPath[depth] = overId
          // 경로가 변경된 경우에만 업데이트 (무한 루프 방지)
          if (JSON.stringify(newPath) !== JSON.stringify(selectedPath)) {
            setSelectedPath(newPath)
          }
        }
      }
    }

    return position
  }

  // 블럭 이동 로직 (같은 레벨)
  const moveBlock = (activeId, overId, position) => {
    if (!setBlocks) return

    const clonedBlocks = JSON.parse(JSON.stringify(blocks))

    // 1. activeBlock 찾기 및 제거
    let activeBlockData = null
    const removeBlock = (blockList, id) => {
      for (let i = 0; i < blockList.length; i++) {
        if (blockList[i].id === id) {
          activeBlockData = blockList.splice(i, 1)[0]
          return true
        }
        if (blockList[i].children) {
          if (removeBlock(blockList[i].children, id)) return true
        }
      }
      return false
    }

    removeBlock(clonedBlocks, activeId)
    if (!activeBlockData) return

    // 2. overBlock 위치에 삽입
    const insertBlock = (blockList, targetId, newBlock, insertPosition) => {
      for (let i = 0; i < blockList.length; i++) {
        if (blockList[i].id === targetId) {
          const insertIndex = insertPosition === 'bottom' ? i + 1 : i
          blockList.splice(insertIndex, 0, newBlock)
          return true
        }
        if (blockList[i].children) {
          if (insertBlock(blockList[i].children, targetId, newBlock, insertPosition)) return true
        }
      }
      return false
    }

    if (!insertBlock(clonedBlocks, overId, activeBlockData, position)) {
      // 삽입 실패 시 원래 블럭 복구
      return
    }

    setBlocks(clonedBlocks)
  }

  // 블럭을 children으로 추가
  const moveBlockAsChild = (activeId, parentId) => {
    if (!setBlocks) return

    const clonedBlocks = JSON.parse(JSON.stringify(blocks))

    // 1. activeBlock 찾기 및 제거
    let activeBlockData = null
    const removeBlock = (blockList, id) => {
      for (let i = 0; i < blockList.length; i++) {
        if (blockList[i].id === id) {
          activeBlockData = blockList.splice(i, 1)[0]
          return true
        }
        if (blockList[i].children) {
          if (removeBlock(blockList[i].children, id)) return true
        }
      }
      return false
    }

    removeBlock(clonedBlocks, activeId)
    if (!activeBlockData) return

    // 2. parent 블럭의 children에 추가
    const addAsChild = (blockList, targetId, newBlock) => {
      for (let i = 0; i < blockList.length; i++) {
        if (blockList[i].id === targetId) {
          if (!blockList[i].children) {
            blockList[i].children = []
          }
          blockList[i].children.push(newBlock)
          return true
        }
        if (blockList[i].children) {
          if (addAsChild(blockList[i].children, targetId, newBlock)) return true
        }
      }
      return false
    }

    if (!addAsChild(clonedBlocks, parentId, activeBlockData)) {
      // 추가 실패 시 원래 블럭 복구
      return
    }

    setBlocks(clonedBlocks)

    // 해당 블럭을 선택된 경로에 추가하여 하위 컬럼 열기
    const parentBlock = findBlockById(clonedBlocks, parentId)
    if (parentBlock) {
      // parentId가 어느 depth에 있는지 찾기
      const findDepth = (blockList, id, currentDepth = 0) => {
        for (const block of blockList) {
          if (block.id === id) return currentDepth
          if (block.children) {
            const depth = findDepth(block.children, id, currentDepth + 1)
            if (depth !== -1) return depth
          }
        }
        return -1
      }

      const parentDepth = findDepth(clonedBlocks, parentId)
      if (parentDepth !== -1) {
        const newPath = selectedPath.slice(0, parentDepth)
        newPath[parentDepth] = parentId
        setSelectedPath(newPath)
      }
    }
  }

  // 드래그 시작
  const handleDragStart = (event) => {
    const { active, activatorEvent } = event
    const block = findBlockById(blocks, active.id)
    setActiveBlock(block)
    activeBlockIdRef.current = active.id // 드래그 중인 블럭 ID 저장
    // 디버그용: body에 dragging 클래스 추가
    document.body.classList.add('dragging')

    // 드래그 시작 시 초기 마우스 위치 설정
    if (activatorEvent) {
      if (activatorEvent.clientY !== undefined) {
        pointerPositionRef.current = {
          x: activatorEvent.clientX || 0,
          y: activatorEvent.clientY
        }
      }
    }

    // 마우스 움직임 추적 시작 - useRef로 즉시 업데이트
    const handleMouseMove = (e) => {
      pointerPositionRef.current = { x: e.clientX, y: e.clientY }

      // 드래그 중이고 over 블럭이 있으면 매 마우스 이동마다 위치 재계산
      // currentOverIdRef가 없어도 activeBlockId로 자기 자신 체크
      const targetId = currentOverIdRef.current || activeBlockIdRef.current
      if (targetId) {
        const position = calculateDropPosition(targetId, e.clientY)
        if (position) {
          setDropPosition(position)
        }
      }
    }
    const handleTouchMove = (e) => {
      if (e.touches[0]) {
        pointerPositionRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }

        // 드래그 중이고 over 블럭이 있으면 매 터치 이동마다 위치 재계산
        // currentOverIdRef가 없어도 activeBlockId로 자기 자신 체크
        const targetId = currentOverIdRef.current || activeBlockIdRef.current
        if (targetId) {
          const position = calculateDropPosition(targetId, e.touches[0].clientY)
          if (position) {
            setDropPosition(position)
          }
        }
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove)

    // 클린업을 위해 저장
    window._dragMoveCleanup = () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
    }
  }

  // 드래그 오버 - 드롭 위치 계산
  const handleDragOver = (event) => {
    const { over } = event

    if (!over) {
      setOverId(null)
      setDropPosition(null)
      currentOverIdRef.current = null
      return
    }

    // over 블럭 ID 저장 (마우스 이동 시 사용)
    // 자기 자신에 드래그할 때도 처리
    currentOverIdRef.current = over.id
    setOverId(over.id)

    // useRef에서 최신 마우스 위치 즉시 읽기
    const mouseY = pointerPositionRef.current.y

    // 위치 계산 헬퍼 함수 사용
    const position = calculateDropPosition(over.id, mouseY)
    if (position) {
      setDropPosition(position)
    }
  }


  // 드래그 종료
  const handleDragEnd = async (event) => {
    const { active, over } = event

    let hasChanged = false

    if (over && active.id !== over.id) {
      if (dropPosition === 'center') {
        // children으로 추가
        moveBlockAsChild(active.id, over.id)
        hasChanged = true
      } else {
        // 같은 레벨에서 순서 변경
        moveBlock(active.id, over.id, dropPosition)
        hasChanged = true
      }
    }

    setActiveBlock(null)
    setOverId(null)
    setDropPosition(null)
    currentOverIdRef.current = null
    activeBlockIdRef.current = null
    // 디버그용: body에서 dragging 클래스 제거
    document.body.classList.remove('dragging')

    // 마우스 이벤트 리스너 제거
    if (window._dragMoveCleanup) {
      window._dragMoveCleanup()
      window._dragMoveCleanup = null
    }

    // 순서가 변경되었으면 저장
    if (hasChanged && onSave) {
      setTimeout(() => {
        onSave()
      }, 100) // 약간의 지연을 두어 state 업데이트 완료 대기
    }
  }

  // 드래그 취소
  const handleDragCancel = () => {
    setActiveBlock(null)
    setOverId(null)
    setDropPosition(null)
    currentOverIdRef.current = null
    activeBlockIdRef.current = null
    // 디버그용: body에서 dragging 클래스 제거
    document.body.classList.remove('dragging')

    // 마우스 이벤트 리스너 제거
    if (window._dragMoveCleanup) {
      window._dragMoveCleanup()
      window._dragMoveCleanup = null
    }
  }

  // 블럭의 텍스트 추출 (content가 배열인 경우 처리)
  const getBlockText = (block) => {
    if (typeof block.content === 'string') {
      return block.content
    }
    if (Array.isArray(block.content)) {
      return block.content.map(item => item.text || '').join('')
    }
    return ''
  }

  // 최대 표시할 컬럼 수 계산 (선택된 경로 + 1)
  const maxColumns = Math.min(selectedPath.length + 1, 10) // 최대 10개 컬럼

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className={`key-thoughts-viewer-page ${isDarkMode ? 'dark-mode' : ''}`}>
        <header className="viewer-header">
          <button
            className="viewer-close-button"
            onClick={onClose}
            aria-label="뷰어 닫기"
          >
            ✕
          </button>
          <h2 className="viewer-title">주요 생각정리</h2>
          <button
            className="dark-mode-toggle"
            onClick={() => setIsDarkMode(!isDarkMode)}
            aria-label={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDarkMode ? 'Light' : 'Dark'}
          </button>
        </header>

        <main className="viewer-content">
          <div className="columns-container">
            {Array.from({ length: maxColumns }).map((_, depth) => {
              const blocksAtDepth = getBlocksAtDepth(depth)
              const selectedBlockId = selectedPath[depth]

              // 드래그 중이고 이전 depth의 블럭이 선택되었으면 빈 컬럼도 표시
              if (blocksAtDepth.length === 0 && depth > 0) {
                const prevDepthHasSelection = selectedPath[depth - 1] !== undefined
                // 드래그 중이 아니거나, 이전 depth에 선택된 블럭이 없으면 컬럼 숨김
                if (!activeBlock || !prevDepthHasSelection) {
                  return null
                }
                // 드래그 중이고 부모가 선택되었으면 빈 컬럼 표시 (아래에서 계속)
              }

              const blockIds = blocksAtDepth.map(b => b.id)

              // 부모 블럭에 center hover 중인지 확인 (하위 칼럼 drop line 표시용)
              // overId의 depth를 찾아서, 그 depth+1이 현재 칼럼 depth와 같으면 선 표시
              const hoverBlockDepth = overId ? findBlockDepth(blocks, overId) : -1
              const showChildDropLine =
                hoverBlockDepth !== -1 &&
                hoverBlockDepth + 1 === depth &&
                dropPosition === 'center' &&
                activeBlock

              return (
                <div key={depth} className="viewer-column">
                  <div className="column-header">
                    {depth === 0 ? 'A' : depth === 1 ? 'B' : depth === 2 ? 'C' : String.fromCharCode(65 + depth)}
                  </div>
                  <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
                    <div className="column-blocks">
                      {blocksAtDepth.length === 0 && showChildDropLine ? (
                        // 빈 칼럼인 경우 맨 위에 드롭 라인 표시
                        <div className="empty-column-drop-line"></div>
                      ) : (
                        blocksAtDepth.map((block, index) => {
                          const isSelected = block.id === selectedBlockId
                          const isOver = block.id === overId
                          const hasChildren = block.children && block.children.length > 0
                          const text = getBlockText(block)
                          // 마지막 블럭이고 부모에 center hover 중이면 하단 라인 표시
                          const isLastBlock = index === blocksAtDepth.length - 1
                          const showBottomLine = isLastBlock && showChildDropLine

                          return (
                            <SortableBlock
                              key={block.id}
                              block={block}
                              depth={depth}
                              isSelected={isSelected}
                              isOver={isOver}
                              dropPosition={dropPosition}
                              activeId={activeBlock?.id}
                              hasChildren={hasChildren}
                              text={text}
                              onClick={() => handleBlockClick(depth, block.id)}
                              showBottomLine={showBottomLine}
                              isEditing={editingBlockId === block.id}
                              editingText={editingText}
                              onDoubleClick={(e) => handleBlockDoubleClick(block.id, e)}
                              onEditChange={setEditingText}
                              onSaveEdit={handleSaveEdit}
                              onCancelEdit={handleCancelEdit}
                              onAddChildBlock={handleAddChildBlock}
                              onDeleteBlock={handleDeleteBlock}
                            />
                          )
                        })
                      )}
                      {/* 새 블럭 추가 버튼 */}
                      <button
                        className="add-block-button"
                        onClick={() => handleAddBlockToColumn(depth)}
                      >
                        + 새 블럭
                      </button>
                    </div>
                  </SortableContext>
                </div>
              )
            })}
          </div>
        </main>

        {/* 드래그 오버레이 - 투명한 복사본 */}
        <DragOverlay>
          {activeBlock ? (
            <div className="viewer-block dragging-overlay">
              <div className="block-content-area">
                <div className="block-text">{getBlockText(activeBlock) || '내용 입력'}</div>
              </div>
              <div className="block-actions-area">
                {activeBlock.children && activeBlock.children.length > 0 && (
                  <div className="block-arrow">▶</div>
                )}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

export default KeyThoughtsViewerPage
