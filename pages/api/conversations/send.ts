// pages/api/conversations/send.ts
import type { NextApiRequest, NextApiResponse } from "next";
import * as admin from "firebase-admin";
import { Storage } from "@google-cloud/storage";

// ✅ Firebase Admin 초기화 (GCS 접근용)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
        }),
    });
}

// ✅ GCS 클라이언트 초기화
const storage = new Storage({
    projectId: process.env.FIREBASE_PROJECT_ID,
    credentials: {
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
        private_key: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    },
});

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME || "concentable-image-bucket";

// ✅ 이미지 파일 업로드를 위해 본문 크기 제한 증가 (20MB)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: "20mb",
        },
    },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        console.log("[send.ts] Request body keys:", req.body ? Object.keys(req.body) : []);

        const {
            tenantId,
            chatId,
            content,
            attachments,
            mode: modeOverride,
            via: viaOverride,
            sent_as: sentAsOverride,
            confirmMode: confirmModeOverride,
            confirmBypass,
            mediatedSource: mediatedSourceOverride,
            slackCleanup,
        } = req.body || {};

        console.log("[send.ts] Parsed values:", {
            tenantId,
            chatId,
            chatIdType: typeof chatId,
            hasContent: !!content,
            contentLength: content?.length,
            attachmentsCount: attachments?.length || 0,
        });

        if (!tenantId || !chatId) {
            console.error("[send.ts] Missing required params:", { tenantId, chatId });
            return res.status(400).json({ error: "tenantId and chatId are required" });
        }

        const hasText = content && String(content).trim().length > 0;
        const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

        if (!hasText && !hasAttachments) {
            console.error("[send.ts] No content or attachments");
            return res.status(400).json({ error: "content or attachments required" });
        }

        const base = (process.env.GCLOUD_BASE_URL || "").replace(/\/+$/, "");
        if (!base) {
            console.error("[send.ts] GCLOUD_BASE_URL not set");
            return res.status(500).json({ error: "GCLOUD_BASE_URL not set" });
        }

        const url = `${base}/api/n8n/send-final`;

        let processedAttachments: Array<{ url: string; filename?: string }> = [];

        if (hasAttachments) {
            console.log("[send.ts] Uploading attachments to GCS...");

            processedAttachments = await Promise.all(
                attachments.map(async (att: any) => {
                    try {
                        const buffer = Buffer.from(att.base64, "base64");
                        const timestamp = Date.now();
                        const sanitizedName = (att.name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
                        const fileName = `conversations/${tenantId}/${timestamp}_${sanitizedName}`;

                        const bucket = storage.bucket(GCS_BUCKET_NAME);
                        const file = bucket.file(fileName);

                        await file.save(buffer, {
                            metadata: {
                                contentType: att.type || "application/octet-stream",
                                cacheControl: "public, max-age=31536000",
                            },
                        });

                        const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${fileName}`;

                        console.log("[send.ts] Uploaded to GCS:", {
                            fileName,
                            size: buffer.length,
                            url: publicUrl,
                        });

                        return {
                            url: publicUrl,
                            filename: att.name || sanitizedName,
                        };
                    } catch (uploadError: any) {
                        console.error("[send.ts] GCS upload failed:", uploadError);
                        throw new Error(`파일 업로드 실패: ${att.name || "unknown"} - ${uploadError.message}`);
                    }
                })
            );

            console.log("[send.ts] All attachments uploaded:", processedAttachments.length);
        }

        const payload = {
            conversationId: String(chatId),
            content: String(content || ""),
            attachments: processedAttachments,
            via: viaOverride || "agent",
            sent_as: sentAsOverride || "agent",
            tenantId: String(tenantId),
            mode: modeOverride || "agent_comment",
            confirmMode: !!confirmModeOverride,
            mediatedSource: mediatedSourceOverride || null,
            confirmBypass: !!confirmBypass,
            slackCleanup: slackCleanup || null,
        };

        console.log("[send.ts] Sending to:", url);
        console.log("[send.ts] Payload summary:", {
            conversationId: payload.conversationId,
            contentLength: payload.content.length,
            attachmentsCount: processedAttachments.length,
            tenantId: payload.tenantId,
        });

        const r = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(process.env.N8N_PROXY_TOKEN ? { "x-n8n-token": process.env.N8N_PROXY_TOKEN } : {}),
            },
            body: JSON.stringify(payload),
        });

        console.log("[send.ts] Response status:", r.status);

        if (!r.ok) {
            const text = await r.text().catch(() => "");
            console.error("[send.ts] GCP error:", text);
            return res.status(502).json({
                error: `send-final failed: ${r.status}`,
                detail: text,
                url,
            });
        }

        const result = await r.json().catch(() => ({}));
        console.log("[send.ts] Success:", result);

        if (confirmBypass) {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.yamoo.ai.kr";
                const minimizeResponse = await fetch(`${baseUrl}/api/slack/minimize-card`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        tenantId: String(tenantId),
                        chatId: String(chatId),
                        minimizedBy: sentAsOverride === "agent" ? "agent" : "confirm",
                        reason:
                            modeOverride === "confirm_approved"
                                ? "AI 답변 승인"
                                : modeOverride === "confirm_edited"
                                ? "AI 답변 수정 후 전송"
                                : "상담원 답변",
                    }),
                });

                const minimizeResult = await minimizeResponse.json();
                console.log('[send.ts] Slack card minimized:', minimizeResult);
            } catch (minimizeError: any) {
                console.error('[send.ts] Failed to minimize slack card:', minimizeError);
            }
        }

        return res.status(200).json({ ok: true, ...result });
    } catch (e: any) {
        console.error("[send.ts] Error:", e);
        return res.status(500).json({
            error: e?.message || "unknown error",
            stack: process.env.NODE_ENV === "development" ? e?.stack : undefined,
        });
    }
}
