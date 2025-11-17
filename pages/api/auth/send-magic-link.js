// pages/api/auth/send-magic-link.js
// ════════════════════════════════════════
// 이메일 매직링크 + 관리자 2단계(비밀키) 바이패스
// ✅ Firestore 버전
// ✅ mode 파라미터 추가: 'link' (기본) | 'otp' (PWA용)
// ════════════════════════════════════════

import jwt from 'jsonwebtoken';
import { db } from '@/lib/firebase-admin';
import crypto from 'crypto';

function parseAdminList(v) {
    return String(v || '')
        .split(/[,;\n]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

function isAdminEmail(email, adminList) {
    if (!email) return false;
    const e = email.toLowerCase();
    if (adminList.includes(e)) return true;
    const domains = adminList.filter((x) => x.startsWith('@'));
    return domains.some((dom) => e.endsWith(dom));
}

// 타이밍 안전 비교
function safeEqual(input, secret) {
    const a = Buffer.from(String(input || ''));
    const b = Buffer.from(String(secret || ''));
    if (a.length !== b.length) return false;
    try {
        return crypto.timingSafeEqual(a, b);
    } catch {
        return false;
    }
}

// 6자리 숫자 OTP 생성
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, adminSecret, mode = 'link' } = req.body || {};
    if (!email) return res.status(400).json({ error: '이메일을 입력해주세요.' });

    const portalDomain = process.env.PORTAL_DOMAIN || 'https://app.yamoo.ai.kr';
    const adminList = parseAdminList(process.env.ADMIN_EMAILS);
    const adminLoginSecret = process.env.ADMIN_LOGIN_SECRET || '';
    const isDev = process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV !== 'production';

    try {
        // ─────────────────────────────────────────────────────
        // A) 관리자 이메일인 경우: 2단계(비밀키) 요구
        // ─────────────────────────────────────────────────────
        if (isAdminEmail(email, adminList)) {
            // ✅ 개발 환경에서는 비밀키 생략하고 바로 관리자 페이지 입장
            if (isDev) {
                const now = Math.floor(Date.now() / 1000);
                const token = jwt.sign(
                    {
                        email: email.toLowerCase(),
                        role: 'admin',
                        source: 'magic-link-admin-dev',
                        iat: now,
                        exp: now + 60 * 60 * 24
                    },
                    process.env.JWT_SECRET
                );
                const redirectPath = '/admin';
                const redirectUrl = `${portalDomain}/?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirectPath)}&admin=1`;
                console.log(`🧭 [Admin Dev Fastlane] ${email} -> ${redirectUrl}`);
                return res.status(200).json({
                    success: true,
                    direct: true,
                    redirectUrl,
                    magicLink: redirectUrl,
                });
            }

            // 2-1) 아직 비밀키를 안 넣었으면, 도전장만 반환
            if (!adminSecret) {
                return res.status(200).json({
                    adminChallenge: true,
                    message: '관리자 비밀키를 입력해주세요.',
                });
            }

            // 2-2) 비밀키 검증 (타이밍 안전 비교)
            const ok = safeEqual(adminSecret, adminLoginSecret);
            if (!ok) {
                return res.status(401).json({
                    error: '관리자 비밀키가 올바르지 않습니다.',
                    adminChallenge: true,
                });
            }

            // 2-3) 바로 입장용 토큰 & 리다이렉트 URL 발급
            const now = Math.floor(Date.now() / 1000);
            const token = jwt.sign(
                {
                    email: email.toLowerCase(),
                    role: 'admin',
                    source: 'magic-link-admin-2step',
                    iat: now,
                    exp: now + 60 * 60 * 24, // 24h
                },
                process.env.JWT_SECRET
            );

            const redirectPath = '/admin';
            const redirectUrl = `${portalDomain}/?token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirectPath)}&admin=1`;

            console.log(`✅ [Admin Fastlane] ${email} -> ${redirectUrl}`);

            return res.status(200).json({
                success: true,
                direct: true,
                redirectUrl,
                magicLink: process.env.NODE_ENV === 'development' ? redirectUrl : undefined,
            });
        }

        // ─────────────────────────────────────────────────────
        // B) 일반 사용자: Firestore 조회 → 매직링크 OR OTP
        // ─────────────────────────────────────────────────────

        // ✅ Firestore에서 이메일로 테넌트 조회
        const tenantsSnapshot = await db.collection('tenants')
            .where('email', '==', email.toLowerCase())
            .get();

        if (tenantsSnapshot.empty) {
            console.warn(`❌ [Send Magic Link] 등록되지 않은 이메일: ${email}`);
            return res.status(404).json({ error: '등록되지 않은 이메일입니다.' });
        }

        // ✅ 조회된 테넌트 목록
        const tenants = [];
        tenantsSnapshot.forEach(doc => {
            const data = doc.data();
            tenants.push({
                tenantId: doc.id,
                email: data.email,
                brandName: data.brandName,
                plan: data.plan || 'trial',
            });
        });

        // ═══════════════════════════════════════════════════════
        // MODE 분기: 'otp' vs 'link' (기본)
        // ═══════════════════════════════════════════════════════

        // 🔐 PWA Mode: OTP 코드 발송
        if (mode === 'otp') {
            const otp = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10분 유효

            // Firestore에 OTP 저장
            await db.collection('otp_codes').add({
                email: email.toLowerCase(),
                code: otp,
                expiresAt: expiresAt.toISOString(),
                createdAt: new Date().toISOString(),
                used: false,
            });

            // n8n으로 OTP 이메일 발송
            const n8nWebhookUrl = process.env.N8N_EMAIL_WEBHOOK_URL;
            if (!n8nWebhookUrl) {
                console.warn('⚠️ [Send OTP] N8N_EMAIL_WEBHOOK_URL not set');
                return res.status(500).json({ error: '이메일 전송 서비스가 설정되지 않았습니다.' });
            }

            const emailPayload = {
                to: email,
                subject: '🔐 야무 포털 로그인 코드',
                type: 'otp',
                otp,
                expiresIn: '10분',
                timestamp: new Date().toISOString(),
            };

            const webhookResponse = await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emailPayload),
            });

            if (!webhookResponse.ok) {
                console.error('❌ [Send OTP] n8n webhook failed');
                return res.status(500).json({
                    error: '이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.'
                });
            }

            console.log(`📧 [Send OTP] 코드 발송 완료: ${email} (코드: ${otp})`);

            return res.status(200).json({
                success: true,
                message: '로그인 코드가 이메일로 전송되었습니다.',
                mode: 'otp',
                expiresIn: 600,
            });
        }

        // 🔗 기본 Mode: 매직링크 발송
        // ✅ JWT 토큰 생성 (24시간)
        const token = jwt.sign(
            {
                email: email.toLowerCase(),
                role: 'user',
                source: 'magic-link',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
            },
            process.env.JWT_SECRET
        );

        const magicLink = `${portalDomain}/?token=${encodeURIComponent(token)}`;

        // ✅ n8n Webhook으로 이메일 전송
        const n8nWebhookUrl = process.env.N8N_EMAIL_WEBHOOK_URL;
        if (!n8nWebhookUrl) {
            console.warn('⚠️ [Send Magic Link] N8N_EMAIL_WEBHOOK_URL not set');
            return res.status(500).json({ error: '이메일 전송 서비스가 설정되지 않았습니다.' });
        }

        const emailPayload = {
            to: email,
            subject: '🔓 야무 포털 로그인 링크',
            type: 'magic-link',
            magicLink,
            tenantsCount: tenants.length,
            expiresIn: '24시간',
            timestamp: new Date().toISOString(),
        };

        const webhookResponse = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailPayload),
        });

        if (!webhookResponse.ok) {
            const errorText = await webhookResponse.text().catch(() => 'No response body');
            console.error('❌ [Send Magic Link] n8n webhook failed:', {
                status: webhookResponse.status,
                statusText: webhookResponse.statusText,
                body: errorText,
            });
            return res.status(500).json({
                error: '이메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.'
            });
        }

        const result = await webhookResponse.json().catch(() => ({}));
        console.log(`📧 [Send Magic Link] 이메일 전송 완료:`, {
            email,
            tenantsCount: tenants.length,
            success: result.success
        });

        return res.status(200).json({
            success: true,
            message: '로그인 링크가 이메일로 전송되었습니다.',
            mode: 'link',
            tenantsCount: tenants.length,
            magicLink: process.env.NODE_ENV === 'development' ? magicLink : undefined,
        });

    } catch (err) {
        console.error('❌ [Send Magic Link] Error:', err);
        return res.status(500).json({
            error: '서버 오류가 발생했습니다.',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined,
        });
    }
}