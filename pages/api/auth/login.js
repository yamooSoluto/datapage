import { google } from 'googleapis';

export default async function handler(req, res) {
  // POST 메서드만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  // 입력값 검증
  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  try {
    // Google Sheets API 인증
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Tenants 시트에서 사용자 정보 조회
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Tenants!A2:E1000', // 헤더 제외하고 A2부터 읽기
    });

    const rows = response.data.values || [];

    // 이메일과 비밀번호가 일치하는 테넌트 찾기
    const tenant = rows.find(row => {
      const rowEmail = row[1]; // B열: Email
      const rowPassword = row[2]; // C열: Password
      return rowEmail === email && rowPassword === password;
    });

    if (!tenant) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 로그인 성공 - 테넌트 정보 반환
    return res.status(200).json({
      id: tenant[0],        // A열: TenantID
      email: tenant[1],     // B열: Email
      name: tenant[3],      // D열: Name
      plan: tenant[4]       // E열: Plan
    });

  } catch (error) {
    console.error('Login API error:', error);
    
    // 에러 종류에 따라 다른 메시지 반환
    if (error.message.includes('API key')) {
      return res.status(500).json({ 
        error: 'Google API 설정 오류입니다. 관리자에게 문의하세요.',
        details: error.message 
      });
    }

    return res.status(500).json({ 
      error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}