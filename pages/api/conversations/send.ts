// /pages/api/conversations/send.ts
import type { NextApiRequest, NextApiResponse } from 'next';

export const config = {
    api: { bodyParser: { sizeLimit: '20mb' } }, // 첨부 base64 대비
};

type IncomingAttachment = {
    name: string;
    type?: string;
    size?: number;
    base64?: string;   // 순수 base64
    dataUrl?: string;  // data:...;base64,xxxx
    url?: string;      // 사전 업로드된 파일 URL (옵션)
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

    const atts = Array.isArray(attachments) ? attachments.slice(0, 10) : [];
    const hasContent = !!(content && String(content).length > 0);
    const hasFiles = atts.length > 0;

    // 내용 없이 첨부만 전송도 허용
    if (!hasContent && !hasFiles) {
        return res.status(400).json({ error: 'content or attachments required' });
    }

    // dataUrl → base64 정규화
    const safeAttachments = atts
        .map((a) => {
            const base64 =
                a?.base64
                    ? String(a.base64)
                    : a?.dataUrl && String(a.dataUrl).startsWith('data:')
                        ? String(a.dataUrl).split(',')[1] ?? ''
                        : '';

            const out: Record<string, any> = {
                name: String(a?.name || 'file'),
                type: String(a?.type || 'application/octet-stream'),
                size: Number(a?.size || 0),
            };
            if (a?.url) out.url = String(a.url);
            if (base64) out.base64 = base64;
            return out;
        })
        .filter((a) => 'url' in a || 'base64' in a);

    try {
        const GCLOUD_BASE_URL = process.env.GCLOUD_BASE_URL?.replace(/\/+$/, '');
        if (!GCLOUD_BASE_URL) {
            return res.status(500).json({ error: 'GCLOUD_BASE_URL not set' });
        }

        const payload = {
            tenantId,
            conversationId: chatId,
            content: content || '',       // 비어 있어도 OK (첨부만 전송)
            attachments: safeAttachments, // [{name,type,size,base64|url}]
            via: 'agent',
            sent_as: 'agent',
            confirmMode: false,
            mediatedSource: 'agent_comment',
        };

        const resp = await fetch(`${GCLOUD_BASE_URL}/api/n8n/send-final`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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
        console.error('[api/conversations/send] error:', e);
        return res.status(500).json({ error: e?.message || 'internal error' });
    }
}
