// /pages/api/conversations/send.ts
export default async function handler(req, res) {
    const { tenantId, chatId, content } = req.body || {};
    // TODO: 입력 검증 + 권한 확인
    // GCF send-final 프록시
    const r = await fetch(process.env.GCLOUD_BASE_URL + '/api/n8n/send-final', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, conversationId: chatId, content, via: 'agent', sent_as: 'agent', mode: 'direct' })
    });
    return r.ok ? res.status(200).json({ ok: true }) : res.status(500).json({ ok: false });
}
