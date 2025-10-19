import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Redirect() {
  const router = useRouter();
  const { token } = router.query;

  useEffect(() => {
    if (token) {
      // 즉시 메인 페이지로 리다이렉트
      window.location.href = `/?token=${token}`;
    }
  }, [token]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        textAlign: 'center',
        color: 'white'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '20px',
          animation: 'spin 1s linear infinite'
        }}>
          ⚡
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold' }}>
          포털로 이동 중...
        </h2>
      </div>
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}