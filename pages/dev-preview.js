// pages/dev-preview.js
import React from "react";
// import 확인하려는 컴포넌트 경로로 바꿔주세요
import MyComponent from "../components/ModularFAQBuilderV2.jsx";

export default function DevPreview() {
    const fakeProps = {
        // 컴포넌트가 필요로 하는 최소 props를 채움
        user: { name: "Dev Tester", id: "dev" },
        onSubmit: (v) => console.log("onSubmit:", v),
    };

    return (
        <div style={{ padding: 40, background: "#f7f7f8", minHeight: "100vh" }}>
            <h3 style={{ marginBottom: 20 }}>DEV PREVIEW — MyComponent</h3>
            <MyComponent {...fakeProps} />
        </div>
    );
}
