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
// GCS 사용 시에도 base64 전송 단계에서 필요할 수 있음
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '20mb',
        }
    }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "POST") return res.status(405).end();

    try {
        // ✅ 디버깅: 요청 본문 요약 (큰 파일의 경우 전체 로그는 생략)
        console.log("[send.ts] Request body keys:", req.body ? Object.keys(req.body) : []);

        const { tenantId, chatId, content, attachments } = req.body || {};

        console.log("[send.ts] Parsed values:", {
            tenantId,
            chatId,
            chatIdType: typeof chatId,
            hasContent: !!content,
            contentLength: content?.length,
            attachmentsCount: attachments?.length || 0,
        });

        // ✅ 필수 파라미터 검증
        if (!tenantId || !chatId) {
            console.error("[send.ts] Missing required params:", { tenantId, chatId });
            return res.status(400).json({ error: "tenantId and chatId are required" });
        }

        // ✅ 텍스트 또는 첨부파일 중 하나는 있어야 함 (더 관대한 검증)
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

        // ✅ GCP 실제 라우트: /api/n8n/send-final
        const url = `${base}/api/n8n/send-final`;

        // ✅ 첨부파일 처리: base64 → GCS 업로드 → URL
        let processedAttachments: Array<{ url: string; filename?: string }> = [];

        if (hasAttachments) {
            console.log("[send.ts] Uploading attachments to GCS...");

            processedAttachments = await Promise.all(
                attachments.map(async (att) => {
                    try {
                        // base64 데이터를 Buffer로 변환
                        const buffer = Buffer.from(att.base64, 'base64');

                        // 파일명 생성 (타임스탬프 + 원본 파일명)
                        const timestamp = Date.now();
                        const sanitizedName = (att.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
                        const fileName = `conversations/${tenantId}/${timestamp}_${sanitizedName}`;

                        // GCS 버킷 참조
                        const bucket = storage.bucket(GCS_BUCKET_NAME);
                        const file = bucket.file(fileName);

                        // 파일 업로드
                        await file.save(buffer, {
                            metadata: {
                                contentType: att.type || 'application/octet-stream',
                                cacheControl: 'public, max-age=31536000',
                            },
                            public: true, // 공개 접근 허용
                        });

                        // 공개 URL 생성
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
                        throw new Error(`파일 업로드 실패: ${att.name || 'unknown'} - ${uploadError.message}`);
                    }
                })
            );

            console.log("[send.ts] All attachments uploaded:", processedAttachments.length);
        }

        const payload = {
            conversationId: String(chatId),
            content: String(content || ''), // ✅ 빈 문자열도 허용
            attachments: processedAttachments,
            via: "agent",
            sent_as: "agent",
            tenantId: String(tenantId),
            mode: "agent_comment",
            confirmMode: false,
            mediatedSource: "agent_comment",
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
                // ✅ 토큰 헤더 추가
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
                url: url
            });
        }

        const result = await r.json().catch(() => ({}));
        console.log("[send.ts] Success:", result);
        return res.status(200).json({ ok: true, ...result });
    } catch (e: any) {
        console.error("[send.ts] Error:", e);
        return res.status(500).json({
            error: e?.message || "unknown error",
            stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
        });
    }
}