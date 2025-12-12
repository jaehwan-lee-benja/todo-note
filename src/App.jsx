import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DAYS, DEFAULT_SPEC_CONTENT, AUTO_SAVE_DELAY } from './utils/constants'
import { formatDateForDB, formatDateOnly, formatDate, isToday } from './utils/dateUtils'
import { useAuth } from './hooks/useAuth'
import AppleTimePicker from './components/Common/AppleTimePicker'
import Toast from './components/Common/Toast'
import './App.css'

// 드래그 가능한 섹션 래퍼 컴포넌트
function SortableSection({ id, children, disabled, onLongPress }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const longPressTimerRef = useRef(null)
  const [isPressed, setIsPressed] = useState(false)

  const handlePointerDown = (e) => {
    if (disabled && onLongPress) {
      // section-header 영역인지 확인
      const isSectionHeader = e.target.closest('.section-header')
      if (!isSectionHeader) {
        // 헤더가 아니면 long press 무시
        return
      }

      setIsPressed(true)
      longPressTimerRef.current = setTimeout(() => {
        onLongPress()
        setIsPressed(false)
      }, 500) // 500ms 길게 누르기
    }
  }

  const handlePointerMove = () => {
    // 포인터가 움직이면 long press 취소 (텍스트 선택 중)
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
      setIsPressed(false)
    }
  }

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setIsPressed(false)
  }

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    setIsPressed(false)
  }

  // translate만 사용 (scale 제거하여 텍스트 렌더링 개선)
  const transformString = transform
    ? `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0)`
    : undefined

  const style = {
    transform: transformString,
    transition,
  }

  const eventHandlers = disabled
    ? {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerCancel,
        onPointerLeave: handlePointerCancel,
      }
    : { ...attributes, ...listeners }

  // 순서 수정 모드일 때 클래스 추가
  const classNames = [
    !disabled && 'reorder-mode',
    isDragging && 'dragging'
  ].filter(Boolean).join(' ')

  return (
    <div ref={setNodeRef} style={style} className={classNames} {...eventHandlers}>
      {children}
    </div>
  )
}

