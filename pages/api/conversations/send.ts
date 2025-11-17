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

        const {
            tenantId,
            chatId,
            content,
            attachments,
            // 🔹 포탈에서 오는 선택 옵션들
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
                        // Note: public: true 옵션 제거 - uniform bucket-level access가 활성화된 경우 ACL 설정 불가
                        await file.save(buffer, {
                            metadata: {
                                contentType: att.type || 'application/octet-stream',
                                cacheControl: 'public, max-age=31536000',
                            },
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
            via: viaOverride || "agent",
            sent_as: sentAsOverride || "agent",
            tenantId: String(tenantId),
            mode: modeOverride || "agent_comment",
            confirmMode: !!confirmModeOverride,
            mediatedSource: mediatedSourceOverride || null,
            // 🔹 그대로 GCP로 전달
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

        // ✅ 전송 성공 시 슬랙 카드 축소 (confirmBypass가 true인 경우)
        if (confirmBypass) {
            try {
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.yamoo.ai.kr';
                const minimizeResponse = await fetch(`${baseUrl}/api/slack/minimize-card`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        tenantId: String(tenantId),
                        chatId: String(chatId),
                        minimizedBy: sentAsOverride === 'agent' ? 'agent' : 'confirm',
                        reason: modeOverride === 'confirm_approved' ? 'AI 답변 승인' :
                            modeOverride === 'confirm_edited' ? 'AI 답변 수정 후 전송' :
                                '상담원 답변',
                    }),
                });

                const minimizeResult = await minimizeResponse.json();
                console.log('[send.ts] Slack card minimized:', minimizeResult);
            } catch (minimizeError: any) {
                console.error('[send.ts] Failed to minimize slack card:', minimizeError);
                // 카드 축소 실패해도 메시지 전송은 성공
            }
        }

        return res.status(200).json({ ok: true, ...result });
    } catch (e: any) {
        console.error("[send.ts] Error:", e);
        return res.status(500).json({
            error: e?.message || "unknown error",
            stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
        });
    }
}