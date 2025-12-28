/**
 * 주요 생각정리 유틸리티 함수
 * - 플랫 리스트 ↔ 트리 구조 변환
 * - 새로운 블럭 기반 DB 구조 지원
 */

/**
 * 플랫 리스트를 트리 구조로 변환
 * @param {Array} flatBlocks - DB에서 가져온 플랫 리스트 [{block_id, parent_id, position, ...}]
 * @returns {Array} 트리 구조 [{id, content, children: [...]}]
 */
export function buildTree(flatBlocks) {
  if (!Array.isArray(flatBlocks) || flatBlocks.length === 0) {
    return []
  }

  // 1. Map 생성 (block_id → 노드 객체)
  const map = new Map()

  flatBlocks.forEach(block => {
    map.set(block.block_id, {
      id: block.block_id,
      type: block.type || 'toggle',
      content: block.content || '',
      isOpen: block.is_open !== undefined ? block.is_open : true,
      isTodo: block.is_todo || false,
      isCompleted: block.is_completed || false,
      memo: block.memo || '',
      children: [],
      // DB 메타데이터 (필요시 사용)
      _dbId: block.id,
      _parentId: block.parent_id,
      _position: block.position,
      _depth: block.depth,
      _createdAt: block.created_at,
      _updatedAt: block.updated_at
    })
  })

  // 2. 트리 구축
  const roots = []

  flatBlocks.forEach(block => {
    const node = map.get(block.block_id)

    if (block.parent_id === null || block.parent_id === undefined) {
      // 최상위 블럭
      roots.push(node)
    } else {
      // 하위 블럭
      const parent = map.get(block.parent_id)
      if (parent) {
        parent.children.push(node)
      } else {
        // 부모를 찾을 수 없는 경우 최상위로 이동 (데이터 무결성 보호)
        console.warn(`Parent not found for block ${block.block_id}, moving to root`)
        roots.push(node)
      }
    }
  })

  // 3. position 순서로 정렬
  const sortByPosition = (nodes) => {
    nodes.sort((a, b) => (a._position || 0) - (b._position || 0))
    nodes.forEach(node => {
      if (node.children.length > 0) {
        sortByPosition(node.children)
      }
    })
  }

  sortByPosition(roots)

  return roots
}

/**
 * 트리 구조를 플랫 리스트로 변환 (저장용)
 * @param {Array} tree - 트리 구조 [{id, content, children: [...]}]
 * @param {string} parentId - 부모 블럭 ID (재귀 호출용, 기본값: null)
 * @param {number} depth - 현재 깊이 (재귀 호출용, 기본값: 0)
 * @returns {Array} 플랫 리스트 [{block_id, parent_id, position, depth, ...}]
 */
export function flattenTree(tree, parentId = null, depth = 0) {
  if (!Array.isArray(tree)) {
    return []
  }

  let result = []

  tree.forEach((node, index) => {
    const { children, _dbId, _parentId, _position, _depth, _createdAt, _updatedAt, ...blockData } = node

    // DB에 저장할 형식으로 변환
    const flatBlock = {
      block_id: blockData.id || node.id,
      content: blockData.content || '',
      type: blockData.type || 'toggle',
      parent_id: parentId,
      position: index,
      depth: depth,
      is_open: blockData.isOpen !== undefined ? blockData.isOpen : true,
      is_todo: blockData.isTodo || false,
      is_completed: blockData.isCompleted || false,
      memo: blockData.memo || ''
    }

    result.push(flatBlock)

    // children이 있으면 재귀 호출
    if (children && children.length > 0) {
      const childBlocks = flattenTree(children, blockData.id || node.id, depth + 1)
      result = result.concat(childBlocks)
    }
  })

  return result
}

/**
 * 블럭 ID 생성 (타임스탬프 + 랜덤)
 * @returns {string} 고유 블럭 ID
 */
export function generateBlockId() {
  return `${Date.now()}.${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 블럭 데이터 검증
 * @param {Object} block - 블럭 객체
 * @returns {boolean} 유효성 여부
 */
export function validateBlock(block) {
  if (!block || typeof block !== 'object') {
    return false
  }

  // 필수 필드 확인
  if (!block.id && !block.block_id) {
    console.error('Block ID is required')
    return false
  }

  // type 확인
  const validTypes = ['toggle', 'text', 'heading', 'heading1', 'heading2', 'heading3']
  if (block.type && !validTypes.includes(block.type)) {
    console.warn(`Invalid block type: ${block.type}, defaulting to 'toggle'`)
  }

  return true
}

/**
 * 트리에서 특정 블럭 찾기
 * @param {Array} tree - 트리 구조
 * @param {string} blockId - 찾을 블럭 ID
 * @returns {Object|null} 찾은 블럭 또는 null
 */
export function findBlockInTree(tree, blockId) {
  if (!Array.isArray(tree)) {
    return null
  }

  for (const node of tree) {
    if (node.id === blockId || node.block_id === blockId) {
      return node
    }

    if (node.children && node.children.length > 0) {
      const found = findBlockInTree(node.children, blockId)
      if (found) {
        return found
      }
    }
  }

  return null
}

/**
 * 트리의 총 블럭 개수 계산
 * @param {Array} tree - 트리 구조
 * @returns {number} 블럭 개수
 */
export function countBlocks(tree) {
  if (!Array.isArray(tree)) {
    return 0
  }

  let count = 0

  tree.forEach(node => {
    count += 1
    if (node.children && node.children.length > 0) {
      count += countBlocks(node.children)
    }
  })

  return count
}

/**
 * 블럭 데이터 정규화 (children이 항상 배열이 되도록 보장)
 * @param {Array} blocks - 블럭 배열
 * @returns {Array} 정규화된 블럭 배열
 */
export function normalizeBlocks(blocks) {
  if (!Array.isArray(blocks)) {
    return []
  }

  return blocks.map(block => ({
    ...block,
    children: Array.isArray(block.children) ? normalizeBlocks(block.children) : []
  }))
}
