// pages/api/n8n/send-final.ts
// 통합 최종 전송 엔드포인트 (n8n/슬랙/포탈 공용)

import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";

// ── Firebase Admin 초기화 ───────────────────────────
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
    });
}
const db = admin.firestore();

// ── ENV ─────────────────────────────────────────────
const CHATWOOT_BASE = process.env.CHATWOOT_BASE_URL || "";
const CHATWOOT_ACCOUNT_ID = Number(process.env.CHATWOOT_ACCOUNT_ID || 0);
const N8N_PROXY_TOKEN = process.env.N8N_PROXY_TOKEN || ""; // n8n→Vercel 인증용(헤더 x-n8n-token)

type SendFinalBody = {
    conversationId?: string | number;
    content?: string;
    attachments?: Array<{ url: string; filename?: string }> | null;
    privateNote?: boolean;
    instruction_mode?: boolean;

    accountId?: number | string | null;
    inboxId?: number | string | null;
    tenantId?: string | null;

    via?: "ai" | "agent";
    mode?: string | null;
    mediatedSource?: string | null;
    sent_as?: "ai" | "agent" | null;

    confirmBypass?: boolean;
    documentId?: string | null;
    slackCleanup?: any;
    channel?: string | null;
};

// ── 유틸 ─────────────────────────────────────────────
const num = (v: any) => (v === 0 || Number(v) ? Number(v) : null);
const nowTs = () => admin.firestore.Timestamp.now();

async function verifyN8NToken(req: NextApiRequest) {
    if (!N8N_PROXY_TOKEN) return true; // 토큰 미설정 시 패스(선택)
    const t = req.headers["x-n8n-token"] || req.query.token;
    return String(t || "") === N8N_PROXY_TOKEN;
}

async function getEffectiveMode(tenantId: string | null, conversationId: string) {
    // 조직마다 저장 위치가 다를 수 있어 최소 구현(없으면 AUTO)
    try {
        const doc = await db
            .collection("Conversation_Mode")
            .doc(`${tenantId || "default"}_${conversationId}`)
            .get();
        const v = (doc.exists && (doc.data()?.mode as string)) || "AUTO";
        return String(v).toUpperCase();
    } catch {
        return "AUTO";
    }
}

async function isStopped(conversationId: string) {
    try {
        const st = await db.collection("Chat_AI_Status").doc(conversationId).get();
        return st.exists && st.data()?.status === "stop";
    } catch {
        return false;
    }
}

function buildContentAttributes(opts: {
    via?: "ai" | "agent";
    mode?: string | null;
    mediatedSource?: string | null;
    instruction_mode?: boolean;
    documentId?: string | null;
    confirmBypass?: boolean;
    sent_as?: "ai" | "agent" | null;
    channel?: string | null;
}) {
    return {
        via: opts.via || "ai",
        pipeline: "n8n",
        sent_as: opts.sent_as || opts.via || "ai",
        source: opts.via === "agent" ? "agent" : "bot",
        instruction_mode: !!opts.instruction_mode,
        generated_at: new Date().toISOString(),
        ...(opts.documentId ? { document_id: opts.documentId } : {}),
        ...(opts.via === "ai" ? { mode: opts.mode } : {}),
        ...(opts.via === "ai" && opts.mode === "mediated" && opts.mediatedSource
            ? { mediatedSource: opts.mediatedSource }
            : {}),
        ...(opts.confirmBypass ? { confirmBypassed: true } : {}),
        ...(opts.channel ? { channel: opts.channel } : {}),
    };
}

async function fetchCwConversation(convId: number) {
    // Admin API로 보충 정보
    const res = await fetch(
        `${CHATWOOT_BASE}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${convId}`,
        {
            headers: { "Content-Type": "application/json" },
        }
    );
    if (!res.ok) return null;
    return res.json();
}

async function sendToChatwoot(params: {
    conversationId: number;
    content: string;
    privateNote?: boolean;
    content_attributes: any;
    attachments?: Array<{ url: string; filename?: string }> | null;
    inboxId?: number | null; // bot 헤더 대체가 있으면 사용
}) {
    const endpoint = `${CHATWOOT_BASE}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${params.conversationId}/messages`;

    const payload = {
        content: params.content || " ",
        private: !!params.privateNote,
        message_type: "outgoing",
        content_attributes: params.content_attributes || {},
        attachments: undefined as any, // REST JSON 업로드는 생략(필요 시 multipart 구현)
    };

    const r = await fetch(endpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // 필요한 경우 api_access_token / bot header를 여기 추가
            ...(process.env.CW_API_TOKEN ? { api_access_token: process.env.CW_API_TOKEN } : {}),
        },
        body: JSON.stringify(payload),
    });

    if (!r.ok) throw new Error(`chatwoot_failed_${r.status}`);
    return r.json();
}

