// pages/api/airtable/sync.ts
// Airtable 동기화 통합 API (데이터 준비 + n8n 전송) - 개선 버전

import { db } from '@/lib/firebase-admin';

// ✅ n8n 웹훅 URL: 환경변수 우선, 없으면 실제 경로로 전송
const N8N_WEBHOOK_URL =
    process.env.N8N_AIRTABLE_WEBHOOK_URL ||
    'https://soluto.app.n8n.cloud/webhook/criteria-sync';

export default async function handler(req: any, res: any) {
    // CORS 헤더 추가 (필요시)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONS 요청 처리
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId } = req.body;

        console.log('🔍 [Sync] Starting sync for tenant:', tenantId);

        if (!tenantId) {
            return res.status(400).json({ error: 'tenantId is required' });
        }

        // 1) Firestore에서 데이터 수집
        console.log('📊 [Sync] Fetching tenant data...');
        const tenantRef = db.collection('tenants').doc(tenantId);
        const tenantDoc = await tenantRef.get();

        if (!tenantDoc.exists) {
            console.error('❌ [Sync] Tenant not found:', tenantId);
            return res.status(404).json({ error: 'Tenant not found' });
        }

        // criteria 서브컬렉션에서 sheets 데이터 가져오기
        console.log('📊 [Sync] Fetching criteria sheets...');
        const criteriaDoc = await tenantRef.collection('criteria').doc('sheets').get();
        const criteriaSheetData = criteriaDoc.exists ? criteriaDoc.data() : null;

        if (!criteriaSheetData) {
            console.error('❌ [Sync] No criteria sheet data found');
            return res.status(404).json({ error: 'Criteria sheet data not found' });
        }

        console.log('✅ [Sync] Criteria sheets found:', {
            sheets: criteriaSheetData.sheets?.length || 0,
            hasItems: !!criteriaSheetData.items
        });

        // templates 데이터 가져오기 (meta 서브컬렉션)
        console.log('📊 [Sync] Fetching templates...');
        const templatesDoc = await tenantRef.collection('meta').doc('templates').get().catch(() => null);
        const templatesData = templatesDoc?.exists ? templatesDoc.data() : null;
        const templates = templatesData?.templates || null;

        console.log('✅ [Sync] Templates found:', templates ? Object.keys(templates).length : 0);

        // 2) criteriaSheets 구조로 변환
        const criteriaSheets: any = {};

        if (criteriaSheetData.sheets && criteriaSheetData.items) {
            criteriaSheetData.sheets.forEach((sheetId: string) => {
                const items = criteriaSheetData.items[sheetId] || [];
                let facets: any[] = [];

                // facets 우선순위: templates > criteriaSheetData.facets
                if (templates && templates[sheetId]?.facets) {
                    facets = templates[sheetId].facets;
                } else if (criteriaSheetData.facets?.[sheetId]) {
                    facets = criteriaSheetData.facets[sheetId];
                }

                criteriaSheets[sheetId] = {
                    template: {
                        title: templates?.[sheetId]?.title || sheetId,
                        facets
                    },
                    items,
                };

                console.log(`✅ [Sync] Sheet "${sheetId}": ${items.length} items, ${facets.length} facets`);
            });
        }

        // 3) library 수집 (서브컬렉션 우선)
        console.log('📊 [Sync] Fetching library data...');
        let library: any = {};

        try {
            const librarySnap = await tenantRef.collection('library').get();

            if (!librarySnap.empty) {
                console.log('✅ [Sync] Library found in subcollection');
                librarySnap.forEach(doc => {
                    const data = doc.data();
                    library[doc.id] = data.items || {};
                    console.log(`  - ${doc.id}: ${Object.keys(data.items || {}).length} items`);
                });
            } else {
                console.log('⚠️ [Sync] No library subcollection, falling back to tenant document');
                library = tenantDoc.data()?.library || {};
            }
        } catch (err) {
            console.error('⚠️ [Sync] Error fetching library, using fallback:', err);
            library = tenantDoc.data()?.library || {};
        }

        // 4) Airtable 포맷으로 가공
        console.log('🔄 [Sync] Converting to Airtable format...');
        const airtableData = prepareForAirtable(criteriaSheets, library, tenantId);

        console.log('✅ [Sync] Airtable data prepared:', {
            items: airtableData.items.length,
            questions: airtableData.totalQuestions,
            sheets: airtableData.summary.sheets
        });

        // 5) n8n 웹훅 호출
        console.log('📤 [Sync] Calling n8n webhook:', N8N_WEBHOOK_URL);

        const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'YAMU-Sync/1.0'
            },
            body: JSON.stringify(airtableData),
        });

        console.log('📥 [Sync] n8n response status:', n8nResponse.status);

        if (!n8nResponse.ok) {
            const errorText = await n8nResponse.text();
            console.error('❌ [Sync] n8n webhook failed:', {
                status: n8nResponse.status,
                statusText: n8nResponse.statusText,
                body: errorText
            });

            throw new Error(`n8n webhook failed: ${n8nResponse.status} ${n8nResponse.statusText}. Response: ${errorText}`);
        }

        const n8nResult = await n8nResponse.json().catch(() => ({ ok: true }));
        console.log('✅ [Sync] n8n webhook success:', n8nResult);

        return res.status(200).json({
            success: true,
            message: 'Airtable 동기화 완료',
            data: {
                totalItems: airtableData.items.length,
                totalQuestions: airtableData.totalQuestions,
                sheets: airtableData.summary.sheets,
                timestamp: airtableData.timestamp,
            },
            n8nResponse: n8nResult,
        });

    } catch (error: any) {
        console.error('❌ [Sync] Fatal error:', error);

        // 상세한 에러 정보 반환
        return res.status(500).json({
            error: 'Internal server error',
            message: error?.message || 'Unknown error',
            details: {
                name: error?.name,
                stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
            }
        });
    }
}


