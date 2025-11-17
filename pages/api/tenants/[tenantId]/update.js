// pages/api/tenants/[tenantId]/update.js
// ════════════════════════════════════════
// 테넌트 정보 업데이트 API (SettingsPage용)
// ════════════════════════════════════════

import admin, { db } from '@/lib/firebase-admin';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { tenantId } = req.query;

    if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
    }

    const {
        brandName,
        email,
        address,
        slack,
        naverAuthorization,
        // industry는 제외 (읽기 전용)
    } = req.body;

    try {
        const tenantRef = db.collection('tenants').doc(tenantId);

        // ✅ 업데이트할 데이터 구성
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        // 조건부 업데이트
        if (brandName !== undefined) updateData.brandName = brandName;
        if (email !== undefined) updateData.email = email;
        if (address !== undefined) updateData.address = address;
        if (naverAuthorization !== undefined) updateData.naverAuthorization = naverAuthorization;

        // Slack 정보
        if (slack !== undefined) {
            updateData.slack = {
                allowedUserIds: slack.allowedUserIds || [],
                defaultChannelId: slack.defaultChannelId || null,
                teamId: slack.teamId || null,
            };
        }

        await tenantRef.update(updateData);

        console.log(`✅ [Tenant Update] ${tenantId} 업데이트 완료`, {
            fields: Object.keys(updateData).filter(k => k !== 'updatedAt')
        });

        return res.status(200).json({
            success: true,
            message: '설정이 저장되었습니다.',
        });

    } catch (error) {
        console.error('❌ [Tenant Update] Error:', error);
        return res.status(500).json({
            error: '설정 저장 중 오류가 발생했습니다.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
}