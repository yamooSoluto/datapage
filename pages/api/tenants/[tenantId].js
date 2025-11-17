// pages/api/tenants/[tenantId].js
// ════════════════════════════════════════
// 테넌트 정보 조회 API
// ════════════════════════════════════════

import { db } from '@/lib/firebase-admin';

export default async function handler(req, res) {
    const { tenantId } = req.query;

    if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
    }

    try {
        // ✅ 테넌트 기본 정보 조회
        const tenantDoc = await db.collection('tenants').doc(tenantId).get();

        if (!tenantDoc.exists) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        const tenant = tenantDoc.data();

        // ✅ 응답 데이터 구성
        const response = {
            tenantId: tenantId,
            brandName: tenant.brandName || '',
            email: tenant.email || null,
            industry: tenant.industry || null,
            address: tenant.address || null,
            plan: tenant.plan || 'trial',
            status: tenant.status || 'active',
            branchNo: tenant.branchNo || '',

            // URLs
            widgetUrl: tenant.widgetUrl || `https://chat.yamoo.ai.kr/chat/${tenantId}`,
            naverInboundUrl: tenant.naverInboundUrl || `https://chat.yamoo.ai.kr/${tenantId}/naver/inbound`,
            naverAuthorization: tenant.naverAuthorization || '',

            // Slack
            slack: tenant.slack || {
                allowedUserIds: [],
                defaultChannelId: null,
                teamId: null,
            },

            // Subscription
            subscription: tenant.subscription || {
                plan: tenant.plan || 'trial',
                status: tenant.status || 'trialing',
                startedAt: tenant.createdAt || new Date().toISOString().split('T')[0],
                renewsAt: null,
            },

            // Onboarding
            onboardingCompleted: tenant.onboardingCompleted || false,
        };

        console.log(`✅ [Tenant API] ${tenantId} 조회 완료`);

        return res.status(200).json(response);

    } catch (error) {
        console.error('❌ [Tenant API] Error:', error);
        return res.status(500).json({
            error: '테넌트 정보 조회 중 오류가 발생했습니다.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
}