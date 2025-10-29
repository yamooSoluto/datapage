// components/ConversationsPage.jsx
// 리스트 화면: 채널/카테고리/라우팅(업무/비업무) 필터 + 카운터 표시
import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, ChevronDown } from "lucide-react";
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

    // 필터 상태
    const [q, setQ] = useState("");
    const [channel, setChannel] = useState("all");
    const [routeGroup, setRouteGroup] = useState("all");
    const [categoryPick, setCategoryPick] = useState("all"); // 단일 카테고리 필터(다중은 detail에서)
    const [categoriesUniverse, setCategoriesUniverse] = useState([]); // 백엔드 제공 목록 or 런타임 수집

    async function load() {
        setLoading(true);
        try {
            const url = new URL(`${apiBase}/list`, location.origin);
            url.searchParams.set("tenant", tenantId || "");
            url.searchParams.set("region", "icn1"); // vercel edge region hint (백엔드가 받으면 사용)
            // 카운터 기반 응답(list.js 최신 버전) 기대
            const res = await fetch(url.toString(), { cache: "no-store" });
            const json = await res.json();
            const arr = Array.isArray(json?.items) ? json.items : [];
            setItems(arr);

            // 화면에서 쓸 카테고리 풀 만들기
            const allCats = new Set();
            arr.forEach((it) => (it.categories || []).forEach((c) => allCats.add(c)));
            setCategoriesUniverse(["all", ...Array.from(allCats)]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
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
            const cls = (it.routeClass || "passive").toLowerCase(); // 'work' | 'passive'
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
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[.98] transition"
                >
                    <RefreshCw className="w-4 h-4" />
                    새로고침
                </button>
            </div>

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

            {/* 리스트 */}
            <div className="flex flex-col gap-3">
                {loading && (
                    <div className="text-center text-slate-500 py-12">불러오는 중…</div>
                )}

                {!loading && filtered.length === 0 && (
                    <div className="text-center text-slate-400 py-12">표시할 대화가 없어요.</div>
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
