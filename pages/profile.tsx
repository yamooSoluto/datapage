// pages/profile.tsx (예시 페이지)
import React from "react";
import CommaChips from "../components/CommaChips";

export default function ProfilePage() {
    const tenant = typeof window !== "undefined" ? new URLSearchParams(location.search).get("tenant") || "" : "";
    const [loading, setLoading] = React.useState(true);
    const [brandName, setBrandName] = React.useState("");
    const [slackUserId, setSlackUserId] = React.useState("");
    const [facilities, setFacilities] = React.useState<string[]>([]);
    const [passes, setPasses] = React.useState<string[]>([]);
    const [menu, setMenu] = React.useState<string[]>([]);

    React.useEffect(() => {
        (async () => {
            setLoading(true);
            const r = await fetch(`/api/profile?tenant=${encodeURIComponent(tenant)}`);
            const j = await r.json();
            setBrandName(j.brandName || "");
            setSlackUserId(j.slackUserId || "");
            setFacilities((j.dictionaries?.facilities || []).map((x: any) => x.name));
            setPasses((j.dictionaries?.passes || []).map((x: any) => x.name));
            setMenu((j.dictionaries?.menu || []).map((x: any) => x.name));
            setLoading(false);
        })();
    }, [tenant]);

    const save = async () => {
        const body = {
            brandName,
            slackUserId,
            facilities,
            passes,
            menu,
        };
        const r = await fetch(`/api/profile?tenant=${encodeURIComponent(tenant)}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        if (r.ok) alert("저장 완료!");
        else alert("저장 실패");
    };

    if (loading) return <div className="p-6">불러오는 중…</div>;

    return (
        <div className="p-6 space-y-6 max-w-2xl">
            <h1 className="text-xl font-semibold">마이페이지 기본 정보</h1>

            <div className="grid gap-3">
                <label className="text-sm">브랜드명</label>
                <input className="border rounded px-3 py-2" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
            </div>

            <div className="grid gap-3">
                <label className="text-sm">Slack User ID</label>
                <input className="border rounded px-3 py-2" value={slackUserId} onChange={(e) => setSlackUserId(e.target.value)} placeholder="U*********" />
                <p className="text-xs text-gray-500">DM/멘션 라우팅에 사용됩니다.</p>
            </div>

            <CommaChips label="시설" values={facilities} onChange={setFacilities} />
            <CommaChips label="이용권" values={passes} onChange={setPasses} />
            <CommaChips label="메뉴" values={menu} onChange={setMenu} />

            <button onClick={save} className="px-4 py-2 rounded bg-black text-white">저장</button>
        </div>
    );
}
