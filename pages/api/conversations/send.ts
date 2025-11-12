// GCP: index.ts or routes.ts

import express from "express";
import axios from "axios";
const app = express();

// ✅ 첨부 base64가 커서 본문 제한 상향 (기존 100KB → 20MB)
app.post(
    "/api/n8n/send-final",
    express.json({ limit: "20mb", verify: (req: any, _res, buf) => (req.rawBody = buf) }),
    async (req, res) => {
        try {
            const {
                tenantId,
                conversationId,
                content = "",
                attachments = [],
                via = "agent",
                sent_as = "agent",
                // ...기존 필드 유지 (mode, confirmMode, mediatedSource, slackCleanup 등)
            } = req.body || {};

            if (!tenantId || !conversationId) {
                return res.status(400).json({ error: "tenantId and conversationId are required" });
            }

            // ✅ attachments 유연 파서: base64 | dataUrl | url 모두 허용
            type In = { name?: string; type?: string; size?: number; base64?: string; dataUrl?: string; url?: string };
            const input: In[] = Array.isArray(attachments) ? attachments.slice(0, 10) : [];

            const files = input.map((f, i) => {
                const name = f?.name || `file-${i + 1}`;
                const type = f?.type || "application/octet-stream";

                // URL 첨부 (서버 업로드 대신 외부 링크 첨부로 전달할 때)
                if (f?.url && /^https?:\/\//.test(f.url)) {
                    return { mode: "url" as const, name, type, url: f.url };
                }

                // base64 / dataUrl → Buffer
                let b64 = "";
                if (f?.base64) b64 = String(f.base64);
                else if (f?.dataUrl && f.dataUrl.startsWith("data:")) b64 = f.dataUrl.split(",")[1] || "";

                const buf = b64 ? Buffer.from(b64, "base64") : null;
                return { mode: "buffer" as const, name, type, buffer: buf };
            });

            const hasContent = (content || "").length > 0;
            const hasFiles = files.some((f) => (f as any).buffer || (f as any).url);

            // ✅ 내용 없이 첨부만도 허용
            if (!hasContent && !hasFiles) {
                return res.status(400).json({ error: "content or attachments required" });
            }

            // 사이즈 가드 (총 15MB)
            const totalBytes = files.reduce((s, f: any) => s + (f.buffer?.length || 0), 0);
            if (totalBytes > 15 * 1024 * 1024) {
                return res.status(413).json({ error: "attachments too large (limit ~15MB per request)" });
            }

            // ── Chatwoot 멀티파트 업로드 ─────────────────────────
            const CHATWOOT_BASE = process.env.CHATWOOT_BASE_URL || "";
            const CHATWOOT_ACCOUNT_ID = process.env.CHATWOOT_ACCOUNT_ID;
            const CW_TOKEN =
                process.env.CW_API_TOKEN ||
                process.env.CHATWOOT_TOKEN ||
                process.env.CHATWOOT_API_TOKEN;

            if (!CHATWOOT_BASE || !CHATWOOT_ACCOUNT_ID || !CW_TOKEN) {
                return res.status(500).json({ error: "Chatwoot ENV missing" });
            }

            const FormData = (await import("form-data")).default;
            const form = new FormData();

            // 내용은 비어도 허용
            form.append("content", content || "");

            for (const f of files) {
                if ((f as any).mode === "url") {
                    // 외부 URL 첨부를 Chatwoot content_attributes로 전달
                    form.append(
                        "content_attributes[external_attachments][]",
                        JSON.stringify({ type: "link", url: (f as any).url, name: f.name })
                    );
                } else if ((f as any).buffer) {
                    form.append("attachments[]", (f as any).buffer, {
                        filename: f.name,
                        contentType: f.type,
                    });
                }
            }

            const endpoint = `${CHATWOOT_BASE}/api/v1/accounts/${CHATWOOT_ACCOUNT_ID}/conversations/${encodeURIComponent(
                conversationId
            )}/messages`;

            const r = await axios.post(endpoint, form, {
                headers: { api_access_token: CW_TOKEN, ...form.getHeaders() },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });

            return res.status(200).json({
                ok: true,
                via,
                sent_as,
                data: r.data,
            });
        } catch (e: any) {
            console.error("[send-final] error:", e?.response?.data || e?.message || e);
            return res
                .status(e?.response?.status || 500)
                .json({ error: e?.message || "internal error", detail: e?.response?.data });
        }
    }
);
