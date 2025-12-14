import { useState, useEffect } from 'react'

export function useEncouragement(session, supabase) {
  const [encouragementMessages, setEncouragementMessages] = useState([])
  const [showEncouragementModal, setShowEncouragementModal] = useState(false)
  const [newEncouragementMessage, setNewEncouragementMessage] = useState('')
  const [editingEncouragementId, setEditingEncouragementId] = useState(null)
  const [editingEncouragementText, setEditingEncouragementText] = useState('')
  const [showEncouragementEmoji, setShowEncouragementEmoji] = useState(false)
  const [currentEncouragementMessage, setCurrentEncouragementMessage] = useState('')

  // 랜덤 격려 메시지 가져오기
  const getRandomEncouragement = () => {
    if (encouragementMessages.length === 0) return ""
    const randomIndex = Math.floor(Math.random() * encouragementMessages.length)
    return encouragementMessages[randomIndex]
  }

  // 격려 메시지 클릭 핸들러
  const handleEncouragementClick = () => {
    let attempts = 0
    setShowEncouragementEmoji(true)

    setTimeout(() => {
      let newMessage = getRandomEncouragement()
      // 같은 메시지가 연속으로 나오지 않도록
      while (newMessage === currentEncouragementMessage && encouragementMessages.length > 1 && attempts < 10) {
        newMessage = getRandomEncouragement()
        attempts++
      }

      setShowEncouragementEmoji(false)
      setCurrentEncouragementMessage(newMessage)
    }, 300)
  }

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

  // 격려 메시지가 로드되면 첫 메시지 설정
  useEffect(() => {
    if (encouragementMessages.length > 0 && !currentEncouragementMessage) {
      setCurrentEncouragementMessage(getRandomEncouragement())
    }
  }, [encouragementMessages])

  return {
    encouragementMessages,
    showEncouragementModal,
    setShowEncouragementModal,
    newEncouragementMessage,
    setNewEncouragementMessage,
    editingEncouragementId,
    setEditingEncouragementId,
    editingEncouragementText,
    setEditingEncouragementText,
    showEncouragementEmoji,
    currentEncouragementMessage,
    handleEncouragementClick,
    fetchEncouragementMessages,
    addEncouragementMessage,
    updateEncouragementMessage,
    deleteEncouragementMessage,
  }
}
