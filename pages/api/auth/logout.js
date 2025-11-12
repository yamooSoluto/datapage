// pages/api/auth/logout.js
// ════════════════════════════════════════
// 로그아웃 (쿠키 삭제)
// ════════════════════════════════════════

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 쿠키 삭제
  res.setHeader('Set-Cookie', [
    `yamoo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  ]);

  return res.status(200).json({ success: true });
}

