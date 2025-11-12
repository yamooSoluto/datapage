// /pages/api/conversations/send.ts
// 프록시: 웹포탈 → (권장) GCP send-final 또는 (옵션) Chatwoot 직접 업로드
import type { NextApiRequest, NextApiResponse } from 'next';

// ▷ base64 첨부 때문에 바디 용량 상향
export const config = {
    api: { bodyParser: { sizeLimit: '20mb' } },
};

type IncomingAttachment = {
    name: string;
    type?: string;
    size?: number;
    base64: string; // data URL prefix 제거된 순수 base64
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { tenantId, chatId, content = '', attachments = [] } = (req.body || {}) as {
        tenantId?: string;
        chatId?: string;
        content?: string;
        attachments?: IncomingAttachment[];
    };

    if (!tenantId || !chatId) {
        return res.status(400).json({ error: 'tenantId and chatId are required' });
    }

    const atts: IncomingAttachment[] = Array.isArray(attachments) ? attachments.slice(0, 10) : [];

    // 내용 없이 첨부만 전송도 허용
    if (!content && atts.length === 0) {
        return res.status(400).json({ error: 'content or attachments required' });
    }

    // 최소 유효성
    const safeAttachments = atts
        .map((a) => ({
            name: String(a?.name || 'file'),
            type: String(a?.type || 'application/octet-stream'),
            size: Number(a?.size || 0),
            base64: String(a?.base64 || ''),
        }))
        .filter((a) => !!a.base64);

    try {
        const GCLOUD_BASE_URL = process.env.GCLOUD_BASE_URL?.replace(/\/+$/, '');
        if (!GCLOUD_BASE_URL) {
            // ─────────────────────────────────────────────────────────
            // (옵션) Chatwoot 직접 업로드 경로 (멀티파트). GCLOUD 없을 때만 사용.
            // 필요한 ENV: CHATWOOT_BASE_URL, CHATWOOT_ACCOUNT_ID, CW_API_TOKEN
            // ─────────────────────────────────────────────────────────
            const CHATWOOT_BASE = process.env.CHATWOOT_BASE_URL || '';
            const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
            const CW_TOKEN =
                process.env.CW_API_TOKEN ||
                process.env.CHATWOOT_TOKEN ||
                process.env.CHATWOOT_API_TOKEN;

            if (!CHATWOOT_BASE || !CHATWOOT_ACCOUNT_ID || !CW_TOKEN) {
                return res.status(500).json({ error: 'No GCLOUD_BASE_URL and Chatwoot ENV not configured' });
            }

            // form-data 동적 import (Next edge 아님)
            const FormData = (await import('form-data')).default;
            const form = new FormData();

            // Chatwoot 메시지 본문 (내용이 비어도 허용)
            form.append('content', content || '');

            // 첨부 (attachments[])
            for (const a of safeAttachments) {
                const buf = Buffer.from(a.base64, 'base64');
                form.append('attachments[]', buf, { filename: a.name, contentType: a.type });
            }

            const endpoint = `${CHATWOOT_BASE}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${encodeURIComponent(
                chatId
            )}/messages`;

            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    api_access_token: CW_TOKEN,
                    ...form.getHeaders(),
                } as any,
                body: form as any,
            });

            const data = await resp.json().catch(() => ({}));
            if (!resp.ok) {
                return res.status(resp.status).json({ error: 'chatwoot upload failed', detail: data });
            }
            return res.status(200).json({ ok: true, via: 'chatwoot', data });
        }

        // ─────────────────────────────────────────────────────────
        // (권장) GCP send-final로 프록시
        // 서버에서 실제 업로드/전송(채널/Chatwoot/GCS)을 처리
        // ─────────────────────────────────────────────────────────
        const payload = {
            tenantId,
            conversationId: chatId,
            content: content || '',            // 내용 없이 전송 허용
            attachments: safeAttachments,      // [{name,type,size,base64}]
            via: 'agent',
            sent_as: 'agent',
            confirmMode: false,
            mediatedSource: 'agent_comment',
        };

        const resp = await fetch(`${GCLOUD_BASE_URL}/api/n8n/send-final`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // 내부 보호용 토큰 있으면 함께 전달 (선택)
                ...(process.env.N8N_TOKEN ? { 'x-internal-auth': process.env.N8N_TOKEN } : {}),
            },
            body: JSON.stringify(payload),
        });

        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            return res.status(resp.status).json({ error: 'send-final failed', detail: data });
        }

        return res.status(200).json({ ok: true, via: 'gcp', data });
    } catch (e: any) {
        console.error('[send] error:', e);
        return res.status(500).json({ error: e?.message || 'internal error' });
    }
}
