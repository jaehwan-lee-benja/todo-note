import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

/**
 * 타임라인 내 정렬 가능한 투두 아이템
 */
function TimelineTodoItem({
  todo,
  index,
  totalCount,
  hour,
  startHour,
  endHour,
  onToggle,
  onRemoveFromTimeline,
  onMoveUpInTimeline,
  onMoveDownInTimeline
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `timeline-todo-${todo.id}`,
    data: {
      type: 'timeline-todo',
      todo: todo
    }
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // 최상위 시간대의 첫 번째 투두면 위로 버튼 숨김
  const canMoveUp = !(index === 0 && hour <= startHour)
  // 최하위 시간대의 마지막 투두면 아래로 버튼 숨김
  const canMoveDown = !(index === totalCount - 1 && hour >= endHour)

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showMoveMenu && !e.target.closest('.timeline-todo-handle-wrapper')) {
        setShowMoveMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showMoveMenu])

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`timeline-scheduled-todo ${isDragging ? 'dragging' : ''}`}
    >
      <div className="timeline-todo-handle-wrapper">
        <span
          className="timeline-todo-handle"
          {...attributes}
          {...listeners}
          onClick={(e) => {
            e.stopPropagation()
            setShowMoveMenu(!showMoveMenu)
          }}
          title="클릭: 이동 메뉴 / 길게 누름: 드래그"
        ></span>
        {showMoveMenu && (
          <div className="timeline-move-menu">
            {canMoveUp && (
              <button
                className="timeline-move-menu-item move-to-top"
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveUpInTimeline(todo.id)
                  setShowMoveMenu(false)
                }}
              >
                <span>↑</span> 위로
              </button>
            )}
            {canMoveDown && (
              <button
                className="timeline-move-menu-item move-to-bottom"
                onClick={(e) => {
                  e.stopPropagation()
                  onMoveDownInTimeline(todo.id)
                  setShowMoveMenu(false)
                }}
              >
                <span>↓</span> 아래로
              </button>
            )}
            <button
              className="timeline-move-menu-item remove"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveFromTimeline(todo.id)
                setShowMoveMenu(false)
              }}
            >
              <span>✕</span> 제거
            </button>
          </div>
        )}
      </div>
      <label className="timeline-todo-checkbox">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
        />
        <span className="timeline-checkbox-custom"></span>
      </label>
      <span className={`timeline-todo-text ${todo.completed ? 'completed' : ''}`}>
        {todo.text}
      </span>
      <button
        className="timeline-todo-remove-button"
        onClick={(e) => {
          e.stopPropagation()
          onRemoveFromTimeline(todo.id)
        }}
        title="타임라인에서 제거"
      >
        ✕
      </button>
    </div>
  )
}

/**
 * 드롭 가능한 시간 슬롯 컴포넌트
 */
