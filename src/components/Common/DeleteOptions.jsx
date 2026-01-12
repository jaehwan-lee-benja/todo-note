import { useState } from 'react'

const DELETE_OPTIONS = [
  {
    value: 'this-only',
    label: '이 할일',
    description: '당일만 삭제',
    tooltip: '과거 기록 유지, 당일것만 삭제, 내일부터 다시 표시함'
  },
  {
    value: 'from-now',
    label: '이번 및 향후 할일',
    description: '당일부터 삭제',
    tooltip: '과거 기록 유지, 당일것 삭제, 내일부터도 표시 안함'
  },
  {
    value: 'all',
    label: '모든 할일',
    description: '모두 삭제',
    tooltip: '과거 기록 삭제, 당일것 삭제, 내일부터도 표시 안함'
  }
]

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  option: (isSelected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '6px',
    background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
    cursor: 'pointer',
    position: 'relative'
  }),
  radio: {
    width: '16px',
    height: '16px',
    cursor: 'pointer'
  },
  labelContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap'
  },
  label: {
    fontWeight: '600'
  },
  description: {
    fontSize: '0.85rem',
    color: '#9ca3af'
  },
  helpButton: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: '1.5px solid #9ca3af',
    background: 'transparent',
    color: '#9ca3af',
    cursor: 'pointer',
    fontSize: '0.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0
  },
  tooltip: {
    position: 'absolute',
    right: '2.5rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: '#1f2937',
    color: '#e5e7eb',
    padding: '0.5rem 0.75rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
    zIndex: 10,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  }
}

/**
 * 삭제 옵션 선택 컴포넌트
 * @param {string} selectedOption - 선택된 옵션 ('this-only' | 'from-now' | 'all')
 * @param {function} onChange - 옵션 변경 핸들러 (value) => void
 * @param {string} name - radio input name (기본값: 'delete-option')
 */
function DeleteOptions({ selectedOption, onChange, name = 'delete-option' }) {
  const [showTooltip, setShowTooltip] = useState(null)

  return (
    <div style={styles.container}>
      {DELETE_OPTIONS.map(option => (
        <div
          key={option.value}
          style={styles.option(selectedOption === option.value)}
          onClick={() => onChange(option.value)}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={selectedOption === option.value}
            onChange={(e) => onChange(e.target.value)}
            style={styles.radio}
          />
          <div style={styles.labelContainer}>
            <div style={styles.labelRow}>
              <span style={styles.label}>{option.label}</span>
              <span style={styles.description}>{option.description}</span>
            </div>
          </div>
          <button
            onMouseEnter={() => setShowTooltip(option.value)}
            onMouseLeave={() => setShowTooltip(null)}
            onClick={(e) => {
              e.stopPropagation()
              setShowTooltip(showTooltip === option.value ? null : option.value)
            }}
            style={styles.helpButton}
          >
            ?
          </button>
          {showTooltip === option.value && (
            <div style={styles.tooltip}>
              {option.tooltip}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default DeleteOptions
