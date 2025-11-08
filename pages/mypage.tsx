// pages/mypage.tsx
import React, { useState } from "react";
import MyPageTabs from "@/components/mypage/MyPageTabs";

export default function MyPage() {
    const [data, setData] = useState<any>(undefined);
    const [library, setLibrary] = useState<any>(undefined);

    const handleSave = async (newData: any) => {
        // 데이터 저장
        setData(newData);
        // TODO: 서버에 저장하는 로직 추가
        console.log("Saving data:", newData);
    };

    const handleSaveLibrary = async (newLibrary: any) => {
        // 라이브러리 저장
        setLibrary(newLibrary);
        // TODO: 서버에 저장하는 로직 추가
        console.log("Saving library:", newLibrary);
    };

    return (
        <MyPageTabs
            tenantId="your-tenant-id"
            initialData={data}
            initialLibrary={library}
            templates={undefined}
            onSave={handleSave}
            onSaveLibrary={handleSaveLibrary}
        />
    );
}