function DroppableTimeSlot({
  hour,
  startHour,
  endHour,
  scheduledTodos,
  onToggle,
  onRemoveFromTimeline,
  onMoveUpInTimeline,
  onMoveDownInTimeline
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `timeline-${hour}`,
    data: {
      type: 'timeline',
      hour: hour
    }
  })

  // 이 시간대에 배치된 투두들 (분 값으로 정렬)
  const todosAtThisHour = scheduledTodos
    .filter(todo => {
      if (!todo.scheduled_time) return false
      const scheduledHour = parseInt(todo.scheduled_time.split(':')[0], 10)
      return scheduledHour === hour
    })
    .sort((a, b) => {
      const minA = parseInt(a.scheduled_time.split(':')[1], 10)
      const minB = parseInt(b.scheduled_time.split(':')[1], 10)
      return minA - minB
    })

  return (
    <div
      ref={setNodeRef}
      className={`timeline-hour-slot ${isOver ? 'timeline-drop-active' : ''}`}
    >
      <div className="timeline-hour-label">
        {hour === 24 ? '00:00' : `${hour.toString().padStart(2, '0')}:00`}
      </div>
      <div className="timeline-hour-content">
        {todosAtThisHour.map((todo, index) => (
          <TimelineTodoItem
            key={todo.id}
            todo={todo}
            index={index}
            totalCount={todosAtThisHour.length}
            hour={hour}
            startHour={startHour}
            endHour={endHour}
            onToggle={onToggle}
            onRemoveFromTimeline={onRemoveFromTimeline}
            onMoveUpInTimeline={onMoveUpInTimeline}
            onMoveDownInTimeline={onMoveDownInTimeline}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * 타임라인 뷰 컴포넌트
 */
const TimelineView = forwardRef(function TimelineView({
  startHour = 6,
  endHour = 24,
  scheduledTodos = [],
  onToggle,
  onRemoveFromTimeline,
  onMoveUpInTimeline,
  onMoveDownInTimeline
}, ref) {
  const [currentTime, setCurrentTime] = useState(new Date())
  const timelineRef = useRef(null)
  const currentTimeRef = useRef(null)

  // 현재 시간으로 스크롤하는 함수
  const scrollToNow = () => {
    if (currentTimeRef.current && timelineRef.current) {
      const container = timelineRef.current
      const indicator = currentTimeRef.current
      const containerHeight = container.clientHeight
      const indicatorTop = indicator.offsetTop

      container.scrollTo({
        top: indicatorTop - containerHeight / 2,
        behavior: 'smooth'
      })
    }
  }

  // ref를 통해 scrollToNow 메서드 노출
  useImperativeHandle(ref, () => ({
    scrollToNow
  }))

  // 1분마다 현재 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)

    return () => clearInterval(timer)
  }, [])

  // 현재 시간 위치로 스크롤 (초기 로딩 시)
  useEffect(() => {
    if (currentTimeRef.current && timelineRef.current) {
      const container = timelineRef.current
      const indicator = currentTimeRef.current
      const containerHeight = container.clientHeight
      const indicatorTop = indicator.offsetTop

      container.scrollTop = indicatorTop - containerHeight / 2
    }
  }, [])

  // 시간 슬롯 생성
  const hours = []
  for (let h = startHour; h <= endHour; h++) {
    hours.push(h)
  }

  // 현재 시간의 위치 계산 (퍼센트)
  const getCurrentTimePosition = () => {
    const hours = currentTime.getHours()
    const minutes = currentTime.getMinutes()
    const totalMinutes = hours * 60 + minutes
    const startMinutes = startHour * 60
    const endMinutes = endHour * 60
    const range = endMinutes - startMinutes

    if (totalMinutes < startMinutes) return 0
    if (totalMinutes > endMinutes) return 100

    return ((totalMinutes - startMinutes) / range) * 100
  }

  // 현재 시간이 표시 범위 내인지 확인
  const isCurrentTimeVisible = () => {
    const hours = currentTime.getHours()
    return hours >= startHour && hours <= endHour
  }

  // 현재 시간 포맷팅
  const formatCurrentTime = () => {
    return currentTime.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    })
  }

  return (
    <div className="timeline-view" ref={timelineRef}>
      <div className="timeline-grid">
        {hours.map((hour) => (
          <DroppableTimeSlot
            key={hour}
            hour={hour}
            startHour={startHour}
            endHour={endHour}
            scheduledTodos={scheduledTodos}
            onToggle={onToggle}
            onRemoveFromTimeline={onRemoveFromTimeline}
            onMoveUpInTimeline={onMoveUpInTimeline}
            onMoveDownInTimeline={onMoveDownInTimeline}
          />
        ))}

        {/* 현재 시간 인디케이터 */}
        {isCurrentTimeVisible() && (
          <div
            ref={currentTimeRef}
            className="timeline-current-time"
            style={{ top: `${getCurrentTimePosition()}%` }}
          >
            <div className="timeline-current-time-dot"></div>
            <div className="timeline-current-time-line"></div>
            <div className="timeline-current-time-label">
              {formatCurrentTime()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

export default TimelineView