// 재사용 가능한 메모 섹션 컴포넌트
function MemoSection({
  title,
  className,
  content,
  setContent,
  isEditing,
  isSaving,
  textareaRef,
  onStartEdit,
  onSave,
  onCancel,
  onKeyDown,
  placeholder,
  emptyMessage,
  children,
}) {
  return (
    <div className={className}>
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
        <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
          {!isEditing && (
            <button
              onClick={onStartEdit}
              className="memo-edit-button-inline"
              title="메모 편집"
            >
              ✏️ 편집
            </button>
          )}
          {isEditing && (
            <div className="memo-edit-actions">
              <button
                onClick={onSave}
                className="memo-save-button"
                disabled={isSaving}
              >
                💾 저장
              </button>
              <button
                onClick={onCancel}
                className="memo-cancel-button"
                disabled={isSaving}
              >
                ✕ 취소
              </button>
            </div>
          )}
        </div>
      </div>
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={onKeyDown}
          className="memo-textarea"
          placeholder={placeholder}
        />
      ) : (
        <div className="memo-preview" onClick={onStartEdit}>
          {content ? (
            <div className="memo-preview-content">
              {content.split('\n').map((line, idx) => (
                <div key={idx} className="memo-preview-line">{line || '\u00A0'}</div>
              ))}
            </div>
          ) : (
            <div className="memo-empty">{emptyMessage}</div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

// 노션 스타일 블록 컴포넌트
// 드래그 가능한 Notion 블록 (Sortable 래퍼)
function SortableNotionBlock({
  block,
  blocks,
  setBlocks,
  focusedBlockId,
  setFocusedBlockId,
  parentBlock,
  rootSetBlocks,
  draggingChildIds = [],
  activeId,
  overId,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  // 노션 방식: 드래그 중에는 블록들이 움직이지 않음
  const isActive = block.id === activeId
  // over 위치인 경우 얇은 선 표시
  const isOver = block.id === overId && activeId && activeId !== overId

  const style = {
    // transform 제거 - 블록이 움직이지 않도록
    cursor: 'grab',
    opacity: isActive ? 0.4 : 1, // 드래그 중인 블록은 약간 투명하게
    borderTop: isOver
      ? '2px solid rgba(99, 102, 241, 0.8)' // over 시 보라색 선
      : '2px solid transparent', // 기본은 투명 (공간 확보)
  }

  return (
    <div ref={setNodeRef} style={style}>
      <NotionBlock
        block={block}
        blocks={blocks}
        setBlocks={setBlocks}
        focusedBlockId={focusedBlockId}
        setFocusedBlockId={setFocusedBlockId}
        dragHandleProps={{ ...attributes, ...listeners }}
        parentBlock={parentBlock}
        rootSetBlocks={rootSetBlocks}
        draggingChildIds={draggingChildIds}
        activeId={activeId}
        overId={overId}
      />
    </div>
  )
}

// Notion 블록 컴포넌트
function NotionBlock({
  block,
  blocks,
  setBlocks,
  focusedBlockId,
  setFocusedBlockId,
  dragHandleProps,
  parentBlock,
  rootSetBlocks,
  draggingChildIds = [],
  activeId,
  overId,
}) {
  const inputRef = useRef(null)
  const isProcessingEnter = useRef(false)

  useEffect(() => {
    if (focusedBlockId === block.id && inputRef.current) {
      inputRef.current.focus()
      // 커서를 끝으로 이동
      const length = inputRef.current.value.length
      inputRef.current.setSelectionRange(length, length)
    }
  }, [focusedBlockId, block.id])

  // textarea 높이 자동 조정
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px'
    }
  }, [block.content])

  const updateBlockInTree = (blocks, blockId, updater) => {
    return blocks.map(b => {
      if (b.id === blockId) {
        const updated = updater(b)
        // children이 없거나 배열이 아니면 빈 배열로 초기화 (불변성 유지)
        return {
          ...updated,
          children: Array.isArray(updated.children) ? updated.children : []
        }
      }
      if (Array.isArray(b.children) && b.children.length > 0) {
        return { ...b, children: updateBlockInTree(b.children, blockId, updater) }
      }
      return b
    })
  }

  const updateBlockContent = (content) => {
    setBlocks(prevBlocks =>
      updateBlockInTree(prevBlocks, block.id, (b) => ({ ...b, content }))
    )
  }

  const updateChildBlocks = (newChildren) => {
    setBlocks(prevBlocks =>
      updateBlockInTree(prevBlocks, block.id, (b) => ({
        ...b,
        children: typeof newChildren === 'function' ? newChildren(b.children) : newChildren
      }))
    )
  }

  const handleBlockControlClick = () => {
    // 토글 열기/닫기
    setBlocks(prevBlocks =>
      updateBlockInTree(prevBlocks, block.id, (b) => {
        const newIsOpen = !b.isOpen

        // 토글을 열 때 자식이 없으면 자동으로 1개 생성
        if (newIsOpen && (!Array.isArray(b.children) || b.children.length === 0)) {
          const newChildBlock = {
            id: Date.now() + Math.random(),
            type: 'toggle',
            content: '',
            children: [],
            isOpen: true
          }
          return { ...b, isOpen: newIsOpen, children: [newChildBlock] }
        }

        return { ...b, isOpen: newIsOpen, children: Array.isArray(b.children) ? b.children : [] }
      })
    )
  }

  const addChildBlock = () => {
    const newChildBlock = {
      id: Date.now() + Math.random(),
      type: 'toggle',
      content: '',
      children: [],
      isOpen: true
    }
    setBlocks(prevBlocks =>
      updateBlockInTree(prevBlocks, block.id, (b) => ({
        ...b,
        children: [...(Array.isArray(b.children) ? b.children : []), newChildBlock],
        isOpen: true // 자식 추가 시 자동으로 열기
      }))
    )
    setTimeout(() => setFocusedBlockId(newChildBlock.id), 0)
  }

  // 블록을 들여쓰기 (Tab) - 바로 위 형제 블록의 자식으로 이동
  const indentBlock = () => {
    const currentIndex = blocks.findIndex(b => b.id === block.id)
    if (currentIndex <= 0) return // 첫 번째 블록이면 들여쓰기 불가

    const prevSibling = blocks[currentIndex - 1]

    setBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks]
      // 현재 블록을 현재 레벨에서 제거
      newBlocks.splice(currentIndex, 1)
      // 이전 형제 블록의 children에 추가
      const updatedPrevSibling = {
        ...prevSibling,
        children: [...(Array.isArray(prevSibling.children) ? prevSibling.children : []), block],
        isOpen: true // 자동으로 열기
      }
      newBlocks[currentIndex - 1] = updatedPrevSibling
      return newBlocks
    })
  }

  // 블록을 상위 레벨로 이동 (Shift+Tab)
  const outdentBlock = () => {
    if (!parentBlock || !rootSetBlocks) return

    rootSetBlocks(prevBlocks => {
      const outdentInTree = (blocks, targetParentId, childToMove) => {
        const result = []

        for (let i = 0; i < blocks.length; i++) {
          const b = blocks[i]

          // 부모 블록을 찾았을 때
          if (b.id === targetParentId) {
            // 부모의 children에서 현재 블록 제거
            const newChildren = b.children.filter(c => c.id !== childToMove.id)
            const updatedParent = { ...b, children: newChildren }
            result.push(updatedParent)
            // 부모 다음에 현재 블록 추가
            result.push(childToMove)
          } else {
            // 자식들을 재귀적으로 처리
            if (Array.isArray(b.children) && b.children.length > 0) {
              const newChildren = outdentInTree(b.children, targetParentId, childToMove)
              // children이 변경되었는지 확인
              if (newChildren !== b.children) {
                result.push({ ...b, children: newChildren })
              } else {
                result.push(b)
              }
            } else {
              result.push(b)
            }
          }
        }

        return result
      }

      // 자식이 없는 블록은 자동으로 닫기
      const autoCloseEmptyBlocks = (blockList) => {
        return blockList.map(block => {
          const hasChildren = Array.isArray(block.children) && block.children.length > 0
          if (!hasChildren && block.isOpen) {
            return { ...block, isOpen: false }
          }
          if (hasChildren) {
            return { ...block, children: autoCloseEmptyBlocks(block.children) }
          }
          return block
        })
      }

      const updated = outdentInTree(prevBlocks, parentBlock.id, block)
      return autoCloseEmptyBlocks(updated)
    })
  }

  // 보이는 블록들을 평탄화 (열려있는 블록의 자식들만 포함)
  const getFlattenedVisibleBlocks = (blocks) => {
    const result = []
    const traverse = (blockList) => {
      for (const b of blockList) {
        result.push(b)
        if (b.isOpen && Array.isArray(b.children) && b.children.length > 0) {
          traverse(b.children)
        }
      }
    }
    traverse(blocks)
    return result
  }

  const handleKeyDown = (e) => {
    // Enter 관련 처리를 먼저 체크
    if (e.key === 'Enter') {
      // Shift+Enter: textarea 내 줄바꿈 (기본 동작 허용)
      if (e.shiftKey) {
        // textarea의 기본 줄바꿈 동작 허용
        return
      }
      // Enter만: 새 블록 추가 (줄바꿈 방지)
      else {
        // 중복 실행 방지
        if (isProcessingEnter.current) {
          e.preventDefault()
          e.stopPropagation()
          return
        }

        e.preventDefault()
        e.stopPropagation()

        isProcessingEnter.current = true

        // 커서 위치 확인
        const cursorPosition = e.target.selectionStart

        const newBlock = {
          id: Date.now() + Math.random(),
          type: 'toggle',
          content: '',
          children: [],
          isOpen: true
        }

        if (cursorPosition === 0) {
          // 커서가 맨 앞: 현재 블록 앞에 빈 블록 추가
          setBlocks(prevBlocks => {
            const currentIndex = prevBlocks.findIndex(b => b.id === block.id)
            if (currentIndex === -1) return prevBlocks
            const newBlocks = [...prevBlocks]
            newBlocks.splice(currentIndex, 0, newBlock)  // 현재 블록 앞에 삽입
            return newBlocks
          })

          // 포커스는 현재 블록 유지 (텍스트가 있는 블록)
          setTimeout(() => {
            setFocusedBlockId(block.id)
            // 플래그 초기화
            setTimeout(() => {
              isProcessingEnter.current = false
            }, 100)
          }, 0)
        } else {
          // 커서가 맨 앞이 아님: 현재 블록 다음에 빈 블록 추가 (기존 로직)
          setBlocks(prevBlocks => {
            const currentIndex = prevBlocks.findIndex(b => b.id === block.id)
            if (currentIndex === -1) return prevBlocks
            const newBlocks = [...prevBlocks]
            newBlocks.splice(currentIndex + 1, 0, newBlock)
            return newBlocks
          })

          setTimeout(() => {
            setFocusedBlockId(newBlock.id)
            // 플래그 초기화
            setTimeout(() => {
              isProcessingEnter.current = false
            }, 100)
          }, 0)
        }
      }
    }
    // Shift+Tab: 상위 레벨로 이동 (outdent)
    else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      if (parentBlock && rootSetBlocks) {
        outdentBlock()
      }
    }
    // Tab: 바로 위 블록의 자식으로 들여쓰기 (indent)
    else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      indentBlock()
    }
    // Backspace: 커서가 맨 앞이고 내용이 비어있으면 블록 삭제
    else if (e.key === 'Backspace') {
      const cursorPosition = e.target.selectionStart
      const isEmpty = block.content === ''
      const isAtStart = cursorPosition === 0

      // 비어있거나 커서가 맨 앞에 있을 때 삭제
      if ((isEmpty || isAtStart)) {
        // 전체 트리의 루트 블록 가져오기
        const getRootBlocks = () => {
          if (rootSetBlocks) {
            let rootBlocks = []
            rootSetBlocks(prev => {
              rootBlocks = prev
              return prev
            })
            return rootBlocks
          }
          return blocks
        }
        const rootBlocks = getRootBlocks()
        const visibleBlocks = getFlattenedVisibleBlocks(rootBlocks)
        const currentIndex = visibleBlocks.findIndex(b => b.id === block.id)

        // 첫 번째 블록이 아닐 때만 삭제
        if (currentIndex > 0) {
          e.preventDefault()
          e.stopPropagation()

          // 이전 블록으로 포커스 이동
          const prevBlock = visibleBlocks[currentIndex - 1]

          // 현재 블록 삭제 - 트리 전체에서 삭제
          const deleteBlockFromTree = (blocks, blockIdToDelete) => {
            return blocks
              .filter(b => b.id !== blockIdToDelete)
              .map(b => {
                if (Array.isArray(b.children) && b.children.length > 0) {
                  return { ...b, children: deleteBlockFromTree(b.children, blockIdToDelete) }
                }
                return b
              })
          }

          // 자식이 없는 블록은 자동으로 닫기
          const autoCloseEmptyBlocks = (blockList) => {
            return blockList.map(block => {
              const hasChildren = Array.isArray(block.children) && block.children.length > 0
              if (!hasChildren && block.isOpen) {
                return { ...block, isOpen: false }
              }
              if (hasChildren) {
                return { ...block, children: autoCloseEmptyBlocks(block.children) }
              }
              return block
            })
          }

          if (rootSetBlocks) {
            rootSetBlocks(prevBlocks => {
              const updated = deleteBlockFromTree(prevBlocks, block.id)
              return autoCloseEmptyBlocks(updated)
            })
          } else {
            setBlocks(prevBlocks => {
              const updated = deleteBlockFromTree(prevBlocks, block.id)
              return autoCloseEmptyBlocks(updated)
            })
          }

          // 이전 블록으로 포커스 이동 및 커서를 끝으로
          setTimeout(() => {
            setFocusedBlockId(prevBlock.id)
          }, 0)
        }
      }
    }
    // ArrowUp: 시각적으로 위에 보이는 블록으로 이동
    else if (e.key === 'ArrowUp' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      // 전체 트리의 루트 블록 가져오기
      const getRootBlocks = () => {
        // rootSetBlocks가 있으면 최상위, 없으면 현재 레벨
        if (rootSetBlocks) {
          let rootBlocks = []
          rootSetBlocks(prev => {
            rootBlocks = prev
            return prev
          })
          return rootBlocks
        }
        return blocks
      }
      const rootBlocks = getRootBlocks()
      const visibleBlocks = getFlattenedVisibleBlocks(rootBlocks)
      const currentIndex = visibleBlocks.findIndex(b => b.id === block.id)
      if (currentIndex > 0) {
        setFocusedBlockId(visibleBlocks[currentIndex - 1].id)
      }
    }
    // ArrowDown: 시각적으로 아래에 보이는 블록으로 이동
    else if (e.key === 'ArrowDown' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      // 전체 트리의 루트 블록 가져오기
      const getRootBlocks = () => {
        if (rootSetBlocks) {
          let rootBlocks = []
          rootSetBlocks(prev => {
            rootBlocks = prev
            return prev
          })
          return rootBlocks
        }
        return blocks
      }
      const rootBlocks = getRootBlocks()
      const visibleBlocks = getFlattenedVisibleBlocks(rootBlocks)
      const currentIndex = visibleBlocks.findIndex(b => b.id === block.id)
      if (currentIndex < visibleBlocks.length - 1) {
        setFocusedBlockId(visibleBlocks[currentIndex + 1].id)
      }
    }
  }

  return (
    <div className="notion-block">
      {/* 드래그 핸들 */}
      {dragHandleProps && (
        <div className="notion-drag-handle" {...dragHandleProps} title="드래그하여 이동">
          ∷
        </div>
      )}

      <div className="notion-block-controls">
        <button
          className="block-type-button"
          onClick={handleBlockControlClick}
          title="클릭: 열기/닫기"
          style={{
            transform: block.isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
        >
          ▶
        </button>
      </div>
      <div className="notion-block-content">
        <textarea
          ref={inputRef}
          value={block.content}
          onChange={(e) => updateBlockContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocusedBlockId(block.id)}
          placeholder=""
          className="notion-block-input"
          rows={1}
        />
      </div>

      {/* 자식 블록들 렌더링 */}
      {block.isOpen && Array.isArray(block.children) && block.children.length > 0 && (
        <div className="notion-block-children">
          {block.children.map((childBlock) => (
            <SortableNotionBlock
              key={childBlock.id}
              block={childBlock}
              blocks={block.children}
              setBlocks={updateChildBlocks}
              focusedBlockId={focusedBlockId}
              setFocusedBlockId={setFocusedBlockId}
              parentBlock={block}
              rootSetBlocks={rootSetBlocks || setBlocks}
              draggingChildIds={draggingChildIds}
              activeId={activeId}
              overId={overId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// 주요 생각정리 - 블록 에디터
function KeyThoughtsSection({ blocks, setBlocks, focusedBlockId, setFocusedBlockId, onShowHistory }) {
  const [activeBlock, setActiveBlock] = useState(null)
  const [overId, setOverId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // 3px 이동 후 드래그 시작 (핸들 전용이므로 민감하게)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 자식이 없는 블록은 자동으로 닫기
  const autoCloseEmptyBlocks = (blockList) => {
    return blockList.map(block => {
      const hasChildren = Array.isArray(block.children) && block.children.length > 0
      if (!hasChildren && block.isOpen) {
        return { ...block, isOpen: false }
      }
      if (hasChildren) {
        return { ...block, children: autoCloseEmptyBlocks(block.children) }
      }
      return block
    })
  }

  // blocks 변경 시 자식 없는 블록 자동 닫기
  useEffect(() => {
    const closedBlocks = autoCloseEmptyBlocks(blocks)
    // 변경사항이 있을 때만 업데이트 (무한 루프 방지)
    if (JSON.stringify(closedBlocks) !== JSON.stringify(blocks)) {
      setBlocks(closedBlocks)
    }
  }, [blocks])

  // 모든 블록을 평탄화 (시각적으로 보이는 순서대로)
  const flattenBlocks = (blockList) => {
    const result = []
    const traverse = (blocks) => {
      for (const block of blocks) {
        result.push(block)
        if (block.isOpen && Array.isArray(block.children) && block.children.length > 0) {
          traverse(block.children)
        }
      }
    }
    traverse(blockList)
    return result
  }

  // 블록의 모든 하위 블록 ID를 재귀적으로 수집
  const getAllChildIds = (block) => {
    const childIds = []
    const traverse = (b) => {
      if (Array.isArray(b.children) && b.children.length > 0) {
        for (const child of b.children) {
          childIds.push(child.id)
          traverse(child)
        }
      }
    }
    traverse(block)
    return childIds
  }

  const handleDragStart = (event) => {
    const { active } = event
    const flatBlocks = flattenBlocks(blocks)
    const block = flatBlocks.find(b => b.id === active.id)
    setActiveBlock(block)
  }

  const handleDragOver = (event) => {
    const { over } = event
    setOverId(over?.id || null)
  }

  // 드래그 중인 블록의 모든 하위 블록 ID 목록
  const draggingChildIds = React.useMemo(() => {
    if (!activeBlock) return []
    return getAllChildIds(activeBlock)
  }, [activeBlock])

  const handleDragEnd = (event) => {
    const { active, over } = event

    // 드래그 종료 시 activeBlock, overId 초기화
    setActiveBlock(null)
    setOverId(null)

    if (!over || active.id === over.id) return

    const flatBlocks = flattenBlocks(blocks)
    const activeBlock = flatBlocks.find(b => b.id === active.id)
    const overBlock = flatBlocks.find(b => b.id === over.id)

    if (!activeBlock || !overBlock) return

    // 드래그 중인 블록의 하위 블록으로 드롭하는 것을 방지
    const childIds = getAllChildIds(activeBlock)
    if (childIds.includes(over.id)) {
      return
    }

    // 깊은 복사로 activeBlock 보존
    const activeBlockCopy = JSON.parse(JSON.stringify(activeBlock))

    // 트리에서 블록 제거
    const removeBlockFromTree = (tree, blockId) => {
      return tree
        .filter(b => b.id !== blockId)
        .map(b => ({
          ...b,
          children: Array.isArray(b.children) ? removeBlockFromTree(b.children, blockId) : []
        }))
    }

    // 트리에서 블록 삽입 (특정 블록 다음에)
    const insertBlockAfter = (tree, targetId, blockToInsert) => {
      let inserted = false
      const result = []

      for (const block of tree) {
        result.push(block)
        if (block.id === targetId) {
          result.push(blockToInsert)
          inserted = true
        }

        if (Array.isArray(block.children) && block.children.length > 0) {
          const { newChildren, wasInserted } = insertBlockAfterWithFlag(block.children, targetId, blockToInsert)
          if (wasInserted) {
            result[result.length - 1] = { ...block, children: newChildren }
            inserted = true
          }
        }
      }

      return { newTree: result, inserted }
    }

    // 삽입 성공 여부를 반환하는 헬퍼 함수
    const insertBlockAfterWithFlag = (tree, targetId, blockToInsert) => {
      let inserted = false
      const result = []

      for (const block of tree) {
        result.push(block)
        if (block.id === targetId) {
          result.push(blockToInsert)
          inserted = true
        }

        if (Array.isArray(block.children) && block.children.length > 0) {
          const { newChildren, wasInserted } = insertBlockAfterWithFlag(block.children, targetId, blockToInsert)
          if (wasInserted) {
            result[result.length - 1] = { ...block, children: newChildren }
            inserted = true
          }
        }
      }

      return { newChildren: result, wasInserted: inserted }
    }

    // 1. 기존 위치에서 제거
    let newTree = removeBlockFromTree(blocks, activeBlock.id)

    // 2. 새 위치에 삽입
    // 첫 번째 블록(루트 레벨)인지 확인
    const isFirstBlock = newTree.length > 0 && newTree[0].id === overBlock.id

    let finalTree
    let inserted = false

    if (isFirstBlock) {
      // 첫 번째 블록 앞에 삽입
      finalTree = [activeBlockCopy, ...newTree]
      inserted = true
    } else {
      // 기존 로직: 특정 블록 다음에 삽입
      const result = insertBlockAfter(newTree, overBlock.id, activeBlockCopy)
      finalTree = result.newTree
      inserted = result.inserted
    }

    // 3. 삽입 실패 시 원래 상태 유지
    if (!inserted) {
      console.warn('Failed to insert block, keeping original state')
      return
    }

    // 4. 자식이 없는 블록은 자동으로 닫기
    const resultTree = autoCloseEmptyBlocks(finalTree)

    setBlocks(resultTree)
  }

  // 드래그 중인 블록의 하위 블록들은 sortable 대상에서 제외
  // (하위 블록들은 상위 블록과 함께 움직이므로 개별적으로 정렬되면 안됨)
  const allBlockIds = flattenBlocks(blocks)
    .filter(b => !draggingChildIds.includes(b.id))
    .map(b => b.id)

  // 전체 펴기/접기 함수
  const toggleAllBlocks = (open) => {
    const toggleRecursively = (blockList) => {
      return blockList.map(block => ({
        ...block,
        isOpen: open,
        children: Array.isArray(block.children) ? toggleRecursively(block.children) : []
      }))
    }
    setBlocks(toggleRecursively(blocks))
  }

  // 모든 블록이 열려있는지 확인
  const checkAllOpen = (blockList) => {
    for (const block of blockList) {
      if (!block.isOpen && Array.isArray(block.children) && block.children.length > 0) {
        return false
      }
      if (Array.isArray(block.children) && block.children.length > 0) {
        if (!checkAllOpen(block.children)) return false
      }
    }
    return true
  }

  const allOpen = checkAllOpen(blocks)

  return (
    <div className="key-thoughts-section section-block">
      <div className="section-header">
        <h3 className="section-title">💡 주요 생각정리</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="toggle-all-button"
            onClick={() => onShowHistory && onShowHistory()}
            title="버전 히스토리 보기"
          >
            🕐 히스토리
          </button>
          <button
            className="toggle-all-button"
            onClick={() => toggleAllBlocks(!allOpen)}
            title={allOpen ? "전체 접기" : "전체 펴기"}
          >
            {allOpen ? "전체 접기" : "전체 펴기"}
          </button>
        </div>
      </div>
      <div
        className="key-thoughts-content notion-editor"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          measuring={{
            droppable: {
              strategy: MeasuringStrategy.Always,
            },
          }}
        >
          <SortableContext
            items={allBlockIds}
            strategy={verticalListSortingStrategy}
          >
            {blocks.map((block) => (
              <SortableNotionBlock
                key={block.id}
                block={block}
                blocks={blocks}
                setBlocks={setBlocks}
                focusedBlockId={focusedBlockId}
                setFocusedBlockId={setFocusedBlockId}
                rootSetBlocks={setBlocks}
                draggingChildIds={draggingChildIds}
                activeId={activeBlock?.id}
                overId={overId}
              />
            ))}
          </SortableContext>
          <DragOverlay>
            {activeBlock ? (
              <div className="drag-overlay-block">
                <NotionBlock
                  block={activeBlock}
                  blocks={blocks}
                  setBlocks={() => {}} // 드래그 중에는 수정 불가
                  focusedBlockId={null}
                  setFocusedBlockId={() => {}}
                  dragHandleProps={{}}
                  parentBlock={null}
                  rootSetBlocks={() => {}}
                  draggingChildIds={[]}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}

// 재사용 가능한 투두 섹션 컴포넌트
function TodoSection({
  title,
  className,
  inputValue,
  setInputValue,
  onAddTodo,
  isAdding,
  placeholder,
  children,
}) {
  return (
    <div className={className}>
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
      </div>
      <div className="section-input">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAddTodo()
          }}
          placeholder={placeholder}
          className="todo-input"
          disabled={isAdding}
        />
        <button onClick={onAddTodo} className="add-button" disabled={isAdding}>
          추가
        </button>
      </div>
      {children}
    </div>
  )
}

// 드래그 가능한 Todo 항목 컴포넌트
function SortableTodoItem({ todo, index, onToggle, onDelete, onEdit, formatDate, formatDateOnly, isFocused, onFocus, onAddSubTodo, subtodos, level = 0, onCreateRoutine, routines, onShowRoutineHistory, onOpenRoutineSetupModal, onOpenHistoryModal, currentPageDate, isPendingRoutine = false, onRemoveFromUI, showSuccessMessage }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)
  const [showDetails, setShowDetails] = useState(false)
  const [showNanotodos, setShowNanotodos] = useState(false)
  const [isAddingSubTodo, setIsAddingSubTodo] = useState(false)
  const [subTodoText, setSubTodoText] = useState('')
  const [showRoutineSetup, setShowRoutineSetup] = useState(false)
  const [routineDays, setRoutineDays] = useState([])
  const [isEditingRoutine, setIsEditingRoutine] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyRecords, setHistoryRecords] = useState([])
  const [expandedHistoryIds, setExpandedHistoryIds] = useState([])
  const [carryOverPath, setCarryOverPath] = useState([])
  const [originalDate, setOriginalDate] = useState(null)
  const [showActionsModal, setShowActionsModal] = useState(false)
  const [selectedAction, setSelectedAction] = useState(null)
  const [isEditingRoutineInModal, setIsEditingRoutineInModal] = useState(false)
  const [routineDaysForModal, setRoutineDaysForModal] = useState([])
  const [routineTimeSlotForModal, setRoutineTimeSlotForModal] = useState('')
  const [todoHistory, setTodoHistory] = useState({}) // todo_id를 키로 하는 히스토리 객체
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [selectedRoutineForHistory, setSelectedRoutineForHistory] = useState(null)
  const [routineHistoryData, setRoutineHistoryData] = useState([])

  // 현재 투두의 루틴 정보 찾기
  const currentRoutine = todo.routine_id ? routines.find(r => r.id === todo.routine_id) : null

  // 스와이프 관련
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeStartX, setSwipeStartX] = useState(0)
  const [swipeStartY, setSwipeStartY] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const [isPointerDown, setIsPointerDown] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: todo.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  // 텍스트가 길면 펼치기 버튼 표시
  const isLongText = todo.text.length > 30

  const handleDoubleClick = () => {
    setIsEditing(true)
    setEditText(todo.text)
  }

  const handleEditSubmit = async () => {
    if (editText.trim() && editText !== todo.text) {
      await onEdit(todo.id, editText.trim())
    }
    setIsEditing(false)
  }

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      await handleEditSubmit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditText(todo.text)
    }
  }

  // 루틴 요일 토글
  const handleToggleRoutineDayInModal = (dayKey) => {
    setRoutineDaysForModal(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 요일 번호를 키로 변환
  const getDayKey = (dayNumber) => {
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
    return keys[dayNumber]
  }

  // 이 날짜에서만 숨김
  const hideOnThisDateOnly = async (todo) => {
    try {
      // currentPageDate가 Date 객체인지 문자열인지 확인
      const dateStr = typeof currentPageDate === 'string'
        ? currentPageDate
        : formatDateForDB(currentPageDate)
      const currentHiddenDates = todo.hidden_dates || []

      // hidden_dates에 현재 날짜 추가
      const newHiddenDates = [...currentHiddenDates, dateStr]

      // 루틴 투두인지 확인
      const isRoutineTodo = todo.routine_id !== null && todo.routine_id !== undefined

      let updateData = {
        hidden_dates: newHiddenDates
      }

      // 루틴 투두가 아닌 경우에만 deleted 설정
      if (!isRoutineTodo) {
        updateData.deleted = true
        updateData.deleted_date = new Date().toISOString()
      }

      const { error } = await supabase
        .from('todos')
        .update(updateData)
        .eq('id', todo.id)

      if (error) throw error

      // 즉시 UI에서 제거
      if (onRemoveFromUI) {
        onRemoveFromUI(todo.id)
      }

      // 성공 메시지 표시 (실행 취소 정보 포함)
      const isRoutine = todo.routine_id !== null && todo.routine_id !== undefined
      showSuccessMessage(
        isRoutine ? '✅ 오늘만 숨겨졌습니다' : '✅ 이 날짜에서 숨겨졌습니다',
        {
          type: 'hideOnDate',
          todoId: todo.id,
          hiddenDate: dateStr,
          wasDeleted: !isRoutineTodo
        }
      )
    } catch (error) {
      console.error('숨김 처리 오류:', error.message)
      alert('❌ 숨김 처리에 실패했습니다.')
    }
  }

  // 완전 삭제
  const deleteCompletely = async (todo) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({ deleted: true, deleted_date: new Date().toISOString() })
        .eq('id', todo.id)

      if (error) throw error

      // 즉시 UI에서 제거
      if (onRemoveFromUI) {
        onRemoveFromUI(todo.id)
      }
    } catch (error) {
      console.error('삭제 오류:', error.message)
      alert('삭제에 실패했습니다.')
    }
  }

  // 루틴 투두 전용: 오늘부터 삭제 (루틴 중단)
  const deleteRoutineFromToday = async (todo) => {
    try {
      if (!todo.routine_id) {
        alert('루틴 투두가 아닙니다.')
        return
      }

      // 루틴을 deleted: true로 설정하여 내일부터 생성되지 않도록
      const { error: routineError } = await supabase
        .from('routines')
        .update({ deleted: true })
        .eq('id', todo.routine_id)

      if (routineError) throw routineError

      // 현재 날짜를 hidden_dates에 추가하여 오늘도 숨김
      const dateStr = typeof currentPageDate === 'string'
        ? currentPageDate
        : formatDateForDB(currentPageDate)
      const currentHiddenDates = todo.hidden_dates || []
      const newHiddenDates = [...currentHiddenDates, dateStr]

      const { error: todoError } = await supabase
        .from('todos')
        .update({ hidden_dates: newHiddenDates })
        .eq('id', todo.id)

      if (todoError) throw todoError

      // UI에서 제거
      if (onRemoveFromUI) {
        onRemoveFromUI(todo.id)
      }

      showSuccessMessage('✅ 오늘부터 루틴이 중단되었습니다', {
        type: 'stopRoutineFromToday',
        todoId: todo.id,
        routineId: todo.routine_id,
        hiddenDate: dateStr
      })
    } catch (error) {
      console.error('루틴 중단 오류:', error.message)
      alert('❌ 루틴 중단에 실패했습니다.')
    }
  }

  // 루틴 투두 전용: 과거+오늘+미래 모두 삭제
  const deleteRoutineCompletely = async (todo) => {
    try {
      if (!todo.routine_id) {
        alert('루틴 투두가 아닙니다.')
        return
      }

      // 1. 루틴을 deleted: true로 설정
      const { error: routineError } = await supabase
        .from('routines')
        .update({ deleted: true })
        .eq('id', todo.routine_id)

      if (routineError) throw routineError

      // 2. 루틴 투두도 deleted: true로 설정 (휴지통으로)
      const { error: todoError } = await supabase
        .from('todos')
        .update({ deleted: true, deleted_date: new Date().toISOString() })
        .eq('id', todo.id)

      if (todoError) throw todoError

      // UI에서 제거
      if (onRemoveFromUI) {
        onRemoveFromUI(todo.id)
      }

      showSuccessMessage('✅ 루틴이 휴지통으로 이동되었습니다', {
        type: 'deleteRoutineCompletely',
        todoId: todo.id,
        routineId: todo.routine_id
      })
    } catch (error) {
      console.error('루틴 완전 삭제 오류:', error.message)
      alert('❌ 루틴 삭제에 실패했습니다.')
    }
  }

  // 히스토리 자동 로드 (selectedAction이 'history'일 때)
  useEffect(() => {
    if (selectedAction === 'history' && !todoHistory[todo.id] && !isLoadingHistory) {
      const loadHistory = async () => {
        setIsLoadingHistory(true)
        try {
          const { data, error } = await supabase
            .from('todo_history')
            .select('*')
            .eq('todo_id', todo.id)
            .order('changed_at', { ascending: false })

          if (error) throw error

          setTodoHistory(prev => ({
            ...prev,
            [todo.id]: data || []
          }))
        } catch (error) {
          console.error('Error fetching history:', error)
        } finally {
          setIsLoadingHistory(false)
        }
      }
      loadHistory()
    }
  }, [selectedAction, todo.id, todoHistory, isLoadingHistory])

  // 루틴 기록 자동 로드 (selectedAction이 'routine-stats'일 때)
  useEffect(() => {
    if (selectedAction === 'routine-stats' && currentRoutine &&
        (!selectedRoutineForHistory || selectedRoutineForHistory.id !== currentRoutine.id)) {
      const loadRoutineHistory = async () => {
        try {
          const { data: routineTodo, error } = await supabase
            .from('todos')
            .select('*')
            .eq('routine_id', currentRoutine.id)
            .eq('deleted', false)
            .maybeSingle()

          if (error) throw error

          if (routineTodo && routineTodo.visible_dates) {
            const historyData = routineTodo.visible_dates
              .sort()
              .map(date => ({
                id: `${routineTodo.id}-${date}`,
                date,
                text: routineTodo.text,
                completed: routineTodo.completed_dates?.includes(date) || false
              }))

            setRoutineHistoryData(historyData)
            setSelectedRoutineForHistory(currentRoutine)
          }
        } catch (error) {
          console.error('Error fetching routine history:', error)
        }
      }
      loadRoutineHistory()
    }
  }, [selectedAction, currentRoutine, selectedRoutineForHistory])

  // 마우스/터치 시작
  const handleStart = (e) => {
    if (isEditing || isDragging) return

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY
    setSwipeStartX(clientX)
    setSwipeStartY(clientY)
    setIsSwiping(false)
    setIsPointerDown(true)
  }

  // 마우스/터치 이동
  const handleMove = (e) => {
    if (isEditing || isDragging || !isPointerDown) return

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
    const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY
    const diffX = swipeStartX - clientX
    const diffY = Math.abs(swipeStartY - clientY)

    // 스와이프 감지 (수평 움직임이 확실할 때만)
    if (!isSwiping) {
      const totalDist = Math.abs(diffX) + diffY
      if (totalDist > 10) {
        // 수평 이동이 전체 이동의 80% 이상이면 스와이프
        if (Math.abs(diffX) > totalDist * 0.8) {
          setIsSwiping(true)
          // 터치 이벤트 전파 막기
          if (e.type.includes('touch')) {
            e.preventDefault()
          }
        } else if (diffY > Math.abs(diffX)) {
          // 수직 이동이 더 크면 포인터 해제 (드래그 모드로 전환)
          setIsPointerDown(false)
          return
        }
      }
    }

    // 스와이프 중일 때만 처리
    if (isSwiping) {
      if (e.type.includes('touch')) {
        e.preventDefault()
      }

      if (diffX > 0 && diffX <= 100) {
        // 왼쪽으로 스와이프 (삭제 버튼 열기)
        setSwipeOffset(diffX)
      } else if (diffX < 0 && swipeOffset > 0) {
        // 오른쪽으로 스와이프 (삭제 버튼 닫기)
        const newOffset = swipeOffset + diffX
        setSwipeOffset(Math.max(0, newOffset))
        setSwipeStartX(clientX)
      }
    }
  }

  // 마우스/터치 종료
  const handleEnd = () => {
    setIsPointerDown(false)

    if (isSwiping) {
      setIsSwiping(false)
      // 40px 이상 열렸으면 80px로 고정, 아니면 닫기
      setSwipeOffset(swipeOffset > 40 ? 80 : 0)
    }
  }

  // 삭제 버튼 클릭
  const handleDeleteClick = () => {
    onDelete(todo.id)
  }

  // 루틴 요일 토글
  const handleToggleRoutineDay = (dayKey) => {
    setRoutineDays(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 루틴 생성 확인
  const handleCreateRoutine = async () => {
    if (routineDays.length > 0 && onCreateRoutine) {
      await onCreateRoutine(todo.id, todo.text, routineDays)
      setRoutineDays([])
      setShowRoutineSetup(false)
    }
  }

  // 루틴 설정 취소
  const handleCancelRoutineSetup = () => {
    setRoutineDays([])
    setShowRoutineSetup(false)
    setIsEditingRoutine(false)
  }

  // 루틴 수정 시작
  const handleStartEditRoutine = () => {
    if (currentRoutine) {
      setRoutineDays(currentRoutine.days)
      setIsEditingRoutine(true)
    }
  }

  // 루틴 수정 저장
  const handleUpdateRoutine = async () => {
    if (routineDays.length > 0 && currentRoutine && onCreateRoutine) {
      // 기존 루틴 업데이트
      await onCreateRoutine(todo.id, todo.text, routineDays, currentRoutine.id)
      setRoutineDays([])
      setIsEditingRoutine(false)
      setShowRoutineSetup(false)
    }
  }

  // 루틴 제거
  const handleRemoveRoutine = async () => {
    if (currentRoutine && onCreateRoutine) {
      // routine_id를 null로 설정하여 제거
      await onCreateRoutine(todo.id, todo.text, [], null, true)
      setShowRoutineSetup(false)
    }
  }

  // 히스토리 가져오기
  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('todo_history')
        .select('*')
        .eq('todo_id', todo.id)
        .order('changed_at', { ascending: false })

      if (error) throw error
      setHistoryRecords(data || [])

      // 이월 경로 조회 (original_todo_id가 있는 경우)
      if (todo.original_todo_id) {
        // 원본 투두 조회
        const { data: originalData, error: originalError } = await supabase
          .from('todos')
          .select('id, date, created_at')
          .eq('id', todo.original_todo_id)
          .single()

        if (originalError) {
          console.error('원본 투두 조회 오류:', originalError.message)
          setCarryOverPath([])
          setOriginalDate(null)
          return
        }

        // 원본 날짜 저장
        setOriginalDate(originalData.date)

        // 같은 original_todo_id를 가진 모든 이월된 투두들 조회
        const { data: pathData, error: pathError } = await supabase
          .from('todos')
          .select('id, date, created_at')
          .eq('original_todo_id', todo.original_todo_id)
          .order('date', { ascending: true })

        if (pathError) {
          console.error('이월 경로 조회 오류:', pathError.message)
          setCarryOverPath([])
          return
        }

        // 원본 + 이월된 투두들을 날짜순으로 정렬
        const allPath = [originalData, ...(pathData || [])].sort((a, b) =>
          new Date(a.date) - new Date(b.date)
        )
        setCarryOverPath(allPath)
      } else {
        setCarryOverPath([])
        setOriginalDate(todo.date)
      }
    } catch (error) {
      console.error('히스토리 가져오기 오류:', error.message)
    }
  }

  // 히스토리 토글 시 데이터 가져오기
  const handleToggleHistory = () => {
    const newShowHistory = !showHistory
    setShowHistory(newShowHistory)

    // 히스토리를 열 때만 백그라운드에서 데이터 로드
    if (newShowHistory) {
      fetchHistory()
    }
  }

  // 개별 히스토리 내용 토글
  const toggleHistoryDetail = (historyId) => {
    setExpandedHistoryIds(prev =>
      prev.includes(historyId)
        ? prev.filter(id => id !== historyId)
        : [...prev, historyId]
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`todo-item-container ${isFocused ? 'focused' : ''}`}
    >
      <span className="todo-number" onClick={() => onFocus(todo.id)}>
        {isFocused && <span className="focus-icon">🔥</span>}
        {index + 1}
      </span>
      <div className="todo-item-wrapper">
        <div className="swipe-background">
          <button
            onClick={handleDeleteClick}
            className="swipe-delete-button"
            title="삭제"
          >
            삭제
          </button>
        </div>
        <div
          {...attributes}
          {...listeners}
          className={`todo-item ${todo.completed ? 'completed' : ''} ${isExpanded ? 'expanded' : ''} ${isDragging ? 'drag-mode' : ''}`}
          style={{
            transform: `translateX(-${swipeOffset}px)`,
            transition: isSwiping || isDragging ? 'none' : 'transform 0.3s ease'
          }}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          onContextMenu={(e) => e.preventDefault()}
        >
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
          className="todo-checkbox"
        />
        <div
          className="todo-content"
          onClick={() => !isEditing && isLongText && setIsExpanded(!isExpanded)}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: isEditing ? 'text' : (isLongText ? 'pointer' : 'default') }}
        >
          {isEditing ? (
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleEditSubmit}
              onKeyDown={handleKeyDown}
              className="todo-edit-input"
              autoFocus
            />
          ) : (
            <span className={`todo-text ${isExpanded ? 'expanded' : ''}`}>
              {todo.text}
            </span>
          )}
        </div>
        {(() => {
          const hasCompletedDateBadge = todo.completed && todo.completed_at &&
            new Date(todo.completed_at).toISOString().split('T')[0] !== todo.date
          const hasRoutineBadge = todo.routine_id && currentRoutine
          const hasPendingRoutineBadge = isPendingRoutine || todo.is_pending_routine
          return (subtodos.length > 0 || hasCompletedDateBadge || hasRoutineBadge || hasPendingRoutineBadge) && (
            <div className="todo-badges">
              {hasCompletedDateBadge && (() => {
                const completedDate = new Date(todo.completed_at).toISOString().split('T')[0]
                const completedDay = new Date(todo.completed_at).getDate()
                return (
                  <span className="completed-date-badge" title={`${completedDate}에 완료됨`}>
                    {completedDay}일✓
                  </span>
                )
              })()}
              {hasRoutineBadge && (() => {
                // JSON 방식: 현재 페이지 날짜 사용
                const displayDate = currentPageDate || todo.date
                const todoDate = new Date(displayDate + 'T00:00:00')
                const month = todoDate.getMonth() + 1
                const date = todoDate.getDate()
                const dayNames = ['일', '월', '화', '수', '목', '금', '토']
                const dayName = dayNames[todoDate.getDay()]
                const dateDisplay = `${month}/${date}(${dayName})`
                return (
                  <span className="routine-date-badge" title={`${currentRoutine.text} 루틴`}>
                    for {dateDisplay}
                  </span>
                )
              })()}
              {hasPendingRoutineBadge && (
                <span className="pending-routine-badge" title="루틴 설정이 필요합니다">
                  미정
                </span>
              )}
              {subtodos.length > 0 && (
                <span
                  className="todo-badge clickable"
                  title="나노투두 보기"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (showNanotodos) {
                      // 이미 나노투두가 열려있으면 토글 닫기
                      setShowDetails(false)
                      setShowNanotodos(false)
                      setIsAddingSubTodo(false)
                    } else {
                      // 나노투두 열기
                      setShowDetails(true)
                      setShowNanotodos(true)
                      setIsAddingSubTodo(false)
                      setShowRoutineSetup(false)
                      setShowHistory(false)
                    }
                  }}
                >
                  🔬
                </span>
              )}
            </div>
          )
        })()}
        {!isEditing && !todo.parent_id && (
          <button
            className="todo-more-button"
            onClick={(e) => {
              e.stopPropagation()
              setShowActionsModal(true)
              setSelectedAction(null)
              // 루틴 설정 상태 초기화
              setIsEditingRoutineInModal(false)
              setRoutineDaysForModal([])
              setRoutineTimeSlotForModal('')
            }}
            title="더보기"
          >
            ⋮
          </button>
        )}
        {showNanotodos && !todo.parent_id && (
          <div className="subtodos-in-item">
            {subtodos && subtodos.length > 0 && subtodos.map((subtodo, subIndex) => (
              <SortableTodoItem
                key={subtodo.id}
                todo={subtodo}
                index={subIndex}
                onToggle={onToggle}
                onDelete={onDelete}
                onEdit={onEdit}
                formatDate={formatDate}
                formatDateOnly={formatDateOnly}
                isFocused={isFocused}
                onFocus={onFocus}
                onAddSubTodo={onAddSubTodo}
                subtodos={[]}
                level={level + 1}
                routines={routines}
                onShowRoutineHistory={onShowRoutineHistory}
                showSuccessMessage={showSuccessMessage}
                onOpenRoutineSetupModal={onOpenRoutineSetupModal}
                onOpenHistoryModal={onOpenHistoryModal}
                currentPageDate={currentPageDate}
              />
            ))}
            {isAddingSubTodo && (
              <div className="subtodo-input-section">
                <input
                  type="text"
                  value={subTodoText}
                  onChange={(e) => setSubTodoText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && subTodoText.trim()) {
                      onAddSubTodo(todo.id, subTodoText.trim())
                      setSubTodoText('')
                    }
                  }}
                  placeholder="나노투두 입력..."
                  className="subtodo-input"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (subTodoText.trim()) {
                      onAddSubTodo(todo.id, subTodoText.trim())
                      setSubTodoText('')
                    }
                  }}
                  className="subtodo-add-button"
                >
                  추가
                </button>
                <button
                  onClick={() => {
                    setSubTodoText('')
                  }}
                  className="subtodo-cancel-button"
                >
                  취소
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      </div>

      {/* 액션 모달 */}
      {showActionsModal && (
        <div className="modal-overlay" onClick={() => setShowActionsModal(false)}>
          <div className="actions-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="actions-modal-header">
              <h3>작업 선택</h3>
              <button onClick={() => setShowActionsModal(false)} className="modal-close-button">✕</button>
            </div>

            {/* 투두 텍스트 편집 영역 */}
            <div className="todo-edit-section">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={() => {
                  if (editText.trim() !== '' && editText !== todo.text) {
                    onEdit(todo.id, editText)
                  } else if (editText.trim() === '') {
                    setEditText(todo.text) // 빈 텍스트면 원래대로 복구
                  }
                }}
                className="todo-edit-textarea"
                placeholder="투두 내용을 입력하세요..."
                rows={3}
              />
            </div>

            <div className="actions-modal-body">
              {/* 왼쪽 메뉴 */}
              <div className="actions-menu">
                <button
                  className={`action-menu-item ${selectedAction === 'nanotodo' ? 'active' : ''}`}
                  onClick={() => setSelectedAction('nanotodo')}
                >
                  <span className="action-icon">🔬</span>
                  <span>나노투두</span>
                </button>
                <button
                  className={`action-menu-item ${selectedAction === 'routine' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedAction('routine')
                    // 루틴 설정 초기화
                    const currentRoutine = routines.find(r => r.id === todo.routine_id)
                    if (currentRoutine) {
                      setRoutineDaysForModal(currentRoutine.days || [])
                      setRoutineTimeSlotForModal(currentRoutine.time_slot || '')
                      setIsEditingRoutineInModal(false) // 기존 루틴이 있으면 보기 모드
                    } else {
                      setRoutineDaysForModal([])
                      setRoutineTimeSlotForModal('')
                      setIsEditingRoutineInModal(true) // 새로 만들 때는 편집 모드
                    }
                  }}
                >
                  <span className="action-icon">📌</span>
                  <span>루틴설정</span>
                </button>
                <button
                  className={`action-menu-item ${selectedAction === 'history' ? 'active' : ''}`}
                  onClick={() => setSelectedAction('history')}
                >
                  <span className="action-icon">📋</span>
                  <span>히스토리</span>
                </button>
                {todo.routine_id && currentRoutine && (
                  <button
                    className={`action-menu-item ${selectedAction === 'routine-stats' ? 'active' : ''}`}
                    onClick={() => setSelectedAction('routine-stats')}
                  >
                    <span className="action-icon">📊</span>
                    <span>루틴기록</span>
                  </button>
                )}
                <button
                  className={`action-menu-item delete ${selectedAction === 'delete' ? 'active' : ''}`}
                  onClick={() => setSelectedAction('delete')}
                >
                  <span className="action-icon">🗑️</span>
                  <span>삭제</span>
                </button>
              </div>

              {/* 오른쪽 상세 */}
              <div className="actions-detail">
                {!selectedAction && (
                  <div className="actions-detail-empty">
                    <p>왼쪽에서 작업을 선택하세요</p>
                  </div>
                )}

                {selectedAction === 'nanotodo' && (
                  <div className="actions-detail-content">
                    <h4>🔬 나노투두</h4>
                    <div className="nanotodo-section-in-modal">
                      {subtodos && subtodos.length > 0 && (
                        <div className="subtodo-list-in-modal">
                          {subtodos.map((subtodo) => (
                            <div key={subtodo.id} className="subtodo-item-in-modal">
                              <input
                                type="checkbox"
                                checked={subtodo.completed}
                                onChange={() => onToggle(subtodo.id)}
                                className="subtodo-checkbox-modal"
                              />
                              <span className={`subtodo-text-modal ${subtodo.completed ? 'completed' : ''}`}>
                                {subtodo.text}
                              </span>
                              <button
                                onClick={() => onDelete(subtodo.id)}
                                className="subtodo-delete-modal"
                                title="삭제"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="subtodo-input-section-modal">
                        <input
                          type="text"
                          value={subTodoText}
                          onChange={(e) => setSubTodoText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && subTodoText.trim()) {
                              onAddSubTodo(todo.id, subTodoText.trim())
                              setSubTodoText('')
                            }
                          }}
                          placeholder="나노투두 입력..."
                          className="subtodo-input-modal"
                        />
                        <button
                          onClick={() => {
                            if (subTodoText.trim()) {
                              onAddSubTodo(todo.id, subTodoText.trim())
                              setSubTodoText('')
                            }
                          }}
                          className="subtodo-add-button-modal"
                        >
                          추가
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {selectedAction === 'routine' && (() => {
                  const currentRoutine = routines.find(r => r.id === todo.routine_id)

                  return (
                    <div className="actions-detail-content">
                      <h4>🔄 루틴 설정</h4>
                      <div className="routine-setup-inline">
                        {currentRoutine && !isEditingRoutineInModal ? (
                          <>
                            <div className="routine-current-info">
                              <div className="routine-info-title">설정된 루틴:</div>
                              <div className="routine-days-display">
                                {DAYS.filter(day => currentRoutine.days.includes(day.key)).map(day => (
                                  <span key={day.key} className="routine-day-badge">
                                    {day.label}
                                  </span>
                                ))}
                              </div>
                              {currentRoutine.time_slot && (
                                <div className="routine-time-slot" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                                  ⏰ {currentRoutine.time_slot}
                                </div>
                              )}
                            </div>
                            <div className="routine-setup-actions">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (currentRoutine) {
                                    setRoutineDaysForModal(currentRoutine.days)
                                    setRoutineTimeSlotForModal(currentRoutine.time_slot || '')
                                    setIsEditingRoutineInModal(true)
                                  }
                                }}
                                className="routine-confirm-button"
                              >
                                수정
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (currentRoutine && todo) {
                                    await onCreateRoutine(todo.id, todo.text, [], null, true)
                                    setShowActionsModal(false)
                                  }
                                }}
                                className="routine-remove-button"
                              >
                                제거
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="routine-setup-title">
                              {isEditingRoutineInModal ? '루틴 수정:' : '반복할 요일 선택:'}
                            </div>
                            <div className="day-selector-inline">
                              {DAYS.map(day => (
                                <button
                                  key={day.key}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleRoutineDayInModal(day.key)
                                  }}
                                  className={`day-button-inline ${routineDaysForModal.includes(day.key) ? 'selected' : ''}`}
                                >
                                  {day.label}
                                </button>
                              ))}
                            </div>
                            <div className="time-slot-selector" style={{ marginTop: '1rem' }}>
                              <label style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem', display: 'block' }}>
                                ⏰ 시간 (선택사항)
                              </label>
                              <AppleTimePicker
                                value={routineTimeSlotForModal}
                                onChange={(time) => setRoutineTimeSlotForModal(time)}
                              />
                            </div>
                            <div className="routine-setup-actions">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  if (todo) {
                                    if (isEditingRoutineInModal && currentRoutine) {
                                      // 루틴 수정
                                      await onCreateRoutine(todo.id, todo.text, routineDaysForModal, currentRoutine.id, false, routineTimeSlotForModal)
                                    } else {
                                      // 새 루틴 생성 (요일 없으면 매일 반복)
                                      await onCreateRoutine(todo.id, todo.text, routineDaysForModal, null, false, routineTimeSlotForModal)
                                    }
                                    setIsEditingRoutineInModal(false)
                                    setShowActionsModal(false)
                                  }
                                }}
                                className="routine-confirm-button"
                              >
                                확인
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setIsEditingRoutineInModal(false)
                                  setRoutineDaysForModal([])
                                  setRoutineTimeSlotForModal('')
                                }}
                                className="routine-cancel-button"
                              >
                                취소
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {selectedAction === 'history' && (() => {
                  const visibleDates = todo.visible_dates && todo.visible_dates.length > 0 ? todo.visible_dates : [todo.date]
                  const originalDate = visibleDates[0]
                  const carryOverPath = visibleDates.map(date => ({ id: `${todo.id}-${date}`, date }))
                  const historyRecords = todoHistory[todo.id] || []

                  if (isLoadingHistory) {
                    return (
                      <div className="actions-detail-content">
                        <h4>📊 투두 히스토리</h4>
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                          로딩 중...
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="actions-detail-content">
                      <h4>📊 투두 히스토리</h4>
                      <div className="todo-history">
                        <div className="history-item">
                          <span className="history-label">생성일:</span>
                          <span className="history-value">{formatDate(todo.created_at)}</span>
                        </div>
                        <div className="history-item">
                          <span className="history-label">원본 페이지:</span>
                          <span className="history-value">
                            {originalDate ? formatDateOnly(new Date(originalDate + 'T00:00:00')) : formatDateOnly(new Date(todo.date + 'T00:00:00'))}
                          </span>
                        </div>
                        {carryOverPath.length > 0 && (
                          <div className="history-item">
                            <span className="history-label">이월 경로:</span>
                            <span className="history-value">
                              {carryOverPath.map((path, idx) => {
                                const isCurrentPage = path.date === todo.date
                                const dateStr = formatDateOnly(new Date(path.date + 'T00:00:00'))
                                return (
                                  <span key={path.id}>
                                    {idx > 0 && ' → '}
                                    <span style={isCurrentPage ? { fontWeight: 'bold', color: '#4CAF50' } : {}}>
                                      {dateStr.split('(')[0]}{isCurrentPage ? '(여기)' : ''}
                                    </span>
                                  </span>
                                )
                              })}
                            </span>
                          </div>
                        )}
                        {(() => {
                          const createdDate = new Date(todo.created_at).toISOString().split('T')[0]
                          const currentDate = todo.date
                          if (createdDate !== currentDate && carryOverPath.length === 0) {
                            return (
                              <div className="history-item">
                                <span className="history-label">현재 페이지:</span>
                                <span className="history-value">{formatDateOnly(new Date(todo.date + 'T00:00:00'))}</span>
                              </div>
                            )
                          }
                          return null
                        })()}
                        {historyRecords.length > 0 && (
                          <div className="history-changes-list">
                            <div className="history-changes-header">변경 이력 ({historyRecords.length})</div>
                            {historyRecords.map((record) => (
                              <div key={record.id} className="history-record-compact">
                                <div className="history-record-summary">
                                  <div className="history-change-time">
                                    {formatDate(record.changed_at)}
                                    {record.changed_on_date && (
                                      <span className="history-page-info"> (페이지: {formatDateOnly(new Date(record.changed_on_date + 'T00:00:00'))})</span>
                                    )}
                                  </div>
                                  <button
                                    className="history-detail-button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleHistoryDetail(record.id)
                                    }}
                                  >
                                    {expandedHistoryIds.includes(record.id) ? '숨기기' : '내용보기'}
                                  </button>
                                </div>
                                {expandedHistoryIds.includes(record.id) && (
                                  <div className="history-change">
                                    <div className="history-change-item history-before">
                                      <span className="change-badge">이전</span>
                                      <span className="change-text">{record.previous_text}</span>
                                    </div>
                                    <div className="history-change-arrow">→</div>
                                    <div className="history-change-item history-after">
                                      <span className="change-badge">이후</span>
                                      <span className="change-text">{record.new_text}</span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {selectedAction === 'routine-stats' && currentRoutine && (() => {
                  // 로딩 중이거나 데이터가 없는 경우
                  if (!selectedRoutineForHistory || selectedRoutineForHistory.id !== currentRoutine.id || routineHistoryData.length === 0) {
                    return (
                      <div className="actions-detail-content">
                        <h4>📊 {currentRoutine.text} 히스토리</h4>
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                          {(!selectedRoutineForHistory || selectedRoutineForHistory.id !== currentRoutine.id) ? '로딩 중...' : '데이터가 없습니다.'}
                        </div>
                      </div>
                    )
                  }

                  // 첫 번째 투두 날짜부터 오늘까지의 달력 생성
                  const firstTodo = routineHistoryData[0]
                  const firstDate = new Date(firstTodo.date)
                  const today = new Date()

                  // 날짜별 완료 여부 맵 생성
                  const completionMap = {}
                  routineHistoryData.forEach(todo => {
                    completionMap[todo.date] = todo.completed
                  })

                  // 월별로 그룹화
                  const monthGroups = []
                  let currentDate = new Date(firstDate)

                  while (currentDate <= today) {
                    const year = currentDate.getFullYear()
                    const month = currentDate.getMonth()
                    const monthKey = `${year}-${month + 1}`

                    if (!monthGroups.find(g => g.key === monthKey)) {
                      monthGroups.push({
                        key: monthKey,
                        year,
                        month,
                        days: []
                      })
                    }

                    const monthGroup = monthGroups.find(g => g.key === monthKey)
                    const dateStr = formatDateForDB(currentDate)
                    const dayOfWeek = currentDate.getDay()

                    // 루틴이 해당 요일에 설정되어 있는지 확인
                    const dayKey = getDayKey(dayOfWeek)
                    const isRoutineDay = currentRoutine.days.includes(dayKey)

                    monthGroup.days.push({
                      date: new Date(currentDate),
                      dateStr,
                      day: currentDate.getDate(),
                      dayOfWeek,
                      isCompleted: completionMap[dateStr] === true,
                      isRoutineDay,
                      hasTodo: completionMap[dateStr] !== undefined
                    })

                    currentDate.setDate(currentDate.getDate() + 1)
                  }

                  return (
                    <div className="actions-detail-content">
                      <h4>📊 {currentRoutine.text} 히스토리</h4>
                      <div className="routine-history-content">
                        <div className="routine-history-calendar">
                          {monthGroups.map(monthGroup => (
                            <div key={monthGroup.key} className="history-month">
                              <h3 className="history-month-title">
                                {monthGroup.year}년 {monthGroup.month + 1}월
                              </h3>
                              <div className="history-calendar-grid">
                                <div className="history-day-header">일</div>
                                <div className="history-day-header">월</div>
                                <div className="history-day-header">화</div>
                                <div className="history-day-header">수</div>
                                <div className="history-day-header">목</div>
                                <div className="history-day-header">금</div>
                                <div className="history-day-header">토</div>

                                {/* 첫 주의 빈 칸 */}
                                {monthGroup.days.length > 0 && Array(monthGroup.days[0].dayOfWeek).fill(null).map((_, i) => (
                                  <div key={`empty-${i}`} className="history-day-cell empty"></div>
                                ))}

                                {/* 날짜 셀 */}
                                {monthGroup.days.map((dayInfo, index) => {
                                  // 다음 월의 첫날이면 빈칸 추가
                                  if (index > 0 && dayInfo.day === 1) {
                                    const prevDay = monthGroup.days[index - 1]
                                    const emptyCount = 6 - prevDay.dayOfWeek
                                    return (
                                      <React.Fragment key={dayInfo.dateStr}>
                                        {Array(emptyCount).fill(null).map((_, i) => (
                                          <div key={`empty-end-${index}-${i}`} className="history-day-cell empty"></div>
                                        ))}
                                        <div className="history-day-header">일</div>
                                        <div className="history-day-header">월</div>
                                        <div className="history-day-header">화</div>
                                        <div className="history-day-header">수</div>
                                        <div className="history-day-header">목</div>
                                        <div className="history-day-header">금</div>
                                        <div className="history-day-header">토</div>
                                        <div className={`history-day-cell ${dayInfo.isCompleted ? 'completed' : ''} ${!dayInfo.isRoutineDay ? 'not-routine-day' : ''}`}>
                                          <span className="day-number">{dayInfo.day}</span>
                                          {dayInfo.isCompleted && <span className="check-mark">✓</span>}
                                        </div>
                                      </React.Fragment>
                                    )
                                  }

                                  return (
                                    <div
                                      key={dayInfo.dateStr}
                                      className={`history-day-cell ${dayInfo.isCompleted ? 'completed' : ''} ${!dayInfo.isRoutineDay ? 'not-routine-day' : ''}`}
                                      title={`${dayInfo.dateStr}${!dayInfo.isRoutineDay ? ' (루틴 요일 아님)' : ''}${dayInfo.isCompleted ? ' - 완료' : dayInfo.hasTodo ? ' - 미완료' : ''}`}
                                    >
                                      <span className="day-number">{dayInfo.day}</span>
                                      {dayInfo.isCompleted && <span className="check-mark">✓</span>}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="routine-history-stats">
                          <div className="stat-item">
                            <span className="stat-label">총 투두:</span>
                            <span className="stat-value">{routineHistoryData.length}개</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">완료:</span>
                            <span className="stat-value completed">{routineHistoryData.filter(t => t.completed).length}개</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">미완료:</span>
                            <span className="stat-value incomplete">{routineHistoryData.filter(t => !t.completed).length}개</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">완료율:</span>
                            <span className="stat-value">
                              {routineHistoryData.length > 0
                                ? Math.round((routineHistoryData.filter(t => t.completed).length / routineHistoryData.length) * 100)
                                : 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {selectedAction === 'delete' && (
                  <div className="actions-detail-content">
                    <h4>🗑️ 삭제</h4>
                    <p className="delete-confirm-text">
                      <strong>{todo.text}</strong>
                    </p>
                    {(() => {
                      // visible_dates 확인 (여러 날짜에 보이는 투두인지 체크)
                      const visibleDates = (todo.visible_dates?.length > 0)
                        ? todo.visible_dates
                        : [todo.date || todo.created_date]

                      // 구 방식(복사 기반) 이월 투두인지 확인
                      const isOldStyleCarryover = todo.original_todo_id !== null && todo.original_todo_id !== undefined

                      // 루틴 투두인지 확인
                      const isRoutineTodo = todo.routine_id !== null && todo.routine_id !== undefined

                      // 루틴 투두인 경우 세 가지 옵션 표시
                      if (isRoutineTodo) {
                        return (
                          <>
                            <p className="delete-confirm-description">
                              이 루틴을 어떻게 삭제하시겠습니까?
                            </p>
                            <div className="delete-options-simple">
                              <button
                                className="delete-option-button-simple option-hide"
                                onClick={async () => {
                                  if (window.confirm('오늘만 숨기시겠습니까?\n다른 날짜에서는 계속 보입니다.')) {
                                    await hideOnThisDateOnly(todo)
                                    setShowActionsModal(false)
                                  }
                                }}
                              >
                                <span className="option-icon">📅</span>
                                <div className="option-content">
                                  <span className="option-title">오늘만 숨김</span>
                                  <span className="option-desc">다른 날짜에서는 계속 보임</span>
                                </div>
                              </button>
                              <button
                                className="delete-option-button-simple option-future"
                                onClick={async () => {
                                  if (window.confirm('오늘부터 루틴을 중단하시겠습니까?\n과거 기록은 유지됩니다.')) {
                                    await deleteRoutineFromToday(todo)
                                    setShowActionsModal(false)
                                  }
                                }}
                              >
                                <span className="option-icon">⏹️</span>
                                <div className="option-content">
                                  <span className="option-title">오늘부터 중단</span>
                                  <span className="option-desc">내일부터 생성 안 됨 (과거 유지)</span>
                                </div>
                              </button>
                              <button
                                className="delete-option-button-simple option-delete"
                                onClick={async () => {
                                  if (window.confirm('⚠️ 루틴과 모든 기록을 삭제하시겠습니까?\n휴지통에서 복원 가능합니다.')) {
                                    await deleteRoutineCompletely(todo)
                                    setShowActionsModal(false)
                                  }
                                }}
                              >
                                <span className="option-icon">🗑️</span>
                                <div className="option-content">
                                  <span className="option-title">모두 삭제</span>
                                  <span className="option-desc">과거+오늘+미래 모두 휴지통으로</span>
                                </div>
                              </button>
                            </div>
                          </>
                        )
                      }
                      // 여러 날짜에 보이는 일반 투두인 경우 두 가지 옵션 표시
                      else if (visibleDates.length > 1 || isOldStyleCarryover) {
                        return (
                          <>
                            <p className="delete-confirm-description">
                              이 투두는 여러 날짜에 보입니다. 어떻게 삭제하시겠습니까?
                            </p>
                            <div className="delete-options-simple">
                              <button
                                className="delete-option-button-simple option-hide"
                                onClick={async () => {
                                  if (window.confirm('이 날짜에서만 숨기시겠습니까?\n다른 날짜에서는 계속 보입니다.')) {
                                    await hideOnThisDateOnly(todo)
                                    setShowActionsModal(false)
                                  }
                                }}
                              >
                                <span className="option-icon">⊘</span>
                                <div className="option-content">
                                  <span className="option-title">이 날짜에서만 숨김</span>
                                  <span className="option-desc">다른 날짜에서는 계속 보입니다</span>
                                </div>
                              </button>
                              <button
                                className="delete-option-button-simple option-delete"
                                onClick={async () => {
                                  await deleteCompletely(todo)
                                  setShowActionsModal(false)
                                }}
                              >
                                <span className="option-icon">🗑️</span>
                                <div className="option-content">
                                  <span className="option-title">휴지통으로 이동</span>
                                  <span className="option-desc">모든 날짜에서 삭제 (복원 가능)</span>
                                </div>
                              </button>
                            </div>
                          </>
                        )
                      } else {
                        // 단일 날짜 투두는 휴지통 이동만 표시
                        return (
                          <>
                            <p className="delete-confirm-description">
                              이 투두를 휴지통으로 이동하시겠습니까?
                            </p>
                            <div className="delete-options-simple">
                              <button
                                className="delete-option-button-simple option-delete"
                                onClick={async () => {
                                  await deleteCompletely(todo)
                                  setShowActionsModal(false)
                                }}
                              >
                                <span className="option-icon">🗑️</span>
                                <div className="option-content">
                                  <span className="option-title">휴지통으로 이동</span>
                                  <span className="option-desc">복원 가능</span>
                                </div>
                              </button>
                            </div>
                          </>
                        )
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 시간 입력은 AppleTimePicker 사용

// 숫자 요일을 키로 변환 (일요일=0, 월요일=1, ...)
const getDayKey = (dayNumber) => {
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  return keys[dayNumber]
}

function App() {
  // 인증 상태
  const { session, authLoading, handleGoogleLogin, handleLogout } = useAuth()

  const [todos, setTodos] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [routineInputValue, setRoutineInputValue] = useState('')
  const [normalInputValue, setNormalInputValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDraggingAny, setIsDraggingAny] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [deletedTodo, setDeletedTodo] = useState(null)
  const [showUndoToast, setShowUndoToast] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [successToastMessage, setSuccessToastMessage] = useState('')
  const [lastDeleteAction, setLastDeleteAction] = useState(null) // { type, todo, routineId, hiddenDate }
  const [showTrashModal, setShowTrashModal] = useState(false)
  const [trashedItems, setTrashedItems] = useState([])

  // 성공 토스트 표시 헬퍼 함수 (실행 취소 가능)
  const showSuccessMessage = (message, undoAction = null) => {
    setSuccessToastMessage(message)
    setLastDeleteAction(undoAction)
    setShowSuccessToast(true)

    const timeoutId = setTimeout(() => {
      setShowSuccessToast(false)
      setSuccessToastMessage('')
      setLastDeleteAction(null)
    }, 5000) // 5초로 늘림 (취소할 시간)

    // timeout ID를 저장하여 취소 시 클리어할 수 있도록
    return timeoutId
  }

  // 삭제 실행 취소
  const handleUndoRoutineDelete = async () => {
    if (!lastDeleteAction) return

    try {
      const { type, todoId, routineId, hiddenDate, wasDeleted } = lastDeleteAction

      if (type === 'hideOnDate') {
        // 오늘만 숨김 취소: hidden_dates에서 날짜 제거
        const { data: todo, error: fetchError } = await supabase
          .from('todos')
          .select('*')
          .eq('id', todoId)
          .single()

        if (fetchError) throw fetchError

        const newHiddenDates = (todo.hidden_dates || []).filter(d => d !== hiddenDate)

        let updateData = { hidden_dates: newHiddenDates }
        if (wasDeleted) {
          updateData.deleted = false
          updateData.deleted_date = null
        }

        const { error: updateError } = await supabase
          .from('todos')
          .update(updateData)
          .eq('id', todoId)

        if (updateError) throw updateError

      } else if (type === 'stopRoutineFromToday') {
        // 오늘부터 중단 취소: 루틴 복원 + hidden_dates에서 날짜 제거
        const { error: routineError } = await supabase
          .from('routines')
          .update({ deleted: false })
          .eq('id', routineId)

        if (routineError) throw routineError

        const { data: todo, error: fetchError } = await supabase
          .from('todos')
          .select('*')
          .eq('id', todoId)
          .single()

        if (fetchError) throw fetchError

        const newHiddenDates = (todo.hidden_dates || []).filter(d => d !== hiddenDate)

        const { error: updateError } = await supabase
          .from('todos')
          .update({ hidden_dates: newHiddenDates })
          .eq('id', todoId)

        if (updateError) throw updateError

      } else if (type === 'deleteRoutineCompletely') {
        // 모두 삭제 취소: 루틴 + 투두 복원
        const { error: routineError } = await supabase
          .from('routines')
          .update({ deleted: false })
          .eq('id', routineId)

        if (routineError) throw routineError

        const { error: todoError } = await supabase
          .from('todos')
          .update({ deleted: false, deleted_date: null })
          .eq('id', todoId)

        if (todoError) throw todoError
      }

      // 토스트 숨기고 페이지 새로고침
      setShowSuccessToast(false)
      setSuccessToastMessage('')
      setLastDeleteAction(null)
      fetchTodos()

    } catch (error) {
      console.error('실행 취소 오류:', error.message)
      alert('❌ 실행 취소에 실패했습니다.')
    }
  }
  const [focusedTodoId, setFocusedTodoId] = useState(null)
  const [showRoutineModal, setShowRoutineModal] = useState(false)
  const [routines, setRoutines] = useState([])
  const [routineInput, setRoutineInput] = useState('')
  const [selectedDays, setSelectedDays] = useState([])
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('')
  const [isAddingRoutine, setIsAddingRoutine] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const recentlyEditedIds = useRef(new Set())
  const [editingRoutineId, setEditingRoutineId] = useState(null)
  const [editingRoutineText, setEditingRoutineText] = useState('')
  const [showRoutineHistory, setShowRoutineHistory] = useState(false)
  const [selectedRoutineForHistory, setSelectedRoutineForHistory] = useState(null)
  const [routineHistoryData, setRoutineHistoryData] = useState([])
  const [editingRoutineDays, setEditingRoutineDays] = useState([])
  const [dummySessions, setDummySessions] = useState([])
  const [showDummyModal, setShowDummyModal] = useState(false)
  const [showDummySQL, setShowDummySQL] = useState(false)
  const [showMemoModal, setShowMemoModal] = useState(false)
  const [memoContent, setMemoContent] = useState('')
  const [isEditingMemo, setIsEditingMemo] = useState(false)
  const [isSavingMemo, setIsSavingMemo] = useState(false)
  const [memoOriginalContent, setMemoOriginalContent] = useState('')
  const [isEditingMemoInline, setIsEditingMemoInline] = useState(false)
  const memoTextareaRef = useRef(null)

  // 주요 생각정리 관련 상태
  const [isSavingKeyThoughts, setIsSavingKeyThoughts] = useState(false)
  const [keyThoughtsBlocks, setKeyThoughtsBlocks] = useState([
    { id: Date.now() + Math.random(), type: 'toggle', content: '', children: [], isOpen: true }
  ])
  const lastSavedKeyThoughtsRef = useRef(null) // 마지막으로 히스토리에 저장된 블록
  const [focusedBlockId, setFocusedBlockId] = useState(null)
  const [keyThoughtsHistory, setKeyThoughtsHistory] = useState([])
  const [showKeyThoughtsHistory, setShowKeyThoughtsHistory] = useState(false)
  const [showGanttChart, setShowGanttChart] = useState(false)
  const [ganttData, setGanttData] = useState([])
  const [ganttPeriod, setGanttPeriod] = useState('1week') // 'all', '1week', '2weeks', '1month', '3months', '6months'
  const [encouragementMessages, setEncouragementMessages] = useState([])
  const [showEncouragementModal, setShowEncouragementModal] = useState(false)
  const [newEncouragementMessage, setNewEncouragementMessage] = useState('')
  const [editingEncouragementId, setEditingEncouragementId] = useState(null)
  const [editingEncouragementText, setEditingEncouragementText] = useState('')
  const [showEncouragementEmoji, setShowEncouragementEmoji] = useState(false)
  const [currentEncouragementMessage, setCurrentEncouragementMessage] = useState('')
  const [showTodoHistoryModal, setShowTodoHistoryModal] = useState(false)
  const [showTodoRoutineSetupModal, setShowTodoRoutineSetupModal] = useState(false)
  const [selectedTodoForModal, setSelectedTodoForModal] = useState(null)
  const [todoHistory, setTodoHistory] = useState({}) // todo_id를 키로 하는 히스토리 객체
  const [expandedHistoryIds, setExpandedHistoryIds] = useState([]) // 펼쳐진 히스토리 항목 ID 목록
  const [routineDaysForModal, setRoutineDaysForModal] = useState([]) // 모달에서 사용할 루틴 요일
  const [isEditingRoutineInModal, setIsEditingRoutineInModal] = useState(false) // 모달에서 루틴 편집 중인지
  const [routineTimeSlotForModal, setRoutineTimeSlotForModal] = useState('') // 모달에서 사용할 루틴 시간대
  const [viewMode, setViewMode] = useState(() => {
    // 로컬스토리지에서 뷰 모드 불러오기
    const saved = localStorage.getItem('viewMode')
    return saved || 'horizontal' // 기본값: horizontal
  })
  const [isReorderMode, setIsReorderMode] = useState(false) // 섹션 순서 수정 모드
  const [sectionOrder, setSectionOrder] = useState(['memo', 'routine', 'normal', 'key-thoughts'])
  const routineCreationInProgress = useRef(new Set()) // 날짜별 루틴 생성 중 플래그
  const carryOverInProgress = useRef(false) // 이월 작업 중 플래그
  const sectionsContainerRef = useRef(null) // 가로 스크롤 컨테이너 ref
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0) // 모바일 섹션 인덱스
  const contentScrollableRef = useRef(null) // 세로 스크롤 컨테이너 ref
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false)
  const [todoToDelete, setTodoToDelete] = useState(null)

  // 랜덤 격려 문구 선택
  const getRandomEncouragement = () => {
    if (encouragementMessages.length === 0) return ""
    const randomIndex = Math.floor(Math.random() * encouragementMessages.length)
    return encouragementMessages[randomIndex]
  }

  // 격려 메시지 클릭 핸들러
  const handleEncouragementClick = () => {
    // 이모지 표시
    setShowEncouragementEmoji(true)

    // 새로운 랜덤 문구 선택 (현재 문구와 다르게)
    let newMessage = getRandomEncouragement()
    let attempts = 0
    while (newMessage === currentEncouragementMessage && encouragementMessages.length > 1 && attempts < 10) {
      newMessage = getRandomEncouragement()
      attempts++
    }

    // 1초 후 이모지 숨기고 문구 변경
    setTimeout(() => {
      setShowEncouragementEmoji(false)
      setCurrentEncouragementMessage(newMessage)
    }, 1000)
  }

  // 더미 데이터 생성
  const handleCreateDummyData = async () => {
    try {
      const sessionId = `DUMMY-${Date.now()}`
      const today = new Date(2025, 10, 16) // 2025-11-16

      const dummyData = []
      const historyData = []

      // 14일 페이지 (정상 생성)
      const date14 = '2025-11-14'
      dummyData.push(
        { text: `[${sessionId}] 더미: 14일생성-미완료-수정이력있음`, date: date14, completed: false, created_at: '2025-11-14T09:00:00Z', order_index: 1001 },
        { text: `[${sessionId}] 더미: 14일생성-14일완료`, date: date14, completed: true, created_at: '2025-11-14T09:10:00Z', order_index: 1002 },
        { text: `[${sessionId}] 더미: 14일생성-15일완료`, date: date14, completed: true, created_at: '2025-11-14T09:20:00Z', order_index: 1003 },
        { text: `[${sessionId}] 더미: 14일생성-16일완료`, date: date14, completed: true, created_at: '2025-11-14T09:30:00Z', order_index: 1004 }
      )

      // 15일 페이지 (정상 생성)
      const date15 = '2025-11-15'
      dummyData.push(
        { text: `[${sessionId}] 더미: 15일생성-미완료-수정이력있음`, date: date15, completed: false, created_at: '2025-11-15T10:00:00Z', order_index: 1005 },
        { text: `[${sessionId}] 더미: 15일생성-15일완료`, date: date15, completed: true, created_at: '2025-11-15T10:10:00Z', order_index: 1006 },
        { text: `[${sessionId}] 더미: 15일생성-16일완료`, date: date15, completed: true, created_at: '2025-11-15T10:20:00Z', order_index: 1007 }
      )

      // 16일 페이지 (정상 생성)
      const date16 = '2025-11-16'
      dummyData.push(
        { text: `[${sessionId}] 더미: 16일생성-미완료`, date: date16, completed: false, created_at: '2025-11-16T11:00:00Z', order_index: 1008 },
        { text: `[${sessionId}] 더미: 16일생성-16일완료`, date: date16, completed: true, created_at: '2025-11-16T11:10:00Z', order_index: 1009 }
      )

      // 15일 페이지에 미리 작성
      dummyData.push(
        { text: `[${sessionId}] 더미: 14일생성-15일페이지-미완료`, date: date15, completed: false, created_at: '2025-11-14T14:00:00Z', order_index: 1010 },
        { text: `[${sessionId}] 더미: 14일생성-15일페이지-15일완료`, date: date15, completed: true, created_at: '2025-11-14T14:10:00Z', order_index: 1011 }
      )

      // 16일 페이지에 미리 작성
      dummyData.push(
        { text: `[${sessionId}] 더미: 15일생성-16일페이지-미완료`, date: date16, completed: false, created_at: '2025-11-15T15:00:00Z', order_index: 1012 },
        { text: `[${sessionId}] 더미: 15일생성-16일페이지-16일완료`, date: date16, completed: true, created_at: '2025-11-15T15:10:00Z', order_index: 1013 },
        { text: `[${sessionId}] 더미: 14일생성-16일페이지-미완료`, date: date16, completed: false, created_at: '2025-11-14T15:00:00Z', order_index: 1014 },
        { text: `[${sessionId}] 더미: 14일생성-16일페이지-16일완료`, date: date16, completed: true, created_at: '2025-11-14T15:10:00Z', order_index: 1015 }
      )

      // 17일 페이지에 미리 작성 (미래)
      const date17 = '2025-11-17'
      dummyData.push(
        { text: `[${sessionId}] 더미: 16일생성-17일페이지-미완료`, date: date17, completed: false, created_at: '2025-11-16T16:00:00Z', order_index: 1016 },
        { text: `[${sessionId}] 더미: 15일생성-17일페이지-미완료`, date: date17, completed: false, created_at: '2025-11-15T16:00:00Z', order_index: 1017 },
        { text: `[${sessionId}] 더미: 14일생성-17일페이지-미완료`, date: date17, completed: false, created_at: '2025-11-14T16:00:00Z', order_index: 1018 }
      )

      // 18일 페이지에 미리 작성 (미래)
      const date18 = '2025-11-18'
      dummyData.push(
        { text: `[${sessionId}] 더미: 16일생성-18일페이지-미완료`, date: date18, completed: false, created_at: '2025-11-16T17:00:00Z', order_index: 1019 },
        { text: `[${sessionId}] 더미: 15일생성-18일페이지-미완료`, date: date18, completed: false, created_at: '2025-11-15T17:00:00Z', order_index: 1020 }
      )

      // Supabase에 투두 삽입
      const { data: insertedTodos, error: todoError } = await supabase
        .from('todos')
        .insert(dummyData)
        .select()

      if (todoError) throw todoError

      // 히스토리 데이터 생성 (수정 이력이 있는 투두들)
      // 14일 생성 투두의 히스토리 (15일, 16일 수정)
      const todo14 = insertedTodos.find(t => t.text.includes('14일생성-미완료-수정이력있음'))
      if (todo14) {
        historyData.push(
          {
            todo_id: todo14.id,
            previous_text: `[${sessionId}] 더미: 14일생성-미완료-1차`,
            new_text: `[${sessionId}] 더미: 14일생성-미완료-2차`,
            changed_at: '2025-11-15T12:00:00Z',
            changed_on_date: date15
          },
          {
            todo_id: todo14.id,
            previous_text: `[${sessionId}] 더미: 14일생성-미완료-2차`,
            new_text: `[${sessionId}] 더미: 14일생성-미완료-수정이력있음`,
            changed_at: '2025-11-16T12:00:00Z',
            changed_on_date: date16
          }
        )
      }

      // 15일 생성 투두의 히스토리 (16일 수정)
      const todo15 = insertedTodos.find(t => t.text.includes('15일생성-미완료-수정이력있음'))
      if (todo15) {
        historyData.push(
          {
            todo_id: todo15.id,
            previous_text: `[${sessionId}] 더미: 15일생성-미완료-1차`,
            new_text: `[${sessionId}] 더미: 15일생성-미완료-수정이력있음`,
            changed_at: '2025-11-16T13:00:00Z',
            changed_on_date: date16
          }
        )
      }

      // 히스토리 데이터 삽입
      if (historyData.length > 0) {
        const { error: historyError } = await supabase
          .from('todo_history')
          .insert(historyData)

        if (historyError) {
          console.error('히스토리 생성 오류:', historyError.message)
        }
      }

      // 세션 정보 저장
      setDummySessions(prev => [...prev, {
        sessionId,
        createdAt: new Date().toISOString(),
        count: dummyData.length,
        historyCount: historyData.length
      }])

      alert(`✅ 더미 데이터 생성 완료!\n투두: ${dummyData.length}개\n히스토리: ${historyData.length}개\n세션 ID: ${sessionId}`)

      // 현재 날짜 새로고침
      fetchTodos()
    } catch (error) {
      console.error('더미 데이터 생성 오류:', error.message)
      alert('❌ 더미 데이터 생성 실패: ' + error.message)
    }
  }

  // 특정 세션 더미 데이터 삭제
  const handleDeleteDummySession = async (sessionId) => {
    const confirmed = window.confirm(
      `⚠️ 정말로 세션 "${sessionId}"의 더미 데이터를 삭제하시겠습니까?\n\n이 세션의 모든 투두가 서버에서 완전히 삭제되며, 이 작업은 되돌릴 수 없습니다.`
    )

    if (!confirmed) return

    try {
      // 먼저 해당 세션의 투두 ID들을 가져오기
      const { data: todosToDelete, error: fetchError } = await supabase
        .from('todos')
        .select('id')
        .like('text', `[${sessionId}]%`)

      if (fetchError) throw fetchError

      // 투두 ID들로 히스토리 삭제 (ON DELETE CASCADE가 없으면 수동으로)
      if (todosToDelete && todosToDelete.length > 0) {
        const todoIds = todosToDelete.map(t => t.id)

        const { error: historyError } = await supabase
          .from('todo_history')
          .delete()
          .in('todo_id', todoIds)

        if (historyError) {
          console.error('히스토리 삭제 오류:', historyError.message)
        }
      }

      // 투두 삭제
      const { error } = await supabase
        .from('todos')
        .delete()
        .like('text', `[${sessionId}]%`)

      if (error) throw error

      setDummySessions(prev => prev.filter(s => s.sessionId !== sessionId))
      alert(`✅ 세션 ${sessionId} 삭제 완료!`)

      // 현재 날짜 새로고침
      fetchTodos()
    } catch (error) {
      console.error('더미 데이터 삭제 오류:', error.message)
      alert('❌ 더미 데이터 삭제 실패: ' + error.message)
    }
  }

  // 모든 더미 데이터 삭제
  const handleDeleteAllDummies = async () => {
    const confirmed = window.confirm(
      `⚠️ 정말로 모든 더미 데이터를 삭제하시겠습니까?\n\n모든 더미 세션의 투두가 서버에서 완전히 삭제되며, 이 작업은 되돌릴 수 없습니다.`
    )

    if (!confirmed) return

    try {
      // 먼저 모든 더미 투두 ID들을 가져오기
      const { data: todosToDelete, error: fetchError } = await supabase
        .from('todos')
        .select('id')
        .like('text', '[DUMMY-%')

      if (fetchError) throw fetchError

      // 투두 ID들로 히스토리 삭제
      if (todosToDelete && todosToDelete.length > 0) {
        const todoIds = todosToDelete.map(t => t.id)

        const { error: historyError } = await supabase
          .from('todo_history')
          .delete()
          .in('todo_id', todoIds)

        if (historyError) {
          console.error('히스토리 삭제 오류:', historyError.message)
        }
      }

      // 투두 삭제
      const { error } = await supabase
        .from('todos')
        .delete()
        .like('text', '[DUMMY-%')

      if (error) throw error

      setDummySessions([])
      alert('✅ 모든 더미 데이터 삭제 완료!')

      // 현재 날짜 새로고침
      fetchTodos()
    } catch (error) {
      console.error('모든 더미 데이터 삭제 오류:', error.message)
      alert('❌ 모든 더미 데이터 삭제 실패: ' + error.message)
    }
  }

  // 중복 투두 확인 및 삭제
  const handleRemoveDuplicates = async () => {
    try {
      // 모든 투두 가져오기 (삭제되지 않은 것만)
      const { data: allTodos, error: fetchError } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)
        .order('created_at', { ascending: true })

      if (fetchError) throw fetchError

      if (!allTodos || allTodos.length === 0) {
        alert('투두가 없습니다.')
        return
      }

      // 같은 텍스트를 가진 투두들을 그룹화
      const textGroups = {}
      allTodos.forEach(todo => {
        if (!textGroups[todo.text]) {
          textGroups[todo.text] = []
        }
        textGroups[todo.text].push(todo)
      })

      // 중복이 있는 그룹만 필터링 (2개 이상)
      const duplicateGroups = Object.entries(textGroups).filter(([_, todos]) => todos.length > 1)

      if (duplicateGroups.length === 0) {
        alert('중복된 투두가 없습니다.')
        return
      }

      // 중복 리스트 생성
      let duplicateList = '중복된 투두 목록:\n\n'
      let todosToDelete = []

      duplicateGroups.forEach(([text, todos]) => {
        duplicateList += `"${text}" - ${todos.length}개\n`
        // 첫 번째(가장 오래된)를 제외한 나머지를 삭제 대상에 추가
        const toDelete = todos.slice(1)
        todosToDelete.push(...toDelete)
        toDelete.forEach(todo => {
          const createdDate = new Date(todo.created_at).toLocaleString('ko-KR')
          duplicateList += `  ❌ 삭제 예정: ${createdDate}\n`
        })
        const keepTodo = todos[0]
        const keepDate = new Date(keepTodo.created_at).toLocaleString('ko-KR')
        duplicateList += `  ✅ 유지: ${keepDate}\n\n`
      })

      duplicateList += `\n총 ${todosToDelete.length}개의 중복 투두를 삭제합니다.`

      // 확인 받기
      const confirmDelete = window.confirm(duplicateList + '\n\n⚠️ 이 투두들은 서버에서 완전히 삭제되며, 이 작업은 되돌릴 수 없습니다.\n\n삭제하시겠습니까?')

      if (!confirmDelete) {
        return
      }

      // 삭제 실행
      const idsToDelete = todosToDelete.map(t => t.id)

      // 히스토리 먼저 삭제
      const { error: historyError } = await supabase
        .from('todo_history')
        .delete()
        .in('todo_id', idsToDelete)

      if (historyError) {
        console.error('히스토리 삭제 오류:', historyError.message)
      }

      // 투두 삭제
      const { error: deleteError } = await supabase
        .from('todos')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) throw deleteError

      alert(`✅ ${todosToDelete.length}개의 중복 투두를 삭제했습니다.`)

      // 현재 날짜 새로고침
      fetchTodos()
    } catch (error) {
      console.error('중복 투두 삭제 오류:', error.message)
      alert('❌ 중복 투두 삭제 실패: ' + error.message)
    }
  }

  // 날짜 변경 핸들러
  const handlePrevDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() - 1)
    setSelectedDate(newDate)
  }

  const handleNextDay = () => {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + 1)
    setSelectedDate(newDate)
  }

  // 날짜 선택 핸들러
  const handleDateChange = (e) => {
    const newDate = new Date(e.target.value + 'T00:00:00')
    setSelectedDate(newDate)
  }


  // 전날 미완료 항목을 다음 날로 이월 (JSON 방식)
  const moveIncompleteTodosToNextDay = async (fromDate, toDate) => {
    try {
      const fromDateStr = formatDateForDB(fromDate)
      const toDateStr = formatDateForDB(toDate)

      // 전날의 모든 투두 가져오기 (하이브리드 방식)
      const { data: allTodos, error: fetchError } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)
        .eq('completed', false)
        .is('routine_id', null) // 루틴 투두는 이월하지 않음

      if (fetchError) throw fetchError

      // 클라이언트 사이드 필터링: fromDateStr에 보이는 미완료 투두
      const incompleteTodos = (allTodos || []).filter(todo => {
        // hidden_dates 체크 (새 방식, 구 방식 모두 적용)
        const isHidden = todo.hidden_dates && Array.isArray(todo.hidden_dates) && todo.hidden_dates.includes(fromDateStr)
        if (isHidden) {
          return false // 숨김 처리된 투두는 이월하지 않음
        }

        // 새 방식: visible_dates 사용
        if (todo.visible_dates && Array.isArray(todo.visible_dates) && todo.visible_dates.length > 0) {
          const isVisible = todo.visible_dates.includes(fromDateStr)
          return isVisible
        }
        // 구 방식: date 사용
        return todo.date === fromDateStr
      })

      if (incompleteTodos.length === 0) {
        return
      }

      // 각 투두의 visible_dates에 toDateStr 추가
      for (const todo of incompleteTodos) {
        let currentVisibleDates = todo.visible_dates || [todo.date]

        // 이미 포함되어 있으면 스킵
        if (currentVisibleDates.includes(toDateStr)) {
          continue
        }

        // 새 날짜 추가
        const newVisibleDates = [...currentVisibleDates, toDateStr].sort()

        // 업데이트
        const { error: updateError } = await supabase
          .from('todos')
          .update({ visible_dates: newVisibleDates })
          .eq('id', todo.id)

        if (updateError) {
          console.error(`투두 ${todo.id} 이월 오류:`, updateError.message)
        }
      }
    } catch (error) {
      console.error('미완료 항목 이월 오류:', error.message)
    }
  }

  // 과거의 모든 미완료 항목을 날짜별로 순차 이월 (복사 방식)
  const movePastIncompleteTodosToToday = async () => {
    // 이미 실행 중이면 중복 실행 방지
    if (carryOverInProgress.current) {
      return
    }

    try {
      // 실행 시작 플래그 설정
      carryOverInProgress.current = true

      const today = new Date()
      const todayStr = formatDateForDB(today)

      // 과거의 가장 오래된 미완료 항목 날짜 찾기
      const { data: oldestTodo, error: oldestError } = await supabase
        .from('todos')
        .select('date')
        .lt('date', todayStr)
        .eq('deleted', false)
        .eq('completed', false)
        .is('routine_id', null)
        .order('date', { ascending: true })
        .limit(1)

      if (oldestError) throw oldestError

      if (!oldestTodo || oldestTodo.length === 0) {
        return // 이월할 항목이 없음
      }

      const oldestDate = new Date(oldestTodo[0].date + 'T00:00:00')

      // 가장 오래된 날짜부터 어제까지, 하루씩 순차적으로 이월
      let currentDate = new Date(oldestDate)
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)

      let totalCarriedOver = 0

      while (currentDate <= yesterday) {
        const fromDateStr = formatDateForDB(currentDate)
        const nextDate = new Date(currentDate)
        nextDate.setDate(nextDate.getDate() + 1)
        const toDateStr = formatDateForDB(nextDate)

        // 현재 날짜의 미완료 항목 가져오기
        const { data: incompleteTodos, error: fetchError } = await supabase
          .from('todos')
          .select('*')
          .eq('date', fromDateStr)
          .eq('deleted', false)
          .eq('completed', false)
          .is('routine_id', null)
          .order('order_index', { ascending: true })

        if (fetchError) throw fetchError

        if (incompleteTodos && incompleteTodos.length > 0) {
          // 다음 날의 기존 항목 가져오기
          const { data: nextDayTodos, error: nextDayError } = await supabase
            .from('todos')
            .select('*')
            .eq('date', toDateStr)
            .eq('deleted', false)
            .order('order_index', { ascending: true })

          if (nextDayError) throw nextDayError

          // 이미 이월된 항목 체크
          const alreadyCarriedOverIds = new Set()
          nextDayTodos?.forEach(t => {
            if (t.original_todo_id !== null) {
              alreadyCarriedOverIds.add(t.original_todo_id)
            }
          })

          // 아직 이월되지 않은 항목만 필터링
          const todosNeedCarryOver = incompleteTodos.filter(todo => {
            const originalId = todo.original_todo_id || todo.id
            return !alreadyCarriedOverIds.has(originalId)
          })

          if (todosNeedCarryOver.length > 0) {
            // 원본 투두들의 created_at 조회
            const originalIds = todosNeedCarryOver
              .map(todo => todo.original_todo_id || todo.id)
              .filter((id, index, self) => self.indexOf(id) === index)

            const { data: originalTodos, error: originalError } = await supabase
              .from('todos')
              .select('id, created_at')
              .in('id', originalIds)

            if (originalError) throw originalError

            const createdAtMap = {}
            originalTodos?.forEach(t => {
              createdAtMap[t.id] = t.created_at
            })

            const nextDayCount = nextDayTodos ? nextDayTodos.length : 0
            const startIndex = nextDayCount + 1

            // 다음 날로 복사
            const todosToInsert = todosNeedCarryOver.map((todo, index) => {
              const originalId = todo.original_todo_id || todo.id
              return {
                text: todo.text,
                completed: false,
                date: toDateStr,
                created_at: createdAtMap[originalId] || todo.created_at,
                order_index: startIndex + index,
                original_todo_id: originalId,
                parent_id: null,
                routine_id: null
              }
            })

            const { error: insertError } = await supabase
              .from('todos')
              .insert(todosToInsert)

            if (insertError) throw insertError

            totalCarriedOver += todosNeedCarryOver.length
          }
        }

        // 다음 날로 이동
        currentDate.setDate(currentDate.getDate() + 1)
      }

      if (totalCarriedOver > 0) {
      }
    } catch (error) {
      console.error('과거 미완료 항목 이월 오류:', error.message)
    } finally {
      // 작업 완료 후 플래그 해제
      carryOverInProgress.current = false
    }
  }

  // 루틴 목록 가져오기
  const fetchRoutines = async () => {
    try {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('deleted', false)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRoutines(data || [])
    } catch (error) {
      console.error('루틴 가져오기 오류:', error.message)
    }
  }

  // 루틴 추가
  const handleAddRoutine = async () => {
    if (routineInput.trim() === '' || isAddingRoutine) return

    try {
      setIsAddingRoutine(true)

      const routineData = {
        text: routineInput,
        days: selectedDays, // 빈 배열이면 매일 반복
        start_date: formatDateForDB(selectedDate), // 시작 날짜 추가
        user_id: session?.user?.id
      }

      // 시간대가 선택되었으면 추가
      if (selectedTimeSlot) {
        routineData.time_slot = selectedTimeSlot
      }

      const { data, error } = await supabase
        .from('routines')
        .insert([routineData])
        .select()

      if (error) throw error

      setRoutines([data[0], ...routines])
      setRoutineInput('')
      setSelectedDays([])
      setSelectedTimeSlot('')
    } catch (error) {
      console.error('루틴 추가 오류:', error.message)
    } finally {
      setIsAddingRoutine(false)
    }
  }

  // 투두에서 루틴 생성/수정/제거
  const handleCreateRoutineFromTodo = async (todoId, text, days, routineId = null, remove = false, timeSlot = '', startDate = null) => {
    try {
      if (remove) {
        // 루틴 제거 - routine_id를 null로
        const { error: updateError } = await supabase
          .from('todos')
          .update({ routine_id: null })
          .eq('id', todoId)

        if (updateError) throw updateError

        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === todoId ? { ...todo, routine_id: null } : todo
          )
        )

        return
      }

      if (routineId) {
        // 기존 루틴 수정
        const { error } = await supabase
          .from('routines')
          .update({ days, time_slot: timeSlot })
          .eq('id', routineId)

        if (error) throw error

        // 투두의 is_pending_routine 플래그 업데이트
        // days가 있으면 정식 루틴, 없으면 미정 루틴
        const { error: updateError } = await supabase
          .from('todos')
          .update({ is_pending_routine: days.length === 0 })
          .eq('id', todoId)

        if (updateError) throw updateError

        // 로컬 루틴 목록 업데이트
        setRoutines(prevRoutines =>
          prevRoutines.map(r => r.id === routineId ? { ...r, days, time_slot: timeSlot } : r)
        )

        // 로컬 투두 목록 업데이트
        setTodos(prevTodos =>
          prevTodos.map(t => t.id === todoId ? { ...t, is_pending_routine: days.length === 0 } : t)
        )
      } else {
        // 새 루틴 생성 - start_date 추가
        const routineData = {
          text,
          days,
          time_slot: timeSlot,
          start_date: startDate || formatDateForDB(selectedDate), // 시작 날짜 설정
          user_id: session?.user?.id
        }

        const { data, error } = await supabase
          .from('routines')
          .insert([routineData])
          .select()

        if (error) throw error


        // 해당 투두에 루틴 ID 연결 및 미정 루틴 플래그 설정
        // days가 있으면 정식 루틴(false), 없으면 미정 루틴(true)
        const { error: updateError } = await supabase
          .from('todos')
          .update({ routine_id: data[0].id, is_pending_routine: days.length === 0 })
          .eq('id', todoId)

        if (updateError) throw updateError

        // 로컬 상태 업데이트
        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === todoId ? { ...todo, routine_id: data[0].id, is_pending_routine: days.length === 0 } : todo
          )
        )

        // 새 루틴을 routines 배열에 추가 (항상)
        setRoutines(prevRoutines => [data[0], ...prevRoutines])
      }
    } catch (error) {
      console.error('루틴 처리 오류:', error.message)
    }
  }

  // 루틴 수정 시작
  const handleStartEditRoutine = (routine) => {
    setEditingRoutineId(routine.id)
    setEditingRoutineText(routine.text)
    setEditingRoutineDays(routine.days)
  }

  // 루틴 수정 취소
  const handleCancelEditRoutine = () => {
    setEditingRoutineId(null)
    setEditingRoutineText('')
    setEditingRoutineDays([])
  }

  // 루틴 수정 저장
  const handleSaveEditRoutine = async () => {
    if (!editingRoutineId || editingRoutineText.trim() === '' || editingRoutineDays.length === 0) return

    try {
      const { error } = await supabase
        .from('routines')
        .update({
          text: editingRoutineText.trim(),
          days: editingRoutineDays
        })
        .eq('id', editingRoutineId)

      if (error) throw error

      // 로컬 상태 업데이트
      setRoutines(routines.map(routine =>
        routine.id === editingRoutineId
          ? { ...routine, text: editingRoutineText.trim(), days: editingRoutineDays }
          : routine
      ))

      // 수정 상태 초기화
      handleCancelEditRoutine()
    } catch (error) {
      console.error('루틴 수정 오류:', error.message)
    }
  }

  // 루틴 수정 시 요일 토글
  const handleToggleEditDay = (dayKey) => {
    setEditingRoutineDays(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 루틴 삭제
  const handleDeleteRoutine = async (id) => {
    const routine = routines.find(r => r.id === id)
    const routineName = routine ? routine.text : '이 루틴'

    const confirmed = window.confirm(
      `⚠️ 정말로 "${routineName}"을(를) 삭제하시겠습니까?\n\n이 루틴은 서버에서 완전히 삭제되며, 이 작업은 되돌릴 수 없습니다.\n(기존에 생성된 투두는 유지됩니다)`
    )

    if (!confirmed) return

    try {
      // 1. 루틴 삭제
      const { error } = await supabase
        .from('routines')
        .update({ deleted: true })
        .eq('id', id)

      if (error) throw error

      // 2. 해당 루틴을 사용하는 모든 투두의 routine_id를 null로 업데이트
      const { error: updateError } = await supabase
        .from('todos')
        .update({ routine_id: null })
        .eq('routine_id', id)

      if (updateError) {
        console.error('투두 루틴 ID 업데이트 오류:', updateError.message)
      }

      // 3. 로컬 상태에서 루틴 제거
      setRoutines(routines.filter(routine => routine.id !== id))

      // 4. 로컬 투두 상태에서 routine_id 제거
      setTodos(prevTodos =>
        prevTodos.map(todo =>
          todo.routine_id === id ? { ...todo, routine_id: null } : todo
        )
      )
    } catch (error) {
      console.error('루틴 삭제 오류:', error.message)
    }
  }

  // 미완료 투두 자동 이월
  const carryOverIncompleteTodos = async (todayStr) => {
    // 이미 이월 작업 중이면 중복 실행 방지
    if (carryOverInProgress.current) {
      return
    }

    try {
      // 이월 작업 시작 플래그 설정
      carryOverInProgress.current = true

      // 모든 미완료 투두 조회 (삭제되지 않은 것만)
      const { data: allTodos, error } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)
        .eq('completed', false)

      if (error) throw error
      if (!allTodos || allTodos.length === 0) return

      // 오늘 이전 날짜에 생성된 미완료 투두 중, 오늘 날짜가 visible_dates에 없는 것만 필터링
      const todosToCarryOver = allTodos.filter(todo => {
        // created_at 날짜가 오늘 이전인지 확인
        const createdDate = new Date(todo.created_at)
        const createdDateStr = formatDateForDB(createdDate)

        if (createdDateStr >= todayStr) {
          return false // 오늘 생성된 투두는 이월 대상이 아님
        }

        // visible_dates에 오늘 날짜가 이미 있으면 제외
        const visibleDates = todo.visible_dates || []
        if (visibleDates.includes(todayStr)) {
          return false
        }

        // hidden_dates에 오늘 날짜가 있으면 제외 (숨김 처리된 경우)
        const hiddenDates = todo.hidden_dates || []
        if (hiddenDates.includes(todayStr)) {
          return false
        }

        return true
      })

      // 이월 대상 투두의 visible_dates에 오늘 날짜 추가
      for (const todo of todosToCarryOver) {
        const updatedVisibleDates = [...(todo.visible_dates || []), todayStr]

        const { error: updateError } = await supabase
          .from('todos')
          .update({ visible_dates: updatedVisibleDates })
          .eq('id', todo.id)

        if (updateError) {
          console.error(`투두 ${todo.id} 이월 오류:`, updateError.message)
        }
      }
    } catch (error) {
      console.error('투두 이월 오류:', error.message)
    } finally {
      // 이월 작업 완료 플래그 해제
      carryOverInProgress.current = false
    }
  }

  // 특정 날짜의 루틴 작업 자동 생성
  const createRoutineTodosForDate = async (dateStr) => {
    // 이미 생성 중이면 중복 실행 방지
    if (routineCreationInProgress.current.has(dateStr)) {
      return
    }

    try {
      // 생성 시작 플래그 설정
      routineCreationInProgress.current.add(dateStr)

      const targetDate = new Date(dateStr)
      const dayKey = getDayKey(targetDate.getDay())

      const { data: allRoutines, error: routineError } = await supabase
        .from('routines')
        .select('*')
        .eq('deleted', false)

      if (routineError) throw routineError

      const matchingRoutines = allRoutines.filter(routine => {
        const days = routine.days || []
        // days가 비어있으면 매일 반복 (미정 루틴), 아니면 해당 요일만
        const hasMatchingDay = days.length === 0 || days.includes(dayKey)

        // start_date가 있는 경우, 현재 날짜가 시작일 이후인지 확인
        if (routine.start_date) {
          const startDate = new Date(routine.start_date)
          const isAfterStartDate = targetDate >= startDate
          return hasMatchingDay && isAfterStartDate
        }

        // start_date가 없는 경우 (기존 루틴), 요일만 체크
        return hasMatchingDay
      })

      if (matchingRoutines.length === 0) return

      for (const routine of matchingRoutines) {
        const todoText = routine.text

        // JSON 방식: 해당 루틴의 기존 투두 찾기 (중복 방지를 위해 배열로 받기)
        const { data: existingTodos, error: checkError } = await supabase
          .from('todos')
          .select('*')
          .eq('routine_id', routine.id)
          .eq('deleted', false)

        if (checkError) throw checkError

        // 중복이 있으면 첫 번째 것만 사용하고 나머지는 삭제
        if (existingTodos && existingTodos.length > 1) {
          console.warn(`루틴 ${routine.id}에 중복 투두 발견 (${existingTodos.length}개). 첫 번째만 유지하고 나머지 삭제.`)
          for (let i = 1; i < existingTodos.length; i++) {
            await supabase
              .from('todos')
              .update({ deleted: true, deleted_date: new Date().toISOString() })
              .eq('id', existingTodos[i].id)
          }
        }

        const existingTodo = existingTodos && existingTodos.length > 0 ? existingTodos[0] : null

        if (existingTodo) {
          // 기존 투두가 있으면 visible_dates에 날짜 추가
          const currentDates = existingTodo.visible_dates || []

          // 이미 포함되어 있으면 스킵
          if (currentDates.includes(dateStr)) {
            continue
          }

          // visible_dates에 날짜 추가 (정렬된 상태 유지)
          const updatedDates = [...currentDates, dateStr].sort()

          const { error: updateError } = await supabase
            .from('todos')
            .update({ visible_dates: updatedDates })
            .eq('id', existingTodo.id)

          if (updateError) {
            console.error('루틴 투두 날짜 추가 오류:', updateError.message)
          }
        } else {
          // 첫 루틴 투두 생성
          const { error: insertError } = await supabase
            .from('todos')
            .insert([{
              text: todoText,
              completed: false,
              date: dateStr, // created_date 역할
              visible_dates: [dateStr], // JSON 방식
              hidden_dates: [],
              order_index: 0, // 루틴은 제일 위에
              routine_id: routine.id,
              user_id: session?.user?.id
            }])

          if (insertError) {
            console.error('루틴 투두 생성 오류:', insertError.message)
          }
        }
      }
    } catch (error) {
      console.error('루틴 작업 생성 오류:', error.message)
    } finally {
      // 생성 완료 후 플래그 해제 (1초 후 - 다른 실행도 완료될 시간)
      setTimeout(() => {
        routineCreationInProgress.current.delete(dateStr)
      }, 1000)
    }
  }

  // 오늘 요일의 루틴 작업 자동 생성 (자정용)
  const createRoutineTodos = async () => {
    const today = new Date()
    const todayStr = formatDateForDB(today)
    await createRoutineTodosForDate(todayStr)
  }

  // 루틴 히스토리 조회
  const fetchRoutineHistory = async (routine) => {
    try {
      // JSON 방식: 해당 루틴의 투두 조회 (중복 방지)
      const { data: routineTodos, error } = await supabase
        .from('todos')
        .select('*')
        .eq('routine_id', routine.id)
        .eq('deleted', false)

      if (error) throw error

      // 중복이 있으면 첫 번째 것만 사용
      const routineTodo = routineTodos && routineTodos.length > 0 ? routineTodos[0] : null

      if (routineTodo && routineTodo.visible_dates) {
        // visible_dates 배열을 날짜별 객체 배열로 변환
        const historyData = routineTodo.visible_dates
          .sort() // 날짜 정렬
          .map(date => ({
            id: `${routineTodo.id}-${date}`, // 고유 ID 생성
            date,
            text: routineTodo.text,
            completed: routineTodo.completed, // TODO: 날짜별 완료 상태 추적 필요
            routine_id: routineTodo.routine_id
          }))

        setRoutineHistoryData(historyData)
      } else {
        setRoutineHistoryData([])
      }

      setSelectedRoutineForHistory(routine)
      setShowRoutineHistory(true)
    } catch (error) {
      console.error('루틴 히스토리 조회 오류:', error.message)
      alert('루틴 히스토리 조회 실패: ' + error.message)
    }
  }

  const handleCloseRoutineHistory = () => {
    setShowRoutineHistory(false)
    setSelectedRoutineForHistory(null)
    setRoutineHistoryData([])
  }

  // 루틴 모달 열기/닫기
  const handleOpenRoutine = () => {
    setShowRoutineModal(true)
    fetchRoutines()
  }

  const handleCloseRoutine = () => {
    setShowRoutineModal(false)
    setRoutineInput('')
    setSelectedDays([])
  }

  const handleToggleDay = (dayKey) => {
    setSelectedDays(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  // 스크롤바 표시 제어
  useEffect(() => {
    let scrollTimer = null

    const handleScroll = () => {
      // 스크롤 시작 시 클래스 추가
      document.body.classList.add('is-scrolling')

      // 기존 타이머 클리어
      if (scrollTimer) {
        clearTimeout(scrollTimer)
      }

      // 1초 후 클래스 제거
      scrollTimer = setTimeout(() => {
        document.body.classList.remove('is-scrolling')
      }, 1000)
    }

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimer) {
        clearTimeout(scrollTimer)
      }
    }
  }, [])

  // 앱 시작 시 루틴 목록 가져오기
  useEffect(() => {
    if (!session) return
    fetchRoutines()
  }, [session])

  // 앱 시작 시 격려 메시지 가져오기
  useEffect(() => {
    if (!session) return
    fetchEncouragementMessages()
  }, [session])

  // 앱 시작 시 생각 메모 가져오기
  useEffect(() => {
    if (!session) return
    fetchMemoContent()
  }, [session])

  // 앱 시작 시 주요 생각정리 가져오기 및 오래된 히스토리 정리
  useEffect(() => {
    if (!session) return
    fetchKeyThoughtsContent()
    cleanupOldHistory() // 하루에 한 번만 실행됨
  }, [session])

  // 주요 생각정리 블록 변경 시 자동 저장
  useEffect(() => {
    if (!session) return // 로그인하지 않은 경우 저장하지 않음

    const timer = setTimeout(() => {
      if (keyThoughtsBlocks.length > 0) {
        handleSaveKeyThoughts()
      }
    }, AUTO_SAVE_DELAY) // 1초 디바운스

    return () => clearTimeout(timer)
  }, [keyThoughtsBlocks, session])

  // 앱 시작 시 섹션 순서 가져오기
  useEffect(() => {
    if (!session) return
    fetchSectionOrder()
  }, [session])

  // 앱 시작 시 과거 미완료 항목을 오늘로 이월
  // ⚠️ 구 방식(복사 기반) 이월 로직 - 비활성화됨
  // 새 방식(JSON 기반)만 사용하도록 변경
  // useEffect(() => {
  //   movePastIncompleteTodosToToday()
  // }, [])

  // 격려 메시지가 로드되면 초기 메시지 설정
  useEffect(() => {
    if (encouragementMessages.length > 0 && !currentEncouragementMessage) {
      setCurrentEncouragementMessage(getRandomEncouragement())
    }
  }, [encouragementMessages])

  // TODO: 가로 스크롤 elastic bounce 효과 - 나중에 다시 시도
  // 현재 브라우저 호환성 이슈로 비활성화됨
  // 트렐로 스타일의 고무줄 효과를 구현하려고 했으나 동작하지 않음
  // 다른 라이브러리 사용이나 다른 접근 방법 고려 필요
  /*
  useEffect(() => {
    if (viewMode !== 'horizontal' || !sectionsContainerRef.current) return

    const container = sectionsContainerRef.current
    let isOverscrolling = false
    let overscrollAmount = 0
    let animationFrameId = null

    const handleWheel = (e) => {
      const { scrollLeft, scrollWidth, clientWidth } = container
      const atStart = scrollLeft <= 0
      const atEnd = scrollLeft >= scrollWidth - clientWidth - 1

      if ((atStart && e.deltaX < 0) || (atEnd && e.deltaX > 0)) {
        e.preventDefault()
        isOverscrolling = true
        overscrollAmount += e.deltaX * 0.3 // 탄성 계수

        // 최대 이동 거리 제한
        overscrollAmount = Math.max(-100, Math.min(100, overscrollAmount))

        // Transform 적용
        container.style.transform = `translateX(${-overscrollAmount}px)`
        container.style.transition = 'none'

        // 자동으로 복귀
        if (animationFrameId) cancelAnimationFrame(animationFrameId)
        animationFrameId = requestAnimationFrame(() => {
          setTimeout(() => {
            container.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            container.style.transform = 'translateX(0)'
            overscrollAmount = 0
            isOverscrolling = false
          }, 50)
        })
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [viewMode])
  */

  // 가로/세로 레이아웃에서 드래그로 스크롤 기능 + elastic bounce
  useEffect(() => {
    if (!sectionsContainerRef.current) return

    const container = sectionsContainerRef.current
    const isHorizontal = viewMode === 'horizontal'
    let isDown = false
    let startPos = 0
    let scrollPos = 0
    let bounceOffset = 0
    let animationFrame = null

    const getEventPos = (e) => {
      if (e.type.includes('touch')) {
        return isHorizontal ? e.touches[0].pageX : e.touches[0].pageY
      }
      return isHorizontal ? e.pageX : e.pageY
    }

    const handlePointerDown = (e) => {
      // section-block 위에서는 그랩 스크롤 비활성화
      if (e.target.closest('.section-block')) return

      isDown = true
      startPos = getEventPos(e)
      scrollPos = isHorizontal ? container.scrollLeft : container.scrollTop
      if (animationFrame) {
        cancelAnimationFrame(animationFrame)
        animationFrame = null
      }
      container.style.transition = 'none'
      container.style.transform = isHorizontal ? 'translateX(0)' : 'translateY(0)'
      bounceOffset = 0
    }

    const handlePointerLeave = () => {
      if (isDown && bounceOffset !== 0) {
        container.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        container.style.transform = isHorizontal ? 'translateX(0)' : 'translateY(0)'
        setTimeout(() => {
          container.style.transition = 'none'
          bounceOffset = 0
        }, 300)
      }
      isDown = false
    }

    const handlePointerUp = () => {
      if (bounceOffset !== 0) {
        container.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        container.style.transform = isHorizontal ? 'translateX(0)' : 'translateY(0)'
        setTimeout(() => {
          container.style.transition = 'none'
          bounceOffset = 0
        }, 300)
      }
      isDown = false
    }

    const handlePointerMove = (e) => {
      if (!isDown) return
      e.preventDefault()

      const pos = getEventPos(e)
      const walk = (pos - startPos) * 1.5
      const newScrollPos = scrollPos - walk

      const maxScroll = isHorizontal
        ? container.scrollWidth - container.clientWidth
        : container.scrollHeight - container.clientHeight

      if (newScrollPos < 0) {
        const overscroll = -newScrollPos
        bounceOffset = Math.min(overscroll * 0.3, 100)
        if (isHorizontal) {
          container.scrollLeft = 0
          container.style.transform = `translateX(${bounceOffset}px)`
        } else {
          container.scrollTop = 0
          container.style.transform = `translateY(${bounceOffset}px)`
        }
      } else if (newScrollPos > maxScroll) {
        const overscroll = newScrollPos - maxScroll
        bounceOffset = -Math.min(overscroll * 0.3, 100)
        if (isHorizontal) {
          container.scrollLeft = maxScroll
          container.style.transform = `translateX(${bounceOffset}px)`
        } else {
          container.scrollTop = maxScroll
          container.style.transform = `translateY(${bounceOffset}px)`
        }
      } else {
        bounceOffset = 0
        container.style.transform = isHorizontal ? 'translateX(0)' : 'translateY(0)'
        if (isHorizontal) {
          container.scrollLeft = newScrollPos
        } else {
          container.scrollTop = newScrollPos
        }
      }
    }

    // section-block 위에서 가로 휠 스크롤 방지
    const handleWheel = (e) => {
      if (isHorizontal && e.target.closest('.section-block') && e.deltaX !== 0) {
        e.preventDefault()
      }
    }

    // 마우스 이벤트
    container.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('mouseup', handlePointerUp)
    document.addEventListener('mouseleave', handlePointerLeave)
    container.addEventListener('mousemove', handlePointerMove)

    // 터치 이벤트
    container.addEventListener('touchstart', handlePointerDown, { passive: true })
    container.addEventListener('touchmove', handlePointerMove, { passive: false })
    container.addEventListener('touchend', handlePointerUp)
    container.addEventListener('touchcancel', handlePointerUp)

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('mouseup', handlePointerUp)
      document.removeEventListener('mouseleave', handlePointerLeave)
      container.removeEventListener('mousemove', handlePointerMove)

      container.removeEventListener('touchstart', handlePointerDown)
      container.removeEventListener('touchmove', handlePointerMove)
      container.removeEventListener('touchend', handlePointerUp)
      container.removeEventListener('touchcancel', handlePointerUp)

      container.removeEventListener('wheel', handleWheel)
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [viewMode, todos, routines])

  // 모바일 섹션 스크롤 감지 (페이지네이션 dots용)
  useEffect(() => {
    if (viewMode !== 'horizontal' || !sectionsContainerRef.current) return

    const container = sectionsContainerRef.current
    const handleScroll = () => {
      const sections = container.querySelectorAll('.section-block')
      if (sections.length === 0) return

      const containerRect = container.getBoundingClientRect()
      const containerCenter = containerRect.left + containerRect.width / 2

      let closestIndex = 0
      let closestDistance = Infinity

      sections.forEach((section, index) => {
        const sectionRect = section.getBoundingClientRect()
        const sectionCenter = sectionRect.left + sectionRect.width / 2
        const distance = Math.abs(sectionCenter - containerCenter)

        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = index
        }
      })

      setCurrentSectionIndex(closestIndex)
    }

    container.addEventListener('scroll', handleScroll)
    handleScroll() // 초기 상태 설정

    return () => container.removeEventListener('scroll', handleScroll)
  }, [viewMode, todos, routines])

  // 세로 스크롤 드래그 기능 (content-scrollable)
  useEffect(() => {
    if (!contentScrollableRef.current) return

    const container = contentScrollableRef.current
    let isDown = false
    let startY = 0
    let scrollTop = 0
    let bounceOffset = 0

    const handleMouseDown = (e) => {
      // 섹션 블록 내부 클릭은 제외
      const isClickOnSection = e.target.closest('.section-block')
      if (isClickOnSection) return

      isDown = true
      startY = e.pageY
      scrollTop = container.scrollTop
      container.style.transition = 'none'
      container.style.transform = 'translateY(0)'
      bounceOffset = 0
    }

    const handleMouseLeave = () => {
      if (isDown && bounceOffset !== 0) {
        container.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        container.style.transform = 'translateY(0)'
        setTimeout(() => {
          container.style.transition = 'none'
          bounceOffset = 0
        }, 300)
      }
      isDown = false
    }

    const handleMouseUp = () => {
      if (bounceOffset !== 0) {
        container.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        container.style.transform = 'translateY(0)'
        setTimeout(() => {
          container.style.transition = 'none'
          bounceOffset = 0
        }, 300)
      }
      isDown = false
    }

    const handleMouseMove = (e) => {
      if (!isDown) return
      e.preventDefault()

      const y = e.pageY
      const walk = (y - startY) * 1.5
      const newScrollTop = scrollTop - walk
      const maxScroll = container.scrollHeight - container.clientHeight

      if (newScrollTop < 0) {
        const overscroll = -newScrollTop
        bounceOffset = Math.min(overscroll * 0.3, 100)
        container.scrollTop = 0
        container.style.transform = `translateY(${bounceOffset}px)`
      } else if (newScrollTop > maxScroll) {
        const overscroll = newScrollTop - maxScroll
        bounceOffset = -Math.min(overscroll * 0.3, 100)
        container.scrollTop = maxScroll
        container.style.transform = `translateY(${bounceOffset}px)`
      } else {
        bounceOffset = 0
        container.style.transform = 'translateY(0)'
        container.scrollTop = newScrollTop
      }
    }

    container.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('mouseleave', handleMouseLeave)
    container.addEventListener('mousemove', handleMouseMove)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('mouseleave', handleMouseLeave)
      container.removeEventListener('mousemove', handleMouseMove)
    }
  }, [todos, routines])

  // 간트차트 기간이 변경되면 데이터 다시 로드
  useEffect(() => {
    if (showGanttChart) {
      fetchGanttData()
    }
  }, [ganttPeriod])

  // 자정에 날짜 자동 업데이트 및 루틴 생성
  useEffect(() => {
    const checkMidnight = async () => {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      const timeUntilMidnight = midnight.getTime() - now.getTime()

      const timer = setTimeout(async () => {
        const yesterday = new Date(now)
        const tomorrow = new Date(now)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // 전날 미완료 항목을 다음 날로 이동
        await moveIncompleteTodosToNextDay(yesterday, tomorrow)

        // 루틴 작업 생성
        await createRoutineTodos()

        // 날짜 업데이트
        setSelectedDate(new Date())
        checkMidnight() // 다음 자정을 위해 재귀 호출
      }, timeUntilMidnight)

      return timer
    }

    const timer = checkMidnight()
    return () => clearTimeout(timer)
  }, [])

  // 선택된 날짜가 변경될 때마다 할 일 목록 가져오기
  useEffect(() => {
    fetchTodos()

    // Supabase Realtime 구독
    const dateStr = formatDateForDB(selectedDate)
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'todos',
          filter: `date=eq.${dateStr}`
        },
        (payload) => {

          if (payload.eventType === 'INSERT') {
            // 새 항목 추가
            setTodos(currentTodos => {
              // 중복 체크
              if (currentTodos.some(t => t.id === payload.new.id)) {
                return currentTodos
              }
              // order_index에 따라 정렬된 위치에 삽입
              const newTodos = [...currentTodos, payload.new]
              return newTodos.sort((a, b) => a.order_index - b.order_index)
            })
          } else if (payload.eventType === 'UPDATE') {
            // 항목 업데이트 (단, 최근에 로컬에서 수정한 항목은 무시)
            setTodos(currentTodos => {
              // 최근에 수정한 항목인지 확인
              if (recentlyEditedIds.current.has(payload.new.id)) {
                return currentTodos
              }
              return currentTodos.map(todo =>
                todo.id === payload.new.id ? payload.new : todo
              ).sort((a, b) => a.order_index - b.order_index)
            })
          } else if (payload.eventType === 'DELETE') {
            // 항목 삭제
            setTodos(currentTodos =>
              currentTodos.filter(todo => todo.id !== payload.old.id)
            )
          }
        }
      )
      .subscribe((status) => {
      })

    // 컴포넌트 언마운트 또는 날짜 변경 시 구독 해제
    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDate])

  // 드래그 중 스크롤 차단
  useEffect(() => {
    if (isDraggingAny) {
      // 현재 스크롤 위치 저장
      const scrollY = window.scrollY
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth

      // body에 overflow hidden 적용 (스크롤바 너비 보상)
      document.body.style.overflow = 'hidden'
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.left = '0'
      document.body.style.right = '0'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }

      return () => {
        // 스크롤 복원
        document.body.style.overflow = ''
        document.body.style.position = ''
        document.body.style.top = ''
        document.body.style.left = ''
        document.body.style.right = ''
        document.body.style.paddingRight = ''
        window.scrollTo(0, scrollY)
      }
    }
  }, [isDraggingAny])

  // 격려 메시지 가져오기
  const fetchEncouragementMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('encouragement_messages')
        .select('*')
        .order('order_index', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        const messages = data.map(item => item.message)
        setEncouragementMessages(messages)
        // 현재 메시지가 없으면 첫 번째 메시지로 설정
        if (!currentEncouragementMessage) {
          setCurrentEncouragementMessage(messages[0])
        }
      }
    } catch (error) {
      console.error('격려 메시지 가져오기 오류:', error.message)
    }
  }

  // 격려 메시지 추가
  const addEncouragementMessage = async (message) => {
    try {
      // 현재 최대 order_index 찾기
      const { data: existingMessages } = await supabase
        .from('encouragement_messages')
        .select('order_index')
        .order('order_index', { ascending: false })
        .limit(1)

      const maxOrder = existingMessages && existingMessages.length > 0
        ? existingMessages[0].order_index
        : 0

      const { error } = await supabase
        .from('encouragement_messages')
        .insert([{ message, order_index: maxOrder + 1, user_id: session?.user?.id }])

      if (error) throw error

      // 목록 새로고침
      await fetchEncouragementMessages()
    } catch (error) {
      console.error('격려 메시지 추가 오류:', error.message)
      alert('격려 메시지 추가에 실패했습니다.')
    }
  }

  // 격려 메시지 수정
  const updateEncouragementMessage = async (index, newMessage) => {
    try {
      // 현재 메시지 목록에서 해당 인덱스의 메시지 찾기
      const { data: allMessages } = await supabase
        .from('encouragement_messages')
        .select('*')
        .order('order_index', { ascending: true })

      if (!allMessages || index >= allMessages.length) {
        throw new Error('메시지를 찾을 수 없습니다.')
      }

      const targetMessage = allMessages[index]

      const { error } = await supabase
        .from('encouragement_messages')
        .update({ message: newMessage })
        .eq('id', targetMessage.id)

      if (error) throw error

      // 목록 새로고침
      await fetchEncouragementMessages()
    } catch (error) {
      console.error('격려 메시지 수정 오류:', error.message)
      alert('격려 메시지 수정에 실패했습니다.')
    }
  }

  // 격려 메시지 삭제
  const deleteEncouragementMessage = async (index) => {
    try {
      // 현재 메시지 목록에서 해당 인덱스의 메시지 찾기
      const { data: allMessages } = await supabase
        .from('encouragement_messages')
        .select('*')
        .order('order_index', { ascending: true })

      if (!allMessages || index >= allMessages.length) {
        throw new Error('메시지를 찾을 수 없습니다.')
      }

      const targetMessage = allMessages[index]

      const { error } = await supabase
        .from('encouragement_messages')
        .delete()
        .eq('id', targetMessage.id)

      if (error) throw error

      // 목록 새로고침
      await fetchEncouragementMessages()
    } catch (error) {
      console.error('격려 메시지 삭제 오류:', error.message)
      alert('격려 메시지 삭제에 실패했습니다.')
    }
  }

  const fetchTodos = async () => {
    try {
      setLoading(true)
      const dateStr = formatDateForDB(selectedDate)

      // 오늘 날짜인 경우 미완료 투두 자동 이월
      if (isToday(selectedDate)) {
        await carryOverIncompleteTodos(dateStr)
      }

      // 해당 날짜의 요일에 맞는 루틴 투두 자동 생성
      await createRoutineTodosForDate(dateStr)

      // 하이브리드 조회: 새 방식(visible_dates) + 구 방식(date) 모두 지원
      // TODO: 3단계 완료 후 서버 사이드 필터링으로 최적화
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)
        .order('order_index', { ascending: true })

      if (error) throw error

      // 클라이언트 사이드 필터링
      const filteredTodos = (data || []).filter(todo => {
        // hidden_dates 체크 (새 방식, 구 방식 모두 적용)
        const isHidden = todo.hidden_dates && Array.isArray(todo.hidden_dates) && todo.hidden_dates.includes(dateStr)
        if (isHidden) {
          return false // 숨김 처리된 투두는 표시하지 않음
        }

        // 새 방식: visible_dates에 현재 날짜가 포함되어 있는지 확인
        if (todo.visible_dates && Array.isArray(todo.visible_dates) && todo.visible_dates.length > 0) {
          const isVisible = todo.visible_dates.includes(dateStr)
          return isVisible
        }

        // 구 방식 (하위 호환): visible_dates가 없거나 빈 배열이면 date 컬럼 사용
        return todo.date === dateStr
      })

      setTodos(filteredTodos)
    } catch (error) {
      console.error('할 일 가져오기 오류:', error.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchTrash = async () => {
    try {
      // 모든 삭제된 항목 가져오기 (날짜 구분 없이 통합)
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('deleted', true)
        .order('deleted_date', { ascending: false })  // 최근 삭제된 순으로 정렬

      if (error) throw error
      setTrashedItems(data || [])
    } catch (error) {
      console.error('휴지통 가져오기 오류:', error.message)
    }
  }

  const handleAddTodo = async () => {
    if (inputValue.trim() === '' || isAdding) return

    try {
      setIsAdding(true)

      // 새 항목은 맨 아래에 추가
      const newOrderIndex = todos.length > 0 ? Math.max(...todos.map(t => t.order_index)) + 1 : 1

      // 새 항목을 추가 (JSON 방식)
      const dateStr = formatDateForDB(selectedDate)
      const { data, error } = await supabase
        .from('todos')
        .insert([{
          text: inputValue,
          completed: false,
          order_index: newOrderIndex,
          date: dateStr,
          visible_dates: [dateStr], // JSON 방식: 현재 날짜를 배열로 설정
          hidden_dates: [],
          user_id: session?.user?.id
        }])
        .select()

      if (error) throw error

      // 로컬 상태 업데이트
      setTodos([...todos, data[0]])
      setInputValue('')
    } catch (error) {
      console.error('할 일 추가 오류:', error.message)
    } finally {
      setIsAdding(false)
    }
  }

  const handleAddRoutineTodo = async () => {
    if (routineInputValue.trim() === '' || isAdding) return

    try {
      setIsAdding(true)

      const dateStr = formatDateForDB(selectedDate)

      // 1. 빈 배열로 루틴 생성 (매일 반복)
      const { data: routineData, error: routineError } = await supabase
        .from('routines')
        .insert([{
          text: routineInputValue,
          days: [], // 빈 배열 = 매일 반복
          start_date: dateStr,
          user_id: session?.user?.id
        }])
        .select()

      if (routineError) throw routineError

      const newRoutine = routineData[0]

      // 2. 미정 루틴 투두들의 최대 order_index 찾기
      const pendingRoutineTodos = todos.filter(t => !t.parent_id && t.is_pending_routine)
      const newOrderIndex = pendingRoutineTodos.length > 0 ? Math.max(...pendingRoutineTodos.map(t => t.order_index)) + 1 : 1

      // 3. 투두 생성 (루틴 ID 연결, 미정 표시 유지)
      const { data: todoData, error: todoError } = await supabase
        .from('todos')
        .insert([{
          text: routineInputValue,
          completed: false,
          order_index: newOrderIndex,
          date: dateStr,
          visible_dates: [dateStr],
          hidden_dates: [],
          routine_id: newRoutine.id, // 루틴 ID 연결
          is_pending_routine: true, // 미정 루틴으로 표시 (요일 미설정)
          user_id: session?.user?.id
        }])
        .select()

      if (todoError) throw todoError

      // 4. 로컬 상태 업데이트
      setRoutines([newRoutine, ...routines])
      setTodos([...todos, todoData[0]])
      setRoutineInputValue('')
    } catch (error) {
      console.error('할 일 추가 오류:', error.message)
    } finally {
      setIsAdding(false)
    }
  }

  const handleAddNormalTodo = async () => {
    if (normalInputValue.trim() === '' || isAdding) return

    try {
      setIsAdding(true)

      // 일반 투두들의 최대 order_index 찾기
      const normalTodos = todos.filter(t => !t.parent_id && t.routine_id === null)
      const newOrderIndex = normalTodos.length > 0 ? Math.max(...normalTodos.map(t => t.order_index)) + 1 : 1

      // 새 항목을 추가 (JSON 방식)
      const dateStr = formatDateForDB(selectedDate)
      const { data, error } = await supabase
        .from('todos')
        .insert([{
          text: normalInputValue,
          completed: false,
          order_index: newOrderIndex,
          date: dateStr,
          visible_dates: [dateStr],
          hidden_dates: [],
          user_id: session?.user?.id
        }])
        .select()

      if (error) throw error

      // 로컬 상태 업데이트
      setTodos([...todos, data[0]])
      setNormalInputValue('')
    } catch (error) {
      console.error('할 일 추가 오류:', error.message)
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggleTodo = async (id) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    try {
      const newCompleted = !todo.completed
      const completedAt = newCompleted ? new Date().toISOString() : null

      // JSON 방식: 1개 투두만 업데이트 (간단!)
      const { error } = await supabase
        .from('todos')
        .update({
          completed: newCompleted,
          completed_at: completedAt
        })
        .eq('id', id)

      if (error) throw error

      setTodos(todos.map(t =>
        t.id === id ? { ...t, completed: newCompleted, completed_at: completedAt } : t
      ))
    } catch (error) {
      console.error('할 일 토글 오류:', error.message)
    }
  }

  // UI에서 투두 즉시 제거 (DB 업데이트 후 사용)
  const handleRemoveTodoFromUI = (id) => {
    setTodos(todos.filter(t => t.id !== id))
  }

  const handleDeleteTodo = async (id) => {
    // 삭제할 todo 찾기
    const todo = todos.find(t => t.id === id)
    if (!todo) return

    // visible_dates 확인 (여러 날짜에 보이는 투두인지 체크)
    // 빈 배열도 체크해야 함 (빈 배열은 truthy이므로 length 체크 필요)
    const visibleDates = (todo.visible_dates?.length > 0)
      ? todo.visible_dates
      : [todo.date || todo.created_date]

    // 구 방식(복사 기반) 이월 투두인지 확인
    const isOldStyleCarryover = todo.original_todo_id !== null && todo.original_todo_id !== undefined

    // 새 방식: 여러 날짜에 보이는 경우 OR 구 방식: 이월된 투두인 경우 → 모달 표시
    if (visibleDates.length > 1 || isOldStyleCarryover) {
      setTodoToDelete(todo)
      setShowDeleteConfirmModal(true)
    } else {
      // 단일 날짜 투두는 바로 삭제
      await executeSimpleDelete(id)
    }
  }

  // 단순 삭제 (단일 날짜 투두)
  const executeSimpleDelete = async (id) => {
    try {
      const todo = todos.find(t => t.id === id)
      if (!todo) return

      // 삭제된 todo 저장
      setDeletedTodo(todo)

      // Soft delete: deleted=true, deleted_date=오늘
      const dateStr = formatDateForDB(selectedDate)
      const { error } = await supabase
        .from('todos')
        .update({ deleted: true, deleted_date: dateStr })
        .eq('id', id)

      if (error) throw error

      // UI에서 제거
      setTodos(todos.filter(t => t.id !== id))

      // 토스트 표시
      setShowUndoToast(true)

      // 5초 후 토스트 자동 숨김
      setTimeout(() => {
        setShowUndoToast(false)
        setDeletedTodo(null)
      }, 5000)
    } catch (error) {
      console.error('할 일 삭제 오류:', error.message)
    }
  }

  // 옵션 1: 이 날짜에서만 숨김 (hidden_dates에 추가)
  const hideOnThisDateOnly = async (todo) => {
    try {
      const dateStr = formatDateForDB(selectedDate)
      const currentHiddenDates = todo.hidden_dates || []

      // hidden_dates에 현재 날짜 추가
      const newHiddenDates = [...currentHiddenDates, dateStr]

      const { error } = await supabase
        .from('todos')
        .update({ hidden_dates: newHiddenDates })
        .eq('id', todo.id)

      if (error) throw error

      // UI에서 제거
      setTodos(todos.filter(t => t.id !== todo.id))
      setShowDeleteConfirmModal(false)
      setTodoToDelete(null)
    } catch (error) {
      console.error('숨김 오류:', error.message)
    }
  }

  // 옵션 2: 완전 삭제 (deleted = true)
  const deleteCompletely = async (todo) => {
    try {
      const dateStr = formatDateForDB(selectedDate)

      const { error } = await supabase
        .from('todos')
        .update({ deleted: true, deleted_date: dateStr })
        .eq('id', todo.id)

      if (error) throw error

      // UI에서 제거
      setTodos(todos.filter(t => t.id !== todo.id))
      setShowDeleteConfirmModal(false)
      setTodoToDelete(null)
    } catch (error) {
      console.error('삭제 오류:', error.message)
    }
  }

  const handleUndoDelete = async () => {
    if (!deletedTodo) return

    try {
      // Soft delete 취소: deleted=false, deleted_date=null
      const { error } = await supabase
        .from('todos')
        .update({ deleted: false, deleted_date: null })
        .eq('id', deletedTodo.id)

      if (error) throw error

      // UI에 다시 추가
      setTodos(currentTodos => {
        const restoredTodo = { ...deletedTodo, deleted: false, deleted_date: null }
        const newTodos = [...currentTodos, restoredTodo]
        return newTodos.sort((a, b) => a.order_index - b.order_index)
      })

      // 토스트 숨김
      setShowUndoToast(false)
      setDeletedTodo(null)
    } catch (error) {
      console.error('삭제 취소 오류:', error.message)
    }
  }

  const handleRestoreFromTrash = async (id) => {
    const confirmed = window.confirm(
      '이 항목을 복원하시겠습니까?\n\n복원된 항목은 원래 날짜 페이지에서 다시 보입니다.'
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('todos')
        .update({
          deleted: false,
          deleted_date: null,
          hidden_dates: []  // 복원 시 숨김 날짜도 초기화하여 모든 날짜에서 보이게
        })
        .eq('id', id)

      if (error) throw error

      // 휴지통에서 제거
      setTrashedItems(trashedItems.filter(item => item.id !== id))

      // 일반 리스트 새로고침
      fetchTodos()

      // 성공 알림
      alert('✅ 복원되었습니다!')
    } catch (error) {
      console.error('복원 오류:', error.message)
      alert('❌ 복원 실패: ' + error.message)
    }
  }

  const handlePermanentDelete = async (id) => {
    const confirmed = window.confirm(
      '⚠️ 정말로 이 항목을 영구적으로 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.'
    )

    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id)

      if (error) throw error

      // 휴지통에서 제거
      setTrashedItems(trashedItems.filter(item => item.id !== id))

      // 성공 알림
      alert('🗑️ 영구적으로 삭제되었습니다.')
    } catch (error) {
      console.error('영구 삭제 오류:', error.message)
      alert('❌ 영구 삭제 실패: ' + error.message)
    }
  }

  const handleEmptyTrash = async () => {
    if (trashedItems.length === 0) return

    const confirmed = window.confirm(
      `⚠️ 정말로 휴지통을 비우시겠습니까?\n\n${trashedItems.length}개의 항목이 영구적으로 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.`
    )

    if (!confirmed) return

    try {
      // 모든 휴지통 항목의 ID 수집
      const idsToDelete = trashedItems.map(item => item.id)

      // 한 번에 모두 삭제
      const { error } = await supabase
        .from('todos')
        .delete()
        .in('id', idsToDelete)

      if (error) throw error

      // UI 업데이트
      setTrashedItems([])
      alert(`✅ ${idsToDelete.length}개의 항목이 영구 삭제되었습니다.`)
    } catch (error) {
      console.error('휴지통 비우기 오류:', error.message)
      alert('❌ 휴지통 비우기 실패: ' + error.message)
    }
  }

  const handleOpenTrash = () => {
    setShowTrashModal(true)
    fetchTrash()
  }

  const handleCloseTrash = () => {
    setShowTrashModal(false)
  }

  // 간트차트 관련 함수
  const handleOpenGanttChart = async () => {
    setShowGanttChart(true)
    await fetchGanttData()
  }

  const handleCloseGanttChart = () => {
    setShowGanttChart(false)
    setGanttData([])
  }

  // 투두 히스토리 모달
  const handleOpenTodoHistoryModal = async (todo) => {
    setSelectedTodoForModal(todo)

    // 히스토리 데이터 가져오기
    try {
      const { data, error } = await supabase
        .from('todo_history')
        .select('*')
        .eq('todo_id', todo.id)
        .order('changed_at', { ascending: false })

      if (error) throw error

      // todoHistory 객체 업데이트
      setTodoHistory(prev => ({
        ...prev,
        [todo.id]: data || []
      }))
    } catch (error) {
      console.error('Error fetching history:', error)
    }

    setShowTodoHistoryModal(true)
  }

  const handleCloseTodoHistoryModal = () => {
    setShowTodoHistoryModal(false)
    setSelectedTodoForModal(null)
    setExpandedHistoryIds([]) // 펼쳐진 항목 초기화
  }

  // 히스토리 세부 내용 토글
  const toggleHistoryDetail = (historyId) => {
    setExpandedHistoryIds(prev =>
      prev.includes(historyId)
        ? prev.filter(id => id !== historyId)
        : [...prev, historyId]
    )
  }

  // 투두 루틴 설정 모달
  const handleOpenTodoRoutineSetupModal = (todo) => {
    setSelectedTodoForModal(todo)

    // 기존 루틴이 있으면 요일과 시간대 설정
    const currentRoutine = routines.find(r => r.id === todo.routine_id)
    if (currentRoutine) {
      setRoutineDaysForModal(currentRoutine.days || [])
      setRoutineTimeSlotForModal(currentRoutine.time_slot || '')
      setIsEditingRoutineInModal(false) // 처음엔 보기 모드
    } else {
      setRoutineDaysForModal([])
      setRoutineTimeSlotForModal('')
      setIsEditingRoutineInModal(true) // 새로 만들 때는 편집 모드
    }

    setShowTodoRoutineSetupModal(true)
  }

  const handleCloseTodoRoutineSetupModal = () => {
    setShowTodoRoutineSetupModal(false)
    setSelectedTodoForModal(null)
    // 루틴 편집 상태 초기화
    setRoutineDaysForModal([])
    setRoutineTimeSlotForModal('')
    setIsEditingRoutineInModal(false)
  }

  // 모달에서 루틴 요일 토글
  const handleToggleRoutineDayInModal = (dayKey) => {
    setRoutineDaysForModal(prev =>
      prev.includes(dayKey)
        ? prev.filter(d => d !== dayKey)
        : [...prev, dayKey]
    )
  }

  const fetchGanttData = async () => {
    try {
      const today = new Date()
      const todayStr = formatDateForDB(today)

      // 기간 계산
      let startDate = null
      if (ganttPeriod !== 'all') {
        startDate = new Date(today)
        switch (ganttPeriod) {
          case '1week':
            startDate.setDate(today.getDate() - 7)
            break
          case '2weeks':
            startDate.setDate(today.getDate() - 14)
            break
          case '1month':
            startDate.setMonth(today.getMonth() - 1)
            break
          case '3months':
            startDate.setMonth(today.getMonth() - 3)
            break
          case '6months':
            startDate.setMonth(today.getMonth() - 6)
            break
        }
      }

      // 모든 투두 조회 (기간 필터링 포함)
      let query = supabase
        .from('todos')
        .select('*')
        .eq('deleted', false)
        .is('routine_id', null) // 루틴 투두 제외
        .order('created_at', { ascending: true })

      if (startDate) {
        query = query.gte('date', formatDateForDB(startDate))
      }

      const { data: allTodos, error } = await query

      if (error) throw error

      // original_todo_id로 그룹화 (같은 투두의 이월 버전들)
      const groupedByOriginal = {}

      for (const todo of allTodos || []) {
        // 원본 ID 결정 (original_todo_id가 있으면 그것, 없으면 자신의 id)
        const originalId = todo.original_todo_id || todo.id

        if (!groupedByOriginal[originalId]) {
          groupedByOriginal[originalId] = []
        }
        groupedByOriginal[originalId].push(todo)
      }

      // 배열로 변환하고 생성일 순서대로 정렬
      const ganttItems = Object.entries(groupedByOriginal).map(([originalId, todos]) => {
        // 날짜순 정렬
        const sortedTodos = todos.sort((a, b) => new Date(a.date) - new Date(b.date))
        const firstTodo = sortedTodos[0]

        // 모든 날짜 추출
        const allDates = sortedTodos.map(t => t.date)

        // 완료 날짜 찾기 (completed_at이 있는 투두에서 추출)
        let completedDate = null
        for (const todo of sortedTodos) {
          if (todo.completed && todo.completed_at) {
            const completedAtDate = new Date(todo.completed_at)
            completedDate = formatDateForDB(completedAtDate)
            break
          }
        }

        // 오늘 날짜에 있는 투두 찾기 (완료 여부 확인용)
        const todayTodo = sortedTodos.find(t => t.date === todayStr)

        return {
          text: firstTodo.text,
          originalId: parseInt(originalId),
          createdAt: firstTodo.created_at,
          startDate: allDates[0],
          endDate: allDates[allDates.length - 1],
          dates: allDates,
          completed: todayTodo?.completed || false,
          completedDate: completedDate
        }
      }).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

      setGanttData(ganttItems)
    } catch (error) {
      console.error('간트차트 데이터 조회 오류:', error.message)
    }
  }

  // 메모 관련 함수
  const handleOpenMemo = async () => {
    setShowMemoModal(true)
    await fetchMemoContent()
  }

  const handleCloseMemo = () => {
    setShowMemoModal(false)
    setIsEditingMemo(false)
    setMemoContent(memoOriginalContent) // 취소 시 원래 내용으로 복원
  }

  const fetchMemoContent = async () => {
    try {
      const { data, error } = await supabase
        .from('spec_memos')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      const content = data && data.length > 0 ? data[0].content : DEFAULT_SPEC_CONTENT
      setMemoContent(content)
      setMemoOriginalContent(content)
    } catch (error) {
      console.error('메모 내용 가져오기 오류:', error.message)
      setMemoContent(DEFAULT_SPEC_CONTENT)
      setMemoOriginalContent(DEFAULT_SPEC_CONTENT)
    }
  }

  const handleEditMemo = () => {
    setIsEditingMemo(true)
  }

  const handleStartEditMemoInline = () => {
    setIsEditingMemoInline(true)
    setMemoOriginalContent(memoContent)
    // textarea에 포커스
    setTimeout(() => {
      if (memoTextareaRef.current) {
        memoTextareaRef.current.focus()
      }
    }, 0)
  }

  const handleSaveMemoInline = async () => {
    if (isSavingMemo) return

    try {
      setIsSavingMemo(true)

      // 기존 메모가 있는지 확인
      const { data: existingMemo } = await supabase
        .from('spec_memos')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

      if (existingMemo && existingMemo.length > 0) {
        // 업데이트
        await supabase
          .from('spec_memos')
          .update({ content: memoContent, updated_at: new Date().toISOString() })
          .eq('id', existingMemo[0].id)
      } else {
        // 신규 생성
        await supabase
          .from('spec_memos')
          .insert([{ content: memoContent, user_id: session?.user?.id }])
      }

      setMemoOriginalContent(memoContent)
      setIsEditingMemoInline(false)
    } catch (error) {
      console.error('메모 저장 오류:', error.message)
      alert('메모 저장에 실패했습니다.')
    } finally {
      setIsSavingMemo(false)
    }
  }

  const handleCancelEditMemoInline = () => {
    setMemoContent(memoOriginalContent)
    setIsEditingMemoInline(false)
  }

  const handleMemoKeyDown = (e) => {
    // Cmd/Ctrl+S to save
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSaveMemoInline()
    }
    // Esc to cancel
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEditMemoInline()
    }
  }

  // 주요 생각정리 관련 함수들
  // 블록 데이터를 정규화하여 children이 항상 배열이 되도록 보장
  const normalizeBlocks = (blocks) => {
    if (!Array.isArray(blocks)) return []
    return blocks.map(block => ({
      ...block,
      children: Array.isArray(block.children) ? normalizeBlocks(block.children) : []
    }))
  }

  const fetchKeyThoughtsContent = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('setting_key', 'key_thoughts_blocks')
        .maybeSingle()

      if (error) {
        console.error('주요 생각정리 불러오기 오류:', error.message)
        return
      }

      if (data && data.setting_value) {
        const blocks = normalizeBlocks(JSON.parse(data.setting_value))
        setKeyThoughtsBlocks(blocks)
        localStorage.setItem('keyThoughtsBlocks', JSON.stringify(blocks))
        // 초기 로드 시 마지막 저장 상태로 설정
        lastSavedKeyThoughtsRef.current = JSON.parse(JSON.stringify(blocks))
      } else {
        const saved = localStorage.getItem('keyThoughtsBlocks')
        if (saved) {
          const blocks = normalizeBlocks(JSON.parse(saved))
          setKeyThoughtsBlocks(blocks)
          // 초기 로드 시 마지막 저장 상태로 설정
          lastSavedKeyThoughtsRef.current = JSON.parse(JSON.stringify(blocks))
        }
      }
    } catch (error) {
      console.error('주요 생각정리 불러오기 오류:', error.message)
      const saved = localStorage.getItem('keyThoughtsBlocks')
      if (saved) {
        const blocks = normalizeBlocks(JSON.parse(saved))
        setKeyThoughtsBlocks(blocks)
        // 초기 로드 시 마지막 저장 상태로 설정
        lastSavedKeyThoughtsRef.current = JSON.parse(JSON.stringify(blocks))
      }
    }
  }

  const handleSaveKeyThoughts = async () => {
    if (!session?.user?.id) return // 로그인하지 않은 경우 저장하지 않음

    try {
      localStorage.setItem('keyThoughtsBlocks', JSON.stringify(keyThoughtsBlocks))

      const { data: existing, error: selectError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('setting_key', 'key_thoughts_blocks')
        .maybeSingle()

      if (selectError) {
        console.error('주요 생각정리 조회 오류:', selectError.message)
        return
      }

      if (existing) {
        await supabase
          .from('user_settings')
          .update({ setting_value: JSON.stringify(keyThoughtsBlocks) })
          .eq('setting_key', 'key_thoughts_blocks')
      } else {
        await supabase
          .from('user_settings')
          .insert([{
            setting_key: 'key_thoughts_blocks',
            setting_value: JSON.stringify(keyThoughtsBlocks),
            user_id: session.user.id
          }])
      }

      // 버전 히스토리 저장
      await saveKeyThoughtsVersion(keyThoughtsBlocks)
    } catch (error) {
      console.error('주요 생각정리 저장 오류:', error.message)
    }
  }

  // 큰 변경 감지: 블록 개수, 타입, 순서, 레벨, 또는 20자 이상 텍스트 변경
  const hasSignificantChange = (oldBlocks, newBlocks) => {
    if (!oldBlocks || oldBlocks.length === 0) return true // 첫 저장
    if (oldBlocks.length !== newBlocks.length) return true // 블록 개수 변경

    // 각 블록 비교 (재귀적으로)
    const compareBlocks = (oldList, newList) => {
      for (let i = 0; i < oldList.length; i++) {
        const oldBlock = oldList[i]
        const newBlock = newList[i]

        // 블록 타입 변경
        if (oldBlock.type !== newBlock.type) return true

        // 들여쓰기 레벨 변경 (부모-자식 관계 변경)
        const oldChildCount = oldBlock.children ? oldBlock.children.length : 0
        const newChildCount = newBlock.children ? newBlock.children.length : 0
        if (oldChildCount !== newChildCount) return true

        // 텍스트 20자 이상 변경
        const oldContent = oldBlock.content || ''
        const newContent = newBlock.content || ''
        if (Math.abs(oldContent.length - newContent.length) >= 20) return true

        // 자식 블록도 재귀적으로 비교
        if (newChildCount > 0) {
          if (compareBlocks(oldBlock.children, newBlock.children)) return true
        }
      }
      return false
    }

    return compareBlocks(oldBlocks, newBlocks)
  }

  // 30일 이상된 히스토리 자동 삭제 (하루에 한 번만 실행)
  const cleanupOldHistory = async () => {
    try {
      // 마지막 정리 날짜 확인
      const lastCleanup = localStorage.getItem('lastHistoryCleanup')
      const today = new Date().toDateString()

      // 오늘 이미 정리했으면 skip
      if (lastCleanup === today) {
        return
      }

      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { error } = await supabase
        .from('key_thoughts_history')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())

      if (error) {
        console.error('오래된 히스토리 삭제 오류:', error.message)
      } else {
        // 정리 성공 시 날짜 저장
        localStorage.setItem('lastHistoryCleanup', today)
        console.log('오래된 히스토리 정리 완료')
      }
    } catch (error) {
      console.error('오래된 히스토리 삭제 오류:', error.message)
    }
  }

  // 버전 히스토리 저장 (큰 변경이 있을 때만)
  const saveKeyThoughtsVersion = async (blocks) => {
    if (!session?.user?.id) return // 로그인하지 않은 경우 저장하지 않음

    try {
      // 큰 변경이 없으면 저장하지 않음
      if (!hasSignificantChange(lastSavedKeyThoughtsRef.current, blocks)) {
        return
      }

      const { error } = await supabase
        .from('key_thoughts_history')
        .insert([{
          content: blocks,
          description: '자동 저장',
          user_id: session.user.id
        }])

      if (error) {
        console.error('버전 히스토리 저장 오류:', error.message)
      } else {
        // 저장 성공하면 현재 상태를 마지막 저장 상태로 업데이트
        lastSavedKeyThoughtsRef.current = JSON.parse(JSON.stringify(blocks))
      }
    } catch (error) {
      console.error('버전 히스토리 저장 오류:', error.message)
    }
  }

  // 버전 히스토리 불러오기
  const fetchKeyThoughtsHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('key_thoughts_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50) // 최근 50개만

      if (error) {
        console.error('버전 히스토리 불러오기 오류:', error.message)
        return
      }

      setKeyThoughtsHistory(data || [])
    } catch (error) {
      console.error('버전 히스토리 불러오기 오류:', error.message)
    }
  }

  // 특정 버전으로 복구
  const restoreKeyThoughtsVersion = async (versionId) => {
    try {
      const version = keyThoughtsHistory.find(v => v.id === versionId)
      if (!version) {
        alert('해당 버전을 찾을 수 없습니다.')
        return
      }

      // 복구 전 확인
      if (!window.confirm('이 버전으로 복구하시겠습니까? 현재 내용은 새 버전으로 저장됩니다.')) {
        return
      }

      // 복구
      const restoredBlocks = normalizeBlocks(version.content)
      setKeyThoughtsBlocks(restoredBlocks)
      // 복구된 블록을 마지막 저장 상태로 설정하여 중복 히스토리 방지
      lastSavedKeyThoughtsRef.current = JSON.parse(JSON.stringify(restoredBlocks))
      await handleSaveKeyThoughts()

      alert('복구되었습니다!')
      setShowKeyThoughtsHistory(false)
    } catch (error) {
      console.error('버전 복구 오류:', error.message)
      alert('복구 중 오류가 발생했습니다.')
    }
  }

  // 섹션 순서 불러오기
  const fetchSectionOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('setting_value')
        .eq('setting_key', 'section_order')
        .maybeSingle()

      if (error) {
        console.error('섹션 순서 불러오기 오류:', error.message)
        return
      }

      if (data && data.setting_value) {
        const order = JSON.parse(data.setting_value)
        setSectionOrder(order)
        localStorage.setItem('sectionOrder', JSON.stringify(order))
      } else {
        // DB에 없으면 localStorage에서 불러오기
        const saved = localStorage.getItem('sectionOrder')
        if (saved) {
          setSectionOrder(JSON.parse(saved))
        }
      }
    } catch (error) {
      console.error('섹션 순서 불러오기 오류:', error.message)
      // 실패하면 localStorage에서 불러오기
      const saved = localStorage.getItem('sectionOrder')
      if (saved) {
        setSectionOrder(JSON.parse(saved))
      }
    }
  }

  // 섹션 순서 저장하기
  const saveSectionOrder = async (newOrder) => {
    try {
      // localStorage에 저장
      localStorage.setItem('sectionOrder', JSON.stringify(newOrder))

      // 로그인하지 않은 경우 Supabase에 저장하지 않음
      if (!session?.user?.id) return

      // Supabase에 저장
      const { data: existing, error: selectError } = await supabase
        .from('user_settings')
        .select('id')
        .eq('setting_key', 'section_order')
        .maybeSingle()

      if (selectError) {
        console.error('섹션 순서 조회 오류:', selectError.message)
        return
      }

      if (existing) {
        // 업데이트
        await supabase
          .from('user_settings')
          .update({ setting_value: JSON.stringify(newOrder), updated_at: new Date().toISOString() })
          .eq('setting_key', 'section_order')
      } else {
        // 신규 생성
        await supabase
          .from('user_settings')
          .insert([{
            setting_key: 'section_order',
            setting_value: JSON.stringify(newOrder),
            user_id: session.user.id
          }])
      }
    } catch (error) {
      console.error('섹션 순서 저장 오류:', error.message)
    }
  }

  // 섹션 이동 핸들러
  const moveSectionLeft = (sectionId) => {
    setSectionOrder((prev) => {
      const index = prev.indexOf(sectionId)
      if (index <= 0) return prev
      const newOrder = [...prev]
      ;[newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
      saveSectionOrder(newOrder)
      return newOrder
    })
  }

  const moveSectionRight = (sectionId) => {
    setSectionOrder((prev) => {
      const index = prev.indexOf(sectionId)
      if (index === -1 || index >= prev.length - 1) return prev
      const newOrder = [...prev]
      ;[newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
      saveSectionOrder(newOrder)
      return newOrder
    })
  }

  const handleSaveMemo = async () => {
    if (isSavingMemo) return

    try {
      setIsSavingMemo(true)

      // 기존 메모 데이터 가져오기
      const { data: existingData, error: fetchError } = await supabase
        .from('spec_memos')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)

      if (fetchError) throw fetchError

      if (existingData && existingData.length > 0) {
        // 업데이트
        const { error: updateError } = await supabase
          .from('spec_memos')
          .update({ content: memoContent, updated_at: new Date().toISOString() })
          .eq('id', existingData[0].id)

        if (updateError) throw updateError
      } else {
        // 새로 생성
        const { error: insertError } = await supabase
          .from('spec_memos')
          .insert([{ content: memoContent, user_id: session?.user?.id }])

        if (insertError) throw insertError
      }

      setMemoOriginalContent(memoContent)
      setIsEditingMemo(false)
    } catch (error) {
      console.error('메모 저장 오류:', error.message)
    } finally {
      setIsSavingMemo(false)
    }
  }

  const handleResetMemo = () => {
    setMemoContent(memoOriginalContent)
    setIsEditingMemo(false)
  }

  const handleFocusTodo = (id) => {
    setFocusedTodoId(focusedTodoId === id ? null : id)
  }

  const handleAddSubTodo = async (parentId, subTodoText) => {
    if (!subTodoText || subTodoText.trim() === '') return

    try {
      // 해당 부모의 서브 투두 개수 확인
      const parentSubtodos = todos.filter(t => t.parent_id === parentId)
      const newOrderIndex = parentSubtodos.length + 1

      const dateStr = formatDateForDB(selectedDate)
      const { data, error } = await supabase
        .from('todos')
        .insert([{
          text: subTodoText.trim(),
          completed: false,
          order_index: newOrderIndex,
          date: dateStr,
          parent_id: parentId,
          user_id: session?.user?.id
        }])
        .select()

      if (error) throw error

      // 로컬 상태 업데이트
      setTodos([...todos, data[0]])
    } catch (error) {
      console.error('하위 할 일 추가 오류:', error.message)
    }
  }

  const handleEditTodo = async (id, newText) => {
    try {
      let currentTodo = null

      // 수정 중인 ID로 표시 (Realtime UPDATE 무시하기 위함)
      recentlyEditedIds.current.add(id)

      // 먼저 로컬 상태 업데이트 (즉각적인 UI 반영) - 함수형 업데이트 사용
      const now = new Date().toISOString()
      setTodos(prevTodos => {
        currentTodo = prevTodos.find(t => t.id === id)
        if (!currentTodo || currentTodo.text === newText) {
          recentlyEditedIds.current.delete(id)
          return prevTodos
        }
        return prevTodos.map(todo =>
          todo.id === id ? { ...todo, text: newText, updated_at: now } : todo
        )
      })

      if (!currentTodo || currentTodo.text === newText) return

      // 히스토리에 변경 기록 추가 (어떤 날짜 페이지에서 변경되었는지도 기록)
      const { error: historyError } = await supabase
        .from('todo_history')
        .insert([{
          todo_id: id,
          previous_text: currentTodo.text,
          new_text: newText,
          changed_on_date: currentTodo.date,
          user_id: session?.user?.id
        }])

      if (historyError) {
        console.error('히스토리 저장 오류:', historyError.message)
      }

      // 이월된 투두라면 원본의 히스토리에도 기록
      if (currentTodo.original_todo_id) {
        // 원본 투두 정보 가져오기
        const { data: originalTodo, error: originalError } = await supabase
          .from('todos')
          .select('text, date')
          .eq('id', currentTodo.original_todo_id)
          .single()

        if (!originalError && originalTodo) {
          // 원본 투두의 히스토리에도 변경 기록 추가
          await supabase
            .from('todo_history')
            .insert([{
              todo_id: currentTodo.original_todo_id,
              previous_text: currentTodo.text, // 이월 당시의 텍스트
              new_text: newText,
              changed_on_date: currentTodo.date, // 현재 페이지 날짜
              user_id: session?.user?.id
            }])
        }
      }

      // 투두 텍스트 업데이트
      const { error } = await supabase
        .from('todos')
        .update({ text: newText })
        .eq('id', id)

      if (error) {
        console.error('할 일 수정 오류:', error.message)
        // 오류 발생 시 원래 상태로 복구
        setTodos(prevTodos =>
          prevTodos.map(todo =>
            todo.id === id ? currentTodo : todo
          )
        )
        recentlyEditedIds.current.delete(id)
      } else {
        // 성공 시 5초 후 수정 완료 표시 제거
        setTimeout(() => {
          recentlyEditedIds.current.delete(id)
        }, 5000)
      }
    } catch (error) {
      console.error('할 일 수정 오류:', error.message)
      recentlyEditedIds.current.delete(id)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddTodo()
    }
  }

  // 드래그 앤 드롭 센서 설정 (투두 항목용)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 500,
        tolerance: 10,
        distance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 섹션 드래그 앤 드롭 센서 설정 (더 빠른 반응)
  const sectionSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 100,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 섹션 드래그 종료 핸들러
  const handleSectionDragEnd = (event) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        saveSectionOrder(newOrder)
        return newOrder
      })
    }
  }

  // 섹션 외부 더블클릭으로 순서 수정 모드 종료
  const handleSectionsContainerDoubleClick = (e) => {
    // 섹션 외부(빈 공간)를 더블클릭했을 때만 반응
    if (isReorderMode && e.target === e.currentTarget) {
      setIsReorderMode(false)
    }
  }

  // 드래그 시작 핸들러
  const handleDragStart = () => {
    setIsDraggingAny(true)
  }

  // 드래그 취소 핸들러
  const handleDragCancel = () => {
    setIsDraggingAny(false)
  }

  // 드래그 종료 핸들러
  const handleDragEnd = async (event) => {
    setIsDraggingAny(false)

    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    const oldIndex = todos.findIndex((todo) => todo.id === active.id)
    const newIndex = todos.findIndex((todo) => todo.id === over.id)

    // 로컬 상태 즉시 업데이트
    const newTodos = arrayMove(todos, oldIndex, newIndex)
    setTodos(newTodos)

    // Supabase에 새로운 순서 저장
    try {
      const updates = newTodos.map((todo, index) => ({
        id: todo.id,
        order_index: index + 1
      }))

      for (const update of updates) {
        await supabase
          .from('todos')
          .update({ order_index: update.order_index })
          .eq('id', update.id)
      }
    } catch (error) {
      console.error('순서 업데이트 오류:', error.message)
      // 오류 시 다시 가져오기
      fetchTodos()
    }
  }

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔄</div>
          <div>로딩 중...</div>
        </div>
      </div>
    )
  }

  // 로그인 화면
  if (!session) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          maxWidth: '400px'
        }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📝 Todo Note</h1>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '2rem' }}>
            날짜별 투두 관리 및 루틴 트래킹
          </p>
          <button
            onClick={handleGoogleLogin}
            style={{
              padding: '1rem 2rem',
              fontSize: '1.1rem',
              background: '#646cff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              margin: '0 auto'
            }}
          >
            <span>🔐</span>
            Google로 로그인
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`app ${isDraggingAny ? 'dragging-active' : ''}`}>
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
            className="sidebar-menu-item"
            onClick={() => {
              handleOpenTrash()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">🗑️</span>
            <span>휴지통</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              handleOpenRoutine()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">📌</span>
            <span>루틴 관리</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              handleOpenMemo()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">📝</span>
            <span>생각 메모</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              // 주요 생각정리 섹션으로 스크롤
              const keyThoughtsSection = document.querySelector('.key-thoughts-section')
              if (keyThoughtsSection) {
                keyThoughtsSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">💡</span>
            <span>주요 생각정리</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              handleOpenGanttChart()
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">📊</span>
            <span>간트로 보기</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              setShowEncouragementModal(true)
              setShowSidebar(false)
            }}
          >
            <span className="sidebar-icon">💬</span>
            <span>격려 문구 관리</span>
          </button>
          <button
            className="sidebar-menu-item"
            onClick={() => {
              setShowDummyModal(true)
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
                handleLogout()
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

      <div className={`container ${viewMode === 'horizontal' ? 'container-wide' : ''}`}>
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
            <div className="date-nav-section">
              <div className="date-display-wrapper">
                <span className="date-display">
                  {formatDateOnly(selectedDate)}
                </span>
                <input
                  type="date"
                  value={formatDateForDB(selectedDate)}
                  onChange={handleDateChange}
                  className="date-picker-input"
                />
              </div>
              <button onClick={handlePrevDay} className="date-nav-button">◀</button>
              <button onClick={handleNextDay} className="date-nav-button">▶</button>
            </div>

            {/* 응원 메시지 */}
            <div className="encouragement-section">
              {isToday(selectedDate) ? (
                <div
                  className="encouragement-message"
                  onClick={handleEncouragementClick}
                  title="클릭하면 다른 격려 문구가 나와요!"
                >
                  {showEncouragementEmoji ? (
                    <span className="encouragement-emoji">🔥 🔥 🔥</span>
                  ) : (
                    currentEncouragementMessage || getRandomEncouragement()
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

        <div className="content-scrollable" ref={contentScrollableRef}>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="todo-list">
            {loading ? (
              <p className="empty-message">로딩 중...</p>
            ) : (() => {
              // 루틴 투두, 미정 루틴, 일반 투두 분리
              const routineTodos = todos.filter(t => !t.parent_id && t.routine_id !== null && !t.is_pending_routine)
              const pendingRoutineTodos = todos.filter(t => !t.parent_id && t.is_pending_routine)
              const normalTodos = todos.filter(t => !t.parent_id && t.routine_id === null && !t.is_pending_routine)

              return (
                <DndContext
                  sensors={sectionSensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleSectionDragEnd}
                >
                  <SortableContext
                    items={sectionOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div
                      ref={sectionsContainerRef}
                      className={`sections-container ${viewMode === 'horizontal' ? 'horizontal-layout' : 'vertical-layout'}`}
                      onDoubleClick={handleSectionsContainerDoubleClick}
                    >
                      {sectionOrder.map((sectionId) => {
                        if (sectionId === 'memo') {
                          return (
                            <SortableSection
                              key="memo"
                              id="memo"
                              disabled={!isReorderMode}
                              onLongPress={() => setIsReorderMode(true)}
                            >
                              <MemoSection
                                title="📋 생각 메모"
                                className="memo-section section-block"
                                content={memoContent}
                                setContent={setMemoContent}
                                isEditing={isEditingMemoInline}
                                isSaving={isSavingMemo}
                                textareaRef={memoTextareaRef}
                                onStartEdit={handleStartEditMemoInline}
                                onSave={handleSaveMemoInline}
                                onCancel={handleCancelEditMemoInline}
                                onKeyDown={handleMemoKeyDown}
                                placeholder="메모를 작성해보세요..."
                                emptyMessage="메모를 작성해보세요"
                              >
                    {/* SQL 버튼 */}
                    {!isEditingMemoInline && (
                      <div style={{marginTop: '1rem'}}>
                        <button
                          onClick={() => setShowDummySQL(!showDummySQL)}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(255, 255, 255, 0.05)',
                            color: 'rgba(255, 255, 255, 0.7)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                          }}
                          title="더미 데이터 SQL 펼치기/접기"
                        >
                          <span>🧪 SQL 더미 데이터</span>
                          <span>{showDummySQL ? '▲' : '▼'}</span>
                        </button>
                      </div>
                    )}

                    {/* 더미 데이터 SQL */}
                    {showDummySQL && !isEditingMemoInline && (
                      <div className="dummy-sql-content" style={{marginTop: '1rem'}}>
                        <div className="sql-block">
                          <div className="sql-header">
                            <span>생성 SQL</span>
                            <div style={{display: 'flex', gap: '0.5rem'}}>
                              <button
                                onClick={() => {
                                  window.open('https://raw.githubusercontent.com/jaehwan-lee-benja/todo-note/main/create-dummy-data-v2.sql', '_blank');
                                }}
                                className="link-button"
                                title="GitHub에서 파일 보기"
                              >
                                🔗
                              </button>
                              <button
                                onClick={() => {
                                  const today = new Date();
                                  const getDateStr = (offset) => {
                                    const d = new Date(today);
                                    d.setDate(d.getDate() + offset);
                                    return d.toISOString().split('T')[0];
                                  };
                                  const getDay = (offset) => {
                                    const d = new Date(today);
                                    d.setDate(d.getDate() + offset);
                                    return d.getDate();
                                  };

                                  const sessionId = Date.now();
                                  const d_m2 = getDay(-2), d_m1 = getDay(-1), d_0 = getDay(0), d_p1 = getDay(1), d_p2 = getDay(2);
                                  const date_m2 = getDateStr(-2), date_m1 = getDateStr(-1), date_0 = getDateStr(0), date_p1 = getDateStr(1), date_p2 = getDateStr(2);

                                  const createSQL = `-- 오늘 날짜 기준 앞뒤 이틀씩 더미 데이터 생성 (${date_0} 기준)
INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음', '${date_m2}', false, '${date_m2}T09:00:00+09:00', 1001),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m2}일완료', '${date_m2}', true, '${date_m2}T09:10:00+09:00', 1002),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m1}일완료', '${date_m2}', true, '${date_m2}T09:20:00+09:00', 1003),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_0}일완료', '${date_m2}', true, '${date_m2}T09:30:00+09:00', 1004);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-수정이력있음', '${date_m1}', false, '${date_m1}T10:00:00+09:00', 1005),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_m1}일완료', '${date_m1}', true, '${date_m1}T10:10:00+09:00', 1006),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_0}일완료', '${date_m1}', true, '${date_m1}T10:20:00+09:00', 1007);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-미완료', '${date_0}', false, '${date_0}T11:00:00+09:00', 1008),
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-${d_0}일완료', '${date_0}', true, '${date_0}T11:10:00+09:00', 1009);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m1}일페이지-미완료', '${date_m1}', false, '${date_m2}T14:00:00+09:00', 1010),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_m1}일페이지-${d_m1}일완료', '${date_m1}', true, '${date_m2}T14:10:00+09:00', 1011);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_0}일페이지-미완료', '${date_0}', false, '${date_m1}T15:00:00+09:00', 1012),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_0}일페이지-${d_0}일완료', '${date_0}', true, '${date_m1}T15:10:00+09:00', 1013),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_0}일페이지-미완료', '${date_0}', false, '${date_m2}T15:00:00+09:00', 1014),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_0}일페이지-${d_0}일완료', '${date_0}', true, '${date_m2}T15:10:00+09:00', 1015);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-${d_p1}일페이지-미완료', '${date_p1}', false, '${date_0}T16:00:00+09:00', 1016),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_p1}일페이지-미완료', '${date_p1}', false, '${date_m1}T16:00:00+09:00', 1017),
  ('[DUMMY-${sessionId}] 더미: ${d_m2}일생성-${d_p1}일페이지-미완료', '${date_p1}', false, '${date_m2}T16:00:00+09:00', 1018);

