// components/ConversationsPage.jsx
// 리스트 화면: 채널/카테고리/라우팅(업무/비업무) 필터 + 카운터 표시
import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, ChevronDown, AlertCircle } from "lucide-react";
import ConversationCard from "./ConversationCard";
import ConversationDetail from "./ConversationDetail";

const CHANNELS = [
    { key: "all", label: "전체 채널" },
    { key: "naver", label: "Naver" },
    { key: "widget", label: "Widget" },
    { key: "kakao", label: "Kakao" },
    { key: "unknown", label: "기타" },
];

// 업무 라우팅(카드 생성/갱신/업그레이드) vs 비업무(Shadow/Skip)
const ROUTE_GROUPS = [
    { key: "all", label: "전체 라우팅" },
    { key: "work", label: "업무 필요" },     // create/update/upgrade
    { key: "passive", label: "자동/패시브" }, // shadow_create/shadow_update/skip
];

function cls(...xs) {
    return xs.filter(Boolean).join(" ");
}

export default function ConversationsPage({ tenantId, apiBase = "/api" }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState(null);
    const [error, setError] = useState(null);

    // 필터 상태
    const [q, setQ] = useState("");
    const [channel, setChannel] = useState("all");
    const [routeGroup, setRouteGroup] = useState("all");
    const [categoryPick, setCategoryPick] = useState("all");
    const [categoriesUniverse, setCategoriesUniverse] = useState([]);

    async function load() {
        setLoading(true);
        setError(null);

        try {
            const url = new URL(`${apiBase}/conversations/list`, location.origin);
            url.searchParams.set("tenant", tenantId || "");
            url.searchParams.set("region", "icn1");

            console.log(`[ConversationsPage] Fetching: ${url.toString()}`);

            const res = await fetch(url.toString(), { cache: "no-store" });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${res.status}`);
            }

            const json = await res.json();
            console.log(`[ConversationsPage] Response:`, json);

            if (!json.ok) {
                throw new Error(json.error || "API returned ok: false");
            }

            const arr = Array.isArray(json?.items) ? json.items : [];
            console.log(`[ConversationsPage] Loaded ${arr.length} items`);

            setItems(arr);

            // 화면에서 쓸 카테고리 풀 만들기
            const allCats = new Set();
            arr.forEach((it) => (it.categories || []).forEach((c) => allCats.add(c)));
            setCategoriesUniverse(["all", ...Array.from(allCats)]);
        } catch (e) {
            console.error("[ConversationsPage] Error:", e);
            setError(e.message || "데이터를 불러올 수 없습니다");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (tenantId) {
            load();
        }
    }, [tenantId]);

    const filtered = useMemo(() => {
        return items.filter((it) => {
            // 검색(이름/프리뷰)
            const hitQ =
                !q ||
                (it.title && it.title.includes(q)) ||
                (it.preview && it.preview.includes(q));

            // 채널
            const hitChannel = channel === "all" || (it.channel || "unknown") === channel;

            // 라우팅 그룹
            const cls = (it.routeClass || "passive").toLowerCase();
            const hitRoute =
                routeGroup === "all" ||
                (routeGroup === "work" && cls === "work") ||
                (routeGroup === "passive" && cls !== "work");

            // 카테고리
            const cats = Array.isArray(it.categories) ? it.categories : [];
            const hitCat = categoryPick === "all" || cats.includes(categoryPick);

            return hitQ && hitChannel && hitRoute && hitCat;
        });
    }, [items, q, channel, routeGroup, categoryPick]);

    return (
        <div className="p-4 max-w-3xl mx-auto">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-3">
                <div className="text-xl font-semibold">
                    대화 목록{tenantId ? <span className="text-slate-400"> · {tenantId}</span> : null}
                </div>
                <button
                    onClick={load}
                    disabled={loading}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[.98] transition disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    새로고침
                </button>
            </div>

            {/* 에러 표시 */}
            {error && (
                <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-sm text-red-700">
                        <div className="font-semibold">오류 발생</div>
                        <div className="mt-1">{error}</div>
                    </div>
                </div>
            )}

            {/* 검색 & 필터 바 */}
            <div className="flex flex-col gap-2 mb-3">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="이름, 메시지 내용 검색…"
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/80 border border-slate-200 outline-none focus:ring-2 ring-blue-500"
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {/* 채널 */}
                    <select
                        className="px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-sm"
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                    >
                        {CHANNELS.map((c) => (
                            <option key={c.key} value={c.key}>
                                {c.label}
                            </option>
                        ))}
                    </select>

                    {/* 라우팅 그룹 */}
                    <select
                        className="px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-sm"
                        value={routeGroup}
                        onChange={(e) => setRouteGroup(e.target.value)}
                    >
                        {ROUTE_GROUPS.map((r) => (
                            <option key={r.key} value={r.key}>
                                {r.label}
                            </option>
                        ))}
                    </select>

                    {/* 카테고리 */}
                    <select
                        className="px-3 py-2 rounded-xl bg-white/80 border border-slate-200 text-sm"
                        value={categoryPick}
                        onChange={(e) => setCategoryPick(e.target.value)}
                    >
                        {categoriesUniverse.map((c) => (
                            <option key={c} value={c}>
                                {c === "all" ? "전체 카테고리" : c}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 데이터 요약 정보 */}
            {!loading && !error && (
                <div className="mb-3 text-sm text-slate-500">
                    전체 {items.length}개 중 {filtered.length}개 표시
                </div>
            )}

            {/* 리스트 */}
            <div className="flex flex-col gap-3">
                {loading && (
                    <div className="text-center text-slate-500 py-12">불러오는 중…</div>
                )}

                {!loading && !error && filtered.length === 0 && items.length > 0 && (
                    <div className="text-center text-slate-400 py-12">
                        필터 조건에 맞는 대화가 없어요.
                    </div>
                )}

                {!loading && !error && items.length === 0 && (
                    <div className="text-center py-12">
                        <div className="text-slate-400 mb-2">표시할 대화가 없어요.</div>
                        <div className="text-sm text-slate-400">
                            데이터베이스에 대화 기록이 없거나<br />
                            tenant ID가 올바르지 않을 수 있습니다.
                        </div>
                    </div>
                )}

                {!loading &&
                    filtered.map((it) => (
                        <ConversationCard
                            key={it.id || `${it.chatId}-${it.lastMessageAt}`}
                            item={it}
                            onClick={() => setSelected(it)}
                        />
                    ))}
            </div>

            {/* 상세 모달 */}
            {selected && (
                <ConversationDetail
                    tenantId={tenantId}
                    id={selected.id}
                    chatId={selected.chatId}
                    apiBase={apiBase}
                    onClose={() => setSelected(null)}
                />
            )}
        </div>
    );
}