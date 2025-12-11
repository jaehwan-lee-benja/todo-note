/**
 * 텍스트 포맷팅 유틸리티 함수들
 */

// 숫자를 두 자리 문자열로 변환 (01, 02, ...)
export const padZero = (num) => {
  return String(num).padStart(2, '0')
}

// 텍스트를 줄바꿈으로 분할
export const splitLines = (text) => {
  return text.split('\n')
}

// 텍스트 앞뒤 공백 제거
export const trimText = (text) => {
  return text.trim()
}

// 시간 문자열을 시와 분으로 분할
export const parseTime = (timeString) => {
  if (!timeString || !timeString.includes(':')) {
    return { hour: '09', minute: '00' }
  }
  const [hour, minute] = timeString.split(':')
  return { hour, minute }
}

// ISO 날짜 문자열에서 날짜 부분만 추출 (YYYY-MM-DD)
export const getDateFromISO = (isoString) => {
  return isoString.split('T')[0]
}