INSERT INTO todos (text, date, completed, created_at, order_index)
VALUES
  ('[DUMMY-${sessionId}] 더미: ${d_0}일생성-${d_p2}일페이지-미완료', '${date_p2}', false, '${date_0}T17:00:00+09:00', 1019),
  ('[DUMMY-${sessionId}] 더미: ${d_m1}일생성-${d_p2}일페이지-미완료', '${date_p2}', false, '${date_m1}T17:00:00+09:00', 1020);

INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT id, '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-1차', '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-2차', '${date_m1}T12:00:00+09:00', '${date_m1}'
FROM todos WHERE text = '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음' LIMIT 1;

INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT id, '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-2차', '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음', '${date_0}T12:00:00+09:00', '${date_0}'
FROM todos WHERE text = '[DUMMY-${sessionId}] 더미: ${d_m2}일생성-미완료-수정이력있음' LIMIT 1;

INSERT INTO todo_history (todo_id, previous_text, new_text, changed_at, changed_on_date)
SELECT id, '[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-1차', '[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-수정이력있음', '${date_0}T13:00:00+09:00', '${date_0}'
FROM todos WHERE text = '[DUMMY-${sessionId}] 더미: ${d_m1}일생성-미완료-수정이력있음' LIMIT 1;`;

                                  const textarea = document.createElement('textarea');
                                  textarea.value = createSQL;
                                  textarea.style.position = 'fixed';
                                  textarea.style.opacity = '0';
                                  document.body.appendChild(textarea);
                                  textarea.select();
                                  try {
                                    document.execCommand('copy');
                                    alert('생성 SQL 복사 완료!');
                                  } catch (err) {
                                    alert('복사에 실패했습니다.');
                                  }
                                  document.body.removeChild(textarea);
                                }}
                                className="copy-button"
                              >
                                📋 복사
                              </button>
                            </div>
                          </div>
                          <pre className="sql-code">{`-- ⚠️ 참고: 복사 버튼 클릭 시 오늘 날짜 기준으로 자동 생성됩니다
