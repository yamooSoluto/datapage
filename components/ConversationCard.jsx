// components/ConversationCard.jsx
// 리스트 셀: 채널 태그, 라우팅(업무/패시브) 뱃지, 카테고리, 카운터(유저/AI/Agent)
import { MessageSquare, User2 } from "lucide-react";
import { Bot } from "lucide-react"; // Robot 대신 Bot 사용

const CHANNEL_LABEL = {
    naver: "Naver",
    widget: "Widget",
    kakao: "Kakao",
    unknown: "기타",
};

const ROUTE_BADGE = {
    create: { label: "create", tone: "work" },
    update: { label: "update", tone: "work" },
    upgrade: { label: "upgrade", tone: "work" },
    shadow_create: { label: "shadow", tone: "passive" },
    shadow_update: { label: "shadow", tone: "passive" },
    skip: { label: "skip", tone: "passive" },
};

function pill(cls, text) {
    return (
        <span
            className={
                "inline-flex items-center px-2 py-0.5 text-[11px] rounded-full border " +
                cls
            }
        >
            {text}
        </span>
    );
}

export default function ConversationCard({ item, onClick }) {
    const {
        title,
        preview,
        lastMessageAt,
        channel = "unknown",
        route,
        routeClass = "passive", // 'work' | 'passive'
        counts = { user: 0, ai: 0, agent: 0 },
        categories = [],
    } = item || {};

    const routeInfo = ROUTE_BADGE[route] || {
        label: routeClass === "work" ? "work" : "auto",
        tone: routeClass === "work" ? "work" : "passive",
    };

    const categoryChips = categories.slice(0, 2);

    return (
        <button
            onClick={onClick}
            className="w-full text-left bg-white/90 backdrop-blur rounded-2xl border border-slate-200 hover:border-slate-300 active:scale-[.997] transition shadow-sm"
        >
            <div className="p-4 flex gap-3">
                {/* 좌측 원형 썸네일 (업무 여부에 따라 테두리 톤만 달리) */}
                <div
                    className={
                        "w-11 h-11 shrink-0 rounded-full grid place-items-center text-white text-sm font-semibold " +
                        (routeClass === "work" ? "bg-indigo-500" : "bg-slate-400")
                    }
                    title={routeClass === "work" ? "업무 필요 라우팅" : "자동/패시브"}
                >
                    {(title || "·").slice(0, 1)}
                </div>

                <div className="flex-1 min-w-0">
                    {/* 1행: 제목 & 메타 */}
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">
                                {title || "제목 없음"}
                            </div>
                            <div className="mt-1 text-[13px] text-slate-500 truncate">
                                {preview || ""}
                            </div>
                        </div>

                        <div className="text-[12px] text-slate-400 whitespace-nowrap">
                            {lastMessageAt ? timeAgo(lastMessageAt) : ""}
                        </div>
                    </div>

                    {/* 2행: 태그 & 카운터 */}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {/* 채널 */}
                        {pill(
                            "border-slate-200 text-slate-600 bg-slate-50",
                            CHANNEL_LABEL[channel] || "기타"
                        )}

                        {/* 라우팅 뱃지(세련된 톤, 컬러 과하지 않게) */}
                        {pill(
                            routeInfo.tone === "work"
                                ? "border-indigo-200 text-indigo-700 bg-indigo-50"
                                : "border-slate-200 text-slate-600 bg-slate-50",
                            routeInfo.label
                        )}

                        {/* 카테고리(최대 2개 프리뷰) */}
                        {categoryChips.map((c) =>
                            pill("border-amber-200 text-amber-700 bg-amber-50", c)
                        )}

                        <div className="ml-auto flex items-center gap-4 text-[13px] text-slate-600">
                            <span className="inline-flex items-center gap-1">
                                <MessageSquare className="w-4 h-4" /> {counts.user ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Bot className="w-4 h-4" /> {counts.ai ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <User2 className="w-4 h-4" /> {counts.agent ?? 0}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </button>
    );
}

function timeAgo(iso) {
    try {
        const t = typeof iso === "number" ? iso : Date.parse(iso);
        const diff = Date.now() - t;
        const sec = Math.max(1, Math.floor(diff / 1000));
        if (sec < 60) return `${sec}초 전`;
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}분 전`;
        const hr = Math.floor(min / 60);
        if (hr < 24) return `${hr}시간 전`;
        const d = Math.floor(hr / 24);
        return `${d}일 전`;
    } catch {
        return "";
    }
}