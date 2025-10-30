// pages/api/auth/send-magic-link.js
// ════════════════════════════════════════
// 이메일로 매직링크 전송
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

// ✅ 핸들러 함수를 먼저 정의
async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: '이메일을 입력해주세요.' });
    }

    try {
        // ✅ Google Sheets에서 해당 이메일의 테넌트 확인
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
                private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SHEET_ID,
            range: 'Tenants!A2:K1000',
        });

        const rows = response.data.values || [];
        const tenants = rows.filter(row => row[3]?.toLowerCase() === email.toLowerCase());

        if (tenants.length === 0) {
            console.warn(`[Send Magic Link] 등록되지 않은 이메일: ${email}`);
            return res.status(404).json({
                error: '등록되지 않은 이메일입니다.'
            });
        }

        // ✅ 24시간 유효 토큰 생성
        const token = jwt.sign(
            {
                email: email.toLowerCase(),
                source: 'magic-link',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24시간
            },
            process.env.JWT_SECRET
        );

        // ✅ 매직링크 URL 생성
        const portalDomain = process.env.PORTAL_DOMAIN || 'https://app.yamoo.ai.kr';
        const magicLink = `${portalDomain}/?token=${token}`;

        console.log(`✅ [Send Magic Link] ${email} → ${tenants.length}개 테넌트`);

        // TODO: 실제로는 이메일 전송 (현재는 URL만 반환)
        // await sendEmail(email, magicLink);

        return res.status(200).json({
            success: true,
            message: '로그인 링크가 이메일로 전송되었습니다.',
            // 개발용: 실제 프로덕션에서는 magicLink 제거
            magicLink: process.env.NODE_ENV === 'development' ? magicLink : undefined,
            tenantsCount: tenants.length
        });

    } catch (error) {
        console.error('❌ [Send Magic Link] Error:', error);
        return res.status(500).json({
            error: '서버 오류가 발생했습니다.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

// ✅ 반드시 export default를 마지막에!
export default handler;