-- 아래는 예시입니다 (실제 날짜는 실행 시점 기준 앞뒤 이틀)

-- DO 블록 버전 (PostgreSQL/Supabase)
DO $$
DECLARE
  day_m2 date := CURRENT_DATE - INTERVAL '2 days';
  day_m1 date := CURRENT_DATE - INTERVAL '1 day';
  day_0 date := CURRENT_DATE;
  day_p1 date := CURRENT_DATE + INTERVAL '1 day';
  day_p2 date := CURRENT_DATE + INTERVAL '2 days';
  d_m2 text := EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '2 days')::text;
  d_m1 text := EXTRACT(DAY FROM CURRENT_DATE - INTERVAL '1 day')::text;
  d_0 text := EXTRACT(DAY FROM CURRENT_DATE)::text;
  d_p1 text := EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '1 day')::text;
  d_p2 text := EXTRACT(DAY FROM CURRENT_DATE + INTERVAL '2 days')::text;
  session_id text := EXTRACT(EPOCH FROM NOW())::bigint::text;
BEGIN
  -- -2일 페이지 데이터 (4개)
  INSERT INTO todos (text, date, completed, created_at, order_index)
  VALUES
    ('[DUMMY-' || session_id || '] 더미: ' || d_m2 || '일생성-미완료-수정이력있음', day_m2, false, (day_m2 + TIME '09:00:00') AT TIME ZONE 'Asia/Seoul', 1001),
    ...

  -- 총 20개의 투두와 3개의 히스토리 생성
  -- 자세한 내용은 GitHub 파일 참고