async function saveDraftForConfirm({
    tenantId,
    conversationId,
    content,
    mode,
    via,
    documentId,
}: {
    tenantId: string;
    conversationId: string;
    content: string;
    mode?: string | null;
    via?: string | null;
    documentId?: string | null;
}) {
    const docId = `${tenantId}_${conversationId}`;
    await db
        .collection("FAQ_realtime_cw")
        .doc(docId)
        .set(
            {
                chat_id: String(conversationId),
                tenant_id: String(tenantId),
                tenantId: String(tenantId),
                ai_draft: String(content || ""),
                draft_status: "pending_approval",
                draft_created_at: nowTs(),
                lastMessageAt: nowTs(),
                draft_metadata: {
                    blocked_at: new Date().toISOString(),
                    mode: mode || null,
                    via: via || null,
                    ...(documentId ? { document_id: documentId } : {}),
                },
            },
            { merge: true }
        );
}

export async function sendFinal(body: SendFinalBody) {
    const {
        conversationId,
        content = "",
        attachments = [],
        privateNote = false,
        instruction_mode = false,
        accountId: bodyAcc,
        inboxId: bodyInbox,
        tenantId: bodyTenant,
        via = "ai",
        mode = "auto",
        mediatedSource = null,
        sent_as = null,
        confirmBypass = false,
        documentId = null,
        channel = null,
    } = body;

    if (!conversationId || (!String(content).trim() && !(attachments?.length))) {
        throw new Error("conversationId and content/attachments required");
    }

    const convIdNum = Number(conversationId);
    if (!convIdNum) throw new Error("invalid conversationId");

    // ── STOP 게이트 (지침/프라이빗 제외) ──
    if (!instruction_mode && !privateNote) {
        if (await isStopped(String(conversationId))) {
            return { blocked: true, reason: "admin_stop" as const };
        }
    }

    // ── 모드/CONFIRM 게이트 ──
    let tenantId = bodyTenant || null;
    let cwInboxId = num(bodyInbox);
    let cwAccountId = num(bodyAcc) || CHATWOOT_ACCOUNT_ID;

    // 대화 정보로 보강(tenantId, 채널 등)
    try {
        const conv = await fetchCwConversation(convIdNum);
        if (conv?.custom_attributes?.tenantId && !tenantId) {
            tenantId = String(conv.custom_attributes.tenantId);
        }
        if (conv?.inbox_id && !cwInboxId) cwInboxId = num(conv.inbox_id);
    } catch { }

    const modeNow = await getEffectiveMode(tenantId, String(conversationId));

    const isAutoAi = via === "ai" && !instruction_mode && !privateNote;
    if (isAutoAi && !confirmBypass && modeNow === "CONFIRM" && tenantId) {
        await saveDraftForConfirm({
            tenantId,
            conversationId: String(conversationId),
            content,
            mode,
            via,
            documentId: documentId || undefined,
        });
        return { blocked: true, reason: "confirm_mode" as const };
    }

    // ── Chatwoot 전송 ──
    const content_attributes = buildContentAttributes({
        via,
        mode,
        mediatedSource,
        instruction_mode,
        documentId,
        confirmBypass,
        sent_as,
        channel,
    });

    const created = await sendToChatwoot({
        conversationId: convIdNum,
        content,
        privateNote,
        content_attributes,
        attachments,
        inboxId: cwInboxId || undefined,
    });

    const messageId =
        (created?.id && `cw:${created.id}`) ||
        (created?.external_id && `cw_ext:${created.external_id}`) ||
        `vercel:${conversationId}:${Date.now()}`;

    // ── Firestore 기록(리스트/상세용) ──
    if (tenantId) {
        const docRef = db.collection("FAQ_realtime_cw").doc(`${tenantId}_${conversationId}`);
        await docRef.set(
            {
                chat_id: String(conversationId),
                tenant_id: String(tenantId),
                tenantId: String(tenantId),
                lastMessageAt: nowTs(),
                messages: admin.firestore.FieldValue.arrayUnion({
                    sender: via === "agent" ? "agent" : instruction_mode ? "admin" : "ai",
                    text: String(content || ""),
                    timestamp: nowTs(),
                    private: !!privateNote,
                    msgId: messageId,
                }),
            },
            { merge: true }
        );
    }

    return {
        success: true as const,
        messageId,
        cw: { id: created?.id || null },
    };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

        // n8n에서 들어오는 요청은 헤더 토큰으로 보호(선택)
        const ok = await verifyN8NToken(req);
        if (!ok) return res.status(401).json({ error: "unauthorized" });

        const result = await sendFinal(req.body || {});
        return res.status(200).json(result);
    } catch (e: any) {
        console.error("[send-final] error:", e?.message || e);
        return res.status(500).json({ error: "internal_error", detail: e?.message || String(e) });
    }
}
