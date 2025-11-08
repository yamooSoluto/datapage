// pages/api/airtable/prepare.ts
// Airtable 질문 데이터셋에 매핑하기 위한 데이터 준비

import { db } from '@/lib/firebase';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { tenantId } = req.body;

        if (!tenantId) {
            return res.status(400).json({ error: 'tenantId is required' });
        }

        // 1. criteriaSheets 가져오기
        const tenantRef = db.collection('tenants').doc(tenantId);
        const tenantDoc = await tenantRef.get();

        if (!tenantDoc.exists) {
            return res.status(404).json({ error: 'Tenant not found' });
        }

        const criteriaSheets = tenantDoc.data()?.criteriaSheets || {};

        // 2. library 가져오기 (서브컬렉션)
        const librarySnapshot = await tenantRef.collection('library').get();
        const library: any = {};

        librarySnapshot.forEach(doc => {
            library[doc.id] = doc.data().items || {};
        });

        // 3. Airtable용 데이터 준비
        const airtableData = prepareForAirtable(criteriaSheets, library, tenantId);

        res.status(200).json({
            success: true,
            data: airtableData
        });

    } catch (error) {
        console.error('Airtable prepare error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

// ────────────────────────────────────────────────────────────
// Airtable 포맷으로 변환
// ────────────────────────────────────────────────────────────

function prepareForAirtable(criteriaSheets: any, library: any, tenantId: string) {
    const items: any[] = [];

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
                if (!rawValue && rawValue !== false && rawValue !== 'false') return;

                const label = facet.label;
                let displayValue = '';

                switch (facet.type) {
                    case 'checkbox':
                        displayValue = (rawValue === 'true' || rawValue === true) ? '있음' : '없음';

                        // 체크박스 질문 생성
                        if (rawValue === 'true' || rawValue === true) {
                            airtableItem.questions.push({
                                question: `${item.name}이(가) 있나요?`,
                                answer: '네, 있습니다',
                                category: '보유',
                                field: label
                            });
                        }
                        break;

                    case 'library-ref':
                        // 라이브러리 참조 → "label: value" 형태
                        const libraryType = facet.libraryType || 'links';
                        const libraryItems = library?.[libraryType] || {};
                        const keys = String(rawValue).split(',').filter(Boolean);

                        const libraryLines: string[] = [];

                        keys.forEach((key: string) => {
                            const libItem = libraryItems[key];
                            if (libItem) {
                                libraryLines.push(`${libItem.label}: ${libItem.value}`);

                                // 질문 자동 생성
                                airtableItem.questions.push({
                                    question: `${item.name} ${libItem.label} 알려줘`,
                                    answer: libItem.value,
                                    category: label,
                                    field: label
                                });
                            }
                        });

                        displayValue = libraryLines.join('\n');
                        break;

                    case 'multi':
                        displayValue = String(rawValue)
                            .split(',')
                            .filter(Boolean)
                            .map((v: string) => v.trim())
                            .join(', ');

                        // 멀티셀렉 질문 생성
                        airtableItem.questions.push({
                            question: `${item.name}에서 ${label}이 어떻게 되나요?`,
                            answer: displayValue,
                            category: label,
                            field: label
                        });
                        break;

                    case 'single':
                    case 'textarea':
                    default:
                        displayValue = String(rawValue);

                        // 일반 필드 질문 생성
                        if (displayValue && displayValue !== '필요없음') {
                            airtableItem.questions.push({
                                question: `${item.name}의 ${label}은 무엇인가요?`,
                                answer: displayValue,
                                category: label,
                                field: label
                            });
                        }
                        break;
                }

                if (displayValue) {
                    airtableItem.fields[label] = displayValue;
                }
            });

            // 전체 텍스트 생성
            const fullTextParts = [
                `항목: ${item.name}`,
                `분류: ${sheetTitle}`
            ];

            Object.entries(airtableItem.fields).forEach(([k, v]) => {
                fullTextParts.push(`${k}: ${v}`);
            });

            airtableItem.fullText = fullTextParts.join('\n');

            items.push(airtableItem);
        });
    });

    return {
        tenantId,
        timestamp: new Date().toISOString(),
        items,
        totalQuestions: items.reduce((sum: number, item: any) => sum + item.questions.length, 0),
        summary: {
            totalItems: items.length,
            sheets: [...new Set(items.map((i: any) => i.sheet))]
        }
    };
}