END $$;`}</pre>
                        </div>

                        <div className="sql-block">
                          <div className="sql-header">
                            <span>삭제 SQL</span>
                            <div style={{display: 'flex', gap: '0.5rem'}}>
                              <button
                                onClick={() => {
                                  window.open('https://raw.githubusercontent.com/jaehwan-lee-benja/todo-note/main/delete-dummy-data-v2.sql', '_blank');
                                }}
                                className="link-button"
                                title="GitHub에서 파일 보기"
                              >
                                🔗
                              </button>
                              <button
                                onClick={() => {
                                  const deleteSQL = `DELETE FROM todo_history
WHERE todo_id IN (
  SELECT id FROM todos WHERE text LIKE '[DUMMY-%'
);

DELETE FROM todos
WHERE text LIKE '[DUMMY-%';`;

                                  const textarea = document.createElement('textarea');
                                  textarea.value = deleteSQL;
                                  textarea.style.position = 'fixed';
                                  textarea.style.opacity = '0';
                                  document.body.appendChild(textarea);
                                  textarea.select();
                                  try {
                                    document.execCommand('copy');
                                    alert('삭제 SQL 복사 완료!');
                                  } catch (err) {
                                    alert('복사에 실패했습니다.');
                                  }
                                  document.body.removeChild(textarea);
                                }}
                                className="copy-button"
                              >
                                📋 복사
                              </button>
                            </div>
                          </div>
                          <pre className="sql-code">{`DELETE FROM todo_history
