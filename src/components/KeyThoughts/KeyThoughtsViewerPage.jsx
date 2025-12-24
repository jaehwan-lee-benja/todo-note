import React, { useState, useRef } from 'react'
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
function SortableBlock({ block, depth, isSelected, isOver, dropPosition, activeId, hasChildren, text, onClick, showBottomLine: showChildDropBottomLine }) {
  const {
    attributes,
    listeners,
    setNodeRef,
  } = useSortable({ id: block.id })

  // 노션 방식: 드래그 중에는 블록들이 움직이지 않음
  const isActive = block.id === activeId
  const showTopLine = isOver && dropPosition === 'top' && activeId && activeId !== block.id
  const showBottomLine = (isOver && dropPosition === 'bottom' && activeId && activeId !== block.id) || showChildDropBottomLine
  const showAsChild = isOver && dropPosition === 'center' && activeId && activeId !== block.id

  const style = {
    // transform 제거 - 블록이 움직이지 않도록
    cursor: 'grab',
    opacity: isActive ? 0.4 : 1, // 드래그 중인 블록은 약간 투명하게
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={block.id}
      data-drop-zone={isOver ? dropPosition : ''}
      className={`viewer-block ${isSelected ? 'selected' : ''} ${hasChildren ? 'has-children' : ''} ${showTopLine ? 'show-drop-line-top' : ''} ${showBottomLine ? 'show-drop-line-bottom' : ''} ${showAsChild ? 'show-as-child-target' : ''}`}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <div className="block-text">{text || '(추가하기: 더블 클릭)'}</div>
      {hasChildren && <div className="block-arrow">▶</div>}
    </div>
  )
}

/**
 * 주요 생각정리 뷰어 페이지 (전체 화면 모드)
 * @param {Array} blocks - 주요 생각정리 블럭 데이터
 * @param {Function} setBlocks - 블럭 데이터 업데이트 함수
 * @param {Function} onClose - 뷰어 닫기 핸들러
 */
function KeyThoughtsViewerPage({ blocks = [], setBlocks, onClose }) {
  // 각 컬럼에서 선택된 블럭 추적
  const [selectedPath, setSelectedPath] = useState([]) // [blockId1, blockId2, ...]

  // 드래그 상태
  const [activeBlock, setActiveBlock] = useState(null)
  const [overId, setOverId] = useState(null)
  const [dropPosition, setDropPosition] = useState(null) // 'top' | 'center' | 'bottom'

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
    // 드래그 중이면 무시
    if (activeBlock) return

    // 선택된 경로를 해당 깊이까지만 유지하고 새 선택 추가
    const newPath = selectedPath.slice(0, depth)
    newPath[depth] = blockId
    setSelectedPath(newPath)
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
  const handleDragEnd = (event) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      if (dropPosition === 'center') {
        // children으로 추가
        moveBlockAsChild(active.id, over.id)
      } else {
        // 같은 레벨에서 순서 변경
        moveBlock(active.id, over.id, dropPosition)
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
      <div className="key-thoughts-viewer-page">
        <header className="viewer-header">
          <button
            className="viewer-close-button"
            onClick={onClose}
            aria-label="뷰어 닫기"
          >
            ✕
          </button>
          <h2 className="viewer-title">💡 주요 생각정리</h2>
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
                            />
                          )
                        })
                      )}
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
              <div className="block-text">{getBlockText(activeBlock) || '(추가하기: 더블 클릭)'}</div>
              {activeBlock.children && activeBlock.children.length > 0 && (
                <div className="block-arrow">▶</div>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  )
}

export default KeyThoughtsViewerPage
