
// /pages/api/ai/correct.ts
export default async function handler(req, res) {
    const { tenantId, chatId, content, options } = req.body || {};
    // TODO: 입력 검증 + 권한 확인
    // n8n tone-correction 프록시
    const r = await fetch(process.env.N8N_TONE_CORRECTION_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tenantId, conversationId: chatId,
            userMessage: '',            // 필요 시 최근 유저메시지 조회해서 채워넣기
            agentInstruction: content,  // 현재 초안
            mode: 'mediated',
            source: 'portal',
            planName: options ? 'business' : 'pro',
            ...options && { voice: options.voice, contentType: options.contentType, toneFlags: options.toneFlags },
            callbackUrl: process.env.GCLOUD_BASE_URL + '/api/slack/tone-result'
        })
    });
    return r.ok ? res.status(200).json({ ok: true }) : res.status(500).json({ ok: false });
}