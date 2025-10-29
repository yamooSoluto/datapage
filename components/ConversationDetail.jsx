// components/ConversationDetail.jsx
// 상세 모달: 상단 메타(채널/라우팅/카테고리/카운터) + 대화 버블
import { useEffect, useMemo, useState } from "react";
import { X, Robot, User2, MessageSquare, Loader2 } from "lucide-react";

export default function ConversationDetail({
    tenantId,
    id,
    chatId,
    apiBase = "/api",
    onClose,
}) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const url = new URL(`${apiBase}/detail`, location.origin);
            if (id) url.searchParams.set("id", id);
            if (!id && chatId) url.searchParams.set("chatId", chatId);
            url.searchParams.set("tenant", tenantId || "");
            url.searchParams.set("region", "icn1");

            const res = await fetch(url.toString(), { cache: "no-store" });
            const json = await res.json();
            setData(json || {});
        } catch (e) {
            console.error(e);
            setData(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, [id, chatId, tenantId]);

    const meta = data?.meta || {};
    const counts = meta?.counts || { user: 0, ai: 0, agent: 0 };
    const cats = meta?.categories || [];

    return (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-end md:items-center justify-center p-3">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* 헤더 */}
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
                    <div className="font-semibold truncate">
                        {meta?.title || `대화 상세 (${chatId || id || ""})`}
                    </div>
                    <div className="ml-auto flex items-center gap-3 text-[13px] text-slate-600">
                        <span className="inline-flex items-center gap-1">
                            <MessageSquare className="w-4 h-4" />
                            {counts.user ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <Robot className="w-4 h-4" />
                            {counts.ai ?? 0}
                        </span>
                        <span className="inline-flex items-center gap-1">
                            <User2 className="w-4 h-4" />
                            {counts.agent ?? 0}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="ml-2 rounded-lg p-2 hover:bg-slate-50"
                        aria-label="닫기"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* 상단 메타 태그 */}
                <div className="px-4 py-2 flex items-center gap-2 flex-wrap border-b border-slate-100">
                    {meta?.channel ? (
                        <Tag tone="neutral">{meta.channel}</Tag>
                    ) : null}
                    {meta?.routeClass === "work" ? (
                        <Tag tone="indigo">{meta.route || "work"}</Tag>
                    ) : (
                        <Tag tone="neutral">{meta.route || "auto"}</Tag>
                    )}
                    {cats.slice(0, 6).map((c) => (
                        <Tag key={c} tone="amber">
                            {c}
                        </Tag>
                    ))}
                </div>

                {/* 바디: 메시지 버블 */}
                <div className="max-h-[70vh] overflow-y-auto p-4 space-y-3 bg-slate-50/40">
                    {loading && (
                        <div className="py-16 text-center text-slate-500">
                            <Loader2 className="w-5 h-5 inline-block animate-spin mr-2" />
                            불러오는 중…
                        </div>
                    )}
                    {!loading &&
                        (data?.messages || []).map((m, i) => (
                            <Bubble key={m.msgId || i} m={m} />
                        ))}
                    {!loading && (!data?.messages || data.messages.length === 0) && (
                        <div className="py-16 text-center text-slate-400">메시지가 없어요.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Tag({ tone = "neutral", children }) {
    const map = {
        neutral: "border-slate-200 text-slate-700 bg-white",
        amber: "border-amber-200 text-amber-700 bg-amber-50",
        indigo: "border-indigo-200 text-indigo-700 bg-indigo-50",
    };
    return (
        <span
            className={
                "inline-flex items-center px-2 py-[3px] text-[11px] rounded-full border " +
                (map[tone] || map.neutral)
            }
        >
            {children}
        </span>
    );
}

function Bubble({ m }) {
    const role = (m.sender || "").toLowerCase(); // 'user' | 'ai' | 'agent'
    const isMine = role === "user";
    const isAgent = role === "agent";
    const base =
        "max-w-[85%] px-3 py-2 rounded-2xl text-[14px] leading-relaxed shadow-sm";

    let cls =
        base +
        " " +
        (isMine
            ? "bg-white border border-slate-200"
            : isAgent
                ? "bg-indigo-50 border border-indigo-100"
                : "bg-slate-900 text-white");

    return (
        <div className={"flex " + (isMine ? "justify-start" : "justify-end")}>
            <div className="flex flex-col gap-1">
                {m.text ? <div className={cls}>{m.text}</div> : null}
                {Array.isArray(m.pics) && m.pics.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {m.pics.slice(0, 4).map((p, i) => (
                            <img
                                key={i}
                                src={p.url}
                                className="rounded-xl border border-slate-200"
                                alt=""
                            />
                        ))}
                    </div>
                ) : null}
                <div className="text-[11px] text-slate-400 pl-1">
                    {time(m.timestamp)}
                </div>
            </div>
        </div>
    );
}

function time(ts) {
    try {
        const d =
            typeof ts === "string"
                ? new Date(ts)
                : ts?.seconds
                    ? new Date(ts.seconds * 1000)
                    : ts?.toDate
                        ? ts.toDate()
                        : new Date(ts);
        return d.toLocaleString(undefined, {
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}