// ────────────────────────────────────────────────────────────
// Airtable 포맷으로 변환 (개선된 버전)
// ────────────────────────────────────────────────────────────

function prepareForAirtable(criteriaSheets: any, library: any, tenantId: string) {
    const items: any[] = [];
    let totalQuestions = 0;

    Object.entries(criteriaSheets || {}).forEach(([sheetId, sheetData]: any) => {
        const template = sheetData.template || {};
        const sheetTitle = template.title || sheetId;

        (sheetData.items || []).forEach((item: any) => {
            const airtableItem: any = {
                name: item.name,
                sheet: sheetTitle,
                fields: {},
                questions: []
            };

            // 각 facet을 Airtable 필드로 변환
            template.facets?.forEach((facet: any) => {
                const rawValue = item.facets?.[facet.key];

                // null, undefined, 빈 문자열 체크
                if (rawValue === null || rawValue === undefined || rawValue === '') {
                    return;
                }

                const label = facet.label;
                let displayValue = '';

                switch (facet.type) {
                    case 'checkbox':
                        // checkbox: true/false 처리
                        const isChecked = rawValue === 'true' || rawValue === true;
                        displayValue = isChecked ? '있음' : '없음';

                        if (isChecked) {
                            airtableItem.questions.push({
                                question: `${item.name}이(가) 있나요?`,
                                answer: '네, 있습니다',
                                category: '보유',
                                field: label
                            });
                        }
                        break;

                    case 'library-ref':
                        // 라이브러리 참조 처리
                        const libraryType = facet.libraryType || 'links';
                        const libraryItems = library?.[libraryType] || {};
                        const keys = String(rawValue).split(',').filter(Boolean);

                        const libraryLines: string[] = [];

                        keys.forEach((key: string) => {
                            const trimmedKey = key.trim();
                            const libItem = libraryItems[trimmedKey];

                            if (libItem) {
                                const displayLine = `${libItem.label}: ${libItem.value}`;
                                libraryLines.push(displayLine);

                                // 질문 생성
                                airtableItem.questions.push({
                                    question: `${item.name} ${libItem.label} 알려줘`,
                                    answer: libItem.value,
                                    category: label,
                                    field: label
                                });
                            }
                        });

                        if (libraryLines.length > 0) {
                            displayValue = libraryLines.join('\n');
                        }
                        break;

                    case 'multi':
                        // 멀티 셀렉트 처리
                        const multiValues = String(rawValue)
                            .split(',')
                            .filter(Boolean)
                            .map((v: string) => v.trim());

                        if (multiValues.length > 0) {
                            displayValue = multiValues.join(', ');

                            airtableItem.questions.push({
                                question: `${item.name}에서 ${label}이 어떻게 되나요?`,
                                answer: displayValue,
                                category: label,
                                field: label
                            });
                        }
                        break;

                    case 'single':
                    case 'textarea':
                    default:
                        // 일반 텍스트 필드 처리
                        displayValue = String(rawValue).trim();

                        if (displayValue && displayValue !== '필요없음' && displayValue !== 'N/A') {
                            airtableItem.questions.push({
                                question: `${item.name}의 ${label}은 무엇인가요?`,
                                answer: displayValue,
                                category: label,
                                field: label
                            });
                        }
                        break;
                }

                // displayValue가 있으면 fields에 추가
                if (displayValue) {
                    airtableItem.fields[label] = displayValue;
                }
            });

            // fullText 생성
            const fullTextParts = [
                `항목: ${item.name}`,
                `분류: ${sheetTitle}`
            ];

            Object.entries(airtableItem.fields).forEach(([k, v]) => {
                fullTextParts.push(`${k}: ${v}`);
            });

            airtableItem.fullText = fullTextParts.join('\n');

            // 질문이 있는 항목만 추가
            if (airtableItem.questions.length > 0 || Object.keys(airtableItem.fields).length > 0) {
                items.push(airtableItem);
                totalQuestions += airtableItem.questions.length;
            }
        });
    });

    const summary = {
        totalItems: items.length,
        sheets: [...new Set(items.map((i: any) => i.sheet))]
    };

    console.log('📊 [prepareForAirtable] Summary:', summary);

    return {
        tenantId,
        timestamp: new Date().toISOString(),
        items,
        totalQuestions,
        summary
    };
}