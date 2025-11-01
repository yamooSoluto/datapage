// pages/api/auth/admin-login.js
import jwt from 'jsonwebtoken';

function cookieString(name, value, { maxAge = 60 * 60 * 24, secure = process.env.NODE_ENV === 'production' } = {}) {
    // HttpOnly 세션 쿠키
    let c = `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
    if (secure) c += '; Secure';
    return c;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { email, code } = req.body || {};
    if (!email || !code) return res.status(400).json({ error: 'email, code 모두 필요합니다.' });

    const admins = (process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(v => v.trim().toLowerCase())
        .filter(Boolean);

    if (!admins.includes(String(email).toLowerCase()))
        return res.status(403).json({ error: '관리자 이메일이 아닙니다.' });

    if (code !== process.env.ADMIN_LOGIN_SECRET)
        return res.status(401).json({ error: '비밀 코드가 올바르지 않습니다.' });

    // 관리자 토큰 발급 (24시간)
    const now = Math.floor(Date.now() / 1000);
    const token = jwt.sign(
        {
            email: String(email).toLowerCase(),
            role: 'admin',
            source: 'admin-login',
            iat: now,
            exp: now + 60 * 60 * 24,
        },
        process.env.JWT_SECRET
    );

    res.setHeader('Set-Cookie', cookieString('yamoo_session', token));
    return res.status(200).json({ success: true, role: 'admin' });
}
