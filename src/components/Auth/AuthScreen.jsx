/**
 * 인증 화면 컴포넌트
 * - 로딩 중 화면 (authLoading)
 * - 로그인 화면 (!session) - Google/Apple 로그인 지원
 */

export default function AuthScreen({ authLoading, session, handleGoogleLogin, handleAppleLogin }) {
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
          maxWidth: '400px',
          width: '90%'
        }}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📝 Todo Note</h1>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '2rem' }}>
            날짜별 투두 관리 및 루틴 트래킹
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Apple 로그인 버튼 */}
            <button
              onClick={handleAppleLogin}
              style={{
                padding: '0.875rem 1.5rem',
                fontSize: '1rem',
                background: '#000000',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                fontWeight: '500'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              Apple로 로그인
            </button>

            {/* Google 로그인 버튼 */}
            <button
              onClick={handleGoogleLogin}
              style={{
                padding: '0.875rem 1.5rem',
                fontSize: '1rem',
                background: '#ffffff',
                color: '#333333',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                width: '100%',
                fontWeight: '500'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 로그인
            </button>
          </div>

          <p style={{
            fontSize: '0.75rem',
            color: 'rgba(255, 255, 255, 0.4)',
            marginTop: '2rem',
            lineHeight: '1.5'
          }}>
            로그인 시 개인정보처리방침 및 이용약관에 동의하게 됩니다.
          </p>
        </div>
      </div>
    )
  }

  // 로그인 완료 시에는 null 반환 (메인 앱 표시)
  return null
}
