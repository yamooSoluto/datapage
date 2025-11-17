// pages/api/tenants/policy.js
export const config = { runtime: 'nodejs' };

import admin, { db } from '@/lib/firebase-admin';
const VALID = new Set(['AUTO', 'CONFIRM', 'AGENT']);

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            const tenantId = String(req.query.tenantId || '').trim();
            if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

            // 1) 전역 모드 문서 우선
            const modeRef = db.collection('Conversation_Mode').doc(`${tenantId}_global`);
            const modeSnap = await modeRef.get();

            let mode = null, sticky = true, exists = false;
            if (modeSnap.exists) {
                const d = modeSnap.data() || {};
                exists = true;
                mode = (d.mode || 'CONFIRM').toString().toUpperCase();
                sticky = d.sticky !== false;
            }

            // 2) 테넌트 policy (보조 정보)
            const policyRef = db.collection('tenants').doc(tenantId);
            const policySnap = await policyRef.get();
            const policy = policySnap.exists ? (policySnap.data()?.policy || {}) : {};

            // effective
            const effectiveMode = mode || (policy.defaultMode ? String(policy.defaultMode).toUpperCase() : 'CONFIRM');
            const effectiveSticky = sticky || policy.confirmSticky === true;

            return res.status(200).json({
                ok: true,
                exists,
                mode: effectiveMode,
                sticky: effectiveSticky,
                raw: {
                    global: modeSnap.exists ? (modeSnap.data() || null) : null,
                    policy,
                }
            });
        }

        if (req.method === 'PATCH') {
            const { tenantId, defaultMode, sticky } = req.body || {};
            const tid = String(tenantId || '').trim();
            const m = String(defaultMode || '').toUpperCase();
            const st = (sticky === false) ? false : true;

            if (!tid) return res.status(400).json({ error: 'tenantId is required' });
            if (!VALID.has(m)) return res.status(400).json({ error: 'Invalid mode' });

            // 테넌트 존재 확인
            const tenantRef = db.collection('tenants').doc(tid);
            const tenantSnap = await tenantRef.get();
            if (!tenantSnap.exists) return res.status(404).json({ error: `Tenant not found: ${tid}` });

            const modeRef = db.collection('Conversation_Mode').doc(`${tid}_global`);

            // 기존 여부 파악 (createdAt 세팅용)
            const existing = await modeRef.get();
            const batch = db.batch();
            const now = admin.firestore.FieldValue.serverTimestamp();

            // 1) 테넌트 policy 동기화
            batch.set(tenantRef, {
                policy: { defaultMode: m, confirmSticky: st },
                updatedAt: now,
            }, { merge: true });

            // 2) 전역 모드 문서 업서트(멱등)
            const modeDoc = {
                tenantId: tid,
                sticky: st,
                mode: m,
                updatedAt: now,
                ...(existing.exists ? {} : { createdAt: now }),
            };
            batch.set(modeRef, modeDoc, { merge: true });

            await batch.commit();

            // (선택) convMode 캐시가 있다면 즉시 무효화 호출
            // try { await globalThis?.convMode?.invalidate?.(tid); } catch(_) {}

            return res.status(200).json({
                ok: true,
                mode: m,
                sticky: st,
                message: `전역 모드가 ${m}로 변경되었습니다`,
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (e) {
        console.error('[tenants/policy] error:', e);
        return res.status(500).json({ error: 'internal_error', detail: e?.message || String(e) });
    }
}
