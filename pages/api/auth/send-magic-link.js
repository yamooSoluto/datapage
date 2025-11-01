// pages/api/auth/send-magic-link.js
// ════════════════════════════════════════
// 이메일로 매직링크 전송 (n8n 웹훅 연동)
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';
import { google } from 'googleapis';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ error: '이메일을 입력해주세요.' });
    }

    try {
        // ✅ 1. Google Sheets에서 해당 이메일의 테넌트 확인
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
            console.warn(`❌ [Send Magic Link] 등록되지 않은 이메일: ${email}`);
            return res.status(404).json({
                error: '등록되지 않은 이메일입니다.'
            });
        }

        // ✅ 2. 24시간 유효 토큰 생성
        const token = jwt.sign(
            {
                email: email.toLowerCase(),
                source: 'magic-link',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24), // 24시간
            },
            process.env.JWT_SECRET
        );

        // ✅ 3. 매직링크 URL 생성
        const portalDomain = process.env.PORTAL_DOMAIN || 'https://app.yamoo.ai.kr';
        const magicLink = `${portalDomain}/?token=${token}`;

        console.log(`✅ [Send Magic Link] ${email} → ${tenants.length}개 테넌트`);

        // ✅ 4. n8n 웹훅으로 이메일 전송
        const n8nWebhookUrl = process.env.N8N_MAGIC_LINK_WEBHOOK_URL;

        if (n8nWebhookUrl) {
            try {
                const emailPayload = {
                    to: email,
                    subject: '🔐 야무 포털 로그인 링크',
                    magicLink: magicLink,
                    tenantsCount: tenants.length,
                    expiresIn: '24시간',
                    timestamp: new Date().toISOString(),
                };

                console.log(`📤 [Send Magic Link] n8n 웹훅 호출:`, {
                    url: n8nWebhookUrl,
                    to: email,
                });

                const webhookResponse = await fetch(n8nWebhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(emailPayload),
                });

                if (!webhookResponse.ok) {
                    const errorText = await webhookResponse.text().catch(() => 'No response body');
                    console.error(`❌ [Send Magic Link] n8n webhook failed:`, {
                        status: webhookResponse.status,
                        statusText: webhookResponse.statusText,
                        body: errorText,
                    });
                    throw new Error(`n8n webhook failed: ${webhookResponse.status}`);
                }

                const result = await webhookResponse.json().catch(() => ({}));
                console.log(`📧 [Send Magic Link] 이메일 전송 완료:`, {
                    email,
                    success: result.success,
                });

            } catch (webhookError) {
                console.error('❌ [Send Magic Link] n8n webhook error:', webhookError);
                // 이메일 전송 실패 시 사용자에게 에러 반환
                return res.status(500).json({
                    error: '이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.',
                    details: process.env.NODE_ENV === 'development' ? webhookError.message : undefined,
                });
            }
        } else {
            console.warn('⚠️ [Send Magic Link] N8N_MAGIC_LINK_WEBHOOK_URL not set');
            return res.status(500).json({
                error: '이메일 전송 서비스가 설정되지 않았습니다.',
            });
        }

        // ✅ 5. 성공 응답
        return res.status(200).json({
            success: true,
            message: '로그인 링크가 이메일로 전송되었습니다.',
            // 개발용: 실제 프로덕션에서는 magicLink 제거
            magicLink: process.env.NODE_ENV === 'development' ? magicLink : undefined,
            tenantsCount: tenants.length,
        });

    } catch (error) {
        console.error('❌ [Send Magic Link] Error:', error);
        return res.status(500).json({
            error: '서버 오류가 발생했습니다.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
}

export default handler;