WHERE todo_id IN (
  SELECT id FROM todos WHERE text LIKE '[DUMMY-%'
);

DELETE FROM todos
WHERE text LIKE '[DUMMY-%';`}</pre>
                        </div>
                      </div>
                    )}
                              </MemoSection>
                            </SortableSection>
                          )
                        } else if (sectionId === 'routine') {
                          return (
                            <SortableSection
                              key="routine"
                              id="routine"
                              disabled={!isReorderMode}
                              onLongPress={() => setIsReorderMode(true)}
                            >
                              <TodoSection
                                title="📌 루틴"
                                className="routine-section section-block"
                                inputValue={routineInputValue}
                                setInputValue={setRoutineInputValue}
                                onAddTodo={handleAddRoutineTodo}
                                isAdding={isAdding}
                                placeholder="루틴 할 일 추가..."
                              >
                    {/* 확정 루틴 */}
                    {routineTodos.length > 0 && (
                      <SortableContext
                        items={routineTodos.map(todo => todo.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {routineTodos.map((todo, index) => {
                          const subtodos = todos.filter(t => t.parent_id === todo.id)
                          return (
                            <SortableTodoItem
                              key={todo.id}
                              todo={todo}
                              index={index}
                              onToggle={handleToggleTodo}
                              onDelete={handleDeleteTodo}
                              onEdit={handleEditTodo}
                              formatDate={formatDate}
                              formatDateOnly={formatDateOnly}
                              isFocused={focusedTodoId === todo.id}
                              onFocus={handleFocusTodo}
                              onAddSubTodo={handleAddSubTodo}
                              subtodos={subtodos}
                              level={0}
                              onCreateRoutine={handleCreateRoutineFromTodo}
                              routines={routines}
                              onShowRoutineHistory={fetchRoutineHistory}
                              onOpenRoutineSetupModal={handleOpenTodoRoutineSetupModal}
                              onOpenHistoryModal={handleOpenTodoHistoryModal}
                              currentPageDate={formatDateForDB(selectedDate)}
                              onRemoveFromUI={handleRemoveTodoFromUI}
                              showSuccessMessage={showSuccessMessage}
                            />
                          )
                        })}
                      </SortableContext>
                    )}

                    {/* 구분선 (확정 루틴과 미정 루틴 사이) */}
                    {routineTodos.length > 0 && pendingRoutineTodos.length > 0 && (
                      <div style={{ margin: '1rem 0', padding: '0 1rem' }}>
                        <div className="separator-line"></div>
                      </div>
                    )}

                    {/* 미정 루틴 */}
                    {pendingRoutineTodos.length > 0 && (
                      <SortableContext
                        items={pendingRoutineTodos.map(todo => todo.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {pendingRoutineTodos.map((todo, index) => {
                          const subtodos = todos.filter(t => t.parent_id === todo.id)
                          return (
                            <SortableTodoItem
                              key={todo.id}
                              todo={todo}
                              index={index}
                              onToggle={handleToggleTodo}
                              onDelete={handleDeleteTodo}
                              onEdit={handleEditTodo}
                              formatDate={formatDate}
                              formatDateOnly={formatDateOnly}
                              isFocused={focusedTodoId === todo.id}
                              onFocus={handleFocusTodo}
                              onAddSubTodo={handleAddSubTodo}
                              subtodos={subtodos}
                              level={0}
                              onCreateRoutine={handleCreateRoutineFromTodo}
                              routines={routines}
                              onShowRoutineHistory={fetchRoutineHistory}
                              onOpenRoutineSetupModal={handleOpenTodoRoutineSetupModal}
                              onOpenHistoryModal={handleOpenTodoHistoryModal}
                              currentPageDate={formatDateForDB(selectedDate)}
                              isPendingRoutine={true}
                              onRemoveFromUI={handleRemoveTodoFromUI}
                              showSuccessMessage={showSuccessMessage}
                            />
                          )
                        })}
                      </SortableContext>
                    )}
                              </TodoSection>
                            </SortableSection>
                          )
                        } else if (sectionId === 'normal') {
                          return (
                            <SortableSection
                              key="normal"
                              id="normal"
                              disabled={!isReorderMode}
                              onLongPress={() => setIsReorderMode(true)}
                            >
                              <TodoSection
                                title="📝 일반 투두"
                                className="normal-section section-block"
                                inputValue={normalInputValue}
                                setInputValue={setNormalInputValue}
                                onAddTodo={handleAddNormalTodo}
                                isAdding={isAdding}
                                placeholder="일반 할 일 추가..."
                              >
                    {normalTodos.length > 0 && (
                      <SortableContext
                        items={normalTodos.map(todo => todo.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {normalTodos.map((todo, index, array) => {
                  const subtodos = todos.filter(t => t.parent_id === todo.id)

                  // 현재 보고 있는 페이지의 날짜 (selectedDate)
                  const currentPageDate = formatDateForDB(selectedDate)

                  // 투두의 생성일 (created_at에서 날짜만 추출)
                  const todoCreatedDate = todo.created_at ? todo.created_at.split('T')[0] : todo.date

                  // 다음 투두의 생성일
                  const nextTodo = array[index + 1]
                  const nextTodoCreatedDate = nextTodo
                    ? (nextTodo.created_at ? nextTodo.created_at.split('T')[0] : nextTodo.date)
                    : null

                  // 현재 투두는 페이지 날짜 이전에 생성, 다음 투두는 페이지 날짜에 생성된 경우 구분선 표시
                  const showSeparator = todoCreatedDate < currentPageDate && nextTodoCreatedDate >= currentPageDate

                  // 디버깅
                  if (index < 5) {
                  }

                  return (
                    <React.Fragment key={todo.id}>
                      <SortableTodoItem
                        todo={todo}
                        index={index}
                        onToggle={handleToggleTodo}
                        onDelete={handleDeleteTodo}
                        onEdit={handleEditTodo}
                        formatDate={formatDate}
                        formatDateOnly={formatDateOnly}
                        isFocused={focusedTodoId === todo.id}
                        onFocus={handleFocusTodo}
                        onAddSubTodo={handleAddSubTodo}
                        subtodos={subtodos}
                        level={0}
                        onCreateRoutine={handleCreateRoutineFromTodo}
                        routines={routines}
                        onShowRoutineHistory={fetchRoutineHistory}
                        onOpenRoutineSetupModal={handleOpenTodoRoutineSetupModal}
                        onOpenHistoryModal={handleOpenTodoHistoryModal}
                        currentPageDate={currentPageDate}
                        onRemoveFromUI={handleRemoveTodoFromUI}
                        showSuccessMessage={showSuccessMessage}
                      />
                      {showSeparator && (
                        <div className="todo-date-separator">
                          <div className="separator-line"></div>
                          <div className="separator-text">이전에서 넘어옴</div>
                          <div className="separator-line"></div>
                        </div>
                      )}
                    </React.Fragment>
                  )
                              })}
                            </SortableContext>
                          )}
                              </TodoSection>
                            </SortableSection>
                          )
                        } else if (sectionId === 'key-thoughts') {
                          return (
                            <SortableSection
                              key="key-thoughts"
                              id="key-thoughts"
                              disabled={!isReorderMode}
                              onLongPress={() => setIsReorderMode(true)}
                            >
                              <KeyThoughtsSection
                                blocks={keyThoughtsBlocks}
                                setBlocks={setKeyThoughtsBlocks}
                                focusedBlockId={focusedBlockId}
                                setFocusedBlockId={setFocusedBlockId}
                                onShowHistory={() => {
                                  fetchKeyThoughtsHistory()
                                  setShowKeyThoughtsHistory(true)
                                }}
                              />
                            </SortableSection>
                          )
                        }
                        return null
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )
            })()}
          </div>
        </DndContext>

        {/* 모바일 섹션 페이지네이션 dots */}
        {viewMode === 'horizontal' && (
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
            {[0, 1, 2].map((index) => (
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
        )}
        </div>

        {showUndoToast && (
          <Toast
            message="삭제되었습니다"
            onUndo={handleUndoDelete}
          />
        )}

        {showSuccessToast && (
          <Toast
            message={successToastMessage}
            onUndo={lastDeleteAction ? handleUndoRoutineDelete : null}
            variant="success"
          />
        )}

        {showDeleteConfirmModal && todoToDelete && (
          <div className="modal-overlay" onClick={() => setShowDeleteConfirmModal(false)}>
            <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🗑️ 삭제 옵션 선택</h2>
                <button onClick={() => setShowDeleteConfirmModal(false)} className="modal-close-button">✕</button>
              </div>
              <div className="delete-confirm-content">
                <p className="delete-confirm-text">
                  <strong>{todoToDelete.text}</strong>
                </p>
                <p className="delete-confirm-description">
                  이 투두는 여러 날짜에 보입니다. 어떻게 삭제하시겠습니까?
                </p>
                <div className="delete-options-simple">
                  <button
                    className="delete-option-button-simple option-hide"
                    onClick={() => hideOnThisDateOnly(todoToDelete)}
                  >
                    <span className="option-icon">👁️‍🗨️</span>
                    <span className="option-title">이 날짜에서만 숨김</span>
                    <span className="option-desc">다른 날짜에서는 계속 보입니다</span>
                  </button>
                  <button
                    className="delete-option-button-simple option-delete"
                    onClick={() => deleteCompletely(todoToDelete)}
                  >
                    <span className="option-icon">🗑️</span>
                    <span className="option-title">휴지통으로 이동</span>
                    <span className="option-desc">모든 날짜에서 삭제 (복원 가능)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 투두 히스토리 모달 */}
        {showTodoHistoryModal && selectedTodoForModal && (() => {
          const todo = selectedTodoForModal
          const visibleDates = todo.visible_dates && todo.visible_dates.length > 0 ? todo.visible_dates : [todo.date]
          const originalDate = visibleDates[0]
          const carryOverPath = visibleDates.map(date => ({ id: `${todo.id}-${date}`, date }))
          const historyRecords = todoHistory[todo.id] || []

          return (
            <div className="modal-overlay" onClick={handleCloseTodoHistoryModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>📊 투두 히스토리</h2>
                  <button onClick={handleCloseTodoHistoryModal} className="modal-close-button">✕</button>
                </div>
                <div className="modal-body">
                  <div className="todo-history">
                    <div className="history-item">
                      <span className="history-label">생성일:</span>
                      <span className="history-value">{formatDate(todo.created_at)}</span>
                    </div>
                    <div className="history-item">
                      <span className="history-label">원본 페이지:</span>
                      <span className="history-value">
                        {originalDate ? formatDateOnly(new Date(originalDate + 'T00:00:00')) : formatDateOnly(new Date(todo.date + 'T00:00:00'))}
                      </span>
                    </div>
                    {carryOverPath.length > 0 && (
                      <div className="history-item">
                        <span className="history-label">이월 경로:</span>
                        <span className="history-value">
                          {carryOverPath.map((path, idx) => {
                            const isCurrentPage = path.date === todo.date
                            const dateStr = formatDateOnly(new Date(path.date + 'T00:00:00'))
                            return (
                              <span key={path.id}>
                                {idx > 0 && ' → '}
                                <span style={isCurrentPage ? { fontWeight: 'bold', color: '#4CAF50' } : {}}>
                                  {dateStr.split('(')[0]}{isCurrentPage ? '(여기)' : ''}
                                </span>
                              </span>
                            )
                          })}
                        </span>
                      </div>
                    )}
                    {(() => {
                      const createdDate = new Date(todo.created_at).toISOString().split('T')[0]
                      const currentDate = todo.date
                      if (createdDate !== currentDate && carryOverPath.length === 0) {
                        return (
                          <div className="history-item">
                            <span className="history-label">현재 페이지:</span>
                            <span className="history-value">{formatDateOnly(new Date(todo.date + 'T00:00:00'))}</span>
                          </div>
                        )
                      }
                      return null
                    })()}
                    {historyRecords.length > 0 && (
                      <div className="history-changes-list">
                        <div className="history-changes-header">변경 이력 ({historyRecords.length})</div>
                        {historyRecords.map((record) => (
                          <div key={record.id} className="history-record-compact">
                            <div className="history-record-summary">
                              <div className="history-change-time">
                                {formatDate(record.changed_at)}
                                {record.changed_on_date && (
                                  <span className="history-page-info"> (페이지: {formatDateOnly(new Date(record.changed_on_date + 'T00:00:00'))})</span>
                                )}
                              </div>
                              <button
                                className="history-detail-button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleHistoryDetail(record.id)
                                }}
                              >
                                {expandedHistoryIds.includes(record.id) ? '숨기기' : '내용보기'}
                              </button>
                            </div>
                            {expandedHistoryIds.includes(record.id) && (
                              <div className="history-change">
                                <div className="history-change-item history-before">
                                  <span className="change-badge">이전</span>
                                  <span className="change-text">{record.previous_text}</span>
                                </div>
                                <div className="history-change-arrow">→</div>
                                <div className="history-change-item history-after">
                                  <span className="change-badge">이후</span>
                                  <span className="change-text">{record.new_text}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* 루틴 설정 모달 */}
        {showTodoRoutineSetupModal && selectedTodoForModal && (() => {
          const todo = selectedTodoForModal
          const currentRoutine = routines.find(r => r.id === todo.routine_id)

          return (
            <div className="modal-overlay" onClick={handleCloseTodoRoutineSetupModal}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>🔄 루틴 설정</h2>
                  <button onClick={handleCloseTodoRoutineSetupModal} className="modal-close-button">✕</button>
                </div>
                <div className="modal-body">
                  <div className="routine-setup-inline">
                    {currentRoutine && !isEditingRoutineInModal ? (
                      <>
                        <div className="routine-current-info">
                          <div className="routine-info-title">설정된 루틴:</div>
                          <div className="routine-days-display">
                            {DAYS.filter(day => currentRoutine.days.includes(day.key)).map(day => (
                              <span key={day.key} className="routine-day-badge">
                                {day.label}
                              </span>
                            ))}
                          </div>
                          {currentRoutine.time_slot && (
                            <div className="routine-time-slot" style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                              ⏰ {currentRoutine.time_slot}
                            </div>
                          )}
                        </div>
                        <div className="routine-setup-actions">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (currentRoutine) {
                                setRoutineDaysForModal(currentRoutine.days)
                                setRoutineTimeSlotForModal(currentRoutine.time_slot || '')
                                setIsEditingRoutineInModal(true)
                              }
                            }}
                            className="routine-confirm-button"
                          >
                            수정
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (currentRoutine && todo) {
                                await handleCreateRoutineFromTodo(todo.id, todo.text, [], null, true)
                                handleCloseTodoRoutineSetupModal()
                              }
                            }}
                            className="routine-remove-button"
                          >
                            제거
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="routine-setup-title">
                          {isEditingRoutineInModal ? '루틴 수정:' : '반복할 요일 선택:'}
                        </div>
                        <div className="day-selector-inline">
                          {DAYS.map(day => (
                            <button
                              key={day.key}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleToggleRoutineDayInModal(day.key)
                              }}
                              className={`day-button-inline ${routineDaysForModal.includes(day.key) ? 'selected' : ''}`}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                        <div className="time-slot-selector" style={{ marginTop: '1rem' }}>
                          <label style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '0.5rem', display: 'block' }}>
                            ⏰ 시간 (선택사항)
                          </label>
                          <AppleTimePicker
                            value={routineTimeSlotForModal}
                            onChange={(time) => setRoutineTimeSlotForModal(time)}
                          />
                        </div>
                        <div className="routine-setup-actions">
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              if (todo) {
                                if (isEditingRoutineInModal && currentRoutine) {
                                  // 루틴 수정
                                  await handleCreateRoutineFromTodo(todo.id, todo.text, routineDaysForModal, currentRoutine.id, false, routineTimeSlotForModal)
                                } else {
                                  // 새 루틴 생성 (요일 없으면 매일 반복)
                                  await handleCreateRoutineFromTodo(todo.id, todo.text, routineDaysForModal, null, false, routineTimeSlotForModal)
                                }
                                handleCloseTodoRoutineSetupModal()
                              }
                            }}
                            className="routine-confirm-button"
                          >
                            확인
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCloseTodoRoutineSetupModal()
                            }}
                            className="routine-cancel-button"
                          >
                            취소
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {showTrashModal && (
          <div className="modal-overlay" onClick={handleCloseTrash}>
            <div className="modal-content trash-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🗑️ 휴지통</h2>
                <div className="modal-header-actions">
                  {trashedItems.length > 0 && (
                    <button
                      onClick={handleEmptyTrash}
                      className="empty-trash-button"
                      title="휴지통 비우기"
                    >
                      전체 비우기
                    </button>
                  )}
                  <button onClick={handleCloseTrash} className="modal-close-button">✕</button>
                </div>
              </div>
              <div className="trash-list">
                {trashedItems.length === 0 ? (
                  <p className="empty-message">휴지통이 비어있습니다.</p>
                ) : (
                  trashedItems.map(item => {
                    // 이월 정보
                    const visibleDates = item.visible_dates || (item.date ? [item.date] : [])
                    const hasCarryover = visibleDates.length > 1 || item.original_todo_id
                    const isOldStyleCarryover = item.original_todo_id !== null && item.original_todo_id !== undefined

                    // 삭제 타입 판단
                    const hasHiddenDates = item.hidden_dates && item.hidden_dates.length > 0
                    let deleteType = '알 수 없음'

                    if (isOldStyleCarryover) {
                      // 구 방식: 개별 레코드 삭제
                      deleteType = '이 날짜만 삭제 (구 방식)'
                    } else if (hasHiddenDates) {
                      // 새 방식: hidden_dates 사용
                      deleteType = '일부 날짜 숨김'
                    } else if (item.deleted === true) {
                      // 새 방식: 완전 삭제
                      deleteType = visibleDates.length > 1 ? '모든 날짜 삭제' : '삭제'
                    }

                    return (
                      <div key={item.id} className="trash-item">
                        <div className="trash-item-content">
                          <span className={`trash-text ${item.completed ? 'completed' : ''}`}>
                            {item.text}
                          </span>
                          <div className="trash-metadata">
                            <span className="trash-date">생성: {formatDate(item.created_at)}</span>
                            {item.deleted_date && (
                              <span className="trash-deleted-date">삭제: {item.deleted_date}</span>
                            )}
                            <span className={`trash-delete-type ${
                              isOldStyleCarryover ? 'old-style' : (hasHiddenDates ? 'partial' : 'complete')
                            }`}>
                              {deleteType}
                            </span>
                          </div>

                          {/* 이월 히스토리 정보 */}
                          {hasCarryover && (
                            <div className="trash-carryover-info">
                              <div className="carryover-label">📅 이월 경로:</div>
                              <div className="carryover-dates">
                                {visibleDates.length > 0 ? (
                                  visibleDates.map((date, idx) => (
                                    <span key={idx} className="carryover-date-badge">
                                      {date}
                                    </span>
                                  ))
                                ) : item.original_todo_id ? (
                                  <span className="carryover-note">구 방식 이월 투두 (original_id: {item.original_todo_id})</span>
                                ) : null}
                              </div>
                              {hasHiddenDates && (
                                <div className="hidden-dates-info">
                                  <span className="hidden-label">🚫 숨김 날짜:</span>
                                  {item.hidden_dates.map((date, idx) => (
                                    <span key={idx} className="hidden-date-badge">
                                      {date}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="trash-actions">
                          <button
                            onClick={() => handleRestoreFromTrash(item.id)}
                            className="restore-button"
                            title="복원"
                          >
                            복원
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(item.id)}
                            className="permanent-delete-button"
                            title="영구 삭제"
                          >
                            영구 삭제
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {showDummyModal && (
          <div className="modal-overlay" onClick={() => setShowDummyModal(false)}>
            <div className="modal-content routine-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>🧪 더미 데이터 관리</h2>
                <button onClick={() => setShowDummyModal(false)} className="modal-close-button">✕</button>
              </div>

              <div className="routine-add-section">
                <h3>더미 데이터 생성</h3>
                <p style={{fontSize: '14px', color: '#666', marginBottom: '10px'}}>
                  14일~18일 날짜에 걸쳐 총 20개의 테스트용 더미 데이터가 생성됩니다.
                </p>
                <button
                  onClick={handleCreateDummyData}
                  className="add-routine-button"
                  style={{width: '100%'}}
                >
                  ✅ 더미 데이터 생성 (20개)
                </button>
              </div>

              <div className="routine-add-section">
                <h3>중복 투두 제거</h3>
                <p style={{fontSize: '14px', color: '#666', marginBottom: '10px'}}>
                  같은 텍스트의 투두 중 생성일이 가장 빠른 것만 남기고 삭제합니다.
                </p>
                <button
                  onClick={handleRemoveDuplicates}
                  className="add-routine-button"
                  style={{width: '100%', background: '#ff6b6b'}}
                >
                  🗑️ 중복 투두 제거
                </button>
              </div>

              <div className="routine-list" style={{marginTop: '20px'}}>
                <h3>생성된 세션 목록</h3>
                {dummySessions.length === 0 ? (
                  <p className="empty-message">생성된 더미 세션이 없습니다.</p>
                ) : (
                  <>
                    {dummySessions.map((session, index) => (
                      <div key={session.sessionId} className="routine-item">
                        <div className="routine-item-content">
                          <span className="routine-text">
                            세션 #{index + 1}: {session.sessionId}
                          </span>
                          <div className="routine-days">
                            <span className="routine-day-badge">
                              투두 {session.count}개
                            </span>
                            {session.historyCount > 0 && (
                              <span className="routine-day-badge">
                                히스토리 {session.historyCount}개
                              </span>
                            )}
                            <span className="routine-day-badge" style={{fontSize: '11px'}}>
                              {formatDate(session.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="routine-item-actions">
                          <button
                            onClick={() => {
                              if (window.confirm(`세션 #${index + 1}을 삭제하시겠습니까?`)) {
                                handleDeleteDummySession(session.sessionId)
                              }
                            }}
                            className="routine-delete-button"
                            title="이 세션만 삭제"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        if (window.confirm('모든 더미 데이터를 삭제하시겠습니까?')) {
                          handleDeleteAllDummies()
                        }
                      }}
                      className="routine-delete-button"
                      style={{width: '100%', marginTop: '15px', padding: '12px'}}
                    >
                      🗑️ 모든 더미 데이터 삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {showMemoModal && (
          <div className="modal-overlay" onClick={handleCloseMemo}>
            <div className="modal-content memo-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📝 생각 메모</h2>
                <button onClick={handleCloseMemo} className="modal-close-button">✕</button>
              </div>

              <div className="memo-content">
                {isEditingMemo ? (
                  <div className="memo-edit-mode">
                    <textarea
                      value={memoContent}
                      onChange={(e) => setMemoContent(e.target.value)}
                      className="memo-textarea"
                      placeholder="메모 내용을 입력하세요..."
                      rows={20}
                    />
                    <div className="memo-actions">
                      <button
                        onClick={handleSaveMemo}
                        className="memo-save-button"
                        disabled={isSavingMemo}
                      >
                        {isSavingMemo ? '저장 중...' : '💾 저장'}
                      </button>
                      <button
                        onClick={handleResetMemo}
                        className="memo-cancel-button"
                        disabled={isSavingMemo}
                      >
                        ↩️ 취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="memo-view-mode">
                    <div className="memo-display">
                      <pre className="memo-text">{memoContent}</pre>
                    </div>
                    <div className="memo-actions">
                      <button
                        onClick={handleEditMemo}
                        className="memo-edit-button"
                      >
                        ✏️ 편집
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showGanttChart && (
          <div className="modal-overlay" onClick={handleCloseGanttChart}>
            <div className="modal-content gantt-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📊 간트차트 - 투두 현황</h2>
                <button onClick={handleCloseGanttChart} className="modal-close-button">✕</button>
              </div>

              <div className="gantt-filter">
                <div className="gantt-period-buttons">
                  {[
                    { value: '1week', label: '지난 1주일' },
                    { value: '2weeks', label: '지난 2주일' },
                    { value: '1month', label: '지난 1개월' },
                    { value: '3months', label: '지난 3개월' },
                    { value: '6months', label: '지난 6개월' },
                    { value: 'all', label: '전체' }
                  ].map(period => (
                    <button
                      key={period.value}
                      className={`period-button ${ganttPeriod === period.value ? 'active' : ''}`}
                      onClick={() => setGanttPeriod(period.value)}
                    >
                      {period.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="gantt-content">
                {ganttData.length === 0 ? (
                  <p className="empty-message">투두가 없습니다.</p>
                ) : (
                  <div className="gantt-chart">
                    {/* 날짜 헤더 */}
                    {(() => {
                      // 전체 날짜 범위 계산
                      const allDates = ganttData.flatMap(item => item.dates)
                      const uniqueDates = [...new Set(allDates)].sort((a, b) => new Date(a) - new Date(b))

                      const minDate = uniqueDates[0]
                      const maxDate = uniqueDates[uniqueDates.length - 1]

                      // minDate부터 maxDate까지의 모든 날짜 생성
                      const dateRange = []
                      let currentDate = new Date(minDate + 'T00:00:00')
                      const endDate = new Date(maxDate + 'T00:00:00')

                      while (currentDate <= endDate) {
                        dateRange.push(formatDateForDB(currentDate))
                        currentDate.setDate(currentDate.getDate() + 1)
                      }

                      return (
                        <>
                          <div className="gantt-header">
                            <div className="gantt-task-column">투두 항목</div>
                            <div className="gantt-timeline">
                              {dateRange.map(date => (
                                <div key={date} className="gantt-date-cell">
                                  {formatDateOnly(new Date(date + 'T00:00:00')).split('(')[0]}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 간트 차트 본문 */}
                          {ganttData.map((item, idx) => {
                            const datesSet = new Set(item.dates)

                            return (
                              <div key={item.originalId} className="gantt-row">
                                <div className="gantt-task-column" title={item.text}>
                                  <span className={item.completed ? 'completed-task' : ''}>
                                    {item.text}
                                  </span>
                                </div>
                                <div className="gantt-timeline">
                                  {dateRange.map(date => {
                                    const hasTask = datesSet.has(date)

                                    if (!hasTask) {
                                      return <div key={date} className="gantt-date-cell"></div>
                                    }

                                    // 날짜 타입 결정
                                    const isStartDate = date === item.startDate
                                    const isCompletedDate = date === item.completedDate
                                    const isMiddle = !isStartDate && !isCompletedDate

                                    let cellClass = 'gantt-date-cell has-task'
                                    if (isStartDate) {
                                      cellClass += ' start-date'
                                    } else if (isCompletedDate) {
                                      cellClass += ' completed-date'
                                    } else {
                                      cellClass += ' middle-date'
                                    }

                                    return (
                                      <div key={date} className={cellClass}>
                                        {isCompletedDate ? <span className="completed-circle">✓</span> : '○'}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showRoutineModal && (
          <div className="modal-overlay" onClick={handleCloseRoutine}>
            <div className="modal-content routine-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📌 루틴 관리</h2>
                <button onClick={handleCloseRoutine} className="modal-close-button">✕</button>
              </div>

              <div className="routine-add-section">
                <input
                  type="text"
                  value={routineInput}
                  onChange={(e) => setRoutineInput(e.target.value)}
                  placeholder="루틴 내용을 입력하세요..."
                  className="routine-input"
                  disabled={isAddingRoutine}
                />
                <div className="day-selector">
                  {DAYS.map(day => (
                    <button
                      key={day.key}
                      onClick={() => handleToggleDay(day.key)}
                      className={`day-button ${selectedDays.includes(day.key) ? 'selected' : ''}`}
                      disabled={isAddingRoutine}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <div className="time-slot-selector">
                  <label className="time-slot-label">⏰ 시간 (선택사항)</label>
                  <AppleTimePicker
                    value={selectedTimeSlot}
                    onChange={(time) => setSelectedTimeSlot(time)}
                  />
                </div>
                <button
                  onClick={handleAddRoutine}
                  className="add-routine-button"
                  disabled={isAddingRoutine || routineInput.trim() === ''}
                >
                  루틴 추가
                </button>
              </div>

              <div className="routine-list">
                {routines.length === 0 ? (
                  <p className="empty-message">등록된 루틴이 없습니다.</p>
                ) : (
                  routines.map(routine => (
                    <div key={routine.id} className="routine-item">
                      {editingRoutineId === routine.id ? (
                        // 수정 모드
                        <>
                          <div className="routine-edit-content">
                            <input
                              type="text"
                              value={editingRoutineText}
                              onChange={(e) => setEditingRoutineText(e.target.value)}
                              className="routine-edit-input"
                              placeholder="루틴 내용"
                            />
                            <div className="day-selector-inline">
                              {DAYS.map(day => (
                                <button
                                  key={day.key}
                                  onClick={() => handleToggleEditDay(day.key)}
                                  className={`day-button-inline ${editingRoutineDays.includes(day.key) ? 'selected' : ''}`}
                                >
                                  {day.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="routine-item-actions">
                            <button
                              onClick={handleSaveEditRoutine}
                              className="routine-save-button"
                              disabled={editingRoutineText.trim() === '' || editingRoutineDays.length === 0}
                            >
                              저장
                            </button>
                            <button
                              onClick={handleCancelEditRoutine}
                              className="routine-cancel-edit-button"
                            >
                              취소
                            </button>
                          </div>
                        </>
                      ) : (
                        // 일반 모드
                        <>
                          <div className="routine-item-content">
                            <span className="routine-text">{routine.text}</span>
                            <div className="routine-meta">
                              <div className="routine-days">
                                {DAYS.filter(day => routine.days.includes(day.key)).map(day => (
                                  <span key={day.key} className="routine-day-badge">
                                    {day.label}
                                  </span>
                                ))}
                              </div>
                              {routine.time_slot && (
                                <span className="routine-time-slot">
                                  {routine.time_slot}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="routine-item-actions">
                            <button
                              onClick={() => fetchRoutineHistory(routine)}
                              className="routine-history-button"
                              title="히스토리 보기"
                            >
                              📊
                            </button>
                            <button
                              onClick={() => handleStartEditRoutine(routine)}
                              className="routine-edit-button"
                              title="수정"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => handleDeleteRoutine(routine.id)}
                              className="routine-delete-button"
                              title="삭제"
                            >
                              삭제
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showRoutineHistory && selectedRoutineForHistory && (
          <div className="modal-overlay" onClick={handleCloseRoutineHistory}>
            <div className="modal-content routine-history-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>📊 {selectedRoutineForHistory.text} 히스토리</h2>
                <button onClick={handleCloseRoutineHistory} className="modal-close-button">✕</button>
              </div>

              <div className="routine-history-content">
                {(() => {
                  if (routineHistoryData.length === 0) {
                    return <p className="empty-message">아직 생성된 투두가 없습니다.</p>
                  }

                  // 첫 번째 투두 날짜부터 오늘까지의 달력 생성
                  const firstTodo = routineHistoryData[0]
                  const firstDate = new Date(firstTodo.date)
                  const today = new Date()

                  // 날짜별 완료 여부 맵 생성
                  const completionMap = {}
                  routineHistoryData.forEach(todo => {
                    completionMap[todo.date] = todo.completed
                  })

                  // 월별로 그룹화
                  const monthGroups = []
                  let currentDate = new Date(firstDate)

                  while (currentDate <= today) {
                    const year = currentDate.getFullYear()
                    const month = currentDate.getMonth()
                    const monthKey = `${year}-${month + 1}`

                    if (!monthGroups.find(g => g.key === monthKey)) {
                      monthGroups.push({
                        key: monthKey,
                        year,
                        month,
                        days: []
                      })
                    }

                    const monthGroup = monthGroups.find(g => g.key === monthKey)
                    const dateStr = formatDateForDB(currentDate)
                    const dayOfWeek = currentDate.getDay()

                    // 루틴이 해당 요일에 설정되어 있는지 확인
                    const dayKey = getDayKey(dayOfWeek)
                    const isRoutineDay = selectedRoutineForHistory.days.includes(dayKey)

                    monthGroup.days.push({
                      date: new Date(currentDate),
                      dateStr,
                      day: currentDate.getDate(),
                      dayOfWeek,
                      isCompleted: completionMap[dateStr] === true,
                      isRoutineDay,
                      hasTodo: completionMap[dateStr] !== undefined
                    })

                    currentDate.setDate(currentDate.getDate() + 1)
                  }

                  return (
                    <div className="routine-history-calendar">
                      {monthGroups.map(monthGroup => (
                        <div key={monthGroup.key} className="history-month">
                          <h3 className="history-month-title">
                            {monthGroup.year}년 {monthGroup.month + 1}월
                          </h3>
                          <div className="history-calendar-grid">
                            <div className="history-day-header">일</div>
                            <div className="history-day-header">월</div>
                            <div className="history-day-header">화</div>
                            <div className="history-day-header">수</div>
                            <div className="history-day-header">목</div>
                            <div className="history-day-header">금</div>
                            <div className="history-day-header">토</div>

                            {/* 첫 주의 빈 칸 */}
                            {monthGroup.days.length > 0 && Array(monthGroup.days[0].dayOfWeek).fill(null).map((_, i) => (
                              <div key={`empty-${i}`} className="history-day-cell empty"></div>
                            ))}

                            {/* 날짜 셀 */}
                            {monthGroup.days.map((dayInfo, index) => {
                              // 다음 월의 첫날이면 빈칸 추가
                              if (index > 0 && dayInfo.day === 1) {
                                const prevDay = monthGroup.days[index - 1]
                                const emptyCount = 6 - prevDay.dayOfWeek
                                return (
                                  <>
                                    {Array(emptyCount).fill(null).map((_, i) => (
                                      <div key={`empty-end-${index}-${i}`} className="history-day-cell empty"></div>
                                    ))}
                                    <div key={dayInfo.dateStr} className="history-day-header">일</div>
                                    <div className="history-day-header">월</div>
                                    <div className="history-day-header">화</div>
                                    <div className="history-day-header">수</div>
                                    <div className="history-day-header">목</div>
                                    <div className="history-day-header">금</div>
                                    <div className="history-day-header">토</div>
                                    <div className={`history-day-cell ${dayInfo.isCompleted ? 'completed' : ''} ${!dayInfo.isRoutineDay ? 'not-routine-day' : ''}`}>
                                      <span className="day-number">{dayInfo.day}</span>
                                      {dayInfo.isCompleted && <span className="check-mark">✓</span>}
                                    </div>
                                  </>
                                )
                              }

                              return (
                                <div
                                  key={dayInfo.dateStr}
                                  className={`history-day-cell ${dayInfo.isCompleted ? 'completed' : ''} ${!dayInfo.isRoutineDay ? 'not-routine-day' : ''}`}
                                  title={`${dayInfo.dateStr}${!dayInfo.isRoutineDay ? ' (루틴 요일 아님)' : ''}${dayInfo.isCompleted ? ' - 완료' : dayInfo.hasTodo ? ' - 미완료' : ''}`}
                                >
                                  <span className="day-number">{dayInfo.day}</span>
                                  {dayInfo.isCompleted && <span className="check-mark">✓</span>}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <div className="routine-history-stats">
                  <div className="stat-item">
                    <span className="stat-label">총 투두:</span>
                    <span className="stat-value">{routineHistoryData.length}개</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">완료:</span>
                    <span className="stat-value completed">{routineHistoryData.filter(t => t.completed).length}개</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">미완료:</span>
                    <span className="stat-value incomplete">{routineHistoryData.filter(t => !t.completed).length}개</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">완료율:</span>
                    <span className="stat-value">
                      {routineHistoryData.length > 0
                        ? Math.round((routineHistoryData.filter(t => t.completed).length / routineHistoryData.length) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {showEncouragementModal && (
          <div className="modal-overlay" onClick={() => setShowEncouragementModal(false)}>
            <div className="modal-content encouragement-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>💬 격려 문구 관리</h2>
                <button onClick={() => setShowEncouragementModal(false)} className="modal-close-button">✕</button>
              </div>

              <div className="encouragement-add-section">
                <input
                  type="text"
                  value={newEncouragementMessage}
                  onChange={(e) => setNewEncouragementMessage(e.target.value)}
                  placeholder="새로운 격려 문구를 입력하세요..."
                  className="encouragement-input"
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter' && newEncouragementMessage.trim() !== '') {
                      await addEncouragementMessage(newEncouragementMessage.trim())
                      setNewEncouragementMessage('')
                    }
                  }}
                />
                <button
                  onClick={async () => {
                    if (newEncouragementMessage.trim() !== '') {
                      await addEncouragementMessage(newEncouragementMessage.trim())
                      setNewEncouragementMessage('')
                    }
                  }}
                  className="add-encouragement-button"
                  disabled={newEncouragementMessage.trim() === ''}
                >
                  추가
                </button>
              </div>

              <div className="encouragement-list">
                {encouragementMessages.length === 0 ? (
                  <p className="empty-message">등록된 격려 문구가 없습니다.</p>
                ) : (
                  encouragementMessages.map((message, index) => (
                    <div key={index} className="encouragement-item">
                      {editingEncouragementId === index ? (
                        // 수정 모드
                        <>
                          <input
                            type="text"
                            value={editingEncouragementText}
                            onChange={(e) => setEditingEncouragementText(e.target.value)}
                            className="encouragement-edit-input"
                            placeholder="격려 문구"
                          />
                          <div className="encouragement-item-actions">
                            <button
                              onClick={async () => {
                                if (editingEncouragementText.trim() !== '') {
                                  await updateEncouragementMessage(index, editingEncouragementText.trim())
                                  setEditingEncouragementId(null)
                                  setEditingEncouragementText('')
                                }
                              }}
                              className="encouragement-save-button"
                              disabled={editingEncouragementText.trim() === ''}
                            >
                              저장
                            </button>
                            <button
                              onClick={() => {
                                setEditingEncouragementId(null)
                                setEditingEncouragementText('')
                              }}
                              className="encouragement-cancel-button"
                            >
                              취소
                            </button>
                          </div>
                        </>
                      ) : (
                        // 일반 모드
                        <>
                          <span className="encouragement-text">{message}</span>
                          <div className="encouragement-item-actions">
                            <button
                              onClick={() => {
                                setEditingEncouragementId(index)
                                setEditingEncouragementText(message)
                              }}
                              className="encouragement-edit-button"
                              title="수정"
                            >
                              수정
                            </button>
                            <button
                              onClick={async () => {
                                if (window.confirm('이 격려 문구를 삭제하시겠습니까?')) {
                                  await deleteEncouragementMessage(index)
                                }
                              }}
                              className="encouragement-delete-button"
                              title="삭제"
                            >
                              삭제
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 주요 생각정리 버전 히스토리 모달 */}
        {showKeyThoughtsHistory && (
          <div className="modal-overlay" onClick={() => setShowKeyThoughtsHistory(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '80vh' }}>
              <div className="modal-header">
                <h2>🕐 주요 생각정리 버전 히스토리</h2>
                <button onClick={() => setShowKeyThoughtsHistory(false)} className="modal-close-button">✕</button>
              </div>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                {keyThoughtsHistory.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#999', padding: '20px' }}>
                    저장된 버전이 없습니다.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {keyThoughtsHistory.map((version) => (
                      <div
                        key={version.id}
                        style={{
                          border: '1px solid #ddd',
                          borderRadius: '8px',
                          padding: '16px',
                          backgroundColor: '#f9f9f9'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                              {new Date(version.created_at).toLocaleString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </div>
                            {version.description && (
                              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                                {version.description}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => restoreKeyThoughtsVersion(version.id)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#4CAF50',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '12px'
                            }}
                          >
                            복구
                          </button>
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: '#666',
                          maxHeight: '100px',
                          overflowY: 'auto',
                          backgroundColor: 'white',
                          padding: '8px',
                          borderRadius: '4px',
                          whiteSpace: 'pre-wrap'
                        }}>
                          {/* 블록 내용 미리보기 */}
                          {Array.isArray(version.content) ?
                            version.content.map((block, idx) => (
                              <div key={idx} style={{ marginBottom: '4px' }}>
                                {block.type === 'toggle' ? '▸ ' : ''}{block.content || '(빈 블록)'}
                              </div>
                            ))
                            : '(내용 없음